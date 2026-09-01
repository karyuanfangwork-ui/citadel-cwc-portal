import { describe, expect, it } from 'vitest';
import { buildApprovalPayload, isOverrideOf, validateApprovalDecision } from '../approvalDecision';

describe('isOverrideOf', () => {
  it('detects terminal departures', () => {
    expect(isOverrideOf('REJECT', 'APPROVE')).toBe(true);
    expect(isOverrideOf('APPROVE', 'CONDITIONAL')).toBe(true);
  });
  it('ignores agreement, routing, and missing recommendations', () => {
    expect(isOverrideOf('APPROVE', 'APPROVE')).toBe(false);
    expect(isOverrideOf('APPROVE', 'RETURN')).toBe(false);
    expect(isOverrideOf(null, 'REJECT')).toBe(false);
  });
});

describe('override reason validation and payload', () => {
  const base = { decision: 'APPROVE' as const, comment: 'Sufficient comfort from the guarantee.' };
  it('requires a reason for an override and accepts a valid one', () => {
    expect(validateApprovalDecision({ ...base, systemRecommendation: 'REJECT' })).toMatch(/override/i);
    expect(validateApprovalDecision({ ...base, systemRecommendation: 'REJECT', overrideReason: 'Parent guarantee covers the shortfall in full.' })).toBeNull();
  });
  it('does not require a reason when aligned and only emits it for overrides', () => {
    expect(validateApprovalDecision({ ...base, systemRecommendation: 'APPROVE' })).toBeNull();
    expect(buildApprovalPayload({ ...base, systemRecommendation: 'REJECT', overrideReason: 'Parent guarantee covers the shortfall in full.' })).toMatchObject({ overrideReason: 'Parent guarantee covers the shortfall in full.' });
    expect('overrideReason' in buildApprovalPayload(base)).toBe(false);
  });
});
