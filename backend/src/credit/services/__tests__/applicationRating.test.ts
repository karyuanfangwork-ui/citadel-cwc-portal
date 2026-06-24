jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScoreRun: { findFirst: jest.fn() },
    financialStatement: { findFirst: jest.fn().mockResolvedValue(null) },
    retailIncome: { findUnique: jest.fn().mockResolvedValue(null) },
    qualitativeAssessment: { findUnique: jest.fn().mockResolvedValue(null) },
    bureauChecklist: { findUnique: jest.fn().mockResolvedValue(null) },
    creditDocument: { findFirst: jest.fn().mockResolvedValue(null) },
    creditApplication: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

import { getApplicationEffectiveRating, getLatestScoreRunAt, getLatestMaterialUpdate } from '../applicationRating.service';
import prisma from '../../../utils/prisma';

describe('getApplicationEffectiveRating', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the latest score run rating', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({ riskRating: 'BBB' });
    expect(await getApplicationEffectiveRating('app-1')).toBe('BBB');
  });

  it('returns NR when no score run exists', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    expect(await getApplicationEffectiveRating('app-1')).toBe('NR');
  });

  it('queries with orderBy runAt desc to get the most recent run', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({ riskRating: 'A' });
    await getApplicationEffectiveRating('app-2');
    const call = (prisma.creditScoreRun.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ applicationId: 'app-2' });
    expect(call.orderBy).toEqual({ runAt: 'desc' });
  });
});

describe('getLatestScoreRunAt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the latest runAt timestamp', async () => {
    const date = new Date('2026-06-24T10:00:00Z');
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({ runAt: date });
    expect(await getLatestScoreRunAt('app-1')).toEqual(date);
  });

  it('returns null when no score run exists', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    expect(await getLatestScoreRunAt('app-1')).toBeNull();
  });
});

describe('getLatestMaterialUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the max timestamp across material sources', async () => {
    const finDate = new Date('2026-06-20T10:00:00Z');
    const appDate = new Date('2026-06-24T10:00:00Z');
    (prisma.financialStatement.findFirst as jest.Mock).mockResolvedValue({ updatedAt: finDate });
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue({
      updatedAt: appDate, borrowerProfileId: 'bp-1',
    });

    const result = await getLatestMaterialUpdate('app-1');
    expect(result).toEqual(appDate);
  });

  it('returns epoch when no material inputs exist', async () => {
    // Reset all mocks to return null for this test
    (prisma.financialStatement.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.retailIncome.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.qualitativeAssessment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.bureauChecklist.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.creditDocument.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getLatestMaterialUpdate('app-empty');
    expect(result).toEqual(new Date(0));
  });
});