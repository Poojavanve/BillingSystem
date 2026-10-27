import { z } from 'zod';

export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PINCODE_REGEX = /^[0-9]{5,10}$/;
export const MOBILE_VALIDATION_MESSAGE = 'Enter a valid 10-digit mobile number.';
export const WHATSAPP_VALIDATION_MESSAGE = 'Enter a valid 10-digit WhatsApp number.';
export const PHONE_VALIDATION_MESSAGE = 'Enter a valid 10-digit phone number.';

export const isValidMobileNumber = (value: string) => MOBILE_REGEX.test(value.trim());
export const hasTrimmedText = (value?: string | null, minLength = 1) => (value?.trim().length || 0) >= minLength;
export const hasSelectedId = (value?: number | null) => Number.isInteger(value) && Number(value) > 0;
export const isPositiveNumber = (value: number) => Number.isFinite(value) && value > 0;
export const isNonNegativeNumber = (value: number) => Number.isFinite(value) && value >= 0;
export const isNonNegativeInteger = (value: number) => Number.isInteger(value) && value >= 0;
export const isValidEmailAddress = (value?: string | null) => !hasTrimmedText(value) || EMAIL_REGEX.test((value || '').trim());
export const isValidGstin = (value?: string | null) => !hasTrimmedText(value) || GSTIN_REGEX.test((value || '').trim());
export const isValidPincode = (value?: string | null) => PINCODE_REGEX.test((value || '').trim());

export const requiredMobileNumberSchema = (message: string = MOBILE_VALIDATION_MESSAGE) =>
  z.string().trim().regex(MOBILE_REGEX, message);

export const optionalMobileNumberSchema = (message: string = MOBILE_VALIDATION_MESSAGE) =>
  z.string().optional().or(z.literal('')).refine((value) => !value || isValidMobileNumber(value), { message });

export const getInvalidMobileNumbers = (commaSeparated: string): string[] =>
  commaSeparated
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isValidMobileNumber(value));
