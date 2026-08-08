import {
  validateApprovalDecision,
  buildApprovalPayload,
  COMMENT_MIN_LENGTH,
} from '../approvalDecision';

const LONG = 'Financials do not support the requested facility size.';

describe('validateApprovalDecision', () => {
  it('accepts a bare APPROVE', () => {
    expect(validateApprovalDecision({ decision: 'APPROVE', comment: '' })).toBeNull();
  });

  it('requires a comment for APPROVE when the tier demands one', () => {
    expect(
      validateApprovalDecision({ decision: 'APPROVE', comment: '', requireCommentForTier: true }),
    ).toMatch(/comment/i);
  });

  it.each(['REJECT', 'CONDITIONAL', 'RETURN'] as const)(
    'requires a %s comment of at least COMMENT_MIN_LENGTH characters',
    (decision) => {
      const msg = validateApprovalDecision({
        decision,
        comment: 'short',
        rejectionReasonCode: 'POLICY_BREACH',
        conditions: [{ title: 'c' }],
      });
      expect(msg).toMatch(new RegExp(String(COMMENT_MIN_LENGTH)));
    },
  );

  it('requires a rejection reason code for REJECT', () => {
    expect(validateApprovalDecision({ decision: 'REJECT', comment: LONG })).toMatch(/reason code/i);
  });

  it('requires at least one condition for CONDITIONAL', () => {
    expect(
      validateApprovalDecision({ decision: 'CONDITIONAL', comment: LONG, conditions: [] }),
    ).toMatch(/condition/i);
  });

  it('accepts a complete REJECT', () => {
    expect(
      validateApprovalDecision({ decision: 'REJECT', comment: LONG, rejectionReasonCode: 'POLICY_BREACH' }),
    ).toBeNull();
  });

  it('accepts a complete CONDITIONAL', () => {
    expect(
      validateApprovalDecision({ decision: 'CONDITIONAL', comment: LONG, conditions: [{ title: 'Valuation report' }] }),
    ).toBeNull();
  });

  it('accepts a complete RETURN', () => {
    expect(validateApprovalDecision({ decision: 'RETURN', comment: LONG })).toBeNull();
  });
});

describe('buildApprovalPayload', () => {
  it('omits rejectionReasonCode for non-REJECT decisions', () => {
    const body = buildApprovalPayload({
      decision: 'APPROVE', comment: LONG, rejectionReasonCode: 'POLICY_BREACH',
    });
    expect(body.rejectionReasonCode).toBeUndefined();
  });

  it('omits conditions for non-CONDITIONAL decisions', () => {
    const body = buildApprovalPayload({
      decision: 'APPROVE', comment: LONG, conditions: [{ title: 'x' }],
    });
    expect(body.conditions).toBeUndefined();
  });

  it('includes both on the decisions that need them', () => {
    expect(buildApprovalPayload({ decision: 'REJECT', comment: LONG, rejectionReasonCode: 'OTHER' }).rejectionReasonCode).toBe('OTHER');
    expect(buildApprovalPayload({ decision: 'CONDITIONAL', comment: LONG, conditions: [{ title: 'x' }] }).conditions).toHaveLength(1);
  });

  it('trims the comment and omits it when empty', () => {
    expect(buildApprovalPayload({ decision: 'APPROVE', comment: '   ' }).comment).toBeUndefined();
    expect(buildApprovalPayload({ decision: 'APPROVE', comment: `  ${LONG}  ` }).comment).toBe(LONG);
  });
});