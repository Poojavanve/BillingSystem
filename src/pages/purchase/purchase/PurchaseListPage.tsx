import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Edit, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { purchaseApi, supplierApi } from '../../../api/endpoints';
import type { PurchaseListItem } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { BulkActionBar } from '../../../components/common/BulkActionBar';
import { ListFooter } from '../../../components/common/ListFooter';
import { ListToolbarHeader } from '../../../components/common/ListToolbarHeader';
import { DateRangeFields } from '../../../components/form/DateRangeFields';
import { Button } from '../../../components/ui/Button';
import { Loader } from '../../../components/ui/Loader';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePagination } from '../../../hooks/usePagination';
import { formatCurrency } from '../../../utils/formatCurrency';
import { formatDate } from '../../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../../utils/tableExport';
import { PERMISSIONS } from '../../../auth/permissions';

const exportColumns = ['Purchase Code', 'Date', 'Due Date', 'Supplier', 'Qty', 'Total', 'Balance', 'Status'];
const purchaseCode = (purchase: PurchaseListItem) => purchase.purchaseNo || purchase.purchaseCode || `PB/${purchase.purchaseId}`;
const statusLabel = (status?: string) => status === 'CREATED' ? 'Created' : status === 'CONFIRMED' ? 'Confirmed' : status === 'CANCELLED' ? 'Cancelled' : 'Created';
const statusBadgeClass = (status?: string) => status === 'CREATED' ? 'bg-gray-100 text-gray-700' : status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

export const PurchaseListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PURCHASE_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PURCHASE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PURCHASE_DELETE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const suppliers = useQuery({ queryKey: ['purchase-suppliers'], queryFn: () => supplierApi.getAll({ page: 0, size: 100, search: '' }) });
  const purchases = useQuery({
    queryKey: ['purchases', page, pageSize, debouncedSearch, fromDate, toDate],
    queryFn: () => purchaseApi.getAll({
      page,
      size: pageSize,
      search: debouncedSearch,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status: 'CREATED,CONFIRMED',
    }),
  });

  const cancel = useMutation({
    mutationFn: purchaseApi.cancel,
    onSuccess: () => {
      toast.success('Purchase cancelled');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to cancel purchase'),
  });

  const deletePurchase = useMutation({
    mutationFn: purchaseApi.delete,
    onSuccess: () => {
      toast.success('Purchase deleted');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete purchase'),
  });

  const rows = (purchases.data?.data?.content || []).filter((purchase) => {
    if (!supplierId) return true;
    const supplier = suppliers.data?.data?.content.find((entry) => entry.id === supplierId);
    return supplier?.supplierName === purchase.supplierName;
  });
  const allSelected = rows.length > 0 && rows.every((purchase) => selectedIds.includes(purchase.purchaseId));
  const selectedRows = rows.filter((purchase) => selectedIds.includes(purchase.purchaseId));

  const exportRows = () => selectedRows.map((purchase) => [
    purchaseCode(purchase),
    purchase.purchaseDate,
    purchase.purchaseDate,
    purchase.supplierName,
    purchase.totalQuantity ?? 0,
    purchase.grandTotal,
    purchase.dueAmount || 0,
    statusLabel(purchase.status),
  ]);

  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'purchases');
    else downloadExcel(exportColumns, exportRows(), 'purchases', 'Purchases');
  };

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Purchases copied');
  };

  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Purchase List')) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one purchase');
      return;
    }
    const confirmed = await confirmAction({
      title: 'Delete Purchases',
      message: 'Delete selected purchases? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    for (const id of selectedIds) await deletePurchase.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Purchase &gt; Purchase List</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Purchase List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search purchases..."
          actions={canCreate && <Button onClick={() => navigate('/purchase/create')} className="min-w-[190px]">Create Purchase</Button>}
        />

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-gray-600">Suppliers
            <select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={supplierId} onChange={(event) => setSupplierId(Number(event.target.value))}>
              <option value={0}>Select Supplier</option>
              {suppliers.data?.data?.content.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-600">User
            <select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">Choose one thing</option>
              {user?.userName && <option value={user.userName}>{user.userName}</option>}
            </select>
          </label>
          <DateRangeFields fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(0); }} onToDateChange={(value) => { setToDate(value); setPage(0); }} inputClassName="mt-1 h-10 w-full rounded border border-gray-300 px-3" />
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

        <div className="overflow-x-auto px-3 pb-3">
          {purchases.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((purchase) => purchase.purchaseId))} /></th>}
                  {['Purchase Code', 'Date', 'Due Date', 'Supplier', 'Qty', 'Total', 'Balance', 'Status', 'Created by', 'Created at', 'Action'].map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((purchase: PurchaseListItem) => (
                  <tr key={purchase.purchaseId} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(purchase.purchaseId)} onChange={() => setSelectedIds((current) => current.includes(purchase.purchaseId) ? current.filter((id) => id !== purchase.purchaseId) : [...current, purchase.purchaseId])} /></td>}
                    <td className="border p-3 font-semibold">{purchaseCode(purchase)}</td>
                    <td className="border p-3">{formatDate(purchase.purchaseDate)}</td>
                    <td className="border p-3">{formatDate(purchase.purchaseDate)}</td>
                    <td className="border p-3">{purchase.supplierName}</td>
                    <td className="border p-3">{purchase.totalQuantity ?? '-'}</td>
                    <td className="border p-3 font-semibold text-green-600">{formatCurrency(purchase.grandTotal)}</td>
                    <td className="border p-3">{formatCurrency(purchase.dueAmount || 0)}</td>
                    <td className="border p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(purchase.status)}`}>{statusLabel(purchase.status)}</span></td>
                    <td className="border p-3">{user?.userName || 'admin'}</td>
                    <td className="border p-3">{formatDate(purchase.purchaseDate)}</td>
                    <td className="border p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/purchase/${purchase.purchaseId}`)} className="text-blue-600" title="View"><Eye size={17} /></button>
                        {canUpdate && purchase.status !== 'CONFIRMED' && <button onClick={() => navigate(`/purchase/${purchase.purchaseId}/edit`)} className="text-orange-600" title="Edit"><Edit size={17} /></button>}
                        {canDelete && <button
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Cancel Purchase',
                              message: 'Cancel this purchase?',
                              confirmText: 'Cancel',
                              variant: 'danger',
                            });
                            if (confirmed) cancel.mutate(purchase.purchaseId);
                          }}
                          className="text-red-600"
                          title="Cancel"
                        >
                          <Ban size={17} />
                        </button>}
                        {canDelete && <button
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Delete Purchase',
                              message: 'Delete this purchase? This cannot be undone.',
                              confirmText: 'Delete',
                              variant: 'danger',
                            });
                            if (confirmed) deletePurchase.mutate(purchase.purchaseId);
                          }}
                          className="text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={17} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={12} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={purchases.data?.data?.totalElements || 0}
          page={page}
          totalPages={purchases.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
