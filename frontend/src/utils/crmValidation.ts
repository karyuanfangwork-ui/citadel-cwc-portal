export interface ValidationError {
  field: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-+().]{6,20}$/;
const URL_RE = /^https?:\/\/.+/;

export function validateLead(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.title?.trim()) errors.push({ field: 'title', message: 'Title is required' });
  if (form.contactEmail && !EMAIL_RE.test(form.contactEmail))
    errors.push({ field: 'contactEmail', message: 'Invalid email format' });
  if (form.estimatedValue !== undefined && form.estimatedValue !== '' && Number(form.estimatedValue) < 0)
    errors.push({ field: 'estimatedValue', message: 'Value cannot be negative' });
  return errors;
}

export function validateAccount(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.name?.trim()) errors.push({ field: 'name', message: 'Name is required' });
  if (form.email && !EMAIL_RE.test(form.email))
    errors.push({ field: 'email', message: 'Invalid email format' });
  if (form.annualRevenue !== undefined && form.annualRevenue !== '' && Number(form.annualRevenue) < 0)
    errors.push({ field: 'annualRevenue', message: 'Revenue cannot be negative' });
  if (form.website && !URL_RE.test(form.website))
    errors.push({ field: 'website', message: 'Invalid URL format (must start with http:// or https://)' });
  return errors;
}

export function validateContact(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.firstName?.trim()) errors.push({ field: 'firstName', message: 'First name is required' });
  if (!form.lastName?.trim()) errors.push({ field: 'lastName', message: 'Last name is required' });
  if (form.email && !EMAIL_RE.test(form.email))
    errors.push({ field: 'email', message: 'Invalid email format' });
  if (form.phone && !PHONE_RE.test(form.phone))
    errors.push({ field: 'phone', message: 'Invalid phone format' });
  return errors;
}

export function validateOpportunity(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.name?.trim()) errors.push({ field: 'name', message: 'Name is required' });
  if (!form.accountId) errors.push({ field: 'accountId', message: 'Account is required' });
  if (!form.pipelineId) errors.push({ field: 'pipelineId', message: 'Pipeline is required' });
  if (!form.stageId) errors.push({ field: 'stageId', message: 'Stage is required' });
  if (form.value !== undefined && form.value !== '' && Number(form.value) < 0)
    errors.push({ field: 'value', message: 'Value cannot be negative' });
  if (form.probability !== undefined && form.probability !== '' && (Number(form.probability) < 0 || Number(form.probability) > 100))
    errors.push({ field: 'probability', message: 'Probability must be 0-100' });
  return errors;
}

export function validateTrustProduct(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.trustType) errors.push({ field: 'trustType', message: 'Trust type is required' });
  if (form.assetValue !== undefined && form.assetValue !== '' && Number(form.assetValue) < 0)
    errors.push({ field: 'assetValue', message: 'Asset value cannot be negative' });
  return errors;
}

export function validateBeneficiary(form: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!form.firstName?.trim()) errors.push({ field: 'firstName', message: 'First name is required' });
  if (!form.lastName?.trim()) errors.push({ field: 'lastName', message: 'Last name is required' });
  if (!form.relationship) errors.push({ field: 'relationship', message: 'Relationship is required' });
  if (form.allocationPct !== undefined && form.allocationPct !== '' && (Number(form.allocationPct) < 0 || Number(form.allocationPct) > 100))
    errors.push({ field: 'allocationPct', message: 'Allocation must be 0-100' });
  return errors;
}