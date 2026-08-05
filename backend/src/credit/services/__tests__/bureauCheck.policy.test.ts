jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditBureauCheck: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn() },
}));

jest.mock('../recalc.service', () => ({
  recalcScore: jest.fn(),
}));

jest.mock('../policyParameter.service', () => ({
  getNumberPolicy: jest.fn(async (_key: string, fallback: number) => fallback),
  getStringPolicy: jest.fn(async (_key: string, fallback: string) => fallback),
}));

import prisma from '../../../utils/prisma';
import { getNumberPolicy, getStringPolicy } from '../policyParameter.service';
import { getBureauCapsForApplication, isBureauCheckFresh } from '../bureauCheck.service';

const mockPrisma = prisma as unknown as {
  creditBureauCheck: { findMany: jest.Mock };
};
const mockedGetNumberPolicy = getNumberPolicy as jest.Mock;
const mockedGetStringPolicy = getStringPolicy as jest.Mock;

describe('bureauCheck policy parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNumberPolicy.mockImplementation(async (_key: string, fallback: number) => fallback);
    mockedGetStringPolicy.mockImplementation(async (_key: string, fallback: string) => fallback);
  });

  it('preserves default bureau caps when no overrides exist', async () => {
    mockPrisma.creditBureauCheck.findMany.mockResolvedValue([
      {
        ccrisSaaFlag: true,
        ccrisMissedPayments12Months: 3,
        ccrisLegalActionFlag: false,
        ccrisBankruptcyFlag: false,
        ctosAdverseFlag: false,
        ctosBankruptcyFlag: false,
        ctosScore: 450,
      },
    ]);

    const caps = await getBureauCapsForApplication('app-1');

    expect(caps).toEqual(expect.arrayContaining([
      { reason: 'ccris_saa', maxRating: 'BBB' },
      { reason: 'ccris_missed_3', maxRating: 'BB' },
      { reason: 'ctos_score_lt_500', maxRating: 'BB' },
    ]));
  });

  it('uses configured missed-payment threshold and max rating', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'bureau.cap.ccris_missed_payments.threshold' ? 2 : fallback,
    );
    mockedGetStringPolicy.mockImplementation(async (key: string, fallback: string) =>
      key === 'bureau.cap.ccris_missed_payments.max_rating' ? 'B' : fallback,
    );
    mockPrisma.creditBureauCheck.findMany.mockResolvedValue([
      {
        ccrisSaaFlag: false,
        ccrisMissedPayments12Months: 2,
        ccrisLegalActionFlag: false,
        ccrisBankruptcyFlag: false,
        ctosAdverseFlag: false,
        ctosBankruptcyFlag: false,
        ctosScore: null,
      },
    ]);

    const caps = await getBureauCapsForApplication('app-1');

    expect(caps).toContainEqual({ reason: 'ccris_missed_2', maxRating: 'B' });
  });

  it('uses configured freshness window', async () => {
    mockedGetNumberPolicy.mockImplementation(async (key: string, fallback: number) =>
      key === 'bureau.freshness_days' ? 30 : fallback,
    );
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    mockPrisma.creditBureauCheck.findMany.mockResolvedValue([
      { provider: 'CTOS', ccrisReportDate: null, ctosReportDate: fortyDaysAgo, runDate: fortyDaysAgo },
    ]);

    const result = await isBureauCheckFresh('app-1');

    expect(result.fresh).toBe(false);
    expect(result.staleProviders).toEqual(['CTOS']);
  });
});
