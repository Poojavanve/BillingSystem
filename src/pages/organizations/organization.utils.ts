import type { Organization, OrganizationAddress, OrganizationRequest, UpdateOrganizationRequest } from '../../api/endpoints';

export const getOrganizationId = (organization: Organization) => Number((organization as any).id ?? (organization as any).organizationId ?? 0);

export const getOrganizationStatus = (status: Organization['status']) => (status === true || status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');

export type OrganizationDisplayStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export const getOrganizationDisplayStatus = (organization: Pick<Organization, 'status' | 'endDate'>): OrganizationDisplayStatus => {
  if (!organization.endDate) return 'ACTIVE';

  const [year, month, day] = organization.endDate.split('-').map(Number);
  const endDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today >= endDate ? 'EXPIRED' : 'ACTIVE';
};

export const getOrganizationSubscribed = (isSubscribed: Organization['isSubscribed']) => isSubscribed !== false;

export const emptyOrganizationAddress: OrganizationAddress = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateId: 0,
  pincode: '',
};

export const emptyOrganizationForm: UpdateOrganizationRequest = {
  name: '',
  description: '',
  logoUrl: '',
  phone: '',
  gstNumber: '',
  address: emptyOrganizationAddress,
  status: 'ACTIVE',
  isSubscribed: true,
};

export const normalizeOrganizationAddress = (address: Organization['address']): OrganizationAddress => {
  if (!address) return { ...emptyOrganizationAddress };
  if (typeof address === 'string') return { ...emptyOrganizationAddress, addressLine1: address };

  return {
    addressLine1: address.addressLine1 || '',
    addressLine2: address.addressLine2 || '',
    city: address.city || '',
    stateId: Number(address.stateId || 0),
    pincode: address.pincode || '',
    stateName: address.stateName,
  };
};

export const formatOrganizationAddress = (address: Organization['address']) => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address || 'N/A';

  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.stateName,
    address.pincode,
  ].filter(Boolean).join(', ') || 'N/A';
};

export const toOrganizationAddressRequest = (address: OrganizationAddress): OrganizationAddress => ({
  addressLine1: address.addressLine1 || '',
  addressLine2: address.addressLine2 || '',
  city: address.city || '',
  stateId: Number(address.stateId || 0),
  pincode: address.pincode || '',
});

export const toCreateOrganizationRequest = (form: UpdateOrganizationRequest, unitIds?: number[]): OrganizationRequest => ({
  name: form.name,
  description: form.description,
  phone: form.phone,
  gstNumber: form.gstNumber,
  address: toOrganizationAddressRequest(form.address),
  status: form.status,
  isSubscribed: form.isSubscribed,
  startDate: form.startDate || undefined,
  endDate: form.endDate || undefined,
  unitIds,
});

export const toUpdateOrganizationRequest = (organization: Organization, logoUrl: string, unitIds?: number[]): UpdateOrganizationRequest => ({
  name: organization.name || '',
  description: organization.description || '',
  logoUrl,
  phone: organization.phone || '',
  gstNumber: organization.gstNumber || '',
  address: toOrganizationAddressRequest(normalizeOrganizationAddress(organization.address)),
  status: getOrganizationStatus(organization.status),
  isSubscribed: getOrganizationSubscribed(organization.isSubscribed),
  startDate: organization.startDate || '',
  endDate: organization.endDate || '',
  unitIds,
});

const extractLogoUrl = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  const response = value as Record<string, unknown>;
  const directValue = response.objectUrl || response.logoUrl || response.url || response.fileUrl || response.filePath || response.path;
  if (typeof directValue === 'string') return directValue;
  return extractLogoUrl(response.data);
};

export const getUploadedOrganizationLogoUrl = (response: unknown) => extractLogoUrl(response);
