import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { branchApi } from '../../api/endpoints';
import type { Branch, BranchRequest } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { hasTrimmedText, isValidMobileNumber, PHONE_VALIDATION_MESSAGE } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminRole } from '../../auth/featurePermissions';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';

interface Props { mode: 'create' | 'edit' }
const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';

export const BranchFormPage: React.FC<Props> = ({ mode }) => {
  const id = Number(useParams<{ id: string }>().id);
  const { returnFromCreate, returnPath: backPath } = useCreateFlowNavigation('/branches');
  const state = useLocation().state as Branch | undefined;
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const organizationId = Number(new URLSearchParams(backPath.split('?')[1] || '').get('organizationId'));
  const [form, setForm] = useState<BranchRequest>({
    branchCode: state?.branchCode || '',
    branchName: state?.branchName || '',
    email: state?.email || '',
    phone: state?.phone || '',
    address: state?.address || '',
    city: state?.city || '',
    state: state?.state || '',
    country: state?.country || '',
    pincode: state?.pincode || '',
    gstNumber: state?.gstNumber || '',
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'edit') return branchApi.update(id, form);
      return isSuperAdmin ? branchApi.createForOrganization(organizationId, form) : branchApi.create(form);
    },
    onSuccess: async () => {
      toast.success(`Branch ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
      await queryClient.invalidateQueries({ queryKey: ['my-branches'] });
      returnFromCreate();
    },
    onError: (error: any) => toast.error(error?.message || `Failed to ${mode} branch`),
  });
  const set = (field: keyof BranchRequest, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const canSubmit = hasTrimmedText(form.branchCode)
    && hasTrimmedText(form.branchName)
    && (!form.phone || isValidMobileNumber(form.phone))
    && (mode !== 'create' || !isSuperAdmin || (Number.isInteger(organizationId) && organizationId > 0));
  const submit = () => {
    if (!form.branchCode.trim()) return toast.error('Branch code is required.');
    if (!form.branchName.trim()) return toast.error('Branch name is required.');
    if (form.phone && !isValidMobileNumber(form.phone)) return toast.error(PHONE_VALIDATION_MESSAGE);
    if (mode === 'create' && isSuperAdmin && (!Number.isInteger(organizationId) || organizationId <= 0)) {
      return toast.error('Open branch creation from an organization-specific page.');
    }
    mutation.mutate();
  };
  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Management &gt; Branches &gt; {mode === 'edit' ? 'Edit Branch' : 'Create Branch'}</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">Branch Details</h1></div>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <label className="text-sm text-gray-600">Branch Code *<input className={`${inputClass} mt-1`} value={form.branchCode} onChange={(event) => set('branchCode', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Branch Name *<input className={`${inputClass} mt-1`} value={form.branchName} onChange={(event) => set('branchName', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Email<input className={`${inputClass} mt-1`} type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Phone<input className={`${inputClass} mt-1`} type="tel" maxLength={10} value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label>
          <label className="text-sm text-gray-600">City<input className={`${inputClass} mt-1`} value={form.city} onChange={(event) => set('city', event.target.value)} /></label>
          <label className="text-sm text-gray-600">State<input className={`${inputClass} mt-1`} value={form.state} onChange={(event) => set('state', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Country<input className={`${inputClass} mt-1`} value={form.country} onChange={(event) => set('country', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Pincode<input className={`${inputClass} mt-1`} value={form.pincode} onChange={(event) => set('pincode', event.target.value)} /></label>
          <label className="text-sm text-gray-600">GST Number<input className={`${inputClass} mt-1`} value={form.gstNumber} onChange={(event) => set('gstNumber', event.target.value)} /></label>
          <label className="text-sm text-gray-600 md:col-span-2">Address<textarea className="mt-1 h-20 w-full rounded border border-gray-300 p-3" value={form.address} onChange={(event) => set('address', event.target.value)} /></label>
        </div>
        <div className="flex gap-3 border-t p-5"><Button onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Submit</Button><Button variant="secondary" onClick={returnFromCreate}>Close</Button></div>
      </div>
    </div>
  );
};
