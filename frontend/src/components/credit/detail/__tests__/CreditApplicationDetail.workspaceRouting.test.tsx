import { describe, expect, it } from 'vitest';
import { resolveWorkspaceLocationFromQuery } from '../applicationWorkspaceAreas';

describe('CreditApplicationDetail workspace route boundary', () => {
  it.each([
    ['application-parties', 'facilities', 'facilities'],
    ['financials', 'income', 'income'],
    ['risk-compliance', 'bureau-kyc', 'bureau-kyc'],
  ] as const)('resolves canonical %s/%s destinations to %s', (area, tab, expectedLocalTab) => {
    expect(resolveWorkspaceLocationFromQuery(tab, area)).toMatchObject({ area, localTab: expectedLocalTab });
  });

  it.each([
    ['loan-request', 'application-parties', 'application'],
    ['facilities', 'application-parties', 'facilities'],
    ['financial-profile', 'financials', 'income'],
    ['financials', 'financials', 'statements'],
    ['sme-financials', 'financials', 'spreading'],
    ['payment-capability', 'financials', 'repayment-capacity'],
    ['risk-score', 'risk-compliance', 'risk-rating'],
    ['credit-bureau', 'risk-compliance', 'bureau-kyc'],
    ['collateral', 'risk-compliance', 'collateral-guarantees'],
  ] as const)('preserves legacy %s routing to %s/%s', (tab, area, localTab) => {
    expect(resolveWorkspaceLocationFromQuery(tab, null)).toMatchObject({ area, localTab });
  });

  it('keeps assessment recommendation outside the Phase 3 working-area wrappers', () => {
    expect(resolveWorkspaceLocationFromQuery('approvals', 'assessment-recommendation')).toMatchObject({
      area: 'assessment-recommendation', tab: 'approvals', localTab: 'recommendation',
    });
  });
});
