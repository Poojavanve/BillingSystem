import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, CreditCard, Edit, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, salesApi } from '../../../api/endpoints';
import type { SaleListItem } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
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
import { BulkActionBar } from '../../../components/common/BulkActionBar';
import { ListFooter } from '../../../components/common/ListFooter';
import { ListToolbarHeader } from '../../../components/common/ListToolbarHeader';
import { DateRangeFields } from '../../../components/form/DateRangeFields';

const exportColumns = ['Order ID', 'Date', 'Due Date', 'Customer', 'Total', 'Balance', 'Status'];

export const SaleOrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.SALES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.SALES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.SALES_DELETE);
  const canPay = hasPermission(PERMISSIONS.PAYMENT_IN_CREATE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const customers = useQuery({
    queryKey: ['sale-order-customers'],
    queryFn: () => customerApi.getAll({ page: 0, size: 100, search: '' }),
  });

  const sales = useQuery({
    queryKey: ['sale-orders', page, pageSize, debouncedSearch, fromDate, toDate],
    queryFn: () => salesApi.getAll({
      page,
      size: pageSize,
      search: debouncedSearch,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status: 'PENDING,ACTIVE',
    }),
  });

  const cancel = useMutation({
    mutationFn: salesApi.cancel,
    onSuccess: () => {
      toast.success('Sale order cancelled');
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to cancel sale order'),
  });

  const deleteSale = useMutation({
    mutationFn: salesApi.delete,
    onSuccess: () => {
      toast.success('Sale order deleted');
      queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete sale order'),
  });

  const rows = (sales.data?.data?.content || []).filter((sale) => {
    if (!customerId) return true;
    const customer = customers.data?.data?.content.find((entry) => entry.id === customerId);
    return customer?.customerName === sale.customerName;
  });
  const allSelected = rows.length > 0 && rows.every((sale) => selectedIds.includes(sale.saleId));
  const selectedRows = rows.filter((sale) => selectedIds.includes(sale.saleId));

  const exportRows = () => selectedRows.map((sale) => [
    sale.invoiceNo,
    sale.invoiceDate,
    sale.invoiceDate,
    sale.customerName,
    sale.grandTotal,
    sale.dueAmount,
    sale.status === 'PENDING' ? 'Pending' : 'Partially Paid',
  ]);

  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'sale-orders');
    else downloadExcel(exportColumns, exportRows(), 'sale-orders', 'Sale Orders');
  };

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Sale orders copied');
  };

  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Sale Order List')) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one sale order');
      return;
    }
    const confirmed = await confirmAction({ title: 'Delete Sale Orders', message: 'Delete selected sale orders? This cannot be undone.', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await deleteSale.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Sale Order &gt; Sale Order List</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Sale Order List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search sale orders..."
          actions={canCreate && <Button onClick={() => navigate('/sales/orders/create')} className="min-w-[175px]">Create Sale Order</Button>}
        />

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-gray-600">Customer
            <select className="mt-1 h-10 w-full rounded border border-gray-300 px-3" value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))}>
              <option value={0}>Select Customer</option>
              {customers.data?.data?.content.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName}</option>)}
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

        <div className="overflow-x-auto px-3 pb-3 pt-3">
          {sales.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((sale) => sale.saleId))} /></th>}
                  {['Order ID', 'Date', 'Due Date', 'Customer', 'Total', 'Balance', 'Status', 'Created by', 'Created at', 'Action'].map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((sale: SaleListItem) => (
                  <tr key={sale.saleId} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(sale.saleId)} onChange={() => setSelectedIds((current) => current.includes(sale.saleId) ? current.filter((id) => id !== sale.saleId) : [...current, sale.saleId])} /></td>}
                    <td className="border p-3 font-semibold">{sale.invoiceNo}</td>
                    <td className="border p-3">{formatDate(sale.invoiceDate)}</td>
                    <td className="border p-3">{formatDate(sale.invoiceDate)}</td>
                    <td className="border p-3">{sale.customerName}</td>
                    <td className="border p-3 font-semibold text-green-600">{formatCurrency(sale.grandTotal)}</td>
                    <td className="border p-3">{formatCurrency(sale.dueAmount)}</td>
                    <td className="border p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.status === 'PENDING' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>{sale.status === 'PENDING' ? 'Pending' : 'Partially Paid'}</span></td>
                    <td className="border p-3">{user?.userName || 'admin'}</td>
                    <td className="border p-3">{formatDate(sale.invoiceDate)}</td>
                    <td className="border p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/sales/orders/${sale.saleId}`)} className="text-blue-600" title="View"><Eye size={17} /></button>
                        {canPay && <button onClick={() => navigate(`/sales/payment-in/create?saleId=${sale.saleId}`)} className="text-green-600" title="Add Payment"><CreditCard size={17} /></button>}
                        {canUpdate && sale.status === 'PENDING' && <button onClick={() => navigate(`/sales/orders/${sale.saleId}/edit`)} className="text-orange-600" title="Edit"><Edit size={17} /></button>}
                        {canDelete && <button onClick={async () => { if (await confirmAction({ title: 'Cancel Sale Order', message: 'Cancel this sale order?', confirmText: 'Cancel', variant: 'danger' })) cancel.mutate(sale.saleId); }} className="text-red-600" title="Cancel"><Ban size={17} /></button>}
                        {canDelete && <button onClick={async () => { if (await confirmAction({ title: 'Delete Sale Order', message: 'Delete this sale order? This cannot be undone.', confirmText: 'Delete', variant: 'danger' })) deleteSale.mutate(sale.saleId); }} className="text-red-600" title="Delete"><Trash2 size={17} /></button>}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={11} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={sales.data?.data?.totalElements || 0}
          page={page}
          totalPages={sales.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};

