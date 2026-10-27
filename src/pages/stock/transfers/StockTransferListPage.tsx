import React, { useState } from 'react';
import { Edit, Eye } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { stockTransferApi } from '../../../api/endpoints';
import type { StockTransferListItem } from '../../../api/endpoints';
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

const exportColumns = ['Transfer Code', 'Date', 'Created by', 'Created at'];
const transferCode = (entry: StockTransferListItem) => entry.transferNo || entry.transferCode || `ST/${entry.transferId}`;

export const StockTransferListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const canCreate = hasPermission(PERMISSIONS.STOCK_TRANSFER_CREATE);
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

  const transfers = useQuery({ queryKey: ['stock-transfers', page, pageSize], queryFn: () => stockTransferApi.getAll({ page, size: pageSize }) });
  const remove = useMutation({
    mutationFn: stockTransferApi.delete,
    onSuccess: () => {
      toast.success('Stock transfer deleted');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete stock transfer'),
  });
  const rows = (transfers.data?.data?.content || [])
    .filter((entry) => !search || JSON.stringify(entry).toLowerCase().includes(search.toLowerCase()))
    .filter((entry) => !fromDate || entry.transferDate >= fromDate)
    .filter((entry) => !toDate || entry.transferDate <= toDate);
  const allSelected = rows.length > 0 && rows.every((entry) => selectedIds.includes(entry.transferId));
  const selectedRows = rows.filter((entry) => selectedIds.includes(entry.transferId));

  const exportRows = () => selectedRows.map((entry) => [transferCode(entry), entry.transferDate, entry.createdBy || user?.userName || 'admin', entry.createdAt || entry.transferDate]);
  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Stock transfers copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'stock-transfers');
    else downloadExcel(exportColumns, exportRows(), 'stock-transfers', 'Stock Transfers');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Stock Transfer List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one transfer');
    const confirmed = await confirmAction({ title: 'Delete Stock Transfers', message: 'Delete selected stock transfers?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Stock &gt; Stock Transfer List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Stock Transfer List"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search stock transfers..."
          actions={canCreate && (
            <Button onClick={() => navigate('/stock/transfers/create')} className="min-w-[150px]">New Transfer</Button>
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
          {transfers.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((entry) => entry.transferId))} /></th>}{exportColumns.concat('Action').map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}</tr></thead>
              <tbody>
                {rows.length ? rows.map((entry: StockTransferListItem) => (
                  <tr key={entry.transferId} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(entry.transferId)} onChange={() => setSelectedIds((current) => current.includes(entry.transferId) ? current.filter((id) => id !== entry.transferId) : [...current, entry.transferId])} /></td>}
                    <td className="border p-3 font-semibold">{transferCode(entry)}</td>
                    <td className="border p-3">{formatDate(entry.transferDate)}</td>
                    <td className="border p-3">{entry.createdBy || user?.userName || 'admin'}</td>
                    <td className="border p-3">{formatDate(entry.createdAt || entry.transferDate)}</td>
                    <td className="border p-3"><div className="flex gap-2"><button title="View transfer" onClick={() => navigate(`/stock/transfers/${entry.transferId}`)} className="text-blue-600"><Eye size={17} /></button>{canCreate && <button title="Edit transfer" onClick={() => navigate(`/stock/transfers/${entry.transferId}/edit`)} className="text-orange-600"><Edit size={17} /></button>}</div></td>
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
          total={transfers.data?.data?.totalElements || 0}
          page={page}
          totalPages={transfers.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};

