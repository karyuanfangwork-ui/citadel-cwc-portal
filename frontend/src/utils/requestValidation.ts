/**
 * Task 13: Frontend form validation utility.
 *
 * Mirrors the backend `validatePublishedForm` semantics from
 * `requestCreationPolicy.service.ts` for early client-side feedback.
 * The backend remains the authoritative validator — this only provides
 * pre-submit UX hints.
 */

export interface FormCondition {
  field?: string;
  fieldId?: string;
  operator?: string;
  value?: unknown;
}

export interface PublishedFormField {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  options?: unknown[];
  required?: boolean;
  condition?: FormCondition;
  requiredWhen?: FormCondition;
}

export interface ValidationFailure {
  fieldId: string;
  label: string;
  message: string;
}

/**
 * Classification levels matching the backend `RequestClassification` enum.
 * The frontend uses this to drive confidentiality UI — CONFIDENTIAL and
 * RESTRICTED types are always confidential; INTERNAL types allow user choice.
 */
export type RequestClassification = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) {
    // File objects with s3Key are "filled"
    if ('s3Key' in value && value.s3Key) return true;
    // candidateDocuments-style nested objects: non-empty keys = filled
    return Object.keys(value).length > 0;
  }
  return true;
}

function conditionApplies(condition: FormCondition | undefined, values: Record<string, unknown>): boolean {
  if (!condition) return true;
  const field = condition.field ?? condition.fieldId;
  if (!field || !condition.operator) return true;

  const actual = values[field];
  switch (condition.operator) {
    case 'equals':
    case 'eq':
      return actual === condition.value;
    case 'notEquals':
    case 'neq':
      return actual !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'notIn':
      return Array.isArray(condition.value) && !condition.value.includes(actual);
    case 'truthy':
      return Boolean(actual);
    case 'falsy':
      return !actual;
    default:
      // Unknown operators apply the requirement (fail-closed, matching backend).
      return true;
  }
}

/**
 * Validate form values against the published form schema.
 * Returns an array of validation failures (empty = valid).
 * This mirrors `validatePublishedForm` in `requestCreationPolicy.service.ts`.
 */
export function validateFormValues(
  formConfig: unknown,
  values: Record<string, unknown>,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  if (!Array.isArray(formConfig)) return failures;

  for (const rawField of formConfig) {
    if (!rawField || typeof rawField !== 'object') continue;
    const field = rawField as PublishedFormField;
    const fieldId = field.id ?? field.name;
    if (!fieldId) continue;
    const label = field.label || fieldId;
    const condition = field.requiredWhen ?? field.condition;

    // Check required / conditionally required
    if (field.required && conditionApplies(condition, values) && !hasValue(values[fieldId])) {
      failures.push({ fieldId, label, message: `${label} is required` });
      continue; // Skip type checks for empty required fields
    }

    const value = values[fieldId];
    if (!hasValue(value)) continue;

    // Type validation
    if ((field.type === 'number' || field.type === 'currency')
      && (typeof value === 'boolean' || !Number.isFinite(Number(value)))) {
      failures.push({ fieldId, label, message: `${label} must be a valid number` });
    }

    if (field.type === 'checkbox' && typeof value !== 'boolean') {
      failures.push({ fieldId, label, message: `${label} must be true or false` });
    }

    if (field.type === 'email'
      && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      failures.push({ fieldId, label, message: `${label} must be a valid email address` });
    }

    // Option validation
    if (field.options?.length) {
      const submitted = Array.isArray(value) ? value : [value];
      if (submitted.some((item) => !field.options!.includes(item))) {
        failures.push({ fieldId, label, message: `${label} contains an invalid option` });
      }
    }
  }

  return failures;
}

/**
 * Determine if a request type's classification forces confidentiality.
 * Mirrors the backend logic in `resolveRequestCreationPolicy`.
 */
export function isConfidentialForClassification(
  classification: RequestClassification | undefined | null,
  userRequestedConfidential: boolean | undefined,
): boolean {
  if (classification === 'CONFIDENTIAL' || classification === 'RESTRICTED') return true;
  if (classification === 'INTERNAL') return !!userRequestedConfidential;
  // Unknown/missing classification defaults to internal (user choice)
  return !!userRequestedConfidential;
}

/**
 * Check whether a form version is stale.
 * Returns true if the version the user has doesn't match the server's current version.
 */
export function isFormVersionStale(
  clientVersion: number | undefined | null,
  serverVersion: number | undefined | null,
): boolean {
  if (serverVersion === null || serverVersion === undefined) return false;
  return clientVersion !== serverVersion;
}