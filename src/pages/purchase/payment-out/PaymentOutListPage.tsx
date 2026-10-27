import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { paymentOutApi, supplierApi } from '../../../api/endpoints';
import type { PaymentListItem } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { Loader } from '../../../components/ui/Loader';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmation } from '../../../hooks/useConfirmation';
import { usePagination } from '../../../hooks/usePagination';
import { formatCurrency } from '../../../utils/formatCurrency';
import { formatDate } from '../../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../../utils/tableExport';
import { PERMISSIONS } from '../../../auth/permissions';
import { BulkActionBar } from '../../../components/common/BulkActionBar';
import { ListFooter } from '../../../components/common/ListFooter';
import { ListToolbarHeader } from '../../../components/common/ListToolbarHeader';
import { DateRangeFields } from '../../../components/form/DateRangeFields';

const exportColumns = ['Date', 'Bill No.', 'Supplier', 'Paid', 'Created by', 'Created at'];

export const PaymentOutListPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canDelete = hasPermission(PERMISSIONS.PAYMENT_OUT_DELETE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [supplierId, setSupplierId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const suppliers = useQuery({ queryKey: ['payment-out-suppliers'], queryFn: () => supplierApi.getAll({ page: 0, size: 100, search: '' }) });
  const payments = useQuery({ queryKey: ['payment-out', page, pageSize], queryFn: () => paymentOutApi.getAll({ page, size: pageSize }), retry: false });

  const rows = (payments.data?.data?.content || [])
    .filter((payment) => !supplierId || suppliers.data?.data?.content.find((supplier) => supplier.id === supplierId)?.supplierName === (payment.supplierName || payment.partyName))
    .filter((payment) => !search || JSON.stringify(payment).toLowerCase().includes(search.toLowerCase()))
    .filter((payment) => !fromDate || payment.paymentDate >= fromDate)
    .filter((payment) => !toDate || payment.paymentDate <= toDate);
  const allSelected = rows.length > 0 && rows.every((payment) => selectedIds.includes(payment.paymentId));
  const selectedRows = rows.filter((payment) => selectedIds.includes(payment.paymentId));

  const exportRows = () => selectedRows.map((payment) => [
    payment.paymentDate,
    payment.paymentNo || '',
    payment.supplierName || payment.partyName || '',
    payment.paymentMethod?.name || '',
    payment.amount,
    user?.userName || '',
    payment.paymentDate,
  ]);
  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Payment out records copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'payment-out');
    else downloadExcel(exportColumns, exportRows(), 'payment-out', 'Payment Out');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Payment Out')) {
      toast.error('Please allow popups to print');
    }
  };

  const deletePayment = useMutation({
    mutationFn: paymentOutApi.delete,
    onSuccess: () => {
      toast.success('Payment deleted');
      queryClient.invalidateQueries({ queryKey: ['payment-out'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase'] });
      queryClient.invalidateQueries({ queryKey: ['report', 'supplierDue'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete payment'),
  });

  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one payment');
    const confirmed = await confirmAction({ title: 'Delete Payments', message: 'Delete selected payments? This cannot be undone.', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await deletePayment.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Purchase &gt; Payment Out</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader title="Payment Out" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search payments..." />

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
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
          <DateRangeFields fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} inputClassName="mt-1 h-10 w-full rounded border border-gray-300 px-3" />
        </div>

        <BulkActionBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onDelete={canDelete ? deleteSelected : undefined}
          onCopy={copy}
          onDownloadExcel={() => download('xls')}
          onDownloadCsv={() => download('csv')}
          onPrint={printPdf}
        />

        <div className="overflow-x-auto px-3 pb-3 pt-3">
          {payments.isLoading ? <div className="p-10"><Loader /></div> : <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((payment) => payment.paymentId))} /></th>
                {exportColumns.map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((payment: PaymentListItem) => (
                <tr key={payment.paymentId} className="border-b even:bg-gray-50">
                  <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(payment.paymentId)} onChange={() => setSelectedIds((current) => current.includes(payment.paymentId) ? current.filter((id) => id !== payment.paymentId) : [...current, payment.paymentId])} /></td>
                  <td className="border p-3">{formatDate(payment.paymentDate)}</td>
                  <td className="border p-3">{payment.paymentNo || 'N/A'}</td>
                  <td className="border p-3">{payment.supplierName || payment.partyName || 'N/A'}</td>
                  <td className="border p-3 font-semibold">{formatCurrency(payment.amount)}</td>
                  <td className="border p-3">{user?.userName || 'admin'}</td>
                  <td className="border p-3">{formatDate(payment.paymentDate)}</td>
                </tr>
              )) : <tr><td colSpan={exportColumns.length + 1} className="bg-gray-50 p-5 text-center text-gray-700">No data available in table</td></tr>}
            </tbody>
          </table>}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={payments.data?.data?.totalElements || 0}
          page={page}
          totalPages={payments.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
