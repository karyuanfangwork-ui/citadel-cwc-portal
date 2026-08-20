import { describe, expect, it } from 'vitest';
import {
  formatApplicationState,
  formatBorrowerDate,
  formatBorrowerType,
  formatMyr,
  formatProductType,
  getApplicationStateTone,
  getReadinessTone,
} from '../borrowerPresentation';

describe('borrower presentation helpers', () => {
  it('renders enum labels as human-readable title case', () => {
    expect(formatProductType('REVOLVING_CREDIT')).toBe('Revolving credit');
    expect(formatApplicationState('UNDERWRITING')).toBe('Underwriting');
    expect(formatBorrowerType('SOLE_PROPRIETOR')).toBe('Sole proprietor');
  });

  it('formats MYR with no decimal places', () => {
    expect(formatMyr(500000)).toMatch(/RM\s?500,000/);
  });

  it('returns an em dash for missing or invalid display values', () => {
    expect(formatMyr('not-a-number')).toBe('—');
    expect(formatBorrowerDate(null)).toBe('—');
    expect(formatBorrowerDate('not-a-date')).toBe('—');
  });

  it('maps terminal and rejected states to negative tone', () => {
    expect(getApplicationStateTone('REJECTED')).toBe('neg');
    expect(getApplicationStateTone('APPROVED')).toBe('pos');
  });

  it('maps readiness states to semantic tones', () => {
    expect(getReadinessTone('READY')).toBe('pos');
    expect(getReadinessTone('WARNING')).toBe('warn');
    expect(getReadinessTone('BLOCKED')).toBe('neg');
  });
});
