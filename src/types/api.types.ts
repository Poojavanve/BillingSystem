export interface Country {
  id: number;
  name?: string;
  countryName?: string;
}

export interface State {
  id: number;
  name?: string;
  stateName?: string;
  countryId?: number;
  countryName?: string;
  stateCode?: string;
  gstCode?: string;
  status?: string;
}

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

export interface OrganizationAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateId: number;
  pincode: string;
  stateName?: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  logoUrl?: string | null;
  phone?: string;
  gstNumber?: string;
  gstRegistrationType?: 'REGISTERED' | 'UNREGISTERED' | 'COMPOSITION' | string;
  legalName?: string;
  tradeName?: string;
  address?: OrganizationAddress | string | null;
  status: OrganizationStatus | string | boolean;
  isSubscribed?: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface OrganizationUnit {
  id: number;
  name: string;
  shortName?: string;
}

export interface OrganizationRequest {
  name: string;
  description: string;
  phone?: string;
  gstNumber?: string;
  address: OrganizationAddress;
  status: OrganizationStatus;
  isSubscribed?: boolean;
  startDate?: string;
  endDate?: string;
  unitIds?: number[];
}

export interface UpdateOrganizationRequest extends OrganizationRequest {
  logoUrl: string;
}

export type OrganizationLogoUploadResponse = string | {
  logoUrl?: string | null;
  url?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  path?: string | null;
} | null;

export type ItemStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ItemListQuery {
  page?: number;
  size?: number;
  search?: string;
  categoryId?: number;
  brandId?: number;
  warehouseId?: number;
  status?: ItemStatus;
}

export interface ItemListItem {
  id: number;
  itemName: string;
  itemCode: string;
  sku: string;
  hsnCode?: string;
  hsnId?: number;
  hsnDescription?: string;
  unitId?: number;
  unitName?: string;
  unitShortName?: string;
  categoryId?: number;
  categoryName?: string;
  subCategoryId?: number | null;
  subCategoryName?: string | null;
  brandId?: number;
  brandName?: string;
  gstTaxability?: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | string;
  gstRate?: number;
  gstRateId?: number;
  gstRateName?: string;
  cessRate?: number;
  purchasePrice?: number;
  purchasePriceWithTax?: number;
  taxPercentage?: number;
  salePrice: number;
  wholesalePrice?: number;
  mrp?: number;
  msp?: number;
  discountPercentage?: number;
  profitMargin?: number;
  manufacturingDate?: string;
  expiryDate?: string;
  openingQuantity?: number;
  availableQty: number;
  reservedQty?: number;
  minimumStock?: number;
  warehouseId?: number;
  warehouseName?: string;
  status: ItemStatus;
  trackingType?: string;
  description?: string;
  imageUrl?: string | null;
  warehouseStocks?: ItemWarehouseStock[];
}

export interface ItemWarehouseStock {
  warehouseId: number;
  availableQty: number;
}

export interface PosItemSearchItem {
  id: number;
  itemName: string;
  itemCode: string;
  sku: string;
  hsnCode?: string;
  hsnId?: number;
  hsnDescription?: string;
  unitId?: number;
  unitName?: string;
  unitShortName?: string;
  categoryId?: number;
  categoryName?: string;
  brandId?: number;
  brandName?: string;
  purchasePrice?: number;
  purchasePriceWithTax?: number;
  taxPercentage?: number;
  imageUrl?: string | null;
  salePrice: number;
  wholesalePrice?: number;
  mrp?: number;
  msp?: number;
  discountPercentage?: number;
  profitMargin?: number;
  gstTaxability?: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | string;
  gstRate?: number;
  gstRateId?: number;
  gstRateName?: string;
  cessRate?: number;
  manufacturingDate?: string;
  expiryDate?: string;
  openingQuantity?: number;
  availableQty: number;
  reservedQty?: number;
  minimumStock?: number;
  warehouseId?: number;
  warehouseName?: string;
  description?: string;
  status: ItemStatus;
  warehouseStocks: ItemWarehouseStock[];
}

export interface ItemCreateResponse {
  id: number;
  itemCode: string;
}

export interface ItemExcelImportMessage {
  sheetName?: string;
  rowNumber: number;
  itemName?: string;
  message: string;
}

export interface ItemExcelImportResult {
  itemRows: number;
  createdItems: number;
  updatedItems: number;
  stockRowsUpdated: number;
  failedRows: number;
  warnings: ItemExcelImportMessage[];
  errors: ItemExcelImportMessage[];
}

export interface UserCreateResponse {
  id: number;
}

export type ItemImageUploadResponse = string | {
  imageUrl?: string | null;
  objectUrl?: string | null;
  url?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  path?: string | null;
} | null;

export interface ItemRequest {
  itemName: string;
  categoryId: number;
  subCategoryId: number;
  brandId: number;
  hsnId: number;
  unitId: number;
  gstTaxability: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | string;
  gstRateId?: number;
  cessRate?: number;
  discountPercentage: number;
  minimumStock: number;
  description: string;
}

export interface ItemStock {
  itemId: number;
  itemName?: string;
  availableQty?: number;
  quantity?: number;
  warehouseName?: string;
  minimumStock?: number;
}

export interface Warehouse {
  id: number;
  name: string;
  warehouseCode: string;
  status: boolean;
  description?: string;
  address?: string;
  totalItems?: number;
  availableStock?: number;
  worthCost?: number;
  worthSale?: number;
  worthProfit?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface WarehouseRequest {
  name: string;
  warehouseCode: string;
  description: string;
  address: string;
}

export interface Branch {
  id: number;
  organizationId: number;
  branchCode: string;
  branchName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstNumber?: string;
  gstRegistrationType?: 'REGISTERED' | 'UNREGISTERED' | 'COMPOSITION' | string;
  legalName?: string;
  tradeName?: string;
  gstStateId?: number;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchRequest {
  branchCode: string;
  branchName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstNumber?: string;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  mobileNo: string;
  roleId: number;
  organizationId: number;
  password?: string;
  status: 'ACTIVE' | 'INACTIVE';
  branchIds?: number[];
}

export type UpdateUserRequest = Omit<CreateUserRequest, 'organizationId'>;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  mobileNo: string;
  status: 'ACTIVE' | 'INACTIVE';
  roleId: number;
  roleName: string;
  organizationId: number;
  organizationName: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  mobileNo: string;
}

export interface UserListItem {
  id: number;
  firstName?: string;
  lastName?: string;
  userName?: string;
  username?: string;
  email?: string;
  mobileNo?: string;
  mobile?: string;
  roleId?: number;
  roleName?: string;
  organizationId?: number;
  organizationName?: string;
  status?: boolean | string;
  createdAt?: string;
  branchIds?: number[];
}

export interface Role {
  id: number;
  name: string;
  status: boolean | 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface RoleRequest {
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  organizationId?: number;
}

export interface PosBillingPaymentRequest {
  paymentMethodId: number;
  amount: number;
}

export interface PosBillingRequest {
  customerId: number;
  warehouseId: number;
  grandTotal: number;
  dueAmount: number;
  paymentMethodId?: number;
  amountPaid?: number;
  payments?: PosBillingPaymentRequest[];
  items: Array<{ itemId: number; quantity: number; discountPercent?: number; warehouseQuantities?: Record<number, number> }>;
}

export interface PosBillingResponse {
  saleId: number;
  invoiceNo: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
}

export interface SimpleMaster {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  branchIds?: number[];
  createdAt?: string;
  createdBy?: string;
}

export interface SimpleMasterRequest {
  name: string;
  description: string;
  categoryId?: number;
  branchIds?: number[];
}

export type MessageTemplateStatus = 'ACTIVE' | 'INACTIVE';

export interface MessageTemplate {
  id: number;
  name: string;
  subject?: string;
  content: string;
  status?: MessageTemplateStatus;
  createdAt?: string;
  createdBy?: string;
}

export interface MessageTemplateRequest {
  name: string;
  subject?: string;
  content: string;
  status: MessageTemplateStatus;
}

export interface EmailSendRequest {
  emailIds: string;
  subject: string;
  message: string;
  file?: File | null;
}

export interface SmsSendRequest {
  mobileNumbers: string[];
  message: string;
}

export type ExpenseMasterStatus = 'ACTIVE' | 'INACTIVE';

export interface ExpenseCategory {
  id: number;
  organizationId?: number;
  name: string;
  description?: string;
  status: ExpenseMasterStatus;
  branchIds?: number[];
}

export interface ExpenseCategoryRequest {
  name: string;
  description: string;
  status: ExpenseMasterStatus;
  branchIds?: number[];
}

export interface ExpenseSubCategory {
  id: number;
  expenseCategoryId: number;
  expenseCategoryName?: string;
  name: string;
  description?: string;
  status: ExpenseMasterStatus;
}

export interface ExpenseSubCategoryRequest {
  name: string;
  description: string;
  status: ExpenseMasterStatus;
  expenseCategoryId: number;
}

export interface PaymentMethod {
  id: number;
  organizationId?: number;
  name: string;
  description?: string;
  status: ExpenseMasterStatus;
}

export interface PaymentMethodRequest {
  name: string;
  description: string;
  status: ExpenseMasterStatus;
}

export interface Unit {
  id: number;
  name: string;
  shortName: string;
  createdAt?: string;
  createdBy?: string;
}

export interface UnitRequest {
  name: string;
  shortName: string;
}

export interface OrganizationUnitsRequest {
  unitIds: number[];
}

export interface HsnMaster {
  id: number;
  hsnCode: string;
  description?: string;
  isActive?: boolean;
  status?: string;
}

export interface HsnRequest {
  hsnCode: string;
  description?: string;
}

export interface GstRateMaster {
  id: number;
  rateName: string;
  gstRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive?: boolean;
  sourceNotification?: string;
}

export interface GstRateRequest {
  rateName: string;
  gstRate: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceNotification?: string;
}

export interface GstHsnRateMapping {
  id: number;
  hsnId: number;
  hsnCode?: string;
  gstRateId: number;
  rateName?: string;
  taxability: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | string;
  effectiveFrom?: string;
  effectiveTo?: string;
  conditionText?: string;
  sourceNotification?: string;
  isActive?: boolean;
}

export interface GstHsnRateMappingRequest {
  hsnId: number;
  gstRateId: number;
  taxability: 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | string;
  effectiveFrom?: string;
  effectiveTo?: string;
  conditionText?: string;
  sourceNotification?: string;
  isActive?: boolean;
}

export interface SaleListItem {
  saleId: number;
  invoiceNo: string;
  customerName: string;
  invoiceDate: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status?: string;
}

export interface SaleRequest {
  customerId: number;
  invoiceDate: string;
  warehouseId: number;
  stateId: number;
  salesPersonId: number;
  roundOff?: number;
  notes: string;
  items: Array<{ itemId: number; quantity: number; unitPrice: number; discountPercent: number; taxPercent: number }>;
}

export interface SaleDetail {
  saleId: number;
  invoiceNo: string;
  invoiceDate: string;
  customer: { id: number; name: string };
  warehouse: { id: number; name: string };
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  gstTaxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  roundOff?: number;
  roundOffAmount?: number;
  grandTotal: number;
  grandTotalAmount?: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  notes?: string;
  items: Array<{ itemId: number; itemName: string; hsnCode?: string; unitCode?: string; batchId: number; batchNo: string; qty: number; unitPrice: number; grossAmount?: number; taxableAmount?: number; discountAmount: number; taxAmount: number; gstRate?: number; cgstAmount?: number; sgstAmount?: number; igstAmount?: number; cessAmount?: number; totalAmount: number }>;
}

export interface SaleInvoice {
  invoiceNo: string;
  customerName: string;
  grandTotal: number;
}

export interface SalesCreateResponse {
  saleId: number;
  invoiceNo: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  gstTaxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  roundOff?: number;
  roundOffAmount?: number;
  grandTotal: number;
  grandTotalAmount?: number;
  paidAmount: number;
  dueAmount: number;
}

export interface QuotationCreateResponse {
  quotationId: number;
  quotationNo: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  status: string;
}

export interface QuotationListItem {
  quotationId: number;
  quotationNo: string;
  quotationDate: string;
  validUntil?: string;
  customerName: string;
  grandTotal: number;
  status: string;
  convertedSaleId?: number;
  convertedInvoiceNo?: string;
}

export interface QuotationRequest {
  customerId: number;
  quotationDate: string;
  validUntil?: string;
  warehouseId: number;
  stateId: number;
  salesPersonId: number;
  roundOff: number;
  status: string;
  notes: string;
  items: Array<{ itemId: number; quantity: number; unitPrice: number; discountPercent: number; taxPercent: number }>;
}

export interface QuotationDetail {
  quotationId: number;
  quotationNo: string;
  quotationDate: string;
  validUntil?: string;
  customer: { id: number; name: string };
  warehouse: { id: number; name: string };
  stateId?: number;
  salesPersonId?: number;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  status: string;
  notes?: string;
  convertedSaleId?: number;
  convertedInvoiceNo?: string;
  items: Array<{ itemId: number; itemName: string; qty: number; unitPrice: number; discountPercent: number; discountAmount: number; taxPercent: number; taxAmount: number; totalAmount: number }>;
}

export interface PaymentListItem {
  paymentId: number;
  paymentNo: string;
  partyName?: string;
  customerName?: string;
  supplierName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: { id: number; name: string };
}

export interface PaymentDetail {
  paymentId: number;
  paymentNo: string;
  paymentType: string;
  party: { id: number; name: string };
  paymentMethod: { id: number; name: string };
  paymentDate: string;
  referenceNo?: string;
  amount: number;
  notes?: string;
  saleIds?: number[];
  purchaseIds?: number[];
}

export interface PaymentOutRequest {
  supplierId: number;
  paymentDate: string;
  paymentMethodId: number;
  referenceNo: string;
  amount: number;
  notes: string;
  purchaseIds: number[];
}

export interface PaymentOutCreateResponse {
  paymentId: number;
  paymentNo: string;
  amount: number;
  supplierBalance: number;
}

export interface PaymentInRequest {
  customerId: number;
  paymentDate: string;
  paymentMethodId: number;
  referenceNo: string;
  amount: number;
  notes: string;
  saleIds: number[];
}

export interface PurchaseCreateResponse {
  purchaseId: number;
  purchaseNo: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  gstTaxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  grandTotal: number;
  roundOff?: number;
  roundOffAmount?: number;
  grandTotalAmount?: number;
  paidAmount: number;
  dueAmount: number;
}

export interface PurchaseListItem {
  purchaseId: number;
  purchaseNo?: string;
  purchaseCode?: string;
  supplierId?: number;
  supplierName: string;
  purchaseDate: string;
  grandTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  status?: string;
  totalQuantity?: number;
}

export interface PurchaseRequest {
  supplierId: number;
  purchaseDate: string;
  referenceNo: string;
  warehouseId: number;
  carrierId: number;
  stateId: number;
  notes: string;
  status?: string;
  roundOff?: number;
  payments?: PurchasePaymentEntry[];
  items: Array<{
    itemId: number;
    batchNo: string;
    manufacturingDate: string;
    expiryDate: string;
    quantity: number;
    unitPrice: number;
    mrp?: number;
    salePrice?: number;
    wholesalePrice?: number;
    discountPercent: number;
    taxPercent: number;
  }>;
}

export interface PurchasePaymentEntry {
  paymentId?: number;
  paymentNo?: string;
  paymentDate: string;
  paymentMethodId?: number;
  paymentMethod?: { id: number; name: string };
  referenceNo?: string;
  amount: number;
  notes?: string;
}

export interface PurchaseDetail {
  purchaseId: number;
  purchaseNo?: string;
  purchaseCode?: string;
  purchaseDate: string;
  referenceNo?: string;
  supplier: { id: number; name: string };
  warehouse: { id: number; name: string };
  carrier?: { id: number; name: string };
  state?: { id: number; name: string };
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  gstTaxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  grandTotal: number;
  roundOff?: number;
  roundOffAmount?: number;
  grandTotalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  status?: string;
  notes?: string;
  payments?: PurchasePaymentEntry[];
  items: Array<{
    itemId: number;
    itemName: string;
    hsnCode?: string;
    unitCode?: string;
    batchNo?: string;
    manufacturingDate?: string;
    expiryDate?: string;
    qty?: number;
    quantity?: number;
    unitPrice: number;
    mrp?: number;
    salePrice?: number;
    wholesalePrice?: number;
    grossAmount?: number;
    taxableAmount?: number;
    discountAmount?: number;
    discountPercent?: number;
    taxAmount?: number;
    taxPercent?: number;
    gstRate?: number;
    cessRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    cessAmount?: number;
    totalAmount?: number;
  }>;
}

export interface PurchaseReturnListItem {
  returnId: number;
  returnNo?: string;
  supplierName: string;
  returnDate: string;
  totalAmount?: number;
  grandTotal?: number;
  balance?: number;
  reason?: string;
}

export interface PurchaseReturnRequest {
  purchaseId: number;
  supplierId: number;
  returnDate: string;
  reason: string;
  items: Array<{ itemId: number; batchId: number; quantity: number; rate: number }>;
}

export interface PurchaseReturnDetail {
  returnId: number;
  returnNo?: string;
  purchaseId?: number;
  supplier: { id: number; name: string };
  returnDate: string;
  reason?: string;
  totalAmount?: number;
  items: Array<{ itemId: number; itemName: string; batchId?: number; quantity: number; rate: number; totalAmount?: number }>;
}

export interface StockTransferListItem {
  transferId: number;
  transferNo?: string;
  transferCode?: string;
  transferDate: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface StockTransferRequest {
  fromWarehouseId: number;
  toWarehouseId: number;
  transferDate: string;
  notes: string;
  items: Array<{ itemId: number; quantity: number }>;
}

export interface StockTransferDetail extends StockTransferListItem {
  fromWarehouse?: { id: number; name: string };
  toWarehouse?: { id: number; name: string };
  items: Array<{ itemId: number; itemName: string; quantity: number; availableQty?: number }>;
}

export interface StockAdjustmentListItem {
  adjustmentId: number;
  adjustmentNo?: string;
  adjustmentCode?: string;
  adjustmentDate: string;
  warehouseName?: string;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface StockAdjustmentRequest {
  warehouseId: number;
  adjustmentDate: string;
  reason: string;
  items: Array<{ itemId: number; currentQty: number; actualQty: number }>;
}

export interface StockAdjustmentDetail extends StockAdjustmentListItem {
  warehouse?: { id: number; name: string };
  items: Array<{ itemId: number; itemName: string; currentQty: number; actualQty: number }>;
}

export interface ExpenseListItem {
  expenseId: number;
  expenseNo?: string;
  expenseNumber?: string;
  expenseDate: string;
  expenseCategoryName?: string;
  expenseSubCategoryName?: string;
  expenseSubCategoryId?: number;
  expenseCategory?: { id: number; name: string };
  expenseSubCategory?: { id: number; name: string };
  categoryName?: string;
  subCategoryName?: string;
  amount: number;
  paymentMethod?: string | { id: number; name: string };
  paymentType?: string;
  paymentMethodName?: string;
  createdBy?: string;
  createdAt?: string;
  notes?: string;
}

export interface ExpenseItemRequest {
  itemId?: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface ExpenseItemResponse extends ExpenseItemRequest {
  lineTotal: number;
}

export interface ExpenseRequest {
  expenseCategoryId: number;
  expenseSubCategoryId?: number;
  expenseDate: string;
  amount: number;
  paymentMethodId: number;
  notes: string;
  items: ExpenseItemRequest[];
}

export interface ExpenseDetail extends ExpenseListItem {
  expenseCategory?: { id: number; name: string };
  expenseSubCategory?: { id: number; name: string };
  paymentMethod?: { id: number; name: string };
  items?: ExpenseItemResponse[];
}

export interface DashboardTrendPoint {
  period?: string;
  label?: string;
  month?: string;
  sales?: number;
  purchases?: number;
  saleAmount?: number;
  purchaseAmount?: number;
}

export interface DashboardTrendingItem {
  itemId: number;
  itemName: string;
  quantity: number;
  totalAmount: number;
  percentage?: number;
}

export interface DashboardRecentInvoice {
  saleId: number;
  invoiceDate: string;
  saleCode: string;
  customerName: string;
  grandTotal: number;
  balance: number;
  status: string;
}

export interface DashboardLowStockItem {
  itemId: number;
  itemName: string;
  brand?: string;
  category?: string;
  minimumStock: number;
  currentStock: number;
}

export interface DashboardSummary {
  todaySales?: number;
  todayPurchase?: number;
  todayExpense?: number;
  todayCollection?: number;
  totalSales?: number;
  totalPurchase?: number;
  totalCollection?: number;
  cashInHand?: number;
  bankBalance?: number;
  stockValue?: number;
  totalCustomers?: number;
  lowStockItems?: number | DashboardLowStockItem[];
  pendingSaleOrders?: number;
  completedSaleOrders?: number;
  paymentReceivables?: number;
  paymentPayables?: number;
  pendingPurchaseOrders?: number;
  completedPurchaseOrders?: number;
  totalExpense?: number;
  netProfit?: number;
  saleVsPurchase?: DashboardTrendPoint[];
  trendingItems?: DashboardTrendingItem[];
  recentInvoices?: DashboardRecentInvoice[];
  lowStockDetails?: DashboardLowStockItem[];
  generatedAt?: string;
}

export interface StockReportItem {
  itemId: number;
  itemName: string;
  itemCode?: string;
  warehouseId?: number;
  warehouseName?: string;
  batchId?: number;
  batchNo?: string;
  availableQty: number;
  currentStock?: number;
  minimumStock?: number;
  reorderLevel: number;
  stockValue?: number;
  brandName?: string;
  categoryName?: string;
  status?: string;
}

export interface TopSellingItem {
  itemId: number;
  itemName: string;
  quantity: number;
  totalAmount: number;
}

export interface GstSummaryReport {
  salesTaxableAmount: number;
  salesCgstAmount: number;
  salesSgstAmount: number;
  salesIgstAmount: number;
  salesCessAmount: number;
  purchaseTaxableAmount: number;
  purchaseCgstAmount: number;
  purchaseSgstAmount: number;
  purchaseIgstAmount: number;
  purchaseCessAmount: number;
  outputTaxTotal: number;
  inputTaxTotal: number;
  netGstLiability: number;
}

export interface PermissionSummary {
  id: number;
  name: string;
  description: string;
}

export interface AssignedPermission extends PermissionSummary {
  groupName: string;
  endpoint?: string;
  status?: string;
}

export type PermissionGroups = Record<string, PermissionSummary[]>;

export interface AssignUserPermissionsRequest {
  userId: number;
  permissionIds: number[];
}
