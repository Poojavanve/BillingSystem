import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { brandApi, categoryApi, itemApi } from '../../api/endpoints';
import type { ItemListItem } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { PrintQuantityModal } from '../../components/pos/PrintQuantityModal';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { useBranchAutoSelect } from '../../hooks/useBranchAutoSelect';
import { useDebounce } from '../../hooks/useDebounce';
import { formatCurrency } from '../../utils/formatCurrency';

type BarcodeType = 'CODE128';
type LabelSizeValue = '50x25' | '50x38';

interface LabelOption {
  value: LabelSizeValue;
  label: string;
  /** Size of a single barcode tile - used for the on-screen preview and LABEL_TIERS scaling. */
  widthMm: number;
  heightMm: number;
  /** Physical label/print-job size. Equals width/heightMm unless itemsPerPage > 1. */
  pageWidthMm: number;
  pageHeightMm: number;
  /** How many tiles are grouped side by side onto one physical label when printing. */
  itemsPerPage: number;
  /** Whether the org/brand name row renders on this size - a size property, not a hardcoded check. */
  showOrganizationName: boolean;
}

interface LabelTierStyle {
  // 'stack': full label - org name / barcode / id / item name / sale price / MRP / branch name -
  // used on 50x38 stock, which is tall enough for all seven rows.
  // 'stackCompact': minimal label - item name / barcode / id only - used on 50x25 stock, which
  // only has 25mm of height so the price/MRP/org/branch rows are dropped.
  layout: 'stack' | 'stackCompact';
  paddingX: string;
  paddingY: string;
  gap: string;
  orgFontSize: string;
  itemFontSize: string;
  priceFontSize: string;
  mrpFontSize: string;
  idFontSize: string;
  barcodeHeight: number;
  barcodeWidth: number;
  barcodeFontSize: number;
}

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const tableHeadings = ['ITEM ID', 'ITEM NAME', 'PURCHASE PRICE', 'SALE PRICE', 'MRP', 'QTY'];
// Label stock currently supported by the printer setup.
const labelOptions: LabelOption[] = [
  { value: '50x38', label: '50 x 38mm', widthMm: 50, heightMm: 38, pageWidthMm: 50, pageHeightMm: 38, itemsPerPage: 1, showOrganizationName: true },
  { value: '50x25', label: '50 x 25mm', widthMm: 50, heightMm: 25, pageWidthMm: 50, pageHeightMm: 25, itemsPerPage: 1, showOrganizationName: false },
];

// All tiers let the stacked rows spread across the full label (see justify-between in
// BarcodePreview) so the printed content fills the whole physical label instead of clustering
// small in the middle. Fonts and barcode dimensions are sized up to match that larger footprint -
// bigger glyphs also survive the html2canvas raster + binarize step far better than the previous
// 5-9px text, which was breaking up into the faint/garbled print seen on the labels.
//
// Padding is deliberately asymmetric (taller top/bottom than left/right), based on actual test
// prints on this label printer: the barcode and the MRP/price line - both positioned in the
// vertical middle of the label - print crisp, while the org name (first row) and warehouse name
// (last row), sitting close to the top/bottom edges, printed garbled or nearly invisible. That
// points to a print-quality dead zone near the start/end of each label along the printer's feed
// direction (typical of small direct-thermal printers - the head needs a few mm past the gap
// sensor to reach full/even contact pressure), not a left/right margin problem. A bigger vertical
// quiet zone keeps text out of that zone; left/right can stay tighter since horizontal content
// (barcode, MRP/price) already prints fine right up to a modest margin.
const LABEL_PADDING_X = '1.5mm';
// Extra quiet zone on the trailing (right) edge only. Test prints show the same dead-zone effect
// documented above for the leading/trailing feed edges (paddingY) also shows up along the right
// edge of the label - text and barcode bars near the right edge print faint or get cut outright,
// while the left edge prints cleanly right up to LABEL_PADDING_X. Keeping left tight and pulling
// content further away from the right compensates without shrinking the usable width on both sides.
const LABEL_PADDING_X_RIGHT = '4.5mm';

const LABEL_TIERS: Record<LabelSizeValue, LabelTierStyle> = {
  // Landscape stock: 50mm wide, 38mm tall - enough room for all seven rows: org name / barcode /
  // id / item name / sale price / MRP / branch name.
  '50x38': {
    layout: 'stack',
    paddingX: LABEL_PADDING_X,
    // Reserve room around the complete stack so the edge text and barcode stay separated.
    paddingY: '3.5mm',
    gap: '0.7mm',
    orgFontSize: '9px',
    itemFontSize: '9px',
    priceFontSize: '7px',
    mrpFontSize: '7px',
    idFontSize: '9px',
    barcodeHeight: 36,
    barcodeWidth: 1.8,
    barcodeFontSize: 9,
  },
  // Landscape stock: 50mm wide, only 25mm tall - item name / barcode / id / price row.
  '50x25': {
    layout: 'stackCompact',
    paddingX: LABEL_PADDING_X,
    // Keep a 2mm quiet zone at both feed edges and use a compact, centered row stack.
    paddingY: '2mm',
    gap: '0.7mm',
    // Some fields are unused by the stackCompact layout, but required by LabelTierStyle.
    orgFontSize: '0px',
    itemFontSize: '9px',
    priceFontSize: '7px',
    mrpFontSize: '0px',
    idFontSize: '10px',
    barcodeHeight: 32,
    barcodeWidth: 2.0,
    barcodeFontSize: 9,
  },
};

// Native dot resolution of the label printer. Almost all direct-thermal label printers (TSC,
// Zebra GK/GC, Xprinter, etc.) are 203 DPI (8 dots/mm); a few are 300 DPI. The label PNG is
// rasterized at EXACTLY this resolution (html2canvas scale = DPI / 96, since a CSS px is 1/96in)
// so it can be printed 1:1 - one image pixel per printer dot - with no driver rescaling.
//
// Previously the page was rendered at scale 3 (= 288 DPI) and then forced to fit via
// scaleContent, which (a) printed ~40% oversized when mapped 1:1, causing each label to spill
// onto the next (the overlap/doubling), and (b) blurred everything when rescaled to fit. Matching
// the real DPI removes both problems. If your printer is a 300 DPI model, change this to 300.
const PREVIEW_SCALE = 2.1;

const itemCodeValue = (item: ItemListItem) => String(item.id);
const labelOptionByValue = (value: LabelSizeValue) => labelOptions.find((option) => option.value === value) || labelOptions[0];
const labelTextStyle = (fontSize: string): React.CSSProperties => ({
  fontSize,
  color: '#000000',
  fontWeight: 700,
  lineHeight: 1.05,
  fontFamily: 'Arial, Helvetica, sans-serif',
});

const BarcodeSvg = ({ value, type, tier, displayValue = true }: { value: string; type: BarcodeType; tier: LabelTierStyle; displayValue?: boolean }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: type,
        width: tier.barcodeWidth,
        height: tier.barcodeHeight,
        displayValue,
        fontSize: tier.barcodeFontSize,
        margin: 0,
        lineColor: '#000000',
        background: '#ffffff',
      });
      // Keep aspect ratio for barcode (do NOT stretch horizontally with preserveAspectRatio="none")
      // Code 39 must maintain proper bar proportions to be scannable
      svgRef.current.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    } catch {
      svgRef.current.replaceChildren();
    }
  }, [tier, type, value, displayValue]);

  return (
    <svg
      ref={svgRef}
      className="shrink-0"
      style={{ 
        height: tier.barcodeHeight,
        maxHeight: tier.barcodeHeight + (displayValue ? tier.barcodeFontSize : 0),
        width: '100%',
        maxWidth: '100%',
        shapeRendering: 'crispEdges',
      }}
    />
  );
};

const BarcodePreview = ({ item, type, label, organizationName, branchName }: { item: ItemListItem; type: BarcodeType; label: LabelOption; organizationName: string; branchName: string }) => {
  const value = itemCodeValue(item);
  const tier = LABEL_TIERS[label.value];
  // Padding on the outer container - horizontally balanced (paddingX both sides), but taller
  // top/bottom (paddingY) to keep text out of the print-quality dead zone near the label's
  // leading/trailing edge (see the dead-zone comment above LABEL_TIERS).
  const labelStyle: React.CSSProperties = {
    width: `${label.widthMm}mm`,
    height: `${label.heightMm}mm`,
    paddingTop: tier.paddingY,
    paddingBottom: tier.paddingY,
    paddingLeft: tier.paddingX,
    paddingRight: LABEL_PADDING_X_RIGHT,
  };
  // Barcode is rendered at its natural module proportions (NOT stretched to the label width) so
  // every bar/gap keeps the exact width ratio the scanner needs - stretching distorted the bars
  // into the unscannable, uneven-width print seen on the labels. It stays centered with a quiet
  // margin on each side (standard retail placement). Its own built-in number is turned off
  // (displayValue={false}) in favor of the dedicated human-readable code row below the bars.
  // QR stays square at its configured size.
  const codeElement = <BarcodeSvg value={value} type={type} tier={tier} displayValue={false} />;

  if (tier.layout === 'stackCompact') {
    // Compact layout for 50x25 stock - item name / barcode / MRP and sale price.
    return (
      <div
        className="barcode-label box-border flex shrink-0 flex-col items-center justify-between overflow-hidden rounded border border-dashed border-gray-300 bg-white text-center"
        style={{ ...labelStyle, gap: tier.gap, justifyContent: 'center' }}
        data-label-size={label.value}
      >
        {/* Item name */}
        <div className="w-full truncate px-1" style={labelTextStyle(tier.itemFontSize)}>
          Item Name: {item.itemName}
        </div>

        {/* Barcode */}
        <div className="w-full flex justify-center items-center px-2">{codeElement}</div>

        {/* Item number on its own centered row. */}
        <div style={labelTextStyle(tier.idFontSize)}>
          {value}
        </div>

        {/* Prices share the row below the item number. */}
        <div
          className="flex w-full items-center justify-center whitespace-nowrap"
          style={{ ...labelTextStyle(tier.priceFontSize), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2mm' }}
        >
          <span>MRP: ₹{item.mrp ?? 0}</span>
          <span>Sale Price: ₹{item.salePrice}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="barcode-label box-border flex shrink-0 flex-col items-center justify-between overflow-hidden rounded border border-dashed border-gray-300 bg-white text-center"
      style={{ ...labelStyle, gap: tier.gap, justifyContent: 'center' }}
      data-label-size={label.value}
    >
      {/* Organization name */}
      {label.showOrganizationName && (
        <div style={{ ...labelTextStyle(tier.orgFontSize), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          {organizationName}
        </div>
      )}

      {/* Barcode */}
      <div
        className="w-full flex justify-center items-center px-2"
        style={{ width: '100%', height: `${tier.barcodeHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}
      >
        {codeElement}
      </div>

      {/* Item number */}
      <div style={{ ...labelTextStyle(tier.idFontSize), flex: '0 0 auto', whiteSpace: 'nowrap' }}>
        {value}
      </div>

      {/* Item name */}
      <div className="w-full truncate px-1" style={{ ...labelTextStyle(tier.itemFontSize), flex: '0 0 auto' }}>
        Item Name: {item.itemName}
      </div>

      {/* Sale Price */}
      <div style={{ ...labelTextStyle(tier.priceFontSize), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        Sale Price: ₹{item.salePrice}
      </div>

      {/* MRP - item.mrp is optional on ItemListItem; fall back to 0 so the row never renders blank */}
      <div style={{ ...labelTextStyle(tier.mrpFontSize), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        MRP: ₹{item.mrp ?? 0}
      </div>

      {/* Branch Name */}
      <div style={{ ...labelTextStyle(tier.mrpFontSize), maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        Branch Name: {branchName}
      </div>
    </div>
  );
};

export const GenerateBarcodePage: React.FC = () => {
  const { user } = useAuth();
  const { branches } = useBranchAutoSelect();
  const { selectedBranchIds } = useBranch();
  const organizationName = user?.organizationName || '';
  const [labelSize, setLabelSize] = useState<LabelSizeValue>('50x38');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(0);
  const [brandId, setBrandId] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ItemListItem | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [generatedItem, setGeneratedItem] = useState<ItemListItem | null>(null);
  const [generatedType, setGeneratedType] = useState<BarcodeType>('CODE128');
  const [generatedCount, setGeneratedCount] = useState(0);
  const [showPrintQuantityModal, setShowPrintQuantityModal] = useState(false);
  const barcodeSectionRef = useRef<HTMLDivElement | null>(null);
  const debouncedSearch = useDebounce(search);

  const items = useQuery({
    queryKey: ['barcode-items', debouncedSearch, categoryId, brandId],
    queryFn: () => itemApi.getAll({
      page: 0,
      size: 20,
      search: debouncedSearch,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
    }),
  });
  const categories = useQuery({ queryKey: ['barcode-categories'], queryFn: () => categoryApi.getAll({ page: 0, size: 100, search: '' }) });
  const brands = useQuery({
    queryKey: ['barcode-brands', categoryId],
    queryFn: () => brandApi.getByCategoryId(categoryId),
    enabled: categoryId > 0,
  });

  const searchResults = items.data?.data?.content || [];
  const categoryOptions = (categories.data?.data?.content || []).map((category) => ({ id: category.id, label: category.name }));
  const brandOptions = (brands.data?.data?.content || []).map((brand) => ({ id: brand.id, label: brand.name }));
  const branchName = branches.filter((branch) => selectedBranchIds.includes(branch.id)).map((branch) => branch.branchName).join(', ') || 'N/A';
  const selectedLabel = labelOptionByValue(labelSize);

  const selectItem = (itemId: number) => {
    setSelectedItemId(itemId);
    const item = searchResults.find((entry) => entry.id === itemId) || null;
    setSelectedItem(item);
    setQuantity(1); // Default quantity (input removed)
    setGeneratedItem(null);
    setGeneratedCount(0);
  };

  useEffect(() => {
    setBrandId(0);
    setSelectedItemId(0);
    setSelectedItem(null);
    setGeneratedItem(null);
    setGeneratedCount(0);
  }, [categoryId]);

  useEffect(() => {
    setSelectedItemId(0);
    setSelectedItem(null);
    setGeneratedItem(null);
    setGeneratedCount(0);
  }, [brandId, debouncedSearch]);

  const generateCode = (type: BarcodeType) => {
    if (!selectedItem) {
      toast.error('Select an item first');
      return;
    }
    setGeneratedType(type);
    setGeneratedItem(selectedItem);
    // Generate 1 barcode by default (quantity input removed)
    setGeneratedCount(1);
  };

  const openBrowserPrintWindow = (tileHtml: string, labelCount: number) => {
    const labelPages = Array.from({ length: labelCount }, () => `
      <div class="label-page">
        ${tileHtml}
      </div>
    `).join('');
    const printableHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Barcode Labels</title>
          <script>
            window.addEventListener('load', function() {
              window.focus();
              window.print();
            });
          </script>
          <style>
            @page { size: ${selectedLabel.pageWidthMm}mm ${selectedLabel.pageHeightMm}mm; margin: 0; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              width: ${selectedLabel.pageWidthMm}mm;
              height: ${selectedLabel.pageHeightMm}mm;
              overflow: hidden;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 0;
              line-height: 0;
            }
            #print-root {
              margin: 0;
              padding: 0;
              width: ${selectedLabel.pageWidthMm}mm;
              overflow: hidden;
            }
            .label-page {
              box-sizing: border-box;
              width: ${selectedLabel.pageWidthMm}mm;
              height: ${selectedLabel.pageHeightMm}mm;
              display: block;
              overflow: hidden;
            }
            .label-page + .label-page { page-break-before: always; break-before: page; }
            /* The captured tile's markup carries the app's Tailwind utility class names, but this
               print document is a standalone page that never loads the app's Tailwind stylesheet -
               without these rules the classes are no-ops and the label falls back to default block
               layout (left-aligned, unstacked), not the centered/spread design shown on screen. */
            .box-border { box-sizing: border-box; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .shrink-0 { flex-shrink: 0; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .overflow-hidden { overflow: hidden; }
            .text-center { text-align: center; }
            .w-full { width: 100%; box-sizing: border-box; }
            .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .barcode-label {
              border: none !important;
              border-radius: 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-size: initial;
              line-height: normal;
            }
          </style>
        </head>
        <body>
          <div id="print-root">${labelPages}</div>
        </body>
      </html>
    `;

    // Default path: hidden iframe print to avoid popup-blocker dependency.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const cleanupIframe = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    };

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (frameDoc && iframe.contentWindow) {
      frameDoc.open();
      frameDoc.write(printableHtml);
      frameDoc.close();
      window.setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        cleanupIframe();
      }, 100);
      return;
    }

    // Fallback only if iframe document can't be initialized.
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!printWindow) throw new Error('Please allow pop-ups to print labels');
    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();
  };

  // Every copy of a given item/type/label is identical, so one already-rendered tile's markup
  // is replicated `quantity` times rather than requiring that many tiles to exist on screen -
  // the print quantity is asked for separately from whatever the preview happens to show.
  const sendLabelsToPrinter = async (quantity: number) => {
    const referenceNode = barcodeSectionRef.current?.querySelector<HTMLElement>('[data-label-size]');
    if (!generatedItem || !referenceNode) {
      toast.error('Generate barcode first');
      return;
    }
    try {
      const tileHtml = referenceNode.outerHTML;
      openBrowserPrintWindow(tileHtml, quantity);
      toast.success(`${quantity} label${quantity === 1 ? '' : 's'} opened in browser print`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to open print dialog');
    }
  };

  const handlePrint = () => {
    if (!generatedItem) {
      toast.error('Generate barcode first');
      return;
    }
    setShowPrintQuantityModal(true);
  };

  const confirmPrintQuantity = (quantity: number) => {
    setShowPrintQuantityModal(false);
    void sendLabelsToPrinter(quantity);
  };

  // Switching the label size no longer re-prints automatically since we're using browser print.

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Utilities &gt; Generate Barcode</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Generate Barcode</h1>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label className="flex-1 text-sm text-gray-600 min-w-[200px]">
              Category
              <select
                className={`${inputClass} mt-1`}
                value={categoryId}
                onChange={(event) => setCategoryId(Number(event.target.value))}
              >
                <option value={0}>{categories.isLoading ? 'Loading categories...' : 'All categories'}</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>

            <label className="flex-1 text-sm text-gray-600 min-w-[200px]">
              Brand
              <select
                className={`${inputClass} mt-1`}
                value={brandId}
                disabled={!categoryId || brands.isLoading}
                onChange={(event) => setBrandId(Number(event.target.value))}
              >
                <option value={0}>{!categoryId ? 'Select category first' : brands.isLoading ? 'Loading brands...' : 'All brands'}</option>
                {brandOptions.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.label}</option>
                ))}
              </select>
            </label>

            <label className="flex-1 text-sm text-gray-600 min-w-[200px]">
              Search
              <input
                className={`${inputClass} mt-1`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by item name"
              />
            </label>

            {(categoryId > 0 || brandId > 0 || search.trim()) && (
              <label className="flex-1 text-sm text-gray-600 min-w-[200px]">
                Item Name
                <select className={`${inputClass} mt-1`} value={selectedItemId} disabled={items.isLoading} onChange={(event) => selectItem(Number(event.target.value))}>
                  <option value={0}>{items.isLoading ? 'Loading items...' : 'Select item'}</option>
                  {searchResults.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.itemName} {item.sku ? `- ${item.sku}` : ''} (ID: {item.id})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex-1 text-sm text-gray-600 min-w-[150px]">
              Label Size
              <select className={`${inputClass} mt-1`} value={labelSize} onChange={(event) => setLabelSize(event.target.value as LabelSizeValue)}>
                {labelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <Button type="button" onClick={() => generateCode('CODE128')} className="h-10 shrink-0 whitespace-nowrap">Generate Barcode</Button>
          </div>

          {selectedItem && (
            <div className="w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {tableHeadings.map((heading) => (
                      <th key={heading} className="border bg-gray-50 p-2 text-left font-semibold text-gray-900 md:p-3">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-semibold text-gray-900 md:p-3">{selectedItem.id}</td>
                    <td className="border p-2 font-semibold text-gray-900 md:p-3">{selectedItem.itemName}</td>
                    <td className="border p-2 text-gray-700 md:p-3">{formatCurrency(selectedItem.purchasePrice || 0)}</td>
                    <td className="border p-2 text-gray-700 md:p-3">{formatCurrency(selectedItem.salePrice || 0)}</td>
                    <td className="border p-2 text-gray-700 md:p-3">{formatCurrency(selectedItem.mrp || 0)}</td>
                    <td className="border p-2 text-gray-700 md:p-3">{selectedItem.availableQty ?? 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {generatedItem && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="bg-white p-5">
            <div
              ref={barcodeSectionRef}
              className="grid gap-3 mb-5 justify-items-center"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${selectedLabel.widthMm * PREVIEW_SCALE}mm, 45%), 1fr))` }}
            >
            {Array.from({ length: 1 }).map((_, index) => (
              <div
                key={`${generatedItem.id}-${index}`}
                className="flex justify-center"
                style={{ width: `${selectedLabel.widthMm * PREVIEW_SCALE}mm`, height: `${selectedLabel.heightMm * PREVIEW_SCALE}mm` }}
              >
                <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                  <BarcodePreview item={generatedItem} type={generatedType} label={selectedLabel} organizationName={organizationName} branchName={branchName} />
                </div>
              </div>
            ))}
            </div>
            <div className="flex justify-end">
              <button type="button" className="inline-flex items-center gap-2 rounded border border-green-500 px-6 py-2 text-sm font-semibold text-green-600 hover:bg-green-50" onClick={handlePrint}>
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {items.isFetching && !items.isLoading && <div className="fixed bottom-5 right-5 rounded bg-white px-4 py-3 shadow"><Loader size="sm" /></div>}

      <PrintQuantityModal
        isOpen={showPrintQuantityModal}
        defaultQuantity={quantity || generatedCount || 1}
        onClose={() => setShowPrintQuantityModal(false)}
        onConfirm={confirmPrintQuantity}
      />
    </div>
  );
};
