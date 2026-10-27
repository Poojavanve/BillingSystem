import React, { useEffect, useMemo, useState } from 'react';
import { CirclePlus, IndianRupee, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { carrierApi, itemApi, paymentMethodApi, supplierApi, warehouseApi } from '../../../api/endpoints';
import type { PurchaseDetail, PurchaseRequest } from '../../../api/endpoints';
import { CountryStateSelect } from '../../../components/form/CountryStateSelect';
import { Button } from '../../../components/ui/Button';
import { NumericInput } from '../../../components/ui/NumericInput';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { useCreateFlowNavigation } from '../../../hooks/useCreateFlowNavigation';
import { useBranch } from '../../../hooks/useBranch';
import { hasSelectedId } from '../../../utils/validation';
import type { PurchasePaymentEntry } from '../../../types/api.types';

export interface PurchasePricingStockLine {
  itemId: number;
  itemName: string;
  categoryId: number;
  subCategoryId: number;
  brandId: number;
  hsnId: number;
  unitId: number;
  gstTaxability: string;
  gstRateId: number;
  cessRate: number;
  description: string;
  purchasePrice: number;
  purchasePriceWithTax: number;
  taxPercentage: number;
  profitMargin: number;
  mrp: number;
  salePrice: number;
  wholesalePrice: number;
  openingQuantity: number;
  minimumStock: number;
}

interface PurchasePaymentDraft {
  key: string;
  paymentMethodId: number;
  paymentDate: string;
  referenceNo: string;
  amount: number;
}

export type PurchaseSubmitPayload = PurchaseRequest & { requestCancel?: boolean };

interface Props {
  initial?: PurchaseRequest & {
    lines?: PurchasePricingStockLine[];
    purchaseNo?: string;
    status?: string;
    dueAmount?: number;
    paidAmount?: number;
    paymentHistory?: PurchaseDetail['payments'];
  };
  submitText: string;
  loading: boolean;
  onSubmit: (payload: PurchaseSubmitPayload) => void;
  onCancel: () => void;
}

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const tableInputClass = 'h-10 w-full !rounded-none !border-0 !bg-transparent !px-1 text-sm text-gray-900 focus:!bg-blue-50 focus:!ring-1 focus:!ring-blue-300';
const roundMoney = (value: number) => Math.round(value * 100) / 100;
type PurchaseLineValidationErrors = Partial<Record<
  'openingQuantity' | 'minimumStock' | 'purchasePrice' | 'mrp' | 'salePrice' | 'wholesalePrice',
  string
>>;

const validatePurchaseLine = (line: PurchasePricingStockLine): PurchaseLineValidationErrors => {
  const errors: PurchaseLineValidationErrors = {};
  if (!Number.isInteger(line.openingQuantity) || line.openingQuantity <= 0) errors.openingQuantity = 'Enter a positive whole quantity.';
  if (line.minimumStock < 0) errors.minimumStock = 'Minimum stock cannot be negative.';
  if (line.purchasePrice <= 0) errors.purchasePrice = 'Enter a purchase price greater than 0.';
  if (line.mrp <= 0) errors.mrp = 'Enter an MRP greater than 0.';
  if (line.salePrice <= 0) errors.salePrice = 'Enter a sale price greater than 0.';
  else if (line.purchasePrice > 0 && line.mrp > 0 && (line.salePrice < line.purchasePrice || line.salePrice > line.mrp)) {
    errors.salePrice = 'Sale price must be between purchase price and MRP.';
  }
  if (line.wholesalePrice <= 0) errors.wholesalePrice = 'Enter a wholesale price greater than 0.';
  else if (line.purchasePrice > 0 && line.mrp > 0 && (line.wholesalePrice < line.purchasePrice || line.wholesalePrice > line.mrp)) {
    errors.wholesalePrice = 'Wholesale price must be between purchase price and MRP.';
  }
  return errors;
};

const blankLine = (): PurchasePricingStockLine => ({
  itemId: 0,
  itemName: '',
  categoryId: 0,
  subCategoryId: 0,
  brandId: 0,
  hsnId: 0,
  unitId: 0,
  gstTaxability: 'TAXABLE',
  gstRateId: 0,
  cessRate: 0,
  description: '',
  purchasePrice: 0,
  purchasePriceWithTax: 0,
  taxPercentage: 0,
  profitMargin: 0,
  mrp: 0,
  salePrice: 0,
  wholesalePrice: 0,
  openingQuantity: 0,
  minimumStock: 0,
});

const createPaymentDraft = (paymentDate: string): PurchasePaymentDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  paymentMethodId: 0,
  paymentDate,
  referenceNo: '',
  amount: 0,
});

const isPaymentActive = (payment: PurchasePaymentDraft) =>
  payment.paymentMethodId > 0
  || payment.amount > 0
  || payment.referenceNo.trim().length > 0;

const isLineFilled = (line: PurchasePricingStockLine) =>
  line.itemId > 0 && line.openingQuantity > 0 && line.mrp > 0 && line.purchasePrice > 0 && line.salePrice > 0 && line.wholesalePrice > 0;

const isTaxableLine = (line: PurchasePricingStockLine) => line.gstTaxability === 'TAXABLE';

const lineGrandTotal = (line: PurchasePricingStockLine) => {
  const grossAmount = line.openingQuantity * line.purchasePrice;
  if (!isTaxableLine(line)) {
    return roundMoney(grossAmount);
  }
  const taxAmount = grossAmount * ((line.taxPercentage || 0) / 100);
  const cessAmount = grossAmount * ((line.cessRate || 0) / 100);
  return roundMoney(grossAmount + taxAmount + cessAmount);
};

export const PurchaseForm: React.FC<Props> = ({ initial, submitText, loading, onSubmit, onCancel }) => {
  const { navigateToCreate } = useCreateFlowNavigation('/purchase');
  const { selectedBranchId } = useBranch();
  const today = new Date().toISOString().slice(0, 10);
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId || 0);
  const [supplierId, setSupplierId] = useState(initial?.supplierId || 0);
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate || today);
  const [referenceNo] = useState(initial?.referenceNo || '');
  const [carrierId, setCarrierId] = useState(initial?.carrierId || 0);
  const [stateId, setStateId] = useState(initial?.stateId || 0);
  const [notes] = useState(initial?.notes || '');
  const [lines, setLines] = useState<PurchasePricingStockLine[]>(initial?.lines || []);
  const [purchaseStatus, setPurchaseStatus] = useState(initial?.status || 'CREATED');
  const [roundOff, setRoundOff] = useState(Number(initial?.roundOff || 0) !== 0);
  const [payments, setPayments] = useState<PurchasePaymentDraft[]>(() => [createPaymentDraft(initial?.purchaseDate || today)]);
  const [paymentNote, setPaymentNote] = useState('');
  const [loadingLineIndex, setLoadingLineIndex] = useState<number | null>(null);

  const suppliers = useQuery({ queryKey: ['purchase-form-suppliers'], queryFn: () => supplierApi.getAll({ page: 0, size: 100, search: '' }) });
  const carriers = useQuery({ queryKey: ['purchase-form-carriers', selectedBranchId], queryFn: () => carrierApi.getAll({ page: 0, size: 100, search: '' }), enabled: selectedBranchId !== null, retry: false });
  const items = useQuery({ queryKey: ['purchase-form-items'], queryFn: () => itemApi.getAll({ page: 0, size: 100, search: '' }) });
  const warehouses = useQuery({ queryKey: ['purchase-form-warehouses', selectedBranchId], queryFn: () => warehouseApi.getAll(), enabled: selectedBranchId !== null });
  const paymentMethods = useQuery({
    queryKey: ['purchase-form-payment-methods', selectedBranchId],
    queryFn: () => paymentMethodApi.getAll(''),
    enabled: selectedBranchId !== null,
  });
  const currentStatus = initial?.status || '';

  const supplierOptions = useMemo(() => (suppliers.data?.data?.content || []).map((supplier) => ({ id: supplier.id, label: supplier.supplierName })), [suppliers.data]);
  const carrierOptions = useMemo(() => (carriers.data?.data?.content || []).map((carrier) => ({ id: carrier.id, label: carrier.name })), [carriers.data]);
  const itemOptions = useMemo(() => (items.data?.data?.content || []).map((item) => ({ id: item.id, label: item.itemName })), [items.data]);
  const warehouseOptions = useMemo(() => (warehouses.data?.data || []).map((warehouse) => ({ id: warehouse.id, label: warehouse.name })), [warehouses.data]);
  const paymentMethodOptions = useMemo(
    () => (paymentMethods.data?.data?.content || []).filter((method) => method.status === 'ACTIVE'),
    [paymentMethods.data],
  );
  const usedItemIds = useMemo(() => new Set(lines.map((line) => line.itemId).filter(Boolean)), [lines]);
  const paymentHistory = initial?.paymentHistory || [];
  const existingPaidAmount = useMemo(
    () => initial?.paidAmount ?? paymentHistory.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [initial?.paidAmount, paymentHistory],
  );
  const statusOptions = useMemo(() => {
    if (currentStatus === 'CONFIRMED') {
      return [
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ];
    }
    if (currentStatus === 'CANCELLED') {
      return [{ value: 'CANCELLED', label: 'Cancelled' }];
    }
    if (currentStatus === 'CREATED') {
      return [
        { value: 'CREATED', label: 'Created' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ];
    }
    return [
      { value: 'CREATED', label: 'Created' },
      { value: 'CONFIRMED', label: 'Confirmed' },
    ];
  }, [currentStatus]);

  useEffect(() => {
    setLines((current) => {
      const last = current[current.length - 1];
      if (!last || isLineFilled(last)) {
        return [...current, blankLine()];
      }
      return current;
    });
  }, [lines]);

  const updateLine = (index: number, patch: Partial<PurchasePricingStockLine>) => {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  };

  const setLinePurchasePrice = (index: number, value: number) => {
    setLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, purchasePrice: value };
      if (value > 0 && line.profitMargin > 0) {
        const computed = roundMoney(value + (value * line.profitMargin) / 100);
        next.salePrice = computed;
        next.wholesalePrice = computed;
      }
      return next;
    }));
  };

  const setLineSalePrice = (index: number, value: number) => {
    updateLine(index, { salePrice: value });
  };

  const setLineWholesalePrice = (index: number, value: number) => {
    updateLine(index, { wholesalePrice: value });
  };

  const updatePayment = (key: string, patch: Partial<PurchasePaymentDraft>) => {
    setPayments((current) => current.map((payment) => payment.key === key ? { ...payment, ...patch } : payment));
  };

  const removePayment = (key: string) => {
    setPayments((current) => current.length === 1
      ? [createPaymentDraft(purchaseDate)]
      : current.filter((payment) => payment.key !== key));
  };

  const selectLineItem = async (index: number, itemId: number) => {
    if (!itemId) {
      updateLine(index, blankLine());
      return;
    }
    const item = items.data?.data?.content.find((entry) => entry.id === itemId);
    if (!item) return;
    setLoadingLineIndex(index);
    try {
      const response = await itemApi.getById(itemId);
      const detail = response.data;
      updateLine(index, {
        itemId: item.id,
        itemName: detail?.itemName || item.itemName,
        categoryId: detail?.categoryId || 0,
        subCategoryId: detail?.subCategoryId || 0,
        brandId: detail?.brandId || 0,
        hsnId: detail?.hsnId || 0,
        unitId: detail?.unitId || 0,
        gstTaxability: detail?.gstTaxability || 'TAXABLE',
        gstRateId: detail?.gstRateId || 0,
        cessRate: detail?.cessRate || 0,
        description: detail?.description || '',
        purchasePrice: detail?.purchasePrice || 0,
        purchasePriceWithTax: detail?.purchasePriceWithTax || 0,
        taxPercentage: detail?.gstTaxability === 'TAXABLE' ? Number(detail?.gstRate ?? detail?.taxPercentage ?? 0) : 0,
        profitMargin: detail?.profitMargin || 0,
        mrp: detail?.mrp || 0,
        salePrice: detail?.salePrice || 0,
        wholesalePrice: detail?.wholesalePrice || 0,
        openingQuantity: 0,
        minimumStock: detail?.minimumStock || 0,
      });
    } catch {
      toast.error('Failed to load item details.');
    } finally {
      setLoadingLineIndex(null);
    }
  };

  useEffect(() => {
    setPayments((current) => current.map((payment) => ({ ...payment, paymentDate: purchaseDate })));
  }, [purchaseDate]);

  useEffect(() => {
    if (!warehouseId && warehouseOptions.length > 0) {
      setWarehouseId(warehouseOptions[0].id);
    }
  }, [warehouseId, warehouseOptions]);

  const validatePayment = (payment: PurchasePaymentDraft) => {
    const errors: Partial<Record<'paymentMethodId' | 'paymentDate' | 'amount', string>> = {};
    if (!payment.paymentMethodId) errors.paymentMethodId = 'Select a payment type.';
    if (!payment.paymentDate) errors.paymentDate = 'Select a payment date.';
    if (payment.amount <= 0) errors.amount = 'Enter an amount greater than 0.';
    return errors;
  };

  const realLines = lines.filter((line) => line.itemId > 0);
  const grandTotal = useMemo(() => realLines.reduce((sum, line) => sum + lineGrandTotal(line), 0), [realLines]);
  const finalGrandTotal = roundOff ? Math.round(grandTotal) : grandTotal;
  const activePayments = useMemo(() => payments.filter(isPaymentActive), [payments]);
  const totalNewPayments = useMemo(() => activePayments.reduce((sum, payment) => sum + payment.amount, 0), [activePayments]);
  const totalPaid = roundMoney(existingPaidAmount + totalNewPayments);
  const remainingAmount = roundMoney(finalGrandTotal - totalPaid);
  const hasPaymentOverflow = remainingAmount < 0;
  const isCancellationOnly = Boolean(currentStatus && currentStatus !== 'CANCELLED' && purchaseStatus === 'CANCELLED');
  const isCancelledPurchase = currentStatus === 'CANCELLED';
  const canSubmit = isCancellationOnly || (
    !isCancelledPurchase
    && Boolean(supplierId)
    && hasSelectedId(warehouseId)
    && realLines.length > 0
    && loadingLineIndex === null
    && realLines.every((line) => Object.keys(validatePurchaseLine(line)).length === 0)
    && activePayments.every((payment) => Object.keys(validatePayment(payment)).length === 0)
    && !hasPaymentOverflow
  );

  const submit = () => {
    if (currentStatus && currentStatus !== 'CANCELLED' && purchaseStatus === 'CANCELLED') {
      onSubmit({
        supplierId,
        purchaseDate,
        referenceNo,
        warehouseId,
        carrierId,
        stateId,
        notes,
        status: purchaseStatus,
        payments: [],
        items: [],
        requestCancel: true,
      });
      return;
    }
    if (!supplierId || !realLines.length) {
      toast.error('Select supplier and at least one item.');
      return;
    }
    const firstLineError = realLines
      .map(validatePurchaseLine)
      .flatMap((errors) => Object.values(errors))
      .find(Boolean);
    if (firstLineError) {
      toast.error(firstLineError);
      return;
    }
    const firstPaymentError = activePayments
      .map(validatePayment)
      .flatMap((errors) => Object.values(errors))
      .find(Boolean);
    if (firstPaymentError) {
      toast.error(firstPaymentError);
      return;
    }
    if (hasPaymentOverflow) {
      toast.error('Total paid amount cannot exceed the grand total.');
      return;
    }
    onSubmit({
      supplierId,
      purchaseDate,
      referenceNo,
      warehouseId,
      carrierId,
      stateId,
      notes,
      status: purchaseStatus,
      roundOff: roundMoney(finalGrandTotal - grandTotal),
      payments: activePayments.map((payment) => ({
        paymentMethodId: payment.paymentMethodId,
        paymentDate: payment.paymentDate,
        referenceNo: payment.referenceNo,
        amount: payment.amount,
        notes: paymentNote,
      })),
      items: realLines.map((line) => ({
        itemId: line.itemId,
        batchNo: 'BATCH',
        manufacturingDate: today,
        expiryDate: today,
        quantity: line.openingQuantity,
        unitPrice: line.purchasePrice,
        mrp: line.mrp,
        salePrice: line.salePrice,
        wholesalePrice: line.wholesalePrice,
        discountPercent: 0,
        taxPercent: isTaxableLine(line) ? line.taxPercentage : 0,
      })),
    });
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Purchase Details</h1></div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <label className="text-sm text-gray-600">Supplier
          <div className="mt-1 flex">
            <SearchableSelect
              className="rounded-r-none"
              value={supplierId}
              options={supplierOptions}
              onChange={setSupplierId}
              isLoading={suppliers.isLoading}
              placeholder="Search supplier"
            />
            <button
              type="button"
              title="Create supplier"
              aria-label="Create supplier"
              onClick={() => navigateToCreate('/contacts/suppliers/create')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"
            >
              <CirclePlus size={17} />
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-600">Warehouse
          <SearchableSelect
            className="mt-1"
            value={warehouseId}
            options={warehouseOptions}
            onChange={setWarehouseId}
            isLoading={warehouses.isLoading}
            placeholder="Select warehouse"
          />
        </label>
        <label className="text-sm text-gray-600">Shipping Carrier
          <SearchableSelect
            className="mt-1"
            value={carrierId}
            options={carrierOptions}
            onChange={setCarrierId}
            isLoading={carriers.isLoading}
            placeholder="Search shipping carrier"
          />
        </label>
        <label className="text-sm text-gray-600">Date
          <input type="date" className={`${inputClass} mt-1`} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
        </label>

        <CountryStateSelect stateId={stateId} onStateChange={setStateId} className={inputClass} />
        <label className="text-sm text-gray-600">Status
          <select
            className={`${inputClass} mt-1`}
            value={purchaseStatus}
            disabled={isCancelledPurchase}
            onChange={(event) => setPurchaseStatus(event.target.value)}
          >
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="border-y px-5 py-4"><h2 className="text-lg font-semibold">Items</h2></div>
      <div className="overflow-x-auto overflow-y-visible px-3 pb-3 pt-3">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Item', 'Quantity', 'MRP', 'Purchase Price', 'GST %', 'Cess %', 'Sale Price', 'Wholesale Price', ''].map((heading) => (
                <th key={heading} className="border p-3 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.itemId > 0 ? line.itemId : `draft-${index}`} className="border-b even:bg-gray-50">
                <td className="min-w-[220px] border p-3">
                  <div className="relative">
                    <SearchableSelect
                      value={line.itemId}
                      options={itemOptions.filter((option) => option.id === line.itemId || !usedItemIds.has(option.id))}
                      onChange={(id) => selectLineItem(index, id)}
                      isLoading={loadingLineIndex === index}
                      loadingPlaceholder="Loading item..."
                      placeholder="Search item/brand name"
                      dropdownPortal
                    />
                  </div>
                </td>
                <td className="border p-3">
                  <NumericInput integer min={1} className={tableInputClass} value={line.openingQuantity || ''} error={line.itemId > 0 ? validatePurchaseLine(line).openingQuantity : undefined} onValueChange={(value) => updateLine(index, { openingQuantity: Math.trunc(value) })} />
                </td>
                <td className="border p-3">
                  <NumericInput min={0} className={tableInputClass} value={line.mrp || ''} error={line.itemId > 0 ? validatePurchaseLine(line).mrp : undefined} onValueChange={(value) => updateLine(index, { mrp: value })} />
                </td>
                <td className="border p-3">
                  <NumericInput min={0} className={tableInputClass} value={line.purchasePrice || ''} error={line.itemId > 0 ? validatePurchaseLine(line).purchasePrice : undefined} onValueChange={(value) => setLinePurchasePrice(index, value)} />
                </td>
                <td className="border p-3 text-sm text-gray-700">
                  {line.itemId > 0 && isTaxableLine(line) ? line.taxPercentage.toFixed(2) : '0.00'}
                </td>
                <td className="border p-3 text-sm text-gray-700">
                  {line.itemId > 0 && isTaxableLine(line) ? line.cessRate.toFixed(2) : '0.00'}
                </td>
                <td className="border p-3">
                  <NumericInput min={0} className={tableInputClass} value={line.salePrice || ''} error={line.itemId > 0 ? validatePurchaseLine(line).salePrice : undefined} onValueChange={(value) => setLineSalePrice(index, value)} />
                </td>
                <td className="border p-3">
                  <NumericInput min={0} className={tableInputClass} value={line.wholesalePrice || ''} error={line.itemId > 0 ? validatePurchaseLine(line).wholesalePrice : undefined} onValueChange={(value) => setLineWholesalePrice(index, value)} />
                </td>
                <td className="border p-3 text-center">
                  {line.itemId > 0 && (
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-red-500" title="Remove item">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t p-5">
        <div className="w-64 space-y-2">
          <label className="flex items-center justify-between bg-gray-50 p-3 text-sm font-semibold">
            <span><input type="checkbox" checked={roundOff} onChange={(event) => setRoundOff(event.target.checked)} className="mr-2" />Round Off</span>
            <input value={roundOff ? (finalGrandTotal - grandTotal).toFixed(2) : '0'} readOnly className="w-28 rounded border border-gray-300 px-3 py-2 text-right" />
          </label>
          <div className="flex items-center justify-between gap-4 text-sm font-bold">
            <span>Grand Total</span>
            <input value={finalGrandTotal.toFixed(2)} readOnly className="w-32 rounded border border-gray-300 px-3 py-2 text-right" />
          </div>
        </div>
      </div>

      <div className="border-y px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
          {!isCancellationOnly && !isCancelledPurchase && (
            <Button
              type="button"
              size="sm"
              leftIcon={<CirclePlus size={15} />}
              onClick={() => setPayments((current) => [...current, createPaymentDraft(purchaseDate)])}
            >
              Add Payment
            </Button>
          )}
        </div>
      </div>

      {paymentHistory.length > 0 && (
        <div className="px-5 pt-5">
          <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Payment No.', 'Date', 'Payment Type','Amount', 'Notes'].map((heading) => (
                    <th key={heading} className="border p-3 text-left">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment: PurchasePaymentEntry) => (
                  <tr key={payment.paymentId || `${payment.paymentNo}-${payment.paymentDate}`} className="border-b even:bg-gray-50">
                    <td className="border p-3 font-medium">{payment.paymentNo || '-'}</td>
                    <td className="border p-3">{payment.paymentDate}</td>
                    <td className="border p-3">{payment.paymentMethod?.name || '-'}</td>
                    <td className="border p-3 font-semibold">{payment.amount.toFixed(2)}</td>
                    <td className="border p-3">{payment.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-4 p-5">
        {payments.map((payment) => {
          const errors = validatePayment(payment);
          const showErrors = isPaymentActive(payment);
          return (
            <div key={payment.key} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_32px] md:items-start">
                <label className="text-sm text-gray-600">Payment Type
                  <select
                    className={`${inputClass} mt-1`}
                    value={payment.paymentMethodId}
                    disabled={paymentMethods.isLoading || paymentMethods.isError}
                    onChange={(event) => updatePayment(payment.key, { paymentMethodId: Number(event.target.value) })}
                  >
                    <option value={0}>
                      {paymentMethods.isLoading
                        ? 'Loading payment types...'
                        : paymentMethods.isError
                          ? 'Failed to load payment types'
                          : 'Choose payment type'}
                    </option>
                    {paymentMethodOptions.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                  </select>
                  {showErrors && errors.paymentMethodId && <p className="mt-1 text-xs font-medium text-red-600">{errors.paymentMethodId}</p>}
                </label>
                <label className="text-sm text-gray-600">Amount
                  <div className="mt-1 flex">
                    <NumericInput
                      min={0}
                      className={`${inputClass} rounded-r-none border-r-0 text-right`}
                      value={payment.amount || ''}
                      onValueChange={(value) => updatePayment(payment.key, { amount: value })}
                    />
                    <span className="flex h-10 w-10 items-center justify-center rounded-r border border-gray-300 bg-slate-50 text-slate-500">
                      <IndianRupee size={14} />
                    </span>
                  </div>
                  {showErrors && errors.amount && <p className="mt-1 text-xs font-medium text-red-600">{errors.amount}</p>}
                </label>
                <div className="flex items-center justify-end md:pt-8">
                  <button type="button" onClick={() => removePayment(payment.key)} className="text-red-500 transition hover:text-red-600" title="Remove payment">
                    <Trash2 size={16} />
                  </button>
                </div>
            </div>
          );
        })}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px] md:gap-8">
          <label className="block text-sm text-gray-600">Payment Note
            <textarea
              className="mt-1 h-24 w-full rounded border border-gray-300 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              placeholder="Enter payment note..."
            />
          </label>
          <div className="flex flex-col justify-center space-y-4 text-sm text-gray-700">
            <div className="flex items-center gap-3">
              <span>Total Amount Paid</span>
              <span className="text-gray-900">{totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Remaining Amount</span>
              <span className={remainingAmount < 0 ? 'text-red-600' : 'text-gray-900'}>{Math.max(remainingAmount, 0).toFixed(2)}</span>
            </div>
            {hasPaymentOverflow && <p className="mt-4 text-xs font-medium text-red-600">Total paid amount cannot exceed the grand total.</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t p-5">
        <div className="flex flex-col items-end gap-2">
          {!isCancellationOnly && !supplierId && <p className="text-xs font-medium text-red-600">Select a supplier to continue.</p>}
          {!isCancellationOnly && supplierId && !realLines.length && <p className="text-xs font-medium text-red-600">Select at least one item to continue.</p>}
          <Button className="w-40" onClick={submit} isLoading={loading} disabled={!canSubmit || loading}>{submitText}</Button>
        </div>
        <Button className="w-40" variant="secondary" onClick={onCancel}>Close</Button>
      </div>
    </div>
  );
};
