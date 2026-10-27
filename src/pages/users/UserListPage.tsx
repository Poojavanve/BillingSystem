import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminUsersApi, usersApi } from '../../api/endpoints';
import type { UserListItem } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadCsv, downloadExcel, printTable } from '../../utils/tableExport';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../auth/permissions';
import { isSuperAdminRole } from '../../auth/featurePermissions';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { ListFooter } from '../../components/common/ListFooter';
import { ListToolbarHeader } from '../../components/common/ListToolbarHeader';
import { OrganizationSelector } from './OrganizationSelector';

export const UserListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const { confirmAction, confirmationDialog } = useConfirmation();
  const canCreate = hasPermission(PERMISSIONS.USER_CREATE);
  const canEdit = hasPermission(PERMISSIONS.USER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE);
  const canAssignPermissions = hasPermission(PERMISSIONS.USER_UPDATE);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [organizationId, setOrganizationId] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const debouncedSearch = useDebounce(search);
  const columns = isSuperAdmin
    ? ['Username', 'First Name', 'Last Name', 'Email', 'Mobile', 'Organization', 'Role', 'Status', 'Action']
    : ['Username', 'First Name', 'Last Name', 'Email', 'Mobile', 'Role', 'Status', 'Action'];
  const users = useQuery({
    queryKey: ['users', isSuperAdmin, organizationId, page, pageSize, debouncedSearch],
    queryFn: () => (isSuperAdmin
      ? adminUsersApi.getAll({ organizationId: organizationId || undefined, page, size: pageSize, search: debouncedSearch })
      : usersApi.getAll({ page, size: pageSize, search: debouncedSearch })),
  });
  const rows = users.data?.data?.content || [];
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const remove = useMutation({
    mutationFn: (row: UserListItem) => (isSuperAdmin && row.organizationId
      ? adminUsersApi.delete(row.organizationId, row.id)
      : usersApi.delete(row.id)),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete user'),
  });

  const exportColumns = columns.slice(0, -1);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const getExportRows = () => selectedRows.map((row) => [
    row.userName || row.username || '',
    row.firstName || '',
    row.lastName || '',
    row.email || '',
    row.mobileNo || row.mobile || '',
    ...(isSuperAdmin ? [row.organizationName || ''] : []),
    row.roleName || '',
    row.status === true || row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
  ]);

  const copy = async () => {
    await navigator.clipboard.writeText([exportColumns, ...getExportRows()].map((entry) => entry.join('\t')).join('\n'));
    toast.success('Users copied');
  };
  const download = (extension: 'csv' | 'xls') => {
    if (extension === 'csv') downloadCsv(exportColumns, getExportRows(), 'users');
    else downloadExcel(exportColumns, getExportRows(), 'users', 'Users');
  };
  const printPdf = () => {
    if (!printTable(exportColumns, getExportRows(), 'User List')) {
      toast.error('Please allow popups to print');
    }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return toast.error('Select at least one user');
    const confirmed = await confirmAction({ title: 'Delete Users', message: 'Delete selected users?', confirmText: 'Delete', variant: 'danger' });
    if (!confirmed) return;
    for (const id of selectedIds) {
      const row = rows.find((entry) => entry.id === id);
      if (row) await remove.mutateAsync(row);
    }
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Users &gt; Users List</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ListToolbarHeader
          title="Users List"
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchPlaceholder="Search users..."
          actions={canCreate && <Button onClick={() => navigate('/users/create')} className="min-w-[170px]">Create User</Button>}
        />

        {isSuperAdmin && (
          <div className="border-b px-5 py-4">
            <div className="max-w-xs">
              <OrganizationSelector
                value={organizationId}
                onChange={(id) => { setOrganizationId(id); setPage(0); }}
                allowClear
                label="Organization"
                clearLabel="All Organizations"
                placeholder="Select organization"
              />
            </div>
          </div>
        )}

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
          {users.isLoading ? <div className="p-10"><Loader /></div> : <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                {canDelete && <th className="border p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : rows.map((row) => row.id))} /></th>}
                {columns.map((heading) => <th key={heading} className="border p-3 text-left">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row: UserListItem) => {
                  const isActive = row.status === true || row.status === 'ACTIVE';
                return (
                <tr key={row.id} className="border-b even:bg-gray-50">
                  {canDelete && <td className="border p-3"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td>}
                  <td className="border p-3">{row.userName || row.username || ''}</td>
                  <td className="border p-3">{row.firstName || ''}</td>
                  <td className="border p-3">{row.lastName || ''}</td>
                  <td className="border p-3">{row.email || ''}</td>
                  <td className="border p-3">{row.mobileNo || row.mobile || ''}</td>
                  {isSuperAdmin && <td className="border p-3">{row.organizationName || ''}</td>}
                  <td className="border p-3">{row.roleName || ''}</td>
                  <td className="border p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  <td className="border p-3"><div className="flex gap-2">{canEdit && <button type="button" title="Edit user" onClick={() => navigate(`/users/${row.id}/edit`, { state: row })} className="text-orange-600"><Edit size={16} /></button>}{canAssignPermissions && <button type="button" title="Assign permissions" onClick={() => navigate(`/users/permissions?userId=${row.id}`)} className="text-blue-600"><ShieldCheck size={16} /></button>}{canDelete && <button type="button" title="Delete user" onClick={async () => { if (await confirmAction({ title: 'Delete User', message: 'Delete this user?', confirmText: 'Delete', variant: 'danger' })) remove.mutate(row); }} className="text-red-600"><Trash2 size={16} /></button>}<MoreVertical size={16} /></div></td>
                </tr>
                );
              }) : (
                <tr><td colSpan={columns.length + Number(canDelete)} className="bg-gray-50 p-5 text-center">No data available in table</td></tr>
              )}
            </tbody>
          </table>}
        </div>

        <ListFooter
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rangeStart={page * pageSize + 1}
          rangeEnd={page * pageSize + rows.length}
          total={users.data?.data?.totalElements || 0}
          page={page}
          totalPages={users.data?.data?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>
      {confirmationDialog}
    </div>
  );
};

