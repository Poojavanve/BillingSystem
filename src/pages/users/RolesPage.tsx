import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { rolesApi } from '../../api/endpoints';
import type { Role } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { PERMISSIONS } from '../../auth/permissions';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatDate';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';

const exportColumns = ['Role Name', 'Status', 'Created at'];
const roleStatusLabel = (role: Role) => (role.status === true || role.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');

export const RolesPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmation();
  const canCreate = hasPermission(PERMISSIONS.ROLE_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ROLE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ROLE_DELETE);
  const showActions = canUpdate || canDelete;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);

  const roles = useQuery({
    queryKey: ['roles', debouncedSearch],
    queryFn: () => rolesApi.getAll(debouncedSearch),
  });

  const remove = useMutation({
    mutationFn: rolesApi.delete,
    onSuccess: () => {
      toast.success('Role deleted');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete role'),
  });

  const allRows = roles.data?.data?.content || [];
  const rows = allRows.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const allSelected = rows.length > 0 && rows.every((role) => selectedIds.includes(role.id));
  const selectedRows = allRows.filter((role) => selectedIds.includes(role.id));
  const exportRows = () => selectedRows.map((role) => [role.name, roleStatusLabel(role), role.createdAt || '']);

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...exportRows()].map((row) => row.join('\t')).join('\n'));
    toast.success('Roles copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, exportRows(), 'roles');
    else downloadExcel(exportColumns, exportRows(), 'roles', 'Roles');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, exportRows(), 'Roles List')) {
      toast.error('Please allow popups to print');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one role');
      return;
    }
    const confirmed = await confirmAction({ title: 'Delete Roles', message: 'Delete selected roles?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) await remove.mutateAsync(id);
    setSelectedIds([]);
  };

  const deleteRole = async (role: Role) => {
    const confirmed = await confirmAction({ title: 'Delete Role', message: `Delete role "${role.name}"?`, confirmText: 'Delete', variant: 'danger' });
    if (confirmed) remove.mutate(role.id);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Users &gt; Permissions &gt; Roles List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Roles List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search roles..."
          actions={canCreate && (
            <Button onClick={() => navigate('/users/roles/create')} className="min-w-[170px]">Create Role</Button>
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
          {roles.isLoading ? (
            <div className="p-10"><Loader /></div>
          ) : (
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((role) => role.id))} /></th>}
                  <th className="border p-3 text-left">Role Name</th>
                  <th className="border p-3 text-center">Status</th>
                  <th className="border p-3 text-left">Created at</th>
                  {showActions && <th className="border p-3 text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((role) => {
                  const isActive = roleStatusLabel(role) === 'ACTIVE';
                  return (
                  <tr key={role.id} className="border-b even:bg-gray-50">
                    {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(role.id)} onChange={() => setSelectedIds((current) => current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id])} /></td>}
                    <td className="border p-3 font-medium">{role.name}</td>
                    <td className="border p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="border p-3">{role.createdAt ? formatDate(role.createdAt) : ''}</td>
                    {showActions && <td className="border p-3">
                      <div className="flex items-center gap-3">
                        {canUpdate && (
                          <button type="button" title="Edit role" aria-label="Edit role" onClick={() => navigate(`/users/roles/${role.id}/edit`)} className="text-orange-600 transition hover:text-orange-700">
                            <Edit size={19} strokeWidth={2.2} />
                          </button>
                        )}
                        {canUpdate && (
                          <button type="button" title="Role settings" aria-label="Role settings" onClick={() => navigate(`/users/roles/${role.id}/edit`)} className="text-blue-600 transition hover:text-blue-700">
                            <ShieldCheck size={20} strokeWidth={2.2} />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" title="Delete role" aria-label="Delete role" onClick={() => deleteRole(role)} className="text-red-600 transition hover:text-red-700">
                            <Trash2 size={19} strokeWidth={2.2} />
                          </button>
                        )}
                        <MoreVertical size={20} strokeWidth={2.4} className="text-slate-900" aria-hidden="true" />
                      </div>
                    </td>}
                  </tr>
                  );
                }) : (
                  <tr><td colSpan={3 + Number(canDelete) + Number(showActions)} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>
                )}
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
          onPageChange={setPage}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};
