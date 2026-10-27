import React, { useState } from 'react';
import { Edit, Eye } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { stockAdjustmentApi } from '../../../api/endpoints';
import type { StockAdjustmentListItem } from '../../../api/endpoints';
import { PERMISSIONS } from '../../../auth/permissions';
import { queryClient } from '../../../app/queryClient';
import { Button } from '../../../components/ui/Button';
import { Loader } from '../../../components/ui/Loader';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { usePagination } from '../../../hooks/usePagination';
import { formatDate } from '../../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../../utils/tableExport';
import { BulkActionBar } from '../../../components/common/BulkActionBar';
import { ListFooter } from '../../../components/common/ListFooter';
import { ListToolbarHeader } from '../../../components/common/ListToolbarHeader';
import { DateRangeFields } from '../../../components/form/DateRangeFields';

const exportColumns = ['Adjustment Code', 'Date', 'Created by', 'Created at'];
const adjustmentCode = (entry: StockAdjustmentListItem) => entry.adjustmentNo || entry.adjustmentCode || `SA/${entry.adjustmentId}`;

export const StockAdjustmentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const canCreate = hasPermission(PERMISSIONS.STOCK_ADJUSTMENT_CREATE);
  // No dedicated delete permission exists yet for this module; reuse the same
  // permission the page already uses to gate Edit, rather than introducing a
  // new backend permission string.
  const canDelete = canCreate;
  const [pageSize, setPageSize] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const adjustments = useQuery({ queryKey: ['stock-adjustments', page, pageSize], queryFn: () => stockAdjustmentApi.getAll({ page, size: pageSize }) });
  const remove = useMutation({
    mutationFn: stockAdjustmentApi.delete,
    onSuccess: () => {
      toast.success('Stock adjustment deleted');
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete stock adjustment'),
  });
  const rows = (adjustments.data?.data?.content || [])
    .filter((entry) => !search || JSON.stringify(entry).toLowerCase().includes(search.toLowerCase()))
    .filter((entry) => !fromDate || entry.adjustmentDate >= fromDate)
    .filter((entry) => !toDate || entry.adjustmentDate <= toDate);
  const allSelected = rows.length > 0 && rows.every((entry) => selectedIds.includes(entry.adjustmentId));
  const selectedRows = rows.filter((entry) => selectedIds.includes(entry.adjustmentId));

  const exportRows = () => selectedRows.map((entry) => [adjustmentCode(entry), entry.adjustmentDate, entry.createdBy || user?.userName || 'admin', entry.createdAt || entry.adjustmentDate]);
  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Stock adjustments copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'stock-adjustments');
    else downloadExcel(exportColumns, exportRows(), 'stock-adjustments', 'Stock Adjustments');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Stock Adjustment List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one adjustment');
    const confirmed = await confirmAction({ title: 'Delete Stock Adjustments', message: 'Delete selected stock adjustments?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Stock &gt; Stock Adjustment List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Stock Adjustment List"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search stock adjustments..."
          actions={canCreate && (
            <Button onClick={() => navigate('/stock/adjustments/create')} className="min-w-[170px]">New Adjustment</Button>
          )}
        />
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <DateRangeFields fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} inputClassName="mt-1 h-10 w-full rounded border border-gray-300 px-3" />
          <label className="text-sm text-gray-600">User<select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Choose one thing</option>{user?.userName && <option value={user.userName}>{user.userName}</option>}</select></label>
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
          {adjustments.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((entry) => entry.adjustmentId))} /></th>}{exportColumns.concat('Action').map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}</tr></thead>
              <tbody>
                {rows.length ? rows.map((entry: StockAdjustmentListItem) => (
                  <tr key={entry.adjustmentId} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(entry.adjustmentId)} onChange={() => setSelectedIds((current) => current.includes(entry.adjustmentId) ? current.filter((id) => id !== entry.adjustmentId) : [...current, entry.adjustmentId])} /></td>}
                    <td className="border p-3 font-semibold">{adjustmentCode(entry)}</td>
                    <td className="border p-3">{formatDate(entry.adjustmentDate)}</td>
                    <td className="border p-3">{entry.createdBy || user?.userName || 'admin'}</td>
                    <td className="border p-3">{formatDate(entry.createdAt || entry.adjustmentDate)}</td>
                    <td className="border p-3"><div className="flex gap-2"><button title="View adjustment" onClick={() => navigate(`/stock/adjustments/${entry.adjustmentId}`)} className="text-blue-600"><Eye size={17} /></button>{canCreate && <button title="Edit adjustment" onClick={() => navigate(`/stock/adjustments/${entry.adjustmentId}/edit`)} className="text-orange-600"><Edit size={17} /></button>}</div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={adjustments.data?.data?.totalElements || 0}
          page={page}
          totalPages={adjustments.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};

