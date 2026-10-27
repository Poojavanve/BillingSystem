import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Eye, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customerApi, posApi, salesApi } from '../../../api/endpoints';
import type { SaleListItem } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
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

const exportColumns = ['Sale Code', 'Date', 'Customer', 'Total', 'Balance', 'Status'];

export const SaleListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canDelete = hasPermission(PERMISSIONS.SALES_DELETE);
  const canPrint = hasPermission(PERMISSIONS.SALES_INVOICE_PRINT);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(0);
  const [selectedUser, setSelectedUser] = useState(user?.userName || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debounced = useDebounce(search);

  const customers = useQuery({ queryKey: ['sale-customers'], queryFn: () => customerApi.getAll({ page: 0, size: 100, search: '' }) });
  const sales = useQuery({
    queryKey: ['sales', page, pageSize, debounced, fromDate, toDate],
    queryFn: () => salesApi.getAll({ page, size: pageSize, search: debounced, fromDate: fromDate || undefined, toDate: toDate || undefined }),
  });
  const cancel = useMutation({
    mutationFn: salesApi.cancel,
    onSuccess: () => { toast.success('Selected sale cancelled'); queryClient.invalidateQueries({ queryKey: ['sales'] }); },
    onError: (error: any) => toast.error(error?.message || 'Failed to cancel sale'),
  });
  const deleteSale = useMutation({
    mutationFn: salesApi.delete,
    onSuccess: () => { toast.success('Sale deleted'); queryClient.invalidateQueries({ queryKey: ['sales'] }); },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete sale'),
  });

  const rows = (sales.data?.data?.content || []).filter((sale) =>
    !customerId || customers.data?.data?.content.find((customer) => customer.id === customerId)?.customerName === sale.customerName
  );
  const allSelected = rows.length > 0 && rows.every((sale) => selectedIds.includes(sale.saleId));
  const selectedRows = rows.filter((sale) => selectedIds.includes(sale.saleId));
  const isSalesLoading = sales.isLoading || sales.isFetching;

  const downloadInvoice = async (sale: SaleListItem) => {
    try {
      const pdfBlob = await posApi.downloadInvoicePdf(sale.saleId);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      const safeCustomer = (sale.customerName || 'Customer').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      link.download = `INV_${safeCustomer || 'Customer'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Invoice ${sale.invoiceNo} downloaded`);
    } catch (error: any) { toast.error(error?.message || 'Failed to load invoice'); }
  };
  const statusLabel = (status?: string) => status === 'PENDING' ? 'Pending' : status === 'ACTIVE' ? 'Partially Paid' : status === 'CANCELLED' ? 'Cancelled' : 'Paid';
  const exportRows = () => selectedRows.map((sale) => [sale.invoiceNo, sale.invoiceDate, sale.customerName, sale.grandTotal, sale.dueAmount, statusLabel(sale.status)]);
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'sales');
    else downloadExcel(exportColumns, exportRows(), 'sales', 'Sales');
  };
  const copy = async () => { await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n')); toast.success('Sales copied'); };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Sale List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one sale');
    const confirmed = await confirmAction({ title: 'Delete Sales', message: 'Delete selected sales? This cannot be undone.', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await deleteSale.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home â€º Invoices â€º Sale List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Sale List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search sales..."
        />

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b p-5 md:grid-cols-2">
          <label className="text-sm text-gray-600">Customer
            <select className="mt-1 w-full rounded border px-3 py-2.5" value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))}><option value={0}>Select Customer</option>{customers.data?.data?.content.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerName}</option>)}</select>
          </label>
          <label className="text-sm text-gray-600">User
            <select className="mt-1 w-full rounded border px-3 py-2.5" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Choose one thing</option>{user?.userName && <option value={user.userName}>{user.userName}</option>}</select>
          </label>
          <DateRangeFields fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(0); }} onToDateChange={(value) => { setToDate(value); setPage(0); }} inputClassName="mt-1 w-full rounded border px-3 py-2.5" />
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
          {isSalesLoading ? <div className="p-10"><Loader /></div> : <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{canDelete && <th className="p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((sale) => sale.saleId))} /></th>}{['Sale Code','Date','Customer','Total','Balance','Status','Created by','Created at','Action'].map((heading) => <th key={heading} className="border-b p-3 text-left">{heading}</th>)}</tr></thead>
              <tbody>{rows.map((sale: SaleListItem) => <tr key={sale.saleId} className="border-b even:bg-gray-50">{canDelete && <td className="p-3"><input type="checkbox" checked={selectedIds.includes(sale.saleId)} onChange={() => setSelectedIds((current) => current.includes(sale.saleId) ? current.filter((id) => id !== sale.saleId) : [...current, sale.saleId])} /></td>}<td className="p-3 font-semibold">{sale.invoiceNo}</td><td className="p-3">{formatDate(sale.invoiceDate)}</td><td className="p-3">{sale.customerName}</td><td className="p-3 font-semibold text-green-600">{formatCurrency(sale.grandTotal)}</td><td className="p-3">{formatCurrency(sale.dueAmount)}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.status === 'PAID' ? 'bg-green-100 text-green-700' : sale.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : sale.status === 'PENDING' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>{statusLabel(sale.status)}</span></td><td className="p-3">{user?.userName || 'N/A'}</td><td className="p-3">{formatDate(sale.invoiceDate)}</td><td className="p-3"><div className="flex gap-1"><button title="View sale" onClick={() => navigate(`/sales/invoices/${sale.saleId}`)} className="text-blue-600"><Eye size={17} /></button>{canPrint && <button title="Download invoice PDF" onClick={() => downloadInvoice(sale)} className="text-indigo-600"><FileText size={17} /></button>}{canDelete && <button title="Cancel sale" onClick={async () => { if (await confirmAction({ title: 'Cancel Sale', message: 'Cancel this sale?', confirmText: 'Cancel', variant: 'danger' })) cancel.mutate(sale.saleId); }} className="text-red-600"><Ban size={17} /></button>}</div></td></tr>)}</tbody>
          </table>}
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

