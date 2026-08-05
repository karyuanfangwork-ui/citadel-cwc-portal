/**
 * Task 13: Frontend request validation tests.
 *
 * Tests the shared validation utility that mirrors backend
 * `validatePublishedForm` semantics, and the classification-driven
 * confidentiality logic.
 */
import { describe, it, expect } from 'vitest';
import {
  validateFormValues,
  isConfidentialForClassification,
  isFormVersionStale,
  type PublishedFormField,
} from '../requestValidation';

describe('requestValidation', () => {
  describe('validateFormValues', () => {
    const basicFields: PublishedFormField[] = [
      { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
      { id: 'needsAccessories', label: 'Needs Accessories', type: 'select', required: false, options: ['Yes', 'No'] },
      {
        id: 'accessoryDetails',
        label: 'Accessory Details',
        type: 'textarea',
        required: true,
        condition: { field: 'needsAccessories', operator: 'equals', value: 'Yes' },
      },
      { id: 'budget', label: 'Budget', type: 'currency', required: false },
      { id: 'contactEmail', label: 'Contact Email', type: 'email', required: false },
      { id: 'acceptTerms', label: 'Accept Terms', type: 'checkbox', required: false },
    ];

    it('returns no failures when all required fields are filled', () => {
      const values = { hardwareName: 'Laptop', needsAccessories: 'No' };
      const failures = validateFormValues(basicFields, values);
      expect(failures).toHaveLength(0);
    });

    it('flags missing required fields', () => {
      const values = { needsAccessories: 'No' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.length).toBeGreaterThanOrEqual(1);
      expect(failures[0].message).toContain('Hardware Name is required');
    });

    it('flags conditionally required fields when the condition is met', () => {
      const values = { hardwareName: 'Laptop', needsAccessories: 'Yes' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.label === 'Accessory Details')).toBe(true);
    });

    it('skips conditionally required fields when the condition is not met', () => {
      const values = { hardwareName: 'Laptop', needsAccessories: 'No' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.label === 'Accessory Details')).toBe(false);
    });

    it('rejects values outside the published field options', () => {
      const values = { hardwareName: 'Laptop', needsAccessories: 'Maybe' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.message.includes('invalid option'))).toBe(true);
    });

    it('validates email type fields', () => {
      const values = { hardwareName: 'Laptop', contactEmail: 'not-an-email' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.message.includes('valid email'))).toBe(true);
    });

    it('validates number/currency fields reject non-numeric values', () => {
      const values = { hardwareName: 'Laptop', budget: 'abc' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.message.includes('valid number'))).toBe(true);
    });

    it('validates checkbox fields reject non-boolean values', () => {
      const values = { hardwareName: 'Laptop', acceptTerms: 'yes' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.message.includes('true or false'))).toBe(true);
    });

    it('accepts valid checkbox values', () => {
      const values = { hardwareName: 'Laptop', acceptTerms: true };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.label === 'Accept Terms')).toBe(false);
    });

    it('accepts valid currency values', () => {
      const values = { hardwareName: 'Laptop', budget: '500.00' };
      const failures = validateFormValues(basicFields, values);
      expect(failures.some(f => f.label === 'Budget')).toBe(false);
    });

    it('returns empty array for null/undefined formConfig', () => {
      expect(validateFormValues(null, { a: '1' })).toEqual([]);
      expect(validateFormValues(undefined, { a: '1' })).toEqual([]);
      expect(validateFormValues('not-an-array', { a: '1' })).toEqual([]);
    });

    it('handles fields without id or name gracefully', () => {
      const fields = [{ required: true }] as PublishedFormField[];
      const failures = validateFormValues(fields, {});
      // Fields without id/name are skipped — no crash
      expect(failures).toHaveLength(0);
    });

    it('uses requiredWhen as an alias for condition', () => {
      const fields: PublishedFormField[] = [
        { id: 'hasManager', label: 'Has Manager', type: 'select', required: false, options: ['Yes', 'No'] },
        { id: 'managerName', label: 'Manager Name', type: 'text', required: true, requiredWhen: { field: 'hasManager', operator: 'equals', value: 'Yes' } },
      ];
      const values = { hasManager: 'Yes' };
      const failures = validateFormValues(fields, values);
      expect(failures.some(f => f.label === 'Manager Name')).toBe(true);
    });

    it('treats unknown condition operators as applying the requirement (fail-closed)', () => {
      const fields: PublishedFormField[] = [
        { id: 'trigger', label: 'Trigger', type: 'text', required: false },
        { id: 'dependent', label: 'Dependent', type: 'text', required: true, condition: { field: 'trigger', operator: 'unknownOp', value: 'x' } },
      ];
      // unknownOp → conditionApplies returns true → field is required
      const values = { trigger: 'anything' };
      const failures = validateFormValues(fields, values);
      expect(failures.some(f => f.label === 'Dependent')).toBe(true);
    });
  });

  describe('isConfidentialForClassification', () => {
    it('forces confidentiality for CONFIDENTIAL classification', () => {
      expect(isConfidentialForClassification('CONFIDENTIAL', false)).toBe(true);
      expect(isConfidentialForClassification('CONFIDENTIAL', undefined)).toBe(true);
    });

    it('forces confidentiality for RESTRICTED classification', () => {
      expect(isConfidentialForClassification('RESTRICTED', false)).toBe(true);
      expect(isConfidentialForClassification('RESTRICTED', undefined)).toBe(true);
    });

    it('respects user choice for INTERNAL classification', () => {
      expect(isConfidentialForClassification('INTERNAL', true)).toBe(true);
      expect(isConfidentialForClassification('INTERNAL', false)).toBe(false);
      expect(isConfidentialForClassification('INTERNAL', undefined)).toBe(false);
    });

    it('defaults to user choice for unknown/missing classification', () => {
      expect(isConfidentialForClassification(null, true)).toBe(true);
      expect(isConfidentialForClassification(undefined, false)).toBe(false);
      expect(isConfidentialForClassification(null, undefined)).toBe(false);
    });
  });

  describe('isFormVersionStale', () => {
    it('detects stale form versions', () => {
      expect(isFormVersionStale(1, 2)).toBe(true);
      expect(isFormVersionStale(2, 3)).toBe(true);
    });

    it('accepts matching versions', () => {
      expect(isFormVersionStale(2, 2)).toBe(false);
      expect(isFormVersionStale(1, 1)).toBe(false);
    });

    it('handles null/undefined server versions gracefully', () => {
      expect(isFormVersionStale(1, null)).toBe(false);
      expect(isFormVersionStale(1, undefined)).toBe(false);
    });
  });
});