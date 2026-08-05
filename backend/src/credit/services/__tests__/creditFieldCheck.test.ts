jest.mock('../creditRuleEngine.service', () => ({
  resolveRequiredFields: jest.fn(),
}));

import { checkRequiredFields } from '../creditFieldCheck.service';
import { resolveRequiredFields } from '../creditRuleEngine.service';

const mockedResolveRequiredFields = resolveRequiredFields as jest.Mock;

const scope = { productType: 'TERM_LOAN', lane: 'CORPORATE', borrowerType: 'CORPORATE' };

describe('checkRequiredFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports missing required fields via dot-path lookup', async () => {
    mockedResolveRequiredFields.mockResolvedValue([
      { fieldPath: 'financials.annualTurnover', label: 'Annual Turnover', isMandatory: true },
      { fieldPath: 'purpose', label: 'Loan Purpose', isMandatory: true },
    ]);

    const result = await checkRequiredFields(scope, { purpose: 'Expansion', financials: {} });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([{ fieldPath: 'financials.annualTurnover', label: 'Annual Turnover' }]);
  });

  it('passes when all required fields are present', async () => {
    mockedResolveRequiredFields.mockResolvedValue([
      { fieldPath: 'purpose', label: 'Loan Purpose', isMandatory: true },
    ]);

    const result = await checkRequiredFields(scope, { purpose: 'Expansion' });

    expect(result).toEqual({ ok: true, missing: [] });
  });
});
