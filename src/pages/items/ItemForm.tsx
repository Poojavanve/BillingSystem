import React, { useEffect, useRef, useState } from 'react';
import { CirclePlus, ImagePlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { brandApi, categoryApi, gstRateApi, hsnApi, unitApi } from '../../api/endpoints';
import type { ItemListItem, ItemRequest } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import { hasSelectedId, hasTrimmedText, isNonNegativeNumber } from '../../utils/validation';

type ItemFormInitial = Partial<ItemListItem> & Partial<Omit<ItemRequest, keyof ItemListItem>>;
interface Props {
  initial?: ItemFormInitial;
  submitText: string;
  loading: boolean;
  validationErrors?: Record<string, string>;
  onFieldChange?: () => void;
  onSubmit: (payload: ItemRequest, imageFile: File | null) => void;
  onCancel: () => void;
}
const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const numberValue = (value: unknown) => Number(value || 0);
const buildFormState = (initial?: ItemFormInitial): ItemRequest => ({
  itemName: initial?.itemName || '',
  categoryId: numberValue(initial?.categoryId),
  subCategoryId: numberValue(initial?.subCategoryId),
  brandId: numberValue(initial?.brandId),
  hsnId: numberValue(initial?.hsnId),
  unitId: numberValue(initial?.unitId),
  gstTaxability: initial?.gstTaxability || 'TAXABLE',
  gstRateId: numberValue(initial?.gstRateId),
  cessRate: numberValue(initial?.cessRate),
  discountPercentage: numberValue(initial?.discountPercentage),
  minimumStock: numberValue(initial?.minimumStock),
  description: initial?.description || '',
});

export const ItemForm: React.FC<Props> = ({
  initial,
  submitText,
  loading,
  validationErrors = {},
  onFieldChange,
  onSubmit,
  onCancel,
}) => {
  const { navigateToCreate } = useCreateFlowNavigation('/items');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(initial?.imageUrl || '');
  const [imageName, setImageName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<ItemRequest>(() => buildFormState(initial));
  const categories = useQuery({ queryKey: ['item-form-categories'], queryFn: () => categoryApi.getAll({ page: 0, size: 100, search: '' }) });
  const brands = useQuery({
    queryKey: ['item-form-brands', form.categoryId],
    queryFn: () => brandApi.getByCategoryId(form.categoryId),
    enabled: form.categoryId > 0,
  });
  const hsns = useQuery({ queryKey: ['item-form-hsns'], queryFn: () => hsnApi.getAll({ page: 0, size: 200, search: '' }) });
  const units = useQuery({ queryKey: ['item-form-units'], queryFn: () => unitApi.getAll({ page: 0, size: 200, search: '' }) });
  const gstRates = useQuery({ queryKey: ['item-form-gst-rates'], queryFn: () => gstRateApi.getAll({ page: 0, size: 200, search: '' }) });
  const fieldError = (field: keyof ItemRequest, aliases: string[] = []) =>
    validationErrors[field] || aliases.map((alias) => validationErrors[alias]).find(Boolean);
  const controlClass = (field: keyof ItemRequest, baseClass = inputClass, aliases: string[] = []) =>
    `${baseClass} ${fieldError(field, aliases) ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`;
  const renderFieldError = (field: keyof ItemRequest, aliases: string[] = []) => {
    const message = fieldError(field, aliases);
    return message ? <p className="mt-1 text-xs font-medium text-red-600">{message}</p> : null;
  };
  const set = (field: keyof ItemRequest, value: string | number) => {
    onFieldChange?.();
    setForm((current) => ({ ...current, [field]: value }));
  };
  const setCategory = (categoryId: number) => {
    onFieldChange?.();
    setForm((current) => ({ ...current, categoryId, brandId: 0 }));
  };
  useEffect(() => {
    setForm(buildFormState(initial));
    setImagePreviewUrl(initial?.imageUrl || '');
    setImageName('');
    setImageFile(null);
  }, [initial?.id]);
  useEffect(() => () => {
    if (imagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);
  const submit = () => {
    if (!form.itemName.trim()) return toast.error('Item name is required.');
    if (form.minimumStock < 0) return toast.error('Minimum stock must be 0 or greater.');
    if (!form.categoryId) return toast.error('Category is required.');
    if (!form.brandId) return toast.error('Brand is required.');
    if (!form.hsnId) return toast.error('HSN is required.');
    if (!form.unitId) return toast.error('Unit is required.');
    if (!form.gstTaxability) return toast.error('Taxability is required.');
    const payload = form.gstTaxability === 'TAXABLE'
      ? form
      : { ...form, gstRateId: 0, cessRate: 0 };
    onSubmit(payload, imageFile);
  };
  const canSubmit = hasTrimmedText(form.itemName)
    && isNonNegativeNumber(form.minimumStock)
    && hasSelectedId(form.categoryId)
    && hasSelectedId(form.brandId)
    && hasSelectedId(form.hsnId)
    && hasSelectedId(form.unitId)
    && hasTrimmedText(form.gstTaxability);
  const chooseImage = (file?: File | null) => {
    if (imagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
    if (!file) {
      setImagePreviewUrl('');
      setImageName('');
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Image size must be 1MB or less.');
      return;
    }
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageName(file.name);
    setImageFile(file);
  };
  const createCategory = () => {
    navigateToCreate('/items/categories/create');
  };
  const createBrand = () => {
    navigateToCreate('/items/brands/create');
  };

  const categoryOptions = (categories.data?.data?.content || []).map((category) => ({ id: category.id, label: category.name }));
  const brandOptions = (brands.data?.data?.content || []).map((brand) => ({ id: brand.id, label: brand.name }));
  const hsnOptions = (hsns.data?.data?.content || []).map((hsn) => ({ id: hsn.id, label: `${hsn.hsnCode}${hsn.description ? ` - ${hsn.description}` : ''}` }));
  const unitOptions = (units.data?.data?.content || []).map((unit) => ({ id: unit.id, label: `${unit.name}${unit.shortName ? ` (${unit.shortName})` : ''}` }));
  const gstRateOptions = (gstRates.data?.data?.content || []).map((rate) => ({ id: rate.id, label: `${rate.rateName}${rate.gstRate !== undefined ? ` (${rate.gstRate}%)` : ''}` }));

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="flex items-center justify-between border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Item Details</h1></div>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        {/* Row 1 */}
        <label className="text-sm text-gray-600">Name
          <input className={`${controlClass('itemName')} mt-1`} value={form.itemName} onChange={(event) => set('itemName', event.target.value)} />
          {renderFieldError('itemName')}
        </label>
        <label className="text-sm text-gray-600">Details
          <textarea className={`${controlClass('description', 'h-10 w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100')} mt-1`} value={form.description} onChange={(event) => set('description', event.target.value)} />
          {renderFieldError('description')}
        </label>

        {/* Row 2 */}
        <div>
          <span className="text-sm text-gray-600">Category</span>
          <div className="mt-1 flex">
            <SearchableSelect
              className="rounded-r-none"
              value={form.categoryId}
              options={categoryOptions}
              isLoading={categories.isLoading}
              hasError={Boolean(fieldError('categoryId'))}
              placeholder="Search category"
              loadingPlaceholder="Loading categories..."
              emptyMessage="No categories found"
              onChange={(categoryId) => setCategory(categoryId)}
            />
            <button type="button" title="Create category" aria-label="Create category" onClick={createCategory} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"><CirclePlus size={17} /></button>
          </div>
          {renderFieldError('categoryId')}
        </div>
        <div>
          <span className="text-sm text-gray-600">Brand</span>
          <div className="mt-1 flex">
            <SearchableSelect
              className="rounded-r-none"
              value={form.brandId}
              options={brandOptions}
              disabled={!form.categoryId}
              isLoading={brands.isLoading}
              hasError={Boolean(fieldError('brandId'))}
              placeholder={!form.categoryId ? 'Select category first' : 'Search brand'}
              loadingPlaceholder="Loading brands..."
              emptyMessage="No brands found"
              onChange={(brandId) => set('brandId', brandId)}
            />
            <button type="button" title="Create brand" aria-label="Create brand" onClick={createBrand} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r border border-l-0 border-blue-400 text-blue-500 hover:bg-blue-50"><CirclePlus size={17} /></button>
          </div>
          {renderFieldError('brandId')}
        </div>
        <div>
          <span className="text-sm text-gray-600">HSN</span>
          <SearchableSelect
            className="mt-1"
            value={form.hsnId}
            options={hsnOptions}
            isLoading={hsns.isLoading}
            hasError={Boolean(fieldError('hsnId'))}
            placeholder="Search HSN"
            loadingPlaceholder="Loading HSNs..."
            emptyMessage="No HSNs found"
            onChange={(hsnId) => set('hsnId', hsnId)}
          />
          {renderFieldError('hsnId')}
        </div>
        <div>
          <span className="text-sm text-gray-600">Unit</span>
          <SearchableSelect
            className="mt-1"
            value={form.unitId}
            options={unitOptions}
            isLoading={units.isLoading}
            hasError={Boolean(fieldError('unitId'))}
            placeholder="Search unit"
            loadingPlaceholder="Loading units..."
            emptyMessage="No units found"
            onChange={(unitId) => set('unitId', unitId)}
          />
          {renderFieldError('unitId')}
        </div>
        <label className="text-sm text-gray-600">Taxability
          <select className={`${controlClass('gstTaxability')} mt-1`} value={form.gstTaxability} onChange={(event) => set('gstTaxability', event.target.value)}>
            <option value="TAXABLE">Taxable</option>
            <option value="EXEMPT">Exempt</option>
            <option value="NIL_RATED">Nil Rated</option>
            <option value="NON_GST">Non GST</option>
          </select>
          {renderFieldError('gstTaxability')}
        </label>
        {form.gstTaxability === 'TAXABLE' && (
          <>
            <div>
              <span className="text-sm text-gray-600">GST Rate</span>
              <SearchableSelect
                className="mt-1"
                value={form.gstRateId || 0}
                options={gstRateOptions}
                isLoading={gstRates.isLoading}
                placeholder="Select GST rate"
                loadingPlaceholder="Loading GST rates..."
                emptyMessage="No GST rates found"
                onChange={(gstRateId) => set('gstRateId', gstRateId)}
              />
            </div>
            <label className="text-sm text-gray-600">Cess %
              <NumericInput min={0} className={`${inputClass} mt-1`} value={form.cessRate || ''} onValueChange={(value) => set('cessRate', value)} />
            </label>
          </>
        )}
        <label className="text-sm text-gray-600">Discount %
          <NumericInput min={0} max={100} className={`${inputClass} mt-1`} value={form.discountPercentage} onValueChange={(value) => set('discountPercentage', value)} />
        </label>
        <label className="text-sm text-gray-600">Minimum Quantity
          <NumericInput min={0} className={`${inputClass} mt-1`} value={form.minimumStock || ''} onValueChange={(value) => set('minimumStock', value)} />
          {renderFieldError('minimumStock')}
        </label>
        <div>
          <span className="block text-sm text-gray-600">&nbsp;</span>
          <Button type="button" variant="secondary" fullWidth leftIcon={<ImagePlus size={16} />} onClick={() => setIsImageModalOpen(true)} className="mt-1">
            Upload Image
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t p-5">
        <Button className="w-40" onClick={submit} isLoading={loading} disabled={!canSubmit || loading}>{submitText}</Button>
        <Button className="w-40" variant="secondary" onClick={onCancel}>Close</Button>
      </div>

      <Modal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        title="Upload Image"
        footer={<Button type="button" className="min-w-[140px]" onClick={() => setIsImageModalOpen(false)}>Done</Button>}
      >
        <div className="flex min-h-24 items-center gap-4 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed border-gray-300 bg-white text-center text-[10px] text-gray-400">
            {imagePreviewUrl ? <img src={imagePreviewUrl} alt={imageName} className="h-full w-full object-cover" /> : <>NO IMAGE<br />FOUND</>}
          </div>
          <div>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />
            <button type="button" onClick={() => imageInputRef.current?.click()} className="rounded border border-blue-400 bg-white px-4 py-2 text-blue-600 hover:bg-blue-50">Browse</button>
            <button type="button" onClick={() => chooseImage(null)} className="ml-2 rounded border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-gray-100">Reset</button>
            <p className="mt-2 text-xs leading-5 text-gray-500">{imageName || 'Allowed JPG, GIF or PNG.'}<br />Max size of 1MB</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
