import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  expenseCategoryApi,
  expenseSubCategoryApi,
  paymentMethodApi,
  type ExpenseCategory,
  type ExpenseSubCategory,
  type PaymentMethod,
} from '../../api/endpoints';
import type { ApiResponse, PageResponse } from '../../api/apiResponse';
import { queryClient } from '../../app/queryClient';
import { PERMISSIONS } from '../../auth/permissions';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';

interface Props {
  type: 'category' | 'subcategory' | 'paymentMethod';
}

type ExpenseMaster = ExpenseCategory | ExpenseSubCategory | PaymentMethod;

const isSubCategory = (record: ExpenseMaster): record is ExpenseSubCategory =>
  'expenseCategoryId' in record;

export const ExpenseMasterListPage: React.FC<Props> = ({ type }) => {
  const categoryMode = type === 'category';
  const subCategoryMode = type === 'subcategory';
  const label = categoryMode
    ? 'Expense Category'
    : subCategoryMode
      ? 'Expense Subcategory'
      : 'Payment Type';
  const basePath = categoryMode
    ? '/expenses/categories'
    : subCategoryMode
      ? '/expenses/subcategories'
      : '/expenses/payment-types';
  const queryKey = categoryMode
    ? 'expense-categories'
    : subCategoryMode
      ? 'expense-subcategories'
      : 'payment-methods';
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { selectedBranchId } = useBranch();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const canCreate = hasPermission(PERMISSIONS.EXPENSE_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EXPENSE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EXPENSE_DELETE);
  const showActions = true;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const records = useQuery<ApiResponse<PageResponse<ExpenseMaster>>>({
    queryKey: [queryKey, selectedBranchId, debouncedSearch],
    queryFn: async () => {
      if (categoryMode) return expenseCategoryApi.getAll(debouncedSearch);
      if (subCategoryMode) return expenseSubCategoryApi.getAll(debouncedSearch);
      return paymentMethodApi.getAll(debouncedSearch);
    },
    enabled: selectedBranchId !== null,
  });

  const remove = useMutation({
    mutationFn: (id: number) => {
      if (categoryMode) return expenseCategoryApi.delete(id);
      if (subCategoryMode) return expenseSubCategoryApi.delete(id);
      return paymentMethodApi.delete(id);
    },
    onSuccess: () => {
      toast.success(`${label} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const allRows = (records.data?.data?.content || []) as ExpenseMaster[];
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const rows = allRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const exportColumns = subCategoryMode
    ? ['Expense Category', 'Name', 'Description', 'Status']
    : ['Name', 'Description', 'Status'];
  const selectedRows = allRows.filter((row) => selectedIds.includes(row.id));
  const exportRows = () => selectedRows.map((row) => subCategoryMode
    ? [isSubCategory(row) ? row.expenseCategoryName || '' : '', row.name, row.description || '', row.status]
    : [row.name, row.description || '', row.status]);

  const copy = async () => {
    await navigator.clipboard.writeText(
      [exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'),
    );
    toast.success(`${label} list copied`);
  };

  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), queryKey);
    else downloadExcel(exportColumns, exportRows(), queryKey, label);
  };

  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), `${label} List`)) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error(`Select at least one ${label.toLowerCase()}`);
      return;
    }
    const confirmed = await confirmAction({ title: `Delete ${label}s`, message: `Delete selected ${label.toLowerCase()} records?`, confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) {
      await remove.mutateAsync(id);
    }
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Expense &gt; {label} List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title={`${label} List`}
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder={`Search ${label.toLowerCase()}...`}
          actions={canCreate && (
            <Button onClick={() => navigate(`${basePath}/create`)} className="min-w-[210px]">
              Create {label}
            </Button>
          )}
        />

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
          {records.isLoading ? (
            <div className="p-10"><Loader /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && <th className="border p-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelectedIds(
                        allSelected
                          ? selectedIds.filter((id) => !rows.some((row) => row.id === id))
                          : Array.from(new Set([...selectedIds, ...rows.map((row) => row.id)])),
                      )}
                    />
                  </th>}
                  {exportColumns.concat(showActions ? 'Action' : []).map((heading) => (
                    <th key={heading} className="border p-3 text-left">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row) => (
                  <tr key={row.id} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => setSelectedIds((current) => current.includes(row.id)
                          ? current.filter((id) => id !== row.id)
                          : [...current, row.id])}
                      />
                    </td>}
                    {subCategoryMode && (
                      <td className="border p-3">
                        {isSubCategory(row) ? row.expenseCategoryName || 'N/A' : 'N/A'}
                      </td>
                    )}
                    <td className="border p-3 font-semibold">{row.name}</td>
                    <td className="border p-3">{row.description || ''}</td>
                    <td className="border p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    {showActions && <td className="border p-3">
                      <div className="flex gap-2">
                        {!categoryMode && !subCategoryMode && <button
                          title={`View ${label}`}
                          onClick={() => navigate(`${basePath}/${row.id}`)}
                          className="text-blue-600"
                        >
                          <Eye size={16} />
                        </button>}
                        {canUpdate && <button
                          title={`Edit ${label}`}
                          onClick={() => navigate(`${basePath}/${row.id}/edit`)}
                          className="text-orange-600"
                        >
                          <Edit size={16} />
                        </button>}
                        {canDelete && <button
                          title={`Delete ${label}`}
                          onClick={async () => {
                            const confirmed = await confirmAction({ title: `Delete ${label}`, message: `Delete this ${label.toLowerCase()}?`, confirmText: 'Delete', variant: 'danger' });
                            if (confirmed) remove.mutate(row.id);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>}
                      </div>
                    </td>}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={exportColumns.length + Number(canDelete) + Number(showActions)} className="bg-gray-50 p-5 text-center">
                      No data available in table
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={safePage * pageSize + 1}
          rangeEnd={safePage * pageSize + rows.length}
          total={allRows.length}
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
