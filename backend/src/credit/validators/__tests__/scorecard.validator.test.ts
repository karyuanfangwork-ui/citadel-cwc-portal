import {
  activateScorecardVersionSchema,
  createScorecardSchema,
  createVersionSchema,
  updateScorecardSchema,
} from '../scorecard.validator';

const validWeights = {
  financial_performance: 100,
  leverage: 0,
  liquidity: 0,
  cashflow: 0,
  management: 0,
  industry: 0,
  collateral: 0,
  relationship: 0,
  market_conditions: 0,
};

describe('scorecard governance validators', () => {
  it('accepts only product types supported by the scorecard schema', () => {
    expect(createScorecardSchema.safeParse({ body: { name: 'Term loans', productType: 'TERM_LOAN' } }).success).toBe(true);
    expect(createScorecardSchema.safeParse({ body: { name: 'Old alias', productType: 'REVOLVING_CREDIT' } }).success).toBe(false);
  });

  it('requires reason and both corporate and retail weight maps for a new draft version', () => {
    const valid = {
      body: {
        factorWeights: validWeights,
        retailFactorWeights: validWeights,
        changeReason: 'Policy-approved proposal',
      },
    };
    expect(createVersionSchema.safeParse(valid).success).toBe(true);
    expect(createVersionSchema.safeParse({ body: { factorWeights: validWeights, changeReason: 'Missing retail' } }).success).toBe(false);
    expect(createVersionSchema.safeParse({ body: { ...valid.body, changeReason: 'no' } }).success).toBe(false);
    expect(createVersionSchema.safeParse({
      body: { ...valid.body, factorWeights: { ...validWeights, unsupported: 1 } },
    }).success).toBe(false);
  });

  it('requires policy evidence and explicit market_conditions acknowledgment for activation', () => {
    expect(activateScorecardVersionSchema.safeParse({
      body: { policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: true },
    }).success).toBe(true);
    expect(activateScorecardVersionSchema.safeParse({
      body: { policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: false },
    }).success).toBe(false);
    expect(activateScorecardVersionSchema.safeParse({ body: {} }).success).toBe(false);
  });

  it('does not expose parent isActive as an editable scorecard field', () => {
    expect(updateScorecardSchema.safeParse({ body: { isActive: true } }).success).toBe(false);
  });
});
