import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, PackageSearch, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { brandApi, categoryApi, itemApi, warehouseApi } from '../../api/endpoints';
import type { ItemListItem } from '../../api/endpoints';
import type { ItemStatus } from '../../types/api.types';
import { queryClient } from '../../app/queryClient';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { PERMISSIONS } from '../../auth/permissions';

type TableColumn = {
  heading: string;
  render: (item: ItemListItem) => React.ReactNode;
  exportValue: (item: ItemListItem) => string | number;
};

const text = (value: unknown, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};
const number = (value: unknown) => Number(value || 0);
const date = (value?: string) => (value ? formatDate(value) : '');
const itemStatusOptions: Array<{ value: ItemStatus; label: string }> = [
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];
const itemStatusLabel = (status: ItemListItem['status'] | '') =>
  itemStatusOptions.find((option) => option.value === status)?.label || text(status);

const itemColumns: TableColumn[] = [
  {
    heading: 'Image',
    render: (item) => (
      item.imageUrl
        ? <img src={item.imageUrl} alt={item.itemName} className="h-10 w-10 rounded border border-gray-200 object-cover" />
        : <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-300"><PackageSearch size={16} /></div>
    ),
    exportValue: (item) => text(item.imageUrl),
  },
  { heading: 'Name', render: (item) => <span className="font-semibold">{item.itemName}</span>, exportValue: (item) => item.itemName },
  { heading: 'Item ID', render: (item) => text(item.id), exportValue: (item) => text(item.id) },
  { heading: 'HSN', render: (item) => text(item.hsnCode), exportValue: (item) => text(item.hsnCode) },
  { heading: 'SKU', render: (item) => text(item.sku), exportValue: (item) => text(item.sku) },
  { heading: 'Category', render: (item) => text(item.categoryName, 'General'), exportValue: (item) => text(item.categoryName, 'General') },
  { heading: 'Brand', render: (item) => text(item.brandName), exportValue: (item) => text(item.brandName) },
  { heading: 'Purchase Price', render: (item) => formatCurrency(number(item.purchasePrice)), exportValue: (item) => number(item.purchasePrice) },
  { heading: 'Purchase With Tax', render: (item) => formatCurrency(number(item.purchasePriceWithTax)), exportValue: (item) => number(item.purchasePriceWithTax) },
  { heading: 'Sale Price', render: (item) => formatCurrency(number(item.salePrice)), exportValue: (item) => number(item.salePrice) },
  { heading: 'Wholesale Price', render: (item) => formatCurrency(number(item.wholesalePrice)), exportValue: (item) => number(item.wholesalePrice) },
  { heading: 'MRP', render: (item) => formatCurrency(number(item.mrp)), exportValue: (item) => number(item.mrp) },
  { heading: 'MSP', render: (item) => formatCurrency(number(item.msp)), exportValue: (item) => number(item.msp) },
  { heading: 'Discount %', render: (item) => number(item.discountPercentage), exportValue: (item) => number(item.discountPercentage) },
  { heading: 'Mfg Date', render: (item) => date(item.manufacturingDate), exportValue: (item) => date(item.manufacturingDate) },
  { heading: 'Exp Date', render: (item) => date(item.expiryDate), exportValue: (item) => date(item.expiryDate) },
  { heading: 'Quantity', render: (item) => number(item.availableQty), exportValue: (item) => number(item.availableQty) },
  { heading: 'Reserved Qty', render: (item) => number(item.reservedQty), exportValue: (item) => number(item.reservedQty) },
  { heading: 'Warehouse', render: (item) => text(item.warehouseName), exportValue: (item) => text(item.warehouseName) },
  { heading: 'Description', render: (item) => <span className="line-clamp-2">{text(item.description)}</span>, exportValue: (item) => text(item.description) },
  { heading: 'Status', render: (item) => itemStatusLabel(item.status), exportValue: (item) => itemStatusLabel(item.status) },
];

// Hidden from the on-screen table only; the underlying fields still exist and remain editable elsewhere.
const hiddenTableHeadings = new Set(['HSN', 'SKU', 'MSP', 'Mfg Date', 'Exp Date']);
const visibleColumns = itemColumns.filter((column) => !hiddenTableHeadings.has(column.heading));
const exportColumns = itemColumns.map((column) => column.heading).concat('Created by');

export const ItemListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const canViewCategories = hasPermission(PERMISSIONS.CATEGORY_VIEW);
  const canViewBrands = hasPermission(PERMISSIONS.BRAND_VIEW);
  const canUseItemFormLookups = canViewCategories && canViewBrands;
  const canCreate = hasPermission(PERMISSIONS.ITEM_CREATE) && canUseItemFormLookups;
  const canUpdate = hasPermission(PERMISSIONS.ITEM_UPDATE) && canUseItemFormLookups;
  const canDelete = hasPermission(PERMISSIONS.ITEM_DELETE);
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [warehouseId, setWarehouseId] = useState(0);
  const [itemStatus, setItemStatus] = useState<ItemStatus | ''>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const items = useQuery({
    queryKey: ['items', page, pageSize, debouncedSearch, categoryId, brandId, warehouseId, itemStatus],
    queryFn: () => itemApi.getAll({
      page,
      size: pageSize,
      search: debouncedSearch,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      warehouseId: warehouseId || undefined,
      status: itemStatus || undefined,
    }),
  });
  const categories = useQuery({ queryKey: ['item-list-categories'], queryFn: () => categoryApi.getAll({ page: 0, size: 100, search: '' }), enabled: canViewCategories });
  const brands = useQuery({
    queryKey: ['item-list-brands', categoryId],
    queryFn: () => brandApi.getByCategoryId(categoryId),
    enabled: canViewBrands && categoryId > 0,
  });
  const warehouses = useQuery({ queryKey: ['item-list-warehouses'], queryFn: () => warehouseApi.getAll() });
  const remove = useMutation({
    mutationFn: itemApi.delete,
    onSuccess: () => {
      toast.success('Item deleted');
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete item'),
  });

  const rows = (items.data?.data?.content || [])
    .filter((item) => !warehouseId || item.warehouseId === warehouseId);
  const allSelected = rows.length > 0 && rows.every((item) => selectedIds.includes(item.id));
  const selectedRows = rows.filter((item) => selectedIds.includes(item.id));
  const exportRows = () => selectedRows.map((item) => [...itemColumns.map((column) => column.exportValue(item)), user?.userName || 'admin']);

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Items copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'items');
    else downloadExcel(exportColumns, exportRows(), 'items', 'Items');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Item List')) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one item');
    const confirmed = await confirmAction({ title: 'Delete Items', message: 'Delete selected items?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  const deleteItem = async (item: ItemListItem) => {
    const confirmed = await confirmAction({
      title: 'Delete Item',
      message: `Delete ${item.itemName}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await remove.mutateAsync(item.id);
    setSelectedIds((current) => current.filter((id) => id !== item.id));
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Items &gt; Item List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Item List"
          actions={canCreate && <Button onClick={() => navigate('/items/create')} className="min-w-[145px]">Create Item</Button>}
        />
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          {canViewCategories && <label className="text-sm text-gray-600">Category<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={categoryId} disabled={categories.isLoading} onChange={(event) => { setCategoryId(Number(event.target.value)); setBrandId(0); setPage(0); }}><option value={0}>{categories.isLoading ? 'Loading categories...' : 'Choose one thing'}</option>{(categories.data?.data?.content || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          {canViewBrands && <label className="text-sm text-gray-600">Brand<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={brandId} disabled={!categoryId || brands.isLoading} onChange={(event) => { setBrandId(Number(event.target.value)); setPage(0); }}><option value={0}>{!categoryId ? 'Select category first' : brands.isLoading ? 'Loading brands...' : 'Choose one thing'}</option>{(brands.data?.data?.content || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          <label className="text-sm text-gray-600">User<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Choose one thing</option>{user?.userName && <option value={user.userName}>{user.userName}</option>}</select></label>
          <label className="text-sm text-gray-600">Warehouse Stock<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={warehouseId} disabled={warehouses.isLoading} onChange={(event) => { setWarehouseId(Number(event.target.value)); setPage(0); }}><option value={0}>{warehouses.isLoading ? 'Loading warehouses...' : 'All warehouses'}</option>{(warehouses.data?.data || []).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
          <label className="text-sm text-gray-600">Item Status<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={itemStatus} onChange={(event) => { setItemStatus(event.target.value as ItemStatus | ''); setPage(0); }}><option value="">All statuses</option>{itemStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm text-gray-600">Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search items..." className="mt-1 h-10 w-full rounded border border-gray-300 px-3" /></label>
        </div>

        {canDelete && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            onDelete={deleteSelected}
            onCopy={copy}
            onDownloadExcel={() => download('xls')}
            onDownloadCsv={() => download('csv')}
            onPrint={printPdf}
          />
        )}

        <div className="overflow-x-auto px-3 pb-3 pt-3">
          {items.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full min-w-[2600px] text-sm">
              <thead className="bg-gray-50"><tr>{canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((item) => item.id))} /></th>}{visibleColumns.map((column) => <th key={column.heading} className="border p-3 text-left">{column.heading}</th>)}<th className="border p-3 text-left">Created by</th><th className="border p-3 text-left">Action</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((item) => (
                  <tr key={item.id} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /></td>}
                    {visibleColumns.map((column) => <td key={column.heading} className="border p-3 align-top">{column.render(item)}</td>)}
                    <td className="border p-3">{user?.userName || 'admin'}</td>
                    <td className="border p-3">
                      <div className="flex gap-2">
                        {canUpdate && <button title="Edit item" onClick={() => navigate(`/items/${item.id}/edit`)} className="text-orange-600"><Edit size={16} /></button>}
                        {canDelete && <button title="Delete item" onClick={() => void deleteItem(item)} className="text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={visibleColumns.length + (canDelete ? 3 : 2)} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={items.data?.data?.totalElements || 0}
          page={page}
          totalPages={items.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
