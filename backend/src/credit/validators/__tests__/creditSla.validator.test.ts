import {
  createSlaPolicySchema,
  updateSlaPolicySchema,
  isSafeEscalationState,
  SAFE_ESCALATION_STATES,
} from '../creditSla.validator';

const validBody = {
  name: 'Credit assessment SLA',
  targetState: 'CREDIT_ASSESSMENT',
  slaHours: 48,
  notifyRoles: ['CREDIT_MANAGER'],
};

function parseCreate(overrides: Record<string, unknown>) {
  return createSlaPolicySchema.safeParse({ body: { ...validBody, ...overrides } });
}

describe('SAFE_ESCALATION_STATES', () => {
  it('contains exactly the two non-decisional escalation targets', () => {
    expect([...SAFE_ESCALATION_STATES].sort()).toEqual(['COMPLIANCE_HOLD', 'REFERRED_BACK']);
  });
});

describe('isSafeEscalationState', () => {
  it('accepts null and undefined', () => {
    expect(isSafeEscalationState(null)).toBe(true);
    expect(isSafeEscalationState(undefined)).toBe(true);
  });

  it.each(['COMPLIANCE_HOLD', 'REFERRED_BACK'])('accepts %s', (s) => {
    expect(isSafeEscalationState(s)).toBe(true);
  });

  it.each([
    'APPROVED', 'REJECTED', 'DISBURSED', 'ACTIVE', 'ACCEPTED',
    'OFFER', 'KYC_APPROVED', 'KYC_REJECTED', 'CONDITION_FULFILMENT',
    'CLOSED', 'WITHDRAWN', 'NOT_A_STATE',
  ])('rejects unsafe state %s', (s) => {
    expect(isSafeEscalationState(s)).toBe(false);
  });
});

describe('createSlaPolicySchema — escalateToState (GAP-P0-01)', () => {
  it('accepts a policy with no escalation configured', () => {
    expect(parseCreate({}).success).toBe(true);
  });

  it.each(['COMPLIANCE_HOLD', 'REFERRED_BACK'])('accepts escalateToState %s', (s) => {
    expect(parseCreate({ escalateToState: s, escalateAfterHours: 24 }).success).toBe(true);
  });

  it.each(['APPROVED', 'DISBURSED', 'ACTIVE', 'REJECTED', 'ACCEPTED', 'KYC_APPROVED', 'CLOSED'])(
    'rejects escalateToState %s', (s) => {
      expect(parseCreate({ escalateToState: s, escalateAfterHours: 24 }).success).toBe(false);
    },
  );

  it('rejects escalateAfterHours without escalateToState', () => {
    expect(parseCreate({ escalateAfterHours: 24 }).success).toBe(false);
  });

  it('rejects escalateToState without escalateAfterHours', () => {
    expect(parseCreate({ escalateToState: 'REFERRED_BACK' }).success).toBe(false);
  });

  it('requires a valid ApplicationState for targetState', () => {
    expect(parseCreate({ targetState: 'MADE_UP' }).success).toBe(false);
  });

  it('rejects a non-positive slaHours', () => {
    expect(parseCreate({ slaHours: 0 }).success).toBe(false);
  });
});

describe('updateSlaPolicySchema — escalateToState (GAP-P0-01)', () => {
  it('allows clearing escalateToState with null', () => {
    expect(updateSlaPolicySchema.safeParse({
      body: { escalateToState: null, escalateAfterHours: null },
    }).success).toBe(true);
  });

  it('rejects patching escalateToState to APPROVED', () => {
    expect(updateSlaPolicySchema.safeParse({
      body: { escalateToState: 'APPROVED', escalateAfterHours: 24 },
    }).success).toBe(false);
  });

  it('accepts an unrelated field-only patch', () => {
    expect(updateSlaPolicySchema.safeParse({ body: { name: 'Renamed' } }).success).toBe(true);
  });
});
