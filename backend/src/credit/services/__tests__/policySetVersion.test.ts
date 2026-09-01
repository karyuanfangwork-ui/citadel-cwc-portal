import {
  computePolicySetVersion,
  isLegacyPolicyVersion,
  describePolicyVersion,
  POLICY_SET_VERSION_PREFIX,
  type PolicySetInput,
} from '../policySetVersion';

const input = (over: Partial<PolicySetInput> = {}): PolicySetInput => ({
  parameters: [{ key: 'missing_data.cashflow.policy', value: 'PENALTY', productType: null, lane: null, borrowerType: null }],
  ruleConfigs: [{ kind: 'REQUIRED_DOCUMENT', documentClass: 'BANK_STATEMENT', fieldPath: null, productType: null, lane: null, borrowerType: null }],
  limits: [{ type: 'SINGLE_BORROWER', maxValue: '5000000', thresholdPct: '80', sector: null, productType: null }],
  ...over,
});

describe('computePolicySetVersion', () => {
  it('returns a sha256-prefixed 12-character identifier', () => {
    const version = computePolicySetVersion(input());
    expect(version).toMatch(/^sha256:[0-9a-f]{12}$/);
    expect(version.startsWith(POLICY_SET_VERSION_PREFIX)).toBe(true);
  });

  it('fits the VarChar(50) column with room to spare', () => {
    expect(computePolicySetVersion(input()).length).toBeLessThanOrEqual(50);
  });

  it('is identical for the same configuration', () => {
    expect(computePolicySetVersion(input())).toBe(computePolicySetVersion(input()));
  });

  it('is insensitive to database row order', () => {
    const a = input({ limits: [
      { type: 'SECTOR', maxValue: '1', thresholdPct: '80', sector: 'AGRI', productType: null },
      { type: 'SINGLE_BORROWER', maxValue: '2', thresholdPct: '80', sector: null, productType: null },
    ] });
    const b = input({ limits: [...a.limits].reverse() });
    expect(computePolicySetVersion(a)).toBe(computePolicySetVersion(b));
  });

  it('changes when any parameter value changes', () => {
    expect(computePolicySetVersion(input())).not.toBe(computePolicySetVersion(input({
      parameters: [{ key: 'missing_data.cashflow.policy', value: 'BLOCK', productType: null, lane: null, borrowerType: null }],
    })));
  });

  it('changes when a rule config is added', () => {
    expect(computePolicySetVersion(input())).not.toBe(computePolicySetVersion(input({
      ruleConfigs: [
        { kind: 'REQUIRED_DOCUMENT', documentClass: 'BANK_STATEMENT', fieldPath: null, productType: null, lane: null, borrowerType: null },
        { kind: 'REQUIRED_FIELD', documentClass: null, fieldPath: 'borrower.nric', productType: null, lane: null, borrowerType: null },
      ],
    })));
  });

  it('changes when a limit changes', () => {
    expect(computePolicySetVersion(input())).not.toBe(computePolicySetVersion(input({
      limits: [{ type: 'SINGLE_BORROWER', maxValue: '6000000', thresholdPct: '80', sector: null, productType: null }],
    })));
  });

  it('distinguishes an empty config set from a populated one', () => {
    const empty = computePolicySetVersion({ parameters: [], ruleConfigs: [], limits: [] });
    expect(empty).toMatch(/^sha256:[0-9a-f]{12}$/);
    expect(empty).not.toBe(computePolicySetVersion(input()));
  });

  it('does not vary with the clock', () => {
    const first = computePolicySetVersion(input());
    jest.spyOn(Date, 'now').mockReturnValue(0);
    expect(computePolicySetVersion(input())).toBe(first);
    jest.restoreAllMocks();
  });
});

describe('isLegacyPolicyVersion', () => {
  it('recognises pre-CA-P6-003 md5 values', () => {
    expect(isLegacyPolicyVersion('md5:1a2b3c4d')).toBe(true);
    expect(isLegacyPolicyVersion('sha256:1a2b3c4d5e6f')).toBe(false);
    expect(isLegacyPolicyVersion(null)).toBe(false);
    expect(isLegacyPolicyVersion(undefined)).toBe(false);
    expect(isLegacyPolicyVersion('')).toBe(false);
  });
});

describe('describePolicyVersion', () => {
  it('describes legacy coverage', () => {
    expect(describePolicyVersion('md5:1a2b3c4d')).toMatch(/missing-data policies only/i);
  });

  it('describes current coverage', () => {
    expect(describePolicyVersion('sha256:1a2b3c4d5e6f')).toMatch(/limits, rule configs and policy parameters/i);
  });

  it('does not invent meaning for an absent version', () => {
    expect(describePolicyVersion(null)).toMatch(/not recorded/i);
  });
});
