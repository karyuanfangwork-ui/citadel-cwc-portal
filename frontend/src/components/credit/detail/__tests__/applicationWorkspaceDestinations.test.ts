import { describe, expect, it } from 'vitest';
import { resolveWorkspaceLocationFromQuery } from '../applicationWorkspaceAreas';

describe('canonical application workspace destinations', () => {
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
  ] as const)('resolves %s to %s/%s', (tab, area, localTab) => {
    expect(resolveWorkspaceLocationFromQuery(tab, null)).toMatchObject({ area, localTab });
  });

  it('resolves canonical local query values when an area is supplied', () => {
    expect(resolveWorkspaceLocationFromQuery('income', 'financials')).toMatchObject({
      area: 'financials', localTab: 'income', tab: 'financial-profile',
    });
  });
});