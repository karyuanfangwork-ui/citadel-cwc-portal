jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditRuleConfig: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../utils/prisma';
import { resolveRequiredDocuments, resolveRequiredFields } from '../creditRuleEngine.service';

const mockedFindMany = prisma.creditRuleConfig.findMany as jest.Mock;

describe('creditRuleEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns matching DB document rules, filtering by scope with null=wildcard', async () => {
    mockedFindMany.mockResolvedValue([
      {
        kind: 'REQUIRED_DOCUMENT',
        productType: null,
        lane: 'SME',
        borrowerType: null,
        documentClass: 'SSM_CERT',
        documentLabel: 'SSM Certificate',
        fieldPath: null,
        fieldLabel: null,
        isMandatory: true,
        sortOrder: 0,
      },
      {
        kind: 'REQUIRED_DOCUMENT',
        productType: 'TERM_LOAN',
        lane: 'CORPORATE',
        borrowerType: null,
        documentClass: 'AUDITED_FINANCIALS',
        documentLabel: 'Audited Financials',
        fieldPath: null,
        fieldLabel: null,
        isMandatory: true,
        sortOrder: 1,
      },
    ]);

    const docs = await resolveRequiredDocuments({ productType: 'TERM_LOAN', lane: 'SME', borrowerType: 'CORPORATE' });

    expect(docs).toEqual([
      { documentClass: 'SSM_CERT', label: 'SSM Certificate', isMandatory: true, sortOrder: 0 },
    ]);
  });

  it('falls back to in-code defaults when no DB rows of that kind exist', async () => {
    mockedFindMany.mockResolvedValue([]);

    const docs = await resolveRequiredDocuments({ productType: 'TERM_LOAN', lane: 'PERSONAL_FAST', borrowerType: 'INDIVIDUAL' });

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.some((d) => d.documentClass === 'NRIC_PASSPORT')).toBe(true);
  });

  it('resolves required fields from DB rows', async () => {
    mockedFindMany.mockResolvedValue([
      {
        kind: 'REQUIRED_FIELD',
        productType: null,
        lane: 'CORPORATE',
        borrowerType: null,
        documentClass: null,
        documentLabel: null,
        fieldPath: 'financials.annualTurnover',
        fieldLabel: 'Annual Turnover',
        isMandatory: true,
        sortOrder: 0,
      },
    ]);

    const fields = await resolveRequiredFields({ productType: 'TERM_LOAN', lane: 'CORPORATE', borrowerType: 'CORPORATE' });

    expect(fields).toEqual([
      { fieldPath: 'financials.annualTurnover', label: 'Annual Turnover', isMandatory: true },
    ]);
  });
});
