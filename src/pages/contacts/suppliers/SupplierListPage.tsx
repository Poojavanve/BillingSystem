import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminContactsApi, supplierApi } from '../../../api/endpoints';
import { CONSTANTS } from '../../../app/constants';
import { queryClient } from '../../../app/queryClient';
import { DataTable } from '../../../components/common/DataTable';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePagination } from '../../../hooks/usePagination';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useAuth } from '../../../hooks/useAuth';
import { useBranch } from '../../../hooks/useBranch';
import { isSuperAdminRole } from '../../../auth/featurePermissions';
import { OrganizationSelector } from '../../users/OrganizationSelector';
import { PERMISSIONS } from '../../../auth/permissions';

export const SupplierListPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { selectedBranchId } = useBranch();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const [organizationId, setOrganizationId] = useState(0);
  const canLoadContacts = isSuperAdmin ? Boolean(organizationId) : Boolean(selectedBranchId);
  const canCreate = hasPermission(PERMISSIONS.SUPPLIER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.SUPPLIER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.SUPPLIER_DELETE);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { page, setPage, handlePageChange } = usePagination();
  const debouncedSearch = useDebounce(searchTerm);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', organizationId, page, debouncedSearch],
    queryFn: () => {
      const params = { page, size: CONSTANTS.ITEMS_PER_PAGE, search: debouncedSearch };
      return isSuperAdmin ? adminContactsApi.getSuppliers(organizationId, params) : supplierApi.getAll(params);
    },
    enabled: canLoadContacts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => supplierApi.delete(id),
    onSuccess: () => {
      toast.success('Supplier deleted successfully');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete supplier'),
  });

  const columns = [
    { key: 'supplierCode', header: 'Supplier Code' },
    { key: 'supplierName', header: 'Supplier Name' },
    { key: 'mobile', header: 'Mobile' },
    { key: 'balance', header: 'Balance', render: (value: number) => formatCurrency(value || 0) },
    {
      key: 'id',
      header: 'Actions',
      render: (value: number) => (
        <div className="flex gap-2">
          <button title="View supplier" aria-label="View supplier" onClick={() => navigate(`/contacts/suppliers/${value}?organizationId=${organizationId}`, { state: { organizationId } })} className="rounded p-1 text-blue-600 hover:bg-blue-50"><Eye size={18} /></button>
          {canUpdate && <button title="Edit supplier" aria-label="Edit supplier" onClick={() => navigate(`/contacts/suppliers/${value}/edit`)} className="rounded p-1 text-orange-600 hover:bg-orange-50"><Edit size={18} /></button>}
          {canDelete && <button title="Delete supplier" aria-label="Delete supplier" onClick={() => setDeleteId(value)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>}
        </div>
      ),
    },
  ];
  const emptyMessage = isSuperAdmin && !organizationId
    ? 'Select an organization to view suppliers.'
    : debouncedSearch
      ? 'No suppliers match your search.'
      : 'No suppliers found.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage your suppliers and their information"
        actions={<>
          {isSuperAdmin && <div className="w-full sm:w-80"><OrganizationSelector value={organizationId} onChange={(nextOrganizationId) => { setOrganizationId(nextOrganizationId); setPage(0); }} allowClear label="Organization" clearLabel="Select organization" /></div>}
          {canCreate && <Button onClick={() => {
            if (isSuperAdmin && !organizationId) { toast.error('Select an organization before creating a supplier'); return; }
            navigate(isSuperAdmin ? `/contacts/suppliers/create?organizationId=${organizationId}` : '/contacts/suppliers/create');
          }} className="flex items-center gap-2"><Plus size={18} />New Supplier</Button>}
        </>}
      />
      <DataTable
        columns={columns}
        data={data?.data?.content || []}
        isLoading={isLoading}
        totalPages={data?.data?.totalPages || 1}
        currentPage={page}
        onPageChange={handlePageChange}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search suppliers..."
        emptyMessage={emptyMessage}
        emptyState="row"
      />
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        isLoading={deleteMutation.isPending}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};
