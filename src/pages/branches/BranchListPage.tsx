import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { branchApi } from '../../api/endpoints';
import type { Branch } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { PERMISSIONS } from '../../auth/permissions';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';

const exportColumns = ['Branch Code', 'Branch Name', 'City', 'Phone', 'Email', 'Status', 'Created by', 'Created at'];

export const BranchListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.BRANCH_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.BRANCH_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.BRANCH_DELETE);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const { page, setPage, handlePageChange } = usePagination();
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const branches = useQuery({ queryKey: ['branches', search], queryFn: () => branchApi.getAll(search) });
  const remove = useMutation({
    mutationFn: branchApi.delete,
    onSuccess: () => {
      toast.success('Branch deleted');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete branch'),
  });
  const allRows: Branch[] = Array.isArray(branches.data?.data) ? branches.data?.data || [] : [];
  const rows = allRows.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const allSelected = rows.length > 0 && rows.every((branch) => selectedIds.includes(branch.id));
  const selectedRows = allRows.filter((branch) => selectedIds.includes(branch.id));
  const exportRows = () => selectedRows.map((branch) => [
    branch.branchCode,
    branch.branchName,
    branch.city || '',
    branch.phone || '',
    branch.email || '',
    branch.isActive ? 'Active' : 'Inactive',
    branch.createdBy || user?.userName || 'admin',
    branch.createdAt ? formatDate(branch.createdAt) : '',
  ]);
  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Branches copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'branches');
    else downloadExcel(exportColumns, exportRows(), 'branches', 'Branches');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Branch List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one branch');
    const confirmed = await confirmAction({ title: 'Delete Branches', message: 'Delete selected branches?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Management &gt; Branches</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Branch List"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search branches..."
          actions={canCreate && <Button onClick={() => navigate('/branches/create')} className="min-w-[180px]">Create Branch</Button>}
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
          {branches.isLoading ? <div className="p-10"><Loader /></div> : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50"><tr>{canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((branch) => branch.id))} /></th>}{exportColumns.concat('Action').map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}</tr></thead>
              <tbody>
                {rows.length ? rows.map((branch) => (
                  <tr key={branch.id} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(branch.id)} onChange={() => setSelectedIds((current) => current.includes(branch.id) ? current.filter((id) => id !== branch.id) : [...current, branch.id])} /></td>}
                    <td className="border p-3 font-semibold">{branch.branchCode}</td>
                    <td className="border p-3">{branch.branchName}</td>
                    <td className="border p-3">{branch.city || 'N/A'}</td>
                    <td className="border p-3">{branch.phone || 'N/A'}</td>
                    <td className="border p-3">{branch.email || 'N/A'}</td>
                    <td className="border p-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="border p-3">{branch.createdBy || user?.userName || 'admin'}</td>
                    <td className="border p-3">{branch.createdAt ? formatDate(branch.createdAt) : ''}</td>
                    <td className="border p-3"><div className="flex gap-2">{canUpdate && <button title="Edit branch" onClick={() => navigate(`/branches/${branch.id}/edit`, { state: branch })} className="text-orange-600"><Edit size={16} /></button>}{canDelete && <button title="Delete branch" onClick={async () => { if (await confirmAction({ title: 'Delete Branch', message: 'Delete this branch?', confirmText: 'Delete', variant: 'danger' })) remove.mutate(branch.id); }} className="text-red-600"><Trash2 size={16} /></button>}</div></td>
                  </tr>
                )) : <tr><td colSpan={9} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={allRows.length}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
