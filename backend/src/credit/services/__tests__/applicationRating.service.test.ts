jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditScoreRun: {
      findFirst: jest.fn(),
    },
    financialStatement: { findFirst: jest.fn() },
    retailIncome: { findUnique: jest.fn() },
    qualitativeAssessment: { findUnique: jest.fn() },
    bureauChecklist: { findUnique: jest.fn() },
    creditDocument: { findFirst: jest.fn() },
  },
}));

import prisma from '../../../utils/prisma';
import {
  getApplicationEffectiveRating,
  persistApplicationRiskRating,
  syncApplicationRiskRatingFromLatestScoreRun,
} from '../applicationRating.service';

const mockPrisma = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock; update: jest.Mock };
  creditScoreRun: { findFirst: jest.Mock };
};

describe('applicationRating.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canonical application rating without querying score runs when present', async () => {
    mockPrisma.creditApplication.findUnique.mockResolvedValue({ riskRating: 'BBB' });

    const result = await getApplicationEffectiveRating('app-1');

    expect(result).toBe('BBB');
    expect(mockPrisma.creditScoreRun.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to latest score run and backfills canonical application rating', async () => {
    const runAt = new Date('2026-01-01T00:00:00Z');
    mockPrisma.creditApplication.findUnique.mockResolvedValue({ riskRating: null });
    mockPrisma.creditScoreRun.findFirst.mockResolvedValue({ riskRating: 'BB', runAt });
    mockPrisma.creditApplication.update.mockResolvedValue({});

    const result = await getApplicationEffectiveRating('app-1');

    expect(result).toBe('BB');
    expect(mockPrisma.creditApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { riskRating: 'BB', riskRatingUpdatedAt: runAt },
    });
  });

  it('returns NR when neither canonical rating nor score run exists', async () => {
    mockPrisma.creditApplication.findUnique.mockResolvedValue({ riskRating: null });
    mockPrisma.creditScoreRun.findFirst.mockResolvedValue(null);

    const result = await getApplicationEffectiveRating('app-1');

    expect(result).toBe('NR');
  });

  it('persists canonical rating directly', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00Z');
    mockPrisma.creditApplication.update.mockResolvedValue({});

    await persistApplicationRiskRating('app-1', 'A', updatedAt);

    expect(mockPrisma.creditApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { riskRating: 'A', riskRatingUpdatedAt: updatedAt },
    });
  });

  it('syncs canonical rating from latest score run', async () => {
    const runAt = new Date('2026-01-03T00:00:00Z');
    mockPrisma.creditScoreRun.findFirst.mockResolvedValue({ riskRating: 'A', runAt });
    mockPrisma.creditApplication.update.mockResolvedValue({});

    const result = await syncApplicationRiskRatingFromLatestScoreRun('app-1');

    expect(result).toBe('A');
    expect(mockPrisma.creditApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: { riskRating: 'A', riskRatingUpdatedAt: runAt },
    });
  });
});
