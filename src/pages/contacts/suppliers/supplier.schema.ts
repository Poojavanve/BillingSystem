import { z } from 'zod';
import { isValidMobileNumber, MOBILE_VALIDATION_MESSAGE, optionalMobileNumberSchema, PHONE_VALIDATION_MESSAGE } from '../../../utils/validation';

const optionalAmount = z.preprocess(
  (value) => (value === '' || value == null ? undefined : String(value).trim()),
  z.string()
    .regex(/^-?(?:\d+|\d*\.\d+)$/, 'Enter a valid number')
    .transform(Number)
    .pipe(z.number().min(0, 'Amount cannot be negative'))
    .optional()
);

export const supplierSchema = z.object({
  firstName: z.string().min(2, 'First name must have at least 2 characters').max(100),
  lastName: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(150).optional().or(z.literal('')),
  phone: optionalMobileNumberSchema(PHONE_VALIDATION_MESSAGE),
  mobile: optionalMobileNumberSchema(),
  whatsappNo: optionalMobileNumberSchema(),
  gstNumber: z
    .string()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GST number')
    .optional()
    .or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  isDefaultSupplier: z.boolean(),
  billingAddress: z.string().optional().or(z.literal('')),
  shippingName: z.string().optional().or(z.literal('')),
  shippingMobile: optionalMobileNumberSchema(),
  shippingEmail: z.string().email('Invalid shipping email').optional().or(z.literal('')),
  shippingGstin: z.string().optional().or(z.literal('')),
  shippingAddress: z.string().optional().or(z.literal('')),
  creditLimit: optionalAmount,
  openingBalance: optionalAmount,
});

// Last Name and Mobile are only collected on the Create Supplier form; Edit hides them, so their
// required-ness is enforced only here via superRefine (this doesn't change the inferred type,
// so the same SupplierFormInput/SupplierFormData types work for both Create and Edit).
export const supplierCreateSchema = supplierSchema.superRefine((data, ctx) => {
  if (!data.lastName || !data.lastName.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: 'Last name is required' });
  }
  if (!data.mobile) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mobile'], message: 'Mobile number is required' });
  } else if (!isValidMobileNumber(data.mobile)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mobile'], message: MOBILE_VALIDATION_MESSAGE });
  }
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
export type SupplierFormInput = z.input<typeof supplierSchema>;

export const toSupplierRequest = (data: SupplierFormData) => ({
  firstName: data.firstName,
  lastName: data.lastName || '',
  mobile: data.mobile || '',
  whatsappNo: data.whatsappNo || data.mobile || '',
  email: data.email || '',
  gstNumber: data.gstNumber || '',
  creditLimit: data.creditLimit ?? 0,
  openingBalance: data.openingBalance ?? 0,
});
