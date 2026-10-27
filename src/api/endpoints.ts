import axiosClient from './axiosClient';
import type { ApiResponse, PageResponse } from './apiResponse';
import type { LoginRequest, LoginResponse } from '../types/auth.types';
import type { CustomerDetail, CustomerListItem } from '../types/customer.types';
import type { CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer.types';
import type { SupplierDetail, SupplierListItem } from '../types/supplier.types';
import type { CreateSupplierRequest, UpdateSupplierRequest } from '../types/supplier.types';
import type { Carrier, CreateCarrierRequest, UpdateCarrierRequest } from '../types/carrier.types';
import type {
  PaymentNoteAssignRequest,
  PaymentNoteAuditEntry,
  PaymentNoteDetail,
  PaymentNoteListItem,
  PaymentNoteRequest,
  PaymentNoteStatusUpdateRequest,
} from '../types/payment-note.types';
import type {
  Branch,
  BranchRequest,
  ChangePasswordRequest,
  Country,
  CreateUserRequest,
  ExpenseDetail,
  ExpenseCategory,
  ExpenseCategoryRequest,
  ExpenseListItem,
  ExpenseRequest,
  ExpenseSubCategory,
  ExpenseSubCategoryRequest,
  ItemListQuery,
  ItemListItem,
  PosItemSearchItem,
  ItemCreateResponse,
  ItemExcelImportResult,
  ItemImageUploadResponse,
  ItemRequest,
  ItemStock,
  HsnMaster,
  HsnRequest,
  GstRateMaster,
  GstRateRequest,
  GstHsnRateMapping,
  GstHsnRateMappingRequest,
  EmailSendRequest,
  MessageTemplate,
  MessageTemplateRequest,
  Organization,
  OrganizationLogoUploadResponse,
  OrganizationRequest,
  OrganizationUnit,
  OrganizationUnitsRequest,
  PaymentDetail,
  PaymentInRequest,
  PaymentListItem,
  PaymentMethod,
  PaymentMethodRequest,
  PaymentOutCreateResponse,
  PaymentOutRequest,
  PurchaseCreateResponse,
  PosBillingRequest,
  PosBillingResponse,
  QuotationCreateResponse,
  QuotationDetail,
  QuotationListItem,
  QuotationRequest,
  PurchaseDetail,
  PurchaseListItem,
  PurchaseRequest,
  PurchaseReturnDetail,
  PurchaseReturnListItem,
  PurchaseReturnRequest,
  Role,
  RoleRequest,
  SaleDetail,
  SalesCreateResponse,
  SaleInvoice,
  SaleListItem,
  SaleRequest,
  SimpleMaster,
  SimpleMasterRequest,
  SmsSendRequest,
  State,
  StockAdjustmentDetail,
  StockAdjustmentListItem,
  StockAdjustmentRequest,
  StockTransferDetail,
  StockTransferListItem,
  StockTransferRequest,
  Unit,
  UnitRequest,
  UpdateProfileRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
  UserCreateResponse,
  UserListItem,
  UserProfile,
  Warehouse,
  WarehouseRequest,
  DashboardSummary,
  GstSummaryReport,
  StockReportItem,
  TopSellingItem,
  AssignedPermission,
  AssignUserPermissionsRequest,
  PermissionGroups,
} from '../types/api.types';

export type {
  Branch,
  BranchRequest,
  ChangePasswordRequest,
  Country,
  CreateUserRequest,
  ExpenseDetail,
  ExpenseCategory,
  ExpenseCategoryRequest,
  ExpenseItemRequest,
  ExpenseItemResponse,
  ExpenseListItem,
  ExpenseMasterStatus,
  ExpenseRequest,
  ExpenseSubCategory,
  ExpenseSubCategoryRequest,
  ItemListItem,
  PosItemSearchItem,
  ItemListQuery,
  ItemCreateResponse,
  ItemImageUploadResponse,
  ItemRequest,
  ItemStock,
  HsnMaster,
  HsnRequest,
  GstRateMaster,
  GstRateRequest,
  GstHsnRateMapping,
  GstHsnRateMappingRequest,
  EmailSendRequest,
  MessageTemplate,
  MessageTemplateRequest,
  Organization,
  OrganizationAddress,
  OrganizationLogoUploadResponse,
  OrganizationRequest,
  OrganizationUnit,
  OrganizationUnitsRequest,
  PaymentDetail,
  PaymentInRequest,
  PaymentListItem,
  PaymentMethod,
  PaymentMethodRequest,
  PaymentOutCreateResponse,
  PaymentOutRequest,
  PurchaseCreateResponse,
  PosBillingRequest,
  PosBillingResponse,
  QuotationCreateResponse,
  QuotationDetail,
  QuotationListItem,
  QuotationRequest,
  PurchaseDetail,
  PurchaseListItem,
  PurchaseRequest,
  PurchaseReturnDetail,
  PurchaseReturnListItem,
  PurchaseReturnRequest,
  Role,
  RoleRequest,
  SaleDetail,
  SalesCreateResponse,
  SaleInvoice,
  SaleListItem,
  SaleRequest,
  SimpleMaster,
  SimpleMasterRequest,
  SmsSendRequest,
  State,
  StockAdjustmentDetail,
  StockAdjustmentListItem,
  StockAdjustmentRequest,
  StockTransferDetail,
  StockTransferListItem,
  StockTransferRequest,
  Unit,
  UnitRequest,
  UpdateProfileRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
  UserCreateResponse,
  UserListItem,
  UserProfile,
  Warehouse,
  WarehouseRequest,
  GstSummaryReport,
  AssignedPermission,
  AssignUserPermissionsRequest,
  PermissionGroups,
} from '../types/api.types';

export type {
  PaymentNoteAssignRequest,
  PaymentNoteAuditEntry,
  PaymentNoteDetail,
  PaymentNoteListItem,
  PaymentNoteRequest,
  PaymentNoteStatusUpdateRequest,
} from '../types/payment-note.types';

const normalizeLocationResponse = <T,>(response: ApiResponse<T[]> | T[]): ApiResponse<T[]> => {
  if (Array.isArray(response)) {
    return {
      success: true,
      message: '',
      data: response,
      timestamp: new Date().toISOString(),
    };
  }
  return response;
};

export const authApi = {
  login: (payload: LoginRequest) =>
    axiosClient.post<ApiResponse<LoginResponse>, ApiResponse<LoginResponse>>('/api/v1/auth/login', payload),
};

export const locationApi = {
  getCountries: async () =>
    normalizeLocationResponse(await axiosClient.get<ApiResponse<Country[]> | Country[], ApiResponse<Country[]> | Country[]>('/api/v1/countries')),
  getStates: async () =>
    normalizeLocationResponse(await axiosClient.get<ApiResponse<State[]> | State[], ApiResponse<State[]> | State[]>('/api/v1/states')),
};

const normalizeOrganizationList = (response: ApiResponse<Organization[] | PageResponse<Organization>> | Organization[]) => {
  if (Array.isArray(response)) {
    return {
      success: true,
      message: '',
      data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<Organization>,
      timestamp: new Date().toISOString(),
    };
  }
  const data: any = response.data;
  if (Array.isArray(data)) {
    return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<Organization> };
  }
  return response as ApiResponse<PageResponse<Organization>>;
};

export const organizationApi = {
  getAll: async (search = '') =>
    normalizeOrganizationList(await axiosClient.get<ApiResponse<Organization[] | PageResponse<Organization>> | Organization[], ApiResponse<Organization[] | PageResponse<Organization>> | Organization[]>('/api/v1/organizations', { params: { search } })),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Organization>, ApiResponse<Organization>>(`/api/v1/organizations/${id}`),
  getUnits: (id: number) =>
    axiosClient.get<ApiResponse<OrganizationUnit[]>, ApiResponse<OrganizationUnit[]>>(`/api/v1/organizations/${id}/units`),
  create: (payload: OrganizationRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/organizations', payload),
  update: (id: number, payload: UpdateOrganizationRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/organizations/${id}`, payload),
  assignUnits: (id: number, payload: OrganizationUnitsRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/organizations/${id}/units`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/organizations/${id}`),
  uploadLogo: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<ApiResponse<OrganizationLogoUploadResponse>, ApiResponse<OrganizationLogoUploadResponse>>(`/api/v1/organizations/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const customerApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<CustomerListItem>>, ApiResponse<PageResponse<CustomerListItem>>>('/api/v1/customers', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<CustomerDetail>, ApiResponse<CustomerDetail>>(`/api/v1/customers/${id}`),
  create: (payload: CreateCustomerRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/customers', payload),
  update: (id: number, payload: UpdateCustomerRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/customers/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/customers/${id}`),
};

export const supplierApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<SupplierListItem>>, ApiResponse<PageResponse<SupplierListItem>>>('/api/v1/suppliers', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<SupplierDetail>, ApiResponse<SupplierDetail>>(`/api/v1/suppliers/${id}`),
  create: (payload: CreateSupplierRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/suppliers', payload),
  update: (id: number, payload: UpdateSupplierRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/suppliers/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/suppliers/${id}`),
};

export const carrierApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<Carrier>>, ApiResponse<PageResponse<Carrier>>>('/api/v1/carriers', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Carrier>, ApiResponse<Carrier>>(`/api/v1/carriers/${id}`),
  create: (payload: CreateCarrierRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/carriers', payload),
  update: (id: number, payload: UpdateCarrierRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/carriers/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/carriers/${id}`),
};

export const dashboardApi = {
  getSummary: (params?: { fromDate?: string; toDate?: string }) =>
    axiosClient.get<ApiResponse<DashboardSummary>, ApiResponse<DashboardSummary>>('/api/v1/dashboard/summary', { params }),
};

export const itemApi = {
  getAll: (params?: ItemListQuery) =>
    axiosClient.get<ApiResponse<PageResponse<ItemListItem>>, ApiResponse<PageResponse<ItemListItem>>>('/api/v1/items', { params }),
  searchPosItems: (search: string) =>
    axiosClient.get<ApiResponse<PosItemSearchItem[]>, ApiResponse<PosItemSearchItem[]>>('/api/v1/items/search', { params: { search } }),
  getById: (id: number, warehouseId?: number) =>
    axiosClient.get<ApiResponse<ItemListItem>, ApiResponse<ItemListItem>>(`/api/v1/items/${id}`, { params: warehouseId ? { warehouseId } : undefined }),
  getStock: (id: number) =>
    axiosClient.get<ApiResponse<ItemStock>, ApiResponse<ItemStock>>(`/api/v1/items/${id}/stock`),
  create: (payload: ItemRequest) =>
    axiosClient.post<ApiResponse<ItemCreateResponse>, ApiResponse<ItemCreateResponse>>('/api/v1/items', payload),
  update: (id: number, payload: ItemRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/items/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/items/${id}`),
  uploadLogo: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<ApiResponse<ItemImageUploadResponse>, ApiResponse<ItemImageUploadResponse>>(`/api/v1/items/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

const normalizeMasterList = (response: ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>) => {
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<SimpleMaster> };
  return response as ApiResponse<PageResponse<SimpleMaster>>;
};

const normalizeUnitList = (response: ApiResponse<Unit[] | PageResponse<Unit>> | Unit[]) => {
  if (Array.isArray(response)) return { success: true, message: '', data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<Unit>, timestamp: new Date().toISOString() };
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<Unit> };
  return response as ApiResponse<PageResponse<Unit>>;
};

const normalizeHsnList = (response: ApiResponse<HsnMaster[] | PageResponse<HsnMaster>> | HsnMaster[]) => {
  if (Array.isArray(response)) return { success: true, message: '', data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<HsnMaster>, timestamp: new Date().toISOString() };
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<HsnMaster> };
  return response as ApiResponse<PageResponse<HsnMaster>>;
};

const normalizeGstRateList = (response: ApiResponse<GstRateMaster[] | PageResponse<GstRateMaster>> | GstRateMaster[]) => {
  if (Array.isArray(response)) return { success: true, message: '', data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<GstRateMaster>, timestamp: new Date().toISOString() };
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<GstRateMaster> };
  return response as ApiResponse<PageResponse<GstRateMaster>>;
};

const normalizeGstHsnMappingList = (response: ApiResponse<GstHsnRateMapping[] | PageResponse<GstHsnRateMapping>> | GstHsnRateMapping[]) => {
  if (Array.isArray(response)) return { success: true, message: '', data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<GstHsnRateMapping>, timestamp: new Date().toISOString() };
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<GstHsnRateMapping> };
  return response as ApiResponse<PageResponse<GstHsnRateMapping>>;
};

export const categoryApi = {
  getAll: async (params?: any) => normalizeMasterList(await axiosClient.get<ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>, ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>>('/api/v1/categories', { params })),
  create: (payload: SimpleMasterRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/categories', payload),
  update: (id: number, payload: SimpleMasterRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/categories/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/categories/${id}`),
};

export const brandApi = {
  getAll: async (params?: any) => normalizeMasterList(await axiosClient.get<ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>, ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>>('/api/v1/brands', { params })),
  getByCategoryId: async (categoryId: number) =>
    normalizeMasterList(await axiosClient.get<ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>, ApiResponse<SimpleMaster[] | PageResponse<SimpleMaster>>>(`/api/v1/brands/category/${categoryId}`)),
  create: (payload: SimpleMasterRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/brands', payload),
  createBulk: (payload: { categoryId: number; names: string[]; description?: string }) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/brands/bulk', payload),
  update: (id: number, payload: SimpleMasterRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/brands/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/brands/${id}`),
};

export const unitApi = {
  getAll: async (params?: any) => normalizeUnitList(await axiosClient.get<ApiResponse<Unit[] | PageResponse<Unit>> | Unit[], ApiResponse<Unit[] | PageResponse<Unit>> | Unit[]>('/api/v1/units', { params })),
  create: (payload: UnitRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/units', payload),
  update: (id: number, payload: UnitRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/units/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/units/${id}`),
};

export const adminUnitApi = {
  getAll: async (params?: { search?: string }) =>
    normalizeUnitList(await axiosClient.get<ApiResponse<Unit[] | PageResponse<Unit>> | Unit[], ApiResponse<Unit[] | PageResponse<Unit>> | Unit[]>('/api/v2/admin/units', { params })),
};

export const hsnApi = {
  getAll: async (params?: any) => normalizeHsnList(await axiosClient.get<ApiResponse<HsnMaster[] | PageResponse<HsnMaster>> | HsnMaster[], ApiResponse<HsnMaster[] | PageResponse<HsnMaster>> | HsnMaster[]>('/api/v1/hsn-masters', { params })),
  getById: (id: number) => axiosClient.get<ApiResponse<HsnMaster>, ApiResponse<HsnMaster>>(`/api/v1/hsn-masters/${id}`),
  create: (payload: HsnRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/hsn-masters', payload),
  update: (id: number, payload: HsnRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/hsn-masters/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/hsn-masters/${id}`),
};

export const gstRateApi = {
  getAll: async (params?: any) => normalizeGstRateList(await axiosClient.get<ApiResponse<GstRateMaster[] | PageResponse<GstRateMaster>> | GstRateMaster[], ApiResponse<GstRateMaster[] | PageResponse<GstRateMaster>> | GstRateMaster[]>('/api/v1/gst-rates', { params })),
  getById: (id: number) => axiosClient.get<ApiResponse<GstRateMaster>, ApiResponse<GstRateMaster>>(`/api/v1/gst-rates/${id}`),
  create: (payload: GstRateRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/gst-rates', payload),
  update: (id: number, payload: GstRateRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/gst-rates/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/gst-rates/${id}`),
};

export const gstHsnRateMappingApi = {
  getAll: async (params?: any) => normalizeGstHsnMappingList(await axiosClient.get<ApiResponse<GstHsnRateMapping[] | PageResponse<GstHsnRateMapping>> | GstHsnRateMapping[], ApiResponse<GstHsnRateMapping[] | PageResponse<GstHsnRateMapping>> | GstHsnRateMapping[]>('/api/v1/gst-hsn-mappings', { params })),
  getById: (id: number) => axiosClient.get<ApiResponse<GstHsnRateMapping>, ApiResponse<GstHsnRateMapping>>(`/api/v1/gst-hsn-mappings/${id}`),
  create: (payload: GstHsnRateMappingRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/gst-hsn-mappings', payload),
  update: (id: number, payload: GstHsnRateMappingRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/gst-hsn-mappings/${id}`, payload),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/gst-hsn-mappings/${id}`),
};

export const warehouseApi = {
  getAll: (search = '') =>
    axiosClient.get<ApiResponse<Warehouse[]>, ApiResponse<Warehouse[]>>('/api/v1/warehouses', { params: { search } }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Warehouse>, ApiResponse<Warehouse>>(`/api/v1/warehouses/${id}`),
  create: (payload: WarehouseRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/warehouses', payload),
  update: (id: number, payload: WarehouseRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/warehouses/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/warehouses/${id}`),
};

export const branchApi = {
  createForOrganization: (organizationId: number, payload: BranchRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>(`/api/v2/admin/organizations/${organizationId}/branches`, payload),
  getAll: (search = '') =>
    axiosClient.get<ApiResponse<Branch[]>, ApiResponse<Branch[]>>('/api/v1/branches', { params: { search } }),
  getByOrganizationId: (organizationId: number) =>
    axiosClient.get<ApiResponse<Branch[]>, ApiResponse<Branch[]>>(`/api/v1/branches/organization/${organizationId}`),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Branch>, ApiResponse<Branch>>(`/api/v1/branches/${id}`),
  create: (payload: BranchRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/branches', payload),
  update: (id: number, payload: BranchRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/branches/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/branches/${id}`),
  getMine: () =>
    axiosClient.get<ApiResponse<Branch[]>, ApiResponse<Branch[]>>('/api/v1/users/me/branches'),
};

export const excelImportApi = {
  downloadContactsTemplate: () =>
    axiosClient.get<Blob, Blob>('/api/v1/contacts/excel/template', { responseType: 'blob' }),
  importContacts: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/contacts/excel/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadItemsTemplate: () =>
    axiosClient.get<Blob, Blob>('/api/v1/items/excel/template', { responseType: 'blob' }),
  importItems: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post<ApiResponse<ItemExcelImportResult>, ApiResponse<ItemExcelImportResult>>('/api/v1/items/excel/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

type MessageTemplateType = 'sms' | 'email';

const messageTemplateBasePath = (type: MessageTemplateType) => `/api/v1/${type}`;

export const messageTemplateApi = {
  getAll: (type: MessageTemplateType, params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<MessageTemplate>>, ApiResponse<PageResponse<MessageTemplate>>>(`${messageTemplateBasePath(type)}/templates`, { params }),
  getById: (type: MessageTemplateType, id: number) =>
    axiosClient.get<ApiResponse<MessageTemplate>, ApiResponse<MessageTemplate>>(`${messageTemplateBasePath(type)}/templates/${id}`),
  create: (type: MessageTemplateType, payload: MessageTemplateRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>(`${messageTemplateBasePath(type)}/templates`, payload),
  update: (type: MessageTemplateType, id: number, payload: MessageTemplateRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`${messageTemplateBasePath(type)}/templates/${id}`, payload),
  delete: (type: MessageTemplateType, id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`${messageTemplateBasePath(type)}/templates/${id}`),
};

export const emailApi = {
  send: ({ emailIds, subject, message, file }: EmailSendRequest) => {
    const formData = new FormData();
    formData.append('emailIds', emailIds);
    formData.append('subject', subject);
    formData.append('message', message);
    if (file) {
      formData.append('file', file);
    }

    return axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/email/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const smsApi = {
  send: (payload: SmsSendRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/sms/send', payload),
};

export const usersApi = {
  getAll: async (params?: any) => normalizeUserList(await axiosClient.get<ApiResponse<UserListItem[] | PageResponse<UserListItem>> | UserListItem[], ApiResponse<UserListItem[] | PageResponse<UserListItem>> | UserListItem[]>('/api/v1/users', { params })),
  isUserNameTaken: (userName: string) =>
    axiosClient.get<ApiResponse<boolean>, ApiResponse<boolean>>('/api/v1/users/username-exists', { params: { userName } }),
  create: (payload: CreateUserRequest) =>
    axiosClient.post<ApiResponse<UserCreateResponse>, ApiResponse<UserCreateResponse>>('/api/v1/users', payload),
  update: (id: number, payload: UpdateUserRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/users/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/users/${id}`),
  getProfile: () =>
    axiosClient.get<ApiResponse<UserProfile>, ApiResponse<UserProfile>>('/api/v1/users/profile'),
  updateProfile: (payload: UpdateProfileRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>('/api/v1/users/update-profile', payload),
  changePassword: (payload: ChangePasswordRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>('/api/v1/users/change-password', payload),
};

export const permissionsApi = {
  getAll: () =>
    axiosClient.get<ApiResponse<PermissionGroups>, ApiResponse<PermissionGroups>>('/api/v1/permissions'),
  getCurrentUser: () =>
    axiosClient.get<ApiResponse<AssignedPermission[]>, ApiResponse<AssignedPermission[]>>('/api/v1/permissions/users/me'),
  getForUser: (userId: number) =>
    axiosClient.get<ApiResponse<AssignedPermission[]>, ApiResponse<AssignedPermission[]>>(`/api/v1/permissions/users/${userId}`),
  assignToUser: (payload: AssignUserPermissionsRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/permissions/users/assign', payload),
};

const normalizeUserList = (response: ApiResponse<UserListItem[] | PageResponse<UserListItem>> | UserListItem[]) => {
  if (Array.isArray(response)) return { success: true, message: '', data: { content: response, page: 0, size: response.length, totalElements: response.length, totalPages: 1, last: true } as PageResponse<UserListItem>, timestamp: new Date().toISOString() };
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<UserListItem> };
  return response as ApiResponse<PageResponse<UserListItem>>;
};

const normalizeRoleList = (response: ApiResponse<Role[] | PageResponse<Role>>) => {
  const data: any = response.data;
  if (Array.isArray(data)) return { ...response, data: { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1, last: true } as PageResponse<Role> };
  return response as ApiResponse<PageResponse<Role>>;
};

export const rolesApi = {
  getAll: async (search = '') =>
    normalizeRoleList(await axiosClient.get<ApiResponse<Role[] | PageResponse<Role>>, ApiResponse<Role[] | PageResponse<Role>>>('/api/v1/roles', { params: { search } })),
  getByOrganizationId: async (organizationId: number) =>
    normalizeRoleList(await axiosClient.get<ApiResponse<Role[]>, ApiResponse<Role[]>>(`/api/v1/roles/organization/${organizationId}`)),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<Role>, ApiResponse<Role>>(`/api/v1/roles/${id}`),
  create: (payload: RoleRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/roles', payload),
  update: (id: number, payload: RoleRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/roles/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/roles/${id}`),
};

export const adminRolesApi = {
  create: (payload: RoleRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v2/admin/organizations/roles', payload),
  getAll: (params?: { organizationId?: number; search?: string }) =>
    axiosClient.get<ApiResponse<Role[]>, ApiResponse<Role[]>>('/api/v2/admin/roles', { params }),
};

export const adminUsersApi = {
  getAll: (params?: { organizationId?: number; search?: string; page?: number; size?: number }) =>
    axiosClient.get<ApiResponse<PageResponse<UserListItem>>, ApiResponse<PageResponse<UserListItem>>>('/api/v2/admin/users', { params }),
  update: (organizationId: number, id: number, payload: UpdateUserRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v2/admin/organizations/${organizationId}/users/${id}`, payload),
  delete: (organizationId: number, id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v2/admin/organizations/${organizationId}/users/${id}`),
};

export const adminItemsApi = {
  getAll: (organizationId: number, params?: ItemListQuery) =>
    axiosClient.get<ApiResponse<PageResponse<ItemListItem>>, ApiResponse<PageResponse<ItemListItem>>>(
      `/api/v2/admin/organizations/${organizationId}/items`,
      { params }
    ),
  getById: (organizationId: number, id: number, warehouseId?: number) =>
    axiosClient.get<ApiResponse<ItemListItem>, ApiResponse<ItemListItem>>(
      `/api/v2/admin/organizations/${organizationId}/items/${id}`,
      { params: warehouseId ? { warehouseId } : undefined }
    ),
  getStock: (organizationId: number, id: number) =>
    axiosClient.get<ApiResponse<ItemStock>, ApiResponse<ItemStock>>(
      `/api/v2/admin/organizations/${organizationId}/items/${id}/stock`
    ),
};

export const adminContactsApi = {
  getCustomer: (organizationId: number, id: number) =>
    axiosClient.get<ApiResponse<CustomerDetail>, ApiResponse<CustomerDetail>>(`/api/v2/admin/organizations/${organizationId}/customers/${id}`),
  getSupplier: (organizationId: number, id: number) =>
    axiosClient.get<ApiResponse<SupplierDetail>, ApiResponse<SupplierDetail>>(`/api/v2/admin/organizations/${organizationId}/suppliers/${id}`),
  getCarrier: (organizationId: number, id: number) =>
    axiosClient.get<ApiResponse<Carrier>, ApiResponse<Carrier>>(`/api/v2/admin/organizations/${organizationId}/carriers/${id}`),
  createCustomer: (organizationId: number, payload: CreateCustomerRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>(`/api/v2/admin/organizations/${organizationId}/customers`, payload),
  createSupplier: (organizationId: number, payload: CreateSupplierRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>(`/api/v2/admin/organizations/${organizationId}/suppliers`, payload),
  getCustomers: (organizationId: number, params?: { page?: number; size?: number; search?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<CustomerListItem>>, ApiResponse<PageResponse<CustomerListItem>>>(
      `/api/v2/admin/organizations/${organizationId}/customers`, { params }
    ),
  getSuppliers: (organizationId: number, params?: { page?: number; size?: number; search?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<SupplierListItem>>, ApiResponse<PageResponse<SupplierListItem>>>(
      `/api/v2/admin/organizations/${organizationId}/suppliers`, { params }
    ),
  getCarriers: (organizationId: number, params?: { page?: number; size?: number; search?: string }) =>
    axiosClient.get<ApiResponse<PageResponse<Carrier>>, ApiResponse<PageResponse<Carrier>>>(
      `/api/v2/admin/organizations/${organizationId}/carriers`, { params }
    ),
};

export const adminStockApi = {
  getAll: (organizationId: number) =>
    axiosClient.get<ApiResponse<StockReportItem[]>, ApiResponse<StockReportItem[]>>(
      `/api/v2/admin/organizations/${organizationId}/stock`
    ),
  getLowStock: (organizationId: number) =>
    axiosClient.get<ApiResponse<StockReportItem[]>, ApiResponse<StockReportItem[]>>(
      `/api/v2/admin/organizations/${organizationId}/stock/low-stock`
    ),
};

export const adminPermissionsApi = {
  getAll: () =>
    axiosClient.get<ApiResponse<PermissionGroups>, ApiResponse<PermissionGroups>>('/api/v2/admin/permissions'),
  getForUser: (organizationId: number, userId: number) =>
    axiosClient.get<ApiResponse<AssignedPermission[]>, ApiResponse<AssignedPermission[]>>(
      `/api/v2/admin/organizations/${organizationId}/users/${userId}/permissions`
    ),
  assignToUser: (organizationId: number, payload: AssignUserPermissionsRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>(
      `/api/v2/admin/organizations/${organizationId}/users/${payload.userId}/permissions`,
      payload
    ),
  updateForUser: (organizationId: number, payload: AssignUserPermissionsRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(
      `/api/v2/admin/organizations/${organizationId}/users/${payload.userId}/permissions`,
      payload
    ),
};

export const posApi = {
  createBill: (payload: PosBillingRequest) =>
    axiosClient.post<ApiResponse<PosBillingResponse>, ApiResponse<PosBillingResponse>>('/api/v1/pos/billing', payload),
  downloadInvoicePdf: (saleId: number) =>
    axiosClient.get<Blob, Blob>(`/api/v1/pos/billing/${saleId}/invoice-pdf`, { responseType: 'blob' }),
  downloadReceiptPdf: (saleId: number) =>
    axiosClient.get<Blob, Blob>(`/api/v1/pos/billing/${saleId}/receipt-pdf`, { responseType: 'blob' }),
};

export const salesApi = {
  getAll: (params?: any) => axiosClient.get<ApiResponse<PageResponse<SaleListItem>>, ApiResponse<PageResponse<SaleListItem>>>('/api/v1/sales', { params }),
  getById: (id: number) => axiosClient.get<ApiResponse<SaleDetail>, ApiResponse<SaleDetail>>(`/api/v1/sales/${id}`),
  create: (payload: SaleRequest) => axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/sales', payload),
  update: (id: number, payload: SaleRequest) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/sales/${id}`, payload),
  cancel: (id: number) => axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/sales/${id}/cancel`),
  delete: (id: number) => axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/sales/${id}`),
  getInvoice: (id: number) => axiosClient.get<ApiResponse<SaleInvoice>, ApiResponse<SaleInvoice>>(`/api/v1/sales/${id}/invoice`),
};

export const quotationApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<QuotationListItem>>, ApiResponse<PageResponse<QuotationListItem>>>('/api/v1/quotations', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<QuotationDetail>, ApiResponse<QuotationDetail>>(`/api/v1/quotations/${id}`),
  create: (payload: QuotationRequest) =>
    axiosClient.post<ApiResponse<QuotationCreateResponse>, ApiResponse<QuotationCreateResponse>>('/api/v1/quotations', payload),
  update: (id: number, payload: QuotationRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/quotations/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/quotations/${id}`),
  convertToInvoice: (id: number, invoiceDate = new Date().toISOString().slice(0, 10)) =>
    axiosClient.post<ApiResponse<SalesCreateResponse>, ApiResponse<SalesCreateResponse>>(`/api/v1/quotations/${id}/convert-to-invoice`, { invoiceDate }),
  downloadPdf: async (id: number) => {
    const response = await axiosClient.get(`/api/v1/quotations/${id}/pdf`, { responseType: 'blob' });
    return response as unknown as Blob;
  },
};

export const paymentInApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<PaymentListItem>>, ApiResponse<PageResponse<PaymentListItem>>>('/api/v1/payment-in', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PaymentDetail>, ApiResponse<PaymentDetail>>(`/api/v1/payment-in/${id}`),
  create: (payload: PaymentInRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/payment-in', payload),
  update: (id: number, payload: PaymentInRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-in/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-in/${id}`),
};

export const paymentNoteApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<PaymentNoteListItem>>, ApiResponse<PageResponse<PaymentNoteListItem>>>('/api/v1/payment-notes', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PaymentNoteDetail>, ApiResponse<PaymentNoteDetail>>(`/api/v1/payment-notes/${id}`),
  create: (payload: PaymentNoteRequest) =>
    axiosClient.post<ApiResponse<PaymentNoteDetail>, ApiResponse<PaymentNoteDetail>>('/api/v1/payment-notes', payload),
  update: (id: number, payload: PaymentNoteRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-notes/${id}`, payload),
  updateStatus: (id: number, payload: PaymentNoteStatusUpdateRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-notes/${id}/status`, payload),
  assign: (id: number, payload: PaymentNoteAssignRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-notes/${id}/assign`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-notes/${id}`),
  getAuditTrail: (id: number) =>
    axiosClient.get<ApiResponse<PaymentNoteAuditEntry[]>, ApiResponse<PaymentNoteAuditEntry[]>>(`/api/v1/payment-notes/${id}/audit`),
};

export const purchaseApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<PurchaseListItem>>, ApiResponse<PageResponse<PurchaseListItem>>>('/api/v1/purchases', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PurchaseDetail>, ApiResponse<PurchaseDetail>>(`/api/v1/purchases/${id}`),
  create: (payload: PurchaseRequest) =>
    axiosClient.post<ApiResponse<PurchaseCreateResponse>, ApiResponse<PurchaseCreateResponse>>('/api/v1/purchases', payload),
  update: (id: number, payload: PurchaseRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/purchases/${id}`, payload),
  cancel: (id: number) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/purchases/${id}/cancel`),
  updateStatus: (id: number, status: string) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/purchases/${id}/status`, { status }),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/purchases/${id}`),
};

export const paymentOutApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<PaymentListItem>>, ApiResponse<PageResponse<PaymentListItem>>>('/api/v1/payment-out', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PaymentDetail>, ApiResponse<PaymentDetail>>(`/api/v1/payment-out/${id}`),
  create: (payload: PaymentOutRequest) =>
    axiosClient.post<ApiResponse<PaymentOutCreateResponse>, ApiResponse<PaymentOutCreateResponse>>('/api/v1/payment-out', payload),
  update: (id: number, payload: PaymentOutRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-out/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-out/${id}`),
};

export const purchaseReturnApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<PurchaseReturnListItem>>, ApiResponse<PageResponse<PurchaseReturnListItem>>>('/api/v1/purchase-returns', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PurchaseReturnDetail>, ApiResponse<PurchaseReturnDetail>>(`/api/v1/purchase-returns/${id}`),
  create: (payload: PurchaseReturnRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/purchase-returns', payload),
};

export const stockTransferApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<StockTransferListItem>>, ApiResponse<PageResponse<StockTransferListItem>>>('/api/v1/stocks/transfers', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<StockTransferDetail>, ApiResponse<StockTransferDetail>>(`/api/v1/stocks/transfers/${id}`),
  create: (payload: StockTransferRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/stocks/transfers', payload),
  update: (id: number, payload: StockTransferRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/stocks/transfers/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/stocks/transfers/${id}`),
};

export const stockAdjustmentApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<StockAdjustmentListItem>>, ApiResponse<PageResponse<StockAdjustmentListItem>>>('/api/v1/stocks/adjustments', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<StockAdjustmentDetail>, ApiResponse<StockAdjustmentDetail>>(`/api/v1/stocks/adjustments/${id}`),
  create: (payload: StockAdjustmentRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/stocks/adjustments', payload),
  update: (id: number, payload: StockAdjustmentRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/stocks/adjustments/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/stocks/adjustments/${id}`),
};

export const expenseApi = {
  getAll: (params?: any) =>
    axiosClient.get<ApiResponse<PageResponse<ExpenseListItem>>, ApiResponse<PageResponse<ExpenseListItem>>>('/api/v1/expenses', { params }),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<ExpenseDetail>, ApiResponse<ExpenseDetail>>(`/api/v1/expenses/${id}`),
  create: (payload: ExpenseRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/expenses', payload),
  update: (id: number, payload: ExpenseRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expenses/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expenses/${id}`),
};

const normalizeExpenseMasterList = <T,>(response: ApiResponse<T[] | PageResponse<T>>) => {
  const data = response.data;
  if (Array.isArray(data)) {
    return {
      ...response,
      data: {
        content: data,
        page: 0,
        size: data.length,
        totalElements: data.length,
        totalPages: 1,
        last: true,
      } as PageResponse<T>,
    };
  }
  return response as ApiResponse<PageResponse<T>>;
};

export const expenseCategoryApi = {
  getAll: async (search = '') =>
    normalizeExpenseMasterList(await axiosClient.get<ApiResponse<ExpenseCategory[] | PageResponse<ExpenseCategory>>, ApiResponse<ExpenseCategory[] | PageResponse<ExpenseCategory>>>('/api/v1/expense-categories', { params: { search } })),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<ExpenseCategory>, ApiResponse<ExpenseCategory>>(`/api/v1/expense-categories/${id}`),
  create: (payload: ExpenseCategoryRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/expense-categories', payload),
  update: (id: number, payload: ExpenseCategoryRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expense-categories/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expense-categories/${id}`),
};

export const expenseSubCategoryApi = {
  getAll: async (search = '') =>
    normalizeExpenseMasterList(await axiosClient.get<ApiResponse<ExpenseSubCategory[] | PageResponse<ExpenseSubCategory>>, ApiResponse<ExpenseSubCategory[] | PageResponse<ExpenseSubCategory>>>('/api/v1/expense-sub-categories', { params: { search } })),
  getByCategoryId: async (expenseCategoryId: number) =>
    normalizeExpenseMasterList(await axiosClient.get<ApiResponse<ExpenseSubCategory[] | PageResponse<ExpenseSubCategory>>, ApiResponse<ExpenseSubCategory[] | PageResponse<ExpenseSubCategory>>>(`/api/v1/expense-sub-categories/category/${expenseCategoryId}`)),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<ExpenseSubCategory>, ApiResponse<ExpenseSubCategory>>(`/api/v1/expense-sub-categories/${id}`),
  create: (payload: ExpenseSubCategoryRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/expense-sub-categories', payload),
  update: (id: number, payload: ExpenseSubCategoryRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expense-sub-categories/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/expense-sub-categories/${id}`),
};

export const paymentMethodApi = {
  getAll: async (search = '') =>
    normalizeExpenseMasterList(await axiosClient.get<ApiResponse<PaymentMethod[] | PageResponse<PaymentMethod>>, ApiResponse<PaymentMethod[] | PageResponse<PaymentMethod>>>('/api/v1/payment-methods', { params: { search } })),
  getById: (id: number) =>
    axiosClient.get<ApiResponse<PaymentMethod>, ApiResponse<PaymentMethod>>(`/api/v1/payment-methods/${id}`),
  create: (payload: PaymentMethodRequest) =>
    axiosClient.post<ApiResponse<void>, ApiResponse<void>>('/api/v1/payment-methods', payload),
  update: (id: number, payload: PaymentMethodRequest) =>
    axiosClient.put<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-methods/${id}`, payload),
  delete: (id: number) =>
    axiosClient.delete<ApiResponse<void>, ApiResponse<void>>(`/api/v1/payment-methods/${id}`),
};

export const reportsApi = {
  topSellingItems: (params?: { fromDate?: string; toDate?: string }) => axiosClient.get<ApiResponse<TopSellingItem[]>, ApiResponse<TopSellingItem[]>>('/api/v1/reports/top-selling-items', { params }),
  stocks: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/stocks', { params }),
  sales: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/sales', { params }),
  purchases: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/purchases', { params }),
  itemSales: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/item-sales', { params }),
  itemPurchases: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/item-purchases', { params }),
  profitLoss: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/profit-loss', { params }),
  lowStock: (params?: any) => axiosClient.get<ApiResponse<StockReportItem[]>, ApiResponse<StockReportItem[]>>('/api/v1/reports/low-stock', { params }),
  inventoryValuation: () => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/inventory-valuation'),
  customerDues: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/customer-dues', { params }),
  supplierDues: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/supplier-dues', { params }),
  purchasePayments: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/purchase-payments', { params }),
  salePayments: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/sale-payments', { params }),
  expenses: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/expenses', { params }),
  itemTransactionsGeneral: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/item-transactions/general', { params }),
  expiredItems: (params?: any) => axiosClient.get<ApiResponse<any>, ApiResponse<any>>('/api/v1/reports/expired-items', { params }),
  gstSummary: (params?: { fromDate?: string; toDate?: string }) => axiosClient.get<ApiResponse<GstSummaryReport>, ApiResponse<GstSummaryReport>>('/api/v1/reports/gst/summary', { params }),
};
