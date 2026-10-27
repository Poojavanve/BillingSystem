import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserRound } from 'lucide-react';
import { adminUsersApi, usersApi } from '../../api/endpoints';
import type { CreateUserRequest, UserListItem } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { OrganizationSelector } from './OrganizationSelector';
import { RoleSelector } from './RoleSelector';
import { BranchSelector } from './BranchSelector';
import { PERMISSIONS } from '../../auth/permissions';
import { isSuperAdminRole } from '../../auth/featurePermissions';
import { hasSelectedId, hasTrimmedText, isValidEmailAddress, isValidMobileNumber, MOBILE_VALIDATION_MESSAGE } from '../../utils/validation';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import { useDebounce } from '../../hooks/useDebounce';

const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';
const USERNAME_PATTERN = /^[A-Za-z0-9]{3,50}$/;

interface Props { mode?: 'create' | 'edit' }

export const UserCreatePage: React.FC<Props> = ({ mode = 'create' }) => {
  const navigate = useNavigate();
  const { navigateToCreate } = useCreateFlowNavigation('/users');
  const id = Number(useParams<{ id: string }>().id);
  const [searchParams] = useSearchParams();
  const state = useLocation().state as UserListItem | undefined;
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = isSuperAdminRole(user?.role);
  const pictureRef = useRef<HTMLInputElement>(null);
  const [picturePreviewUrl, setPicturePreviewUrl] = useState('');
  const [form, setForm] = useState<CreateUserRequest>({
    firstName: state?.firstName || '',
    lastName: state?.lastName || '',
    userName: state?.userName || state?.username || '',
    email: state?.email || '',
    mobileNo: state?.mobileNo || state?.mobile || '',
    roleId: state?.roleId || 0,
    organizationId: Number(searchParams.get('organizationId')) || state?.organizationId || user?.organizationId || 0,
    status: state?.status === false || state?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    branchIds: state?.branchIds || [],
  });
  const debouncedUserName = useDebounce(form.userName, 400);
  const isUserNameValid = USERNAME_PATTERN.test(form.userName);
  const isUserNameCheckCurrent = form.userName === debouncedUserName;
  const userNameCheck = useQuery({
    queryKey: ['users', 'username-exists', debouncedUserName],
    queryFn: () => usersApi.isUserNameTaken(debouncedUserName),
    enabled: mode === 'create' && isUserNameValid && isUserNameCheckCurrent,
    staleTime: 30_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<{ data?: { id?: number } | void }> => {
      if (mode === 'edit') {
        const { organizationId, ...payload } = form;
        return isSuperAdmin && organizationId
          ? adminUsersApi.update(organizationId, id, payload)
          : usersApi.update(id, payload);
      }
      return usersApi.create(form);
    },
    onSuccess: (response) => {
      toast.success(`User ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const createdUserId = mode === 'create' ? (response?.data as { id?: number } | undefined)?.id : undefined;
      navigate(createdUserId ? `/users/permissions?userId=${createdUserId}` : '/users');
    },
    onError: (error: any) => toast.error(error?.message || `Failed to ${mode} user`),
  });

  useEffect(() => () => {
    if (picturePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(picturePreviewUrl);
  }, [picturePreviewUrl]);

  const choosePicture = (file?: File | null) => {
    if (picturePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(picturePreviewUrl);
    if (!file) {
      setPicturePreviewUrl('');
      if (pictureRef.current) pictureRef.current.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Image size must be 1MB or less.');
      return;
    }
    setPicturePreviewUrl(URL.createObjectURL(file));
  };

  const setText = (field: keyof CreateUserRequest, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const canSubmit = hasTrimmedText(form.firstName)
    && hasTrimmedText(form.lastName)
    && hasTrimmedText(form.userName)
    && (mode !== 'create' || isUserNameValid)
    && (mode !== 'create' || isUserNameCheckCurrent)
    && (mode !== 'create' || !userNameCheck.isFetching)
    && (mode !== 'create' || !userNameCheck.isError)
    && (mode !== 'create' || !userNameCheck.data?.data)
    && hasTrimmedText(form.email)
    && isValidEmailAddress(form.email)
    && (!form.mobileNo || isValidMobileNumber(form.mobileNo))
    && hasSelectedId(form.roleId)
    && (!isSuperAdmin || mode !== 'create' || hasSelectedId(form.organizationId))
    && (isSuperAdmin || Boolean(form.branchIds?.length));
  const submit = () => {
    if (!form.firstName.trim()) return toast.error('First name is required');
    if (!form.lastName.trim()) return toast.error('Last name is required');
    if (!form.userName.trim()) return toast.error('Username is required');
    if (mode === 'create' && !isUserNameValid) return toast.error('Username must be 3-50 letters or numbers with no spaces or special characters');
    if (mode === 'create' && !isUserNameCheckCurrent) return toast.error('Wait for username validation to finish');
    if (mode === 'create' && userNameCheck.isFetching) return toast.error('Wait for username validation to finish');
    if (mode === 'create' && userNameCheck.isError) return toast.error('Unable to validate username. Please try again');
    if (mode === 'create' && userNameCheck.data?.data) return toast.error('This username is already taken');
    if (!form.email.trim()) return toast.error('Email is required');
    if (form.mobileNo && !isValidMobileNumber(form.mobileNo)) return toast.error(MOBILE_VALIDATION_MESSAGE);
    if (!form.roleId) return toast.error('Role is required');
    if (mode === 'create' && isSuperAdmin && !form.organizationId) return toast.error('Organization is required');
    if (!isSuperAdmin && (!form.branchIds || form.branchIds.length === 0)) return toast.error('Branch is required');
    mutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Users &gt; Users List &gt; {mode === 'edit' ? 'Edit User' : 'Create User'}</div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">User Details</h1>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-gray-600">User Picture</label>
            <div className="flex items-start gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded border bg-gray-100 text-gray-400">
                {picturePreviewUrl ? <img src={picturePreviewUrl} alt="User" className="h-full w-full object-cover" /> : <UserRound size={64} />}
              </div>
              <div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => pictureRef.current?.click()} className="h-10 rounded border border-blue-500 px-5 text-sm font-semibold text-blue-600">Browse</button>
                  <button type="button" onClick={() => choosePicture(null)} className="h-10 rounded border border-gray-300 px-5 text-sm text-gray-700">Reset</button>
                </div>
                <p className="mt-2 text-sm text-gray-500">Allowed JPG, GIF or PNG. Max size of 1MB</p>
                <input ref={pictureRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(event) => choosePicture(event.target.files?.[0])} />
              </div>
            </div>
          </div>
          {mode === 'create' && isSuperAdmin && (
            <OrganizationSelector
              value={form.organizationId}
              onChange={(organizationId) => setForm((current) => ({
                ...current,
                organizationId,
                roleId: organizationId === current.organizationId ? current.roleId : 0,
                branchIds: organizationId === current.organizationId ? current.branchIds : [],
              }))}
              onCreate={() => navigateToCreate('/organizations/create')}
              canCreate={hasPermission(PERMISSIONS.ORGANIZATION_CREATE)}
            />
          )}
          <label className="text-sm text-gray-600">First Name *<input className={`${inputClass} mt-1`} value={form.firstName} onChange={(event) => setText('firstName', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Last Name *<input className={`${inputClass} mt-1`} value={form.lastName} onChange={(event) => setText('lastName', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Username *
            <input
              className={`${inputClass} mt-1 ${mode === 'create' && form.userName && !isUserNameValid || mode === 'create' && isUserNameCheckCurrent && userNameCheck.data?.data ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
              value={form.userName}
              onChange={(event) => setText('userName', event.target.value)}
            />
            {mode === 'create' && form.userName && !isUserNameValid && <p className="mt-1 text-xs font-medium text-red-600">Use 3-50 letters or numbers only, with no spaces or special characters.</p>}
            {mode === 'create' && form.userName && isUserNameValid && !isUserNameCheckCurrent && <p className="mt-1 text-xs text-gray-500">Waiting to check username...</p>}
            {mode === 'create' && isUserNameCheckCurrent && userNameCheck.isFetching && <p className="mt-1 text-xs text-gray-500">Checking username...</p>}
            {mode === 'create' && isUserNameCheckCurrent && userNameCheck.isError && <p className="mt-1 text-xs font-medium text-red-600">Unable to validate username. Please try again.</p>}
            {mode === 'create' && isUserNameCheckCurrent && userNameCheck.isSuccess && userNameCheck.data.data && <p className="mt-1 text-xs font-medium text-red-600">This username is already taken.</p>}
            {mode === 'create' && isUserNameCheckCurrent && userNameCheck.isSuccess && !userNameCheck.data.data && <p className="mt-1 text-xs font-medium text-green-600">Username is available.</p>}
          </label>
          <label className="text-sm text-gray-600">Email Address *<input className={`${inputClass} mt-1`} type="email" value={form.email} onChange={(event) => setText('email', event.target.value)} /></label>
          <label className="text-sm text-gray-600">Mobile<input className={`${inputClass} mt-1`} type="tel" maxLength={10} value={form.mobileNo} onChange={(event) => setText('mobileNo', event.target.value)} /></label>
          <RoleSelector
            organizationId={form.organizationId}
            value={form.roleId}
            onChange={(roleId) => setForm((current) => ({ ...current, roleId }))}
            allowedRoleNames={isSuperAdmin ? ['Admin'] : ['Manager','Employee']}
            onCreate={() => navigateToCreate(`/users/roles/create?organizationId=${form.organizationId}`)}
          />
          <BranchSelector
            organizationId={form.organizationId}
            value={form.branchIds || []}
            onChange={(branchIds) => setForm((current) => ({ ...current, branchIds }))}
            onCreate={() => navigateToCreate('/branches/create')}
          />
          <label className="text-sm text-gray-600">
            Status
            <select className={`${inputClass} mt-1`} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreateUserRequest['status'] }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3 border-t p-5">
          <Button type="button" isLoading={mutation.isPending} onClick={submit} disabled={!canSubmit || mutation.isPending}>Submit</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/users')}>Close</Button>
        </div>
      </div>
    </div>
  );
};
