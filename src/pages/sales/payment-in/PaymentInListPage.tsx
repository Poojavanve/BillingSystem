import React, { useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, paymentInApi } from '../../../api/endpoints';
import type { PaymentListItem } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { Button } from '../../../components/ui/Button';
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

const exportColumns = ['Date', 'Reference No.', 'Invoice No.', 'Customer', 'Paid', 'Created by', 'Created at'];

export const PaymentInListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PAYMENT_IN_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PAYMENT_IN_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PAYMENT_IN_DELETE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [customerId, setCustomerId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const customers = useQuery({ queryKey: ['payment-in-customers'], queryFn: () => customerApi.getAll({ page: 0, size: 100, search: '' }) });
  const payments = useQuery({
    queryKey: ['payment-in', page, pageSize],
    queryFn: () => paymentInApi.getAll({ page, size: pageSize }),
  });

  const rows = (payments.data?.data?.content || [])
    .filter((payment) => !customerId || customers.data?.data?.content.find((customer) => customer.id === customerId)?.customerName === payment.customerName)
    .filter((payment) => !search || JSON.stringify(payment).toLowerCase().includes(search.toLowerCase()))
    .filter((payment) => !fromDate || payment.paymentDate >= fromDate)
    .filter((payment) => !toDate || payment.paymentDate <= toDate);
  const allSelected = rows.length > 0 && rows.every((payment) => selectedIds.includes(payment.paymentId));
  const selectedRows = rows.filter((payment) => selectedIds.includes(payment.paymentId));

  const exportRows = () => selectedRows.map((payment) => [
    payment.paymentDate,
    payment.paymentNo || '',
    payment.paymentNo || '',
    payment.customerName || payment.partyName || '',
    payment.amount,
    user?.userName || '',
    payment.paymentDate,
  ]);
  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Payment records copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'payment-in');
    else downloadExcel(exportColumns, exportRows(), 'payment-in', 'Payment In');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Payment In')) {
      toast.error('Please allow popups to print');
    }
  };

  const deletePayment = useMutation({
    mutationFn: paymentInApi.delete,
    onSuccess: () => {
      toast.success('Payment deleted');
      queryClient.invalidateQueries({ queryKey: ['payment-in'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale'] });
      queryClient.invalidateQueries({ queryKey: ['report', 'customerDue'] });
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
      <div className="text-sm text-gray-500">Home â€º Sale â€º Payment In</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Payment In"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search payments..."
          actions={canCreate && <Button onClick={() => navigate('/sales/payment-in/create')} className="min-w-[150px]">Add Payment</Button>}
        />

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-gray-600">Customers
            <select className="mt-1 w-full rounded border px-3 py-2.5" value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))}>
              <option value={0}>Select Customer</option>
              {customers.data?.data?.content.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-600">User
            <select className="mt-1 w-full rounded border px-3 py-2.5" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">Choose one thing</option>
              {user?.userName && <option value={user.userName}>{user.userName}</option>}
            </select>
          </label>
          <DateRangeFields fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} inputClassName="mt-1 w-full rounded border px-3 py-2.5" />
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
          {payments.isLoading ? <div className="p-10"><Loader /></div> : <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{canDelete && <th className="p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((payment) => payment.paymentId))} /></th>}{exportColumns.concat('Action').map((heading) => <th key={heading} className="border-b p-3 text-left">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.length ? rows.map((payment: PaymentListItem) => <tr key={payment.paymentId} className="border-b even:bg-gray-50">
                {canDelete && <td className="p-3"><input type="checkbox" checked={selectedIds.includes(payment.paymentId)} onChange={() => setSelectedIds((current) => current.includes(payment.paymentId) ? current.filter((id) => id !== payment.paymentId) : [...current, payment.paymentId])} /></td>}
                <td className="p-3">{formatDate(payment.paymentDate)}</td><td className="p-3">{payment.paymentNo || 'N/A'}</td><td className="p-3">{payment.paymentNo || 'N/A'}</td><td className="p-3">{payment.customerName || payment.partyName || 'N/A'}</td><td className="p-3 font-semibold">{formatCurrency(payment.amount)}</td><td className="p-3">{user?.userName || 'N/A'}</td><td className="p-3">{formatDate(payment.paymentDate)}</td><td className="p-3">
                  <div className="flex items-center gap-2">
                    {canUpdate && <button title="Update payment" onClick={() => navigate(`/sales/payment-in/${payment.paymentId}/edit`)} className="text-orange-600"><Edit size={17} /></button>}
                    {canDelete && <button title="Delete payment" onClick={async () => { if (await confirmAction({ title: 'Delete Payment', message: 'Delete this payment? This cannot be undone.', confirmText: 'Delete', variant: 'danger' })) deletePayment.mutate(payment.paymentId); }} className="text-red-600"><Trash2 size={17} /></button>}
                  </div>
                </td>
              </tr>) : <tr><td colSpan={9} className="bg-gray-50 p-5 text-center text-gray-700">No data available in table</td></tr>}
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

