import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { expenseApi, expenseCategoryApi } from '../../api/endpoints';
import type { ExpenseListItem } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { PERMISSIONS } from '../../auth/permissions';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';

const exportColumns = ['Date', 'Expense Number', 'Category', 'Subcategory', 'Amount', 'Payment Type', 'Notes', 'Created by', 'Created at'];
const expenseNumber = (expense: ExpenseListItem) => expense.expenseNo || expense.expenseNumber || `EXP/${expense.expenseId}`;
const expenseCategoryName = (expense: ExpenseListItem) =>
  expense.expenseCategoryName || expense.categoryName || expense.expenseCategory?.name || '';
const expenseSubCategoryName = (expense: ExpenseListItem) =>
  expense.expenseSubCategoryName || expense.subCategoryName || expense.expenseSubCategory?.name || '';
const expensePaymentMethodName = (expense: ExpenseListItem) => {
  if (typeof expense.paymentMethod === 'string') return expense.paymentMethod;
  return expense.paymentMethod?.name || expense.paymentMethodName || expense.paymentType || '';
};

export const ExpenseListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { selectedBranchId } = useBranch();
  const canCreate = hasPermission(PERMISSIONS.EXPENSE_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EXPENSE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EXPENSE_DELETE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const expenses = useQuery({
    queryKey: ['expenses', selectedBranchId, page, pageSize, debouncedSearch],
    queryFn: () => expenseApi.getAll({ page, size: pageSize, search: debouncedSearch }),
    enabled: selectedBranchId !== null,
  });
  const categories = useQuery({
    queryKey: ['expense-categories', selectedBranchId, 'expense-list-filter'],
    queryFn: () => expenseCategoryApi.getAll(''),
    enabled: selectedBranchId !== null,
  });
  const remove = useMutation({
    mutationFn: expenseApi.delete,
    onSuccess: () => {
      toast.success('Expense deleted');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete expense'),
  });

  const categoryOptions = (categories.data?.data?.content || [])
    .filter((category) => category.status === 'ACTIVE' || category.id === categoryId);
  const selectedCategory = categoryOptions.find((category) => category.id === categoryId);
  const rows = (expenses.data?.data?.content || [])
    .filter((expense) => !selectedCategory || expenseCategoryName(expense) === selectedCategory.name);
  const allSelected = rows.length > 0 && rows.every((expense) => selectedIds.includes(expense.expenseId));
  const selectedRows = rows.filter((expense) => selectedIds.includes(expense.expenseId));
  const exportRows = () => selectedRows.map((expense) => [expense.expenseDate, expenseNumber(expense), expenseCategoryName(expense), expenseSubCategoryName(expense), expense.amount, expensePaymentMethodName(expense), expense.notes || '', expense.createdBy || user?.userName || 'admin', expense.createdAt || expense.expenseDate]);
  const copy = async () => { await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n')); toast.success('Expenses copied'); };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'expenses');
    else downloadExcel(exportColumns, exportRows(), 'expenses', 'Expenses');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Expense List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one expense');
    const confirmed = await confirmAction({ title: 'Delete Expenses', message: 'Delete selected expenses?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Expense &gt; Expense List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Expense List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search expenses..."
          actions={canCreate && <Button onClick={() => navigate('/expenses/create')} className="min-w-[165px]">Create Expense</Button>}
        />
        <div className="p-5">
          <label className="block max-w-xs text-sm text-gray-600">
            Category
            <select
              className="mt-1 h-10 w-full rounded border border-gray-300 px-3 disabled:cursor-not-allowed disabled:bg-gray-50"
              value={categoryId}
              disabled={categories.isLoading || categories.isError}
              onChange={(event) => {
                setCategoryId(Number(event.target.value));
                setSelectedIds([]);
              }}
            >
              <option value={0}>
                {categories.isLoading
                  ? 'Loading expense categories...'
                  : categories.isError
                    ? 'Failed to load expense categories'
                    : 'Choose one thing'}
              </option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
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
        <div className="overflow-x-auto px-3 pb-3 pt-3">{expenses.isLoading ? <div className="p-10"><Loader /></div> : <table className="w-full text-sm"><thead className="bg-gray-50"><tr>{canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((expense) => expense.expenseId))} /></th>}{exportColumns.concat('Action').map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}</tr></thead><tbody>{rows.length ? rows.map((expense: ExpenseListItem) => <tr key={expense.expenseId} className="border-b even:bg-gray-50">{canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(expense.expenseId)} onChange={() => setSelectedIds((current) => current.includes(expense.expenseId) ? current.filter((id) => id !== expense.expenseId) : [...current, expense.expenseId])} /></td>}<td className="border p-3">{formatDate(expense.expenseDate)}</td><td className="border p-3 font-semibold">{expenseNumber(expense)}</td><td className="border p-3">{expenseCategoryName(expense) || 'N/A'}</td><td className="border p-3">{expenseSubCategoryName(expense) || 'N/A'}</td><td className="border p-3 font-semibold">{formatCurrency(expense.amount)}</td><td className="border p-3">{expensePaymentMethodName(expense) || 'N/A'}</td><td className="border p-3">{expense.notes || 'N/A'}</td><td className="border p-3">{expense.createdBy || user?.userName || 'admin'}</td><td className="border p-3">{formatDate(expense.createdAt || expense.expenseDate)}</td><td className="border p-3"><div className="flex gap-2">{canUpdate && <button title="Edit expense" onClick={() => navigate(`/expenses/${expense.expenseId}/edit`)} className="text-orange-600"><Edit size={16} /></button>}{canDelete && <button title="Delete expense" onClick={async () => { if (await confirmAction({ title: 'Delete Expense', message: 'Delete this expense?', confirmText: 'Delete', variant: 'danger' })) remove.mutate(expense.expenseId); }} className="text-red-600"><Trash2 size={16} /></button>}</div></td></tr>) : <tr><td colSpan={exportColumns.length + Number(canDelete) + 1} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}</tbody></table>}</div>
        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={expenses.data?.data?.totalElements || 0}
          page={page}
          totalPages={expenses.data?.data?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
