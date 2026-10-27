import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminUnitApi, organizationApi, unitApi } from '../../api/endpoints';
import type { Organization, OrganizationAddress, UpdateOrganizationRequest } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { DateRangeFields, DATE_RANGE_ERROR, isValidDateRange } from '../../components/form/DateRangeFields';
import { Loader } from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { OrganizationForm } from './OrganizationForm';
import {
  emptyOrganizationAddress,
  emptyOrganizationForm,
  getOrganizationDisplayStatus,
  getOrganizationId,
  getOrganizationSubscribed,
  getUploadedOrganizationLogoUrl,
  normalizeOrganizationAddress,
  toOrganizationAddressRequest,
} from './organization.utils';
import { hasTrimmedText, isValidGstin, isValidMobileNumber, PHONE_VALIDATION_MESSAGE } from '../../utils/validation';
import { isSuperAdminRole } from '../../auth/featurePermissions';

const createEmptyForm = (): UpdateOrganizationRequest => ({
  ...emptyOrganizationForm,
  address: { ...emptyOrganizationAddress },
});

const normalizeDateValue = (value?: string) => value ? value.slice(0, 10) : '';
const today = new Date().toISOString().slice(0, 10);

const toForm = (organization: Organization): UpdateOrganizationRequest => ({
  name: organization.name || '',
  description: organization.description || '',
  phone: organization.phone || '',
  gstNumber: organization.gstNumber || '',
  logoUrl: organization.logoUrl || '',
  address: normalizeOrganizationAddress(organization.address),
  status: 'ACTIVE',
  isSubscribed: getOrganizationSubscribed(organization.isSubscribed),
  startDate: normalizeDateValue(organization.startDate),
  endDate: normalizeDateValue(organization.endDate),
});

export const OrganizationEditPage: React.FC = () => {
  const navigate = useNavigate();
  const id = Number(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const state = useLocation().state as Organization | undefined;
  const [form, setForm] = useState<UpdateOrganizationRequest>(state ? toForm(state) : createEmptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const canLoadOrgUnits = Boolean(user?.organizationId) || isSuperAdmin;
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);

  const organizationQuery = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationApi.getById(id),
    enabled: !state && Number.isFinite(id) && id > 0,
    initialData: state ? { success: true, message: '', data: state, timestamp: new Date().toISOString() } : undefined,
  });

  const organizationUnitsQuery = useQuery({
    queryKey: ['organization-units', id],
    queryFn: () => organizationApi.getUnits(id),
    enabled: canLoadOrgUnits && Number.isFinite(id) && id > 0,
  });

  const unitsQuery = useQuery({
    queryKey: ['organization-unit-options', isSuperAdmin ? 'super' : user?.organizationId ?? 'token-org'],
    queryFn: () => (isSuperAdmin ? adminUnitApi.getAll() : unitApi.getAll({ page: 0, size: 500, search: '' })),
    enabled: canLoadOrgUnits,
  });

  const organization = useMemo(() => {
    if (state && getOrganizationId(state) === id) return state;
    return organizationQuery.data?.data;
  }, [id, organizationQuery.data?.data, state]);

  useEffect(() => {
    if (organization) setForm(toForm(organization));
  }, [organization]);

  useEffect(() => {
    if (!canLoadOrgUnits) return;
    const unitIds = organizationUnitsQuery.data?.data?.map((unit) => unit.id) || [];
    setSelectedUnitIds(unitIds);
  }, [canLoadOrgUnits, organizationUnitsQuery.data?.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      let logoUrl = form.logoUrl || '';
      if (logoFile) {
        const uploadResponse = await organizationApi.uploadLogo(id, logoFile);
        logoUrl = getUploadedOrganizationLogoUrl(uploadResponse);
        if (!logoUrl) throw new Error('Logo upload did not return a URL');
      }
      const startDate = normalizeDateValue(form.startDate) || undefined;
      const endDate = normalizeDateValue(form.endDate) || undefined;
      await organizationApi.update(id, {
        ...form,
        status: 'ACTIVE',
        logoUrl,
        address: toOrganizationAddressRequest(form.address),
        // Empty date controls must not be sent as invalid date strings.
        startDate,
        endDate,
        unitIds: canLoadOrgUnits ? selectedUnitIds : undefined,
      });
      return {
        ...organization,
        ...form,
        id,
        status: 'ACTIVE',
        logoUrl,
        address: toOrganizationAddressRequest(form.address),
        startDate,
        endDate,
        unitIds: canLoadOrgUnits ? selectedUnitIds : undefined,
      } as Organization;
    },
    onSuccess: async (updatedOrganization) => {
      toast.success('Organization updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['organization', id] });
      navigate(`/organizations/${id}`, { state: updatedOrganization });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update organization'),
  });

  const set = <K extends keyof UpdateOrganizationRequest>(field: K, value: UpdateOrganizationRequest[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setAddress = <K extends keyof OrganizationAddress>(field: K, value: OrganizationAddress[K]) => {
    setForm((current) => ({ ...current, address: { ...current.address, [field]: value } }));
  };

  const displayStatus = getOrganizationDisplayStatus({ status: 'ACTIVE', endDate: form.endDate });

  const submit = () => {
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Organization id is missing');
      return;
    }
    if (canLoadOrgUnits && unitsQuery.isLoading) {
      toast.error('Please wait for units to load');
      return;
    }
    if (canLoadOrgUnits && unitsQuery.isError) {
      toast.error('Failed to load units');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    if (form.phone && !isValidMobileNumber(form.phone)) {
      toast.error(PHONE_VALIDATION_MESSAGE);
      return;
    }
    if (form.startDate && form.startDate < today) {
      toast.error('Start date cannot be earlier than today');
      return;
    }
    if (!isValidDateRange(form.startDate || '', form.endDate || '')) {
      toast.error(DATE_RANGE_ERROR);
      return;
    }
    mutation.mutate();
  };
  const canSubmit = Number.isFinite(id)
    && id > 0
    && (!canLoadOrgUnits || (!unitsQuery.isLoading && !unitsQuery.isError))
    && hasTrimmedText(form.name)
    && (!form.phone || isValidMobileNumber(form.phone))
    && isValidGstin(form.gstNumber)
    && (!form.startDate || form.startDate >= today)
    && isValidDateRange(form.startDate || '', form.endDate || '');

  if (!state && organizationQuery.isLoading) return <div className="p-10"><Loader /></div>;

  if (!organization) {
    return (
      <div className="space-y-5">
        <div className="text-sm text-gray-500">Home &gt; Organization &gt; Organization List &gt; Edit Organization</div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Organization not found.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/organizations')}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Organization &gt; Organization List &gt; Edit Organization</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Organization Details</h1></div>
        <OrganizationForm
          form={form}
          onChange={set}
          onAddressChange={setAddress}
          statusDisplay={displayStatus}
          showLogoUpload
          logoFile={logoFile}
          onLogoFileChange={setLogoFile}
          showUnitSelection={canLoadOrgUnits}
          units={unitsQuery.data?.data?.content || []}
          selectedUnitIds={selectedUnitIds}
          onSelectedUnitIdsChange={setSelectedUnitIds}
          unitsLoading={unitsQuery.isLoading}
          unitsError={unitsQuery.isError}
        />
        <div className="grid grid-cols-1 gap-4 border-t px-5 py-4 md:grid-cols-2">
          <DateRangeFields
            fromDate={form.startDate || ''}
            toDate={form.endDate || ''}
            fromLabel="Start Date"
            toLabel="End Date"
            fromMinDate={today}
            inputClassName="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onFromDateChange={(value) => set('startDate', value)}
            onToDateChange={(value) => set('endDate', value)}
          />
        </div>
        <div className="flex gap-3 border-t p-5">
          <Button onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Submit</Button>
          <Button variant="secondary" onClick={() => navigate('/organizations')}>Close</Button>
        </div>
      </div>
    </div>
  );
};
