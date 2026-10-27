import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit, Eye, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/common/DataTable';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePagination } from '../../../hooks/usePagination';
import { CONSTANTS } from '../../../app/constants';
import { adminContactsApi, customerApi } from '../../../api/endpoints';
import { queryClient } from '../../../app/queryClient';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useAuth } from '../../../hooks/useAuth';
import { useBranch } from '../../../hooks/useBranch';
import { isSuperAdminRole } from '../../../auth/featurePermissions';
import { OrganizationSelector } from '../../users/OrganizationSelector';
import { PERMISSIONS } from '../../../auth/permissions';

export const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { selectedBranchId } = useBranch();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const [organizationId, setOrganizationId] = useState(0);
  const canLoadContacts = isSuperAdmin ? Boolean(organizationId) : Boolean(selectedBranchId);
  const canCreate = hasPermission(PERMISSIONS.CUSTOMER_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.CUSTOMER_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.CUSTOMER_DELETE);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { page, setPage, handlePageChange } = usePagination();
  const debouncedSearch = useDebounce(searchTerm);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', organizationId, page, debouncedSearch],
    queryFn: () => {
      const params = {
        page,
        size: CONSTANTS.ITEMS_PER_PAGE,
        search: debouncedSearch,
      };
      return isSuperAdmin ? adminContactsApi.getCustomers(organizationId, params) : customerApi.getAll(params);
    },
    enabled: canLoadContacts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customerApi.delete(id),
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete customer');
    },
  });

  const columns = [
    { key: 'customerCode', header: 'Customer Code' },
    { key: 'customerName', header: 'Customer Name' },
    { key: 'mobile', header: 'Mobile' },
    { key: 'balance', header: 'Balance', render: (value: number) => formatCurrency(value || 0) },
    {
      key: 'id',
      header: 'Actions',
      render: (value: number) => (
        <div className="flex gap-2">
          <button
            title="View customer"
            onClick={() => navigate(`/contacts/customers/${value}?organizationId=${organizationId}`, { state: { organizationId } })}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Eye size={18} />
          </button>
          {canUpdate && (
            <button
              title="Edit customer"
              onClick={() =>
                navigate(`/contacts/customers/${value}/edit`)
              }
              className="p-1 text-orange-600 hover:bg-orange-50 rounded"
            >
              <Edit size={18} />
            </button>
          )}
          {canDelete && (
            <button
              title="Delete customer"
              onClick={() => setDeleteId(value)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const pageData = data?.data?.content || [];
  const totalPages = data?.data?.totalPages || 1;
  const emptyMessage = isSuperAdmin && !organizationId
    ? 'Select an organization to view customers.'
    : debouncedSearch
      ? 'No customers match your search.'
      : 'No customers found.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers and their information"
        actions={<>
          {isSuperAdmin && <div className="w-full sm:w-80"><OrganizationSelector value={organizationId} onChange={(nextOrganizationId) => { setOrganizationId(nextOrganizationId); setPage(0); }} allowClear label="Organization" clearLabel="Select organization" /></div>}
          {canCreate && <Button onClick={() => {
            if (isSuperAdmin && !organizationId) { toast.error('Select an organization before creating a customer'); return; }
            navigate(isSuperAdmin ? `/contacts/customers/create?organizationId=${organizationId}` : '/contacts/customers/create');
          }} className="flex items-center gap-2"><Plus size={18} />New Customer</Button>}
        </>}
      />

      <DataTable
        columns={columns}
        data={pageData}
        isLoading={isLoading}
        totalPages={totalPages}
        currentPage={page}
        onPageChange={handlePageChange}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search customers..."
        emptyMessage={emptyMessage}
        emptyState="row"
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        isLoading={deleteMutation.isPending}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};
