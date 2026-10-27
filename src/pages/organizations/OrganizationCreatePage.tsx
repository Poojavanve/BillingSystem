import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import toast from 'react-hot-toast';
import { adminUnitApi, organizationApi, unitApi } from '../../api/endpoints';
import type { OrganizationAddress, UpdateOrganizationRequest } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { DateRangeFields, DATE_RANGE_ERROR, isValidDateRange } from '../../components/form/DateRangeFields';
import { useAuth } from '../../hooks/useAuth';
import { OrganizationForm } from './OrganizationForm';
import { emptyOrganizationAddress, emptyOrganizationForm, toCreateOrganizationRequest } from './organization.utils';
import { hasSelectedId, hasTrimmedText, isValidGstin, isValidMobileNumber, isValidPincode, PHONE_VALIDATION_MESSAGE } from '../../utils/validation';
import { isSuperAdminRole } from '../../auth/featurePermissions';

const createEmptyForm = (): UpdateOrganizationRequest => ({
  ...emptyOrganizationForm,
  address: { ...emptyOrganizationAddress },
});

type CreateOrganizationForm = UpdateOrganizationRequest & {
  startDate: string;
  endDate: string;
};

const fieldLabels: Record<string, string> = {
  name: 'Organization name',
  description: 'Description',
  phone: 'Phone',
  gstNumber: 'GSTIN',
  'address.addressLine1': 'Address line 1',
  'address.addressLine2': 'Address line 2',
  'address.city': 'City',
  'address.stateId': 'State',
  'address.pincode': 'Pincode',
  startDate: 'Start date',
  endDate: 'End date',
};

const today = new Date().toISOString().slice(0, 10);

export const OrganizationCreatePage: React.FC = () => {
  const { returnFromCreate } = useCreateFlowNavigation('/organizations');
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const canLoadOrgUnits = Boolean(user?.organizationId) || isSuperAdmin;
  const [form, setForm] = useState<CreateOrganizationForm>(() => ({
    ...createEmptyForm(),
    startDate: '',
    endDate: '',
  }));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);

  const unitsQuery = useQuery({
    queryKey: ['organization-unit-options', isSuperAdmin ? 'super' : user?.organizationId ?? 'token-org'],
    queryFn: () => (isSuperAdmin ? adminUnitApi.getAll() : unitApi.getAll({ page: 0, size: 500, search: '' })),
    enabled: canLoadOrgUnits,
  });

  const mutation = useMutation({
    mutationFn: () => organizationApi.create(toCreateOrganizationRequest(form, canLoadOrgUnits ? selectedUnitIds : undefined)),
    onSuccess: async () => {
      toast.success('Organization created successfully');
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      returnFromCreate();
    },
    onError: (error: any) => {
      if (error?.errorCode === 'ORGANIZATION_ALREADY_EXISTS' || error?.errorCode === 'DATA_INTEGRITY_VIOLATION') {
        const message = error?.errorCode === 'ORGANIZATION_ALREADY_EXISTS'
          ? 'An organization with this name already exists'
          : 'This organization name is already in use';
        setValidationErrors({ name: message });
        toast.error(message);
        return;
      }
      const errors = error?.errors;
      if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
        setValidationErrors(errors);
        toast.error('Please correct the highlighted validation errors');
        return;
      }
      toast.error(error?.message || 'Failed to create organization');
    },
  });

  const set = <K extends keyof CreateOrganizationForm>(field: K, value: CreateOrganizationForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors({});
  };

  const setOrganizationField = <K extends keyof UpdateOrganizationRequest>(field: K, value: UpdateOrganizationRequest[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors({});
  };

  const setAddress = <K extends keyof OrganizationAddress>(field: K, value: OrganizationAddress[K]) => {
    setForm((current) => ({ ...current, address: { ...current.address, [field]: value } }));
    setValidationErrors({});
  };

  const submit = () => {
    if (canLoadOrgUnits && unitsQuery.isLoading) {
      toast.error('Please wait for units to load');
      return;
    }
    if (canLoadOrgUnits && unitsQuery.isError) {
      toast.error('Failed to load units');
      return;
    }
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Organization name is required';
    else if (form.name.trim().length < 2 || form.name.trim().length > 150) errors.name = 'Organization name must be between 2 and 150 characters';
    if (form.description.length > 500) errors.description = 'Description cannot exceed 500 characters';
    if (form.phone && !isValidMobileNumber(form.phone)) errors.phone = PHONE_VALIDATION_MESSAGE;
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstNumber)) errors.gstNumber = 'Enter a valid GSTIN';
    if (!form.address.addressLine1.trim()) errors['address.addressLine1'] = 'Address line 1 is required';
    else if (form.address.addressLine1.length > 250) errors['address.addressLine1'] = 'Address line 1 cannot exceed 250 characters';
    if (form.address.addressLine2.length > 250) errors['address.addressLine2'] = 'Address line 2 cannot exceed 250 characters';
    if (!form.address.city.trim()) errors['address.city'] = 'City is required';
    else if (form.address.city.length > 100) errors['address.city'] = 'City cannot exceed 100 characters';
    if (!form.address.stateId) errors['address.stateId'] = 'Please select a state';
    if (!/^[0-9]{5,10}$/.test(form.address.pincode)) errors['address.pincode'] = 'Pincode must contain 5 to 10 digits';
    if (!form.startDate) errors.startDate = 'Start date is required';
    else if (form.startDate < today) errors.startDate = 'Start date cannot be earlier than today';
    if (!form.endDate) errors.endDate = 'End date is required';
    else if (form.startDate && form.endDate && !isValidDateRange(form.startDate, form.endDate)) errors.endDate = DATE_RANGE_ERROR;

    if (Object.keys(errors).length) {
      setValidationErrors(errors);
      toast.error('Please correct the validation errors');
      return;
    }
    setValidationErrors({});
    mutation.mutate();
  };
  const canSubmit = (!canLoadOrgUnits || (!unitsQuery.isLoading && !unitsQuery.isError))
    && hasTrimmedText(form.name, 2)
    && form.name.trim().length <= 150
    && form.description.length <= 500
    && (!form.phone || isValidMobileNumber(form.phone))
    && isValidGstin(form.gstNumber)
    && hasTrimmedText(form.address.addressLine1)
    && form.address.addressLine1.length <= 250
    && form.address.addressLine2.length <= 250
    && hasTrimmedText(form.address.city)
    && form.address.city.length <= 100
    && hasSelectedId(form.address.stateId)
    && isValidPincode(form.address.pincode)
    && Boolean(form.startDate)
    && form.startDate >= today
    && Boolean(form.endDate)
    && isValidDateRange(form.startDate, form.endDate);

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Organization &gt; Organization List &gt; Create Organization</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Organization Details</h1></div>
        {Object.keys(validationErrors).length > 0 && (
          <div className="mx-5 mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Please correct the following fields:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {Object.entries(validationErrors).map(([field, message]) => <li key={field}><span className="font-medium">{fieldLabels[field] || field}:</span> {message}</li>)}
            </ul>
          </div>
        )}
        <OrganizationForm
          form={form}
          onChange={setOrganizationField}
          onAddressChange={setAddress}
          hideSubscribed
          showUnitSelection={canLoadOrgUnits}
          units={unitsQuery.data?.data?.content || []}
          selectedUnitIds={selectedUnitIds}
          onSelectedUnitIdsChange={setSelectedUnitIds}
          unitsLoading={unitsQuery.isLoading}
          unitsError={unitsQuery.isError}
        />
        <div className="grid grid-cols-1 gap-4 p-5 pt-0 md:grid-cols-2">
          <DateRangeFields
            fromDate={form.startDate}
            toDate={form.endDate}
            fromLabel="Start Date *"
            toLabel="End Date *"
            fromMinDate={today}
            inputClassName="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onFromDateChange={(value) => set('startDate', value)}
            onToDateChange={(value) => set('endDate', value)}
          />
        </div>
        <div className="flex gap-3 border-t p-5">
          <Button onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Submit</Button>
          <Button variant="secondary" onClick={returnFromCreate}>Close</Button>
        </div>
      </div>
    </div>
  );
};
