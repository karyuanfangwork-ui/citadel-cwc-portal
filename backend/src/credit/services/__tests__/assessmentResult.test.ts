const createMock = jest.fn();
const updateManyMock = jest.fn();

jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    creditScoreRun: {
      findFirst: jest.fn(),
    },
    bureauChecklist: {
      findUnique: jest.fn().mockResolvedValue({ noAdverseRecord: true, amlScreeningDone: true }),
    },
    applicationAssessmentResult: {
      findMany: jest.fn().mockResolvedValue([]),
      create: createMock,
      updateMany: updateManyMock,
      findFirst: jest.fn(),
    },
  };
  mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../decisionEngine.service', () => ({
  recommendDecision: jest.fn().mockReturnValue({
    recommendation: 'CONDITIONAL',
    ruleTrace: [{ rule: 'RATING_MODERATE', recommendation: 'CONDITIONAL', detail: 'BBB requires conditional approval' }],
    reasonCodes: ['RATING_MODERATE'],
  }),
}));

import { freezeAssessmentResult, getLatestAssessmentResult } from '../assessmentResult.service';
import prisma from '../../../utils/prisma';

describe('freezeAssessmentResult', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a FROZEN assessment result from the latest score run', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-1',
      riskRating: 'BBB',
      baseRiskRating: 'BBB',
      totalScore: 65,
      missingInputs: [{ factor: 'cashflow', subField: 'dscr', policy: 'NEUTRAL', appliedScore: 50 }],
      bureauCapsApplied: [],
      inputSnapshot: null,
      ratingBandVersion: 1,
      calculationSource: 'MANUAL',
    });
    (prisma.applicationAssessmentResult.create as jest.Mock).mockResolvedValue({
      id: 'ar-1', status: 'FROZEN', version: 1,
    });

    const result = await freezeAssessmentResult('app-1', 'u-1');

    expect(result.id).toBe('ar-1');
    expect(result.status).toBe('FROZEN');
    expect(prisma.applicationAssessmentResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: 'app-1',
          scoreRunId: 'run-1',
          finalRiskRating: 'BBB',
          riskCategory: 'MODERATE',
          decisionRecommendation: 'CONDITIONAL',
          status: 'FROZEN',
          version: 1,
          createdById: 'u-1',
        }),
      }),
    );
  });

  it('throws when no score run exists', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(freezeAssessmentResult('app-empty', 'u-1')).rejects.toThrow(/no score run/i);
  });

  it('supersedes prior FROZEN results and increments version', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-2', riskRating: 'A', totalScore: 72, missingInputs: null,
      bureauCapsApplied: [], inputSnapshot: null, ratingBandVersion: 1,
      calculationSource: 'MANUAL',
    });
    (prisma.applicationAssessmentResult.findMany as jest.Mock).mockResolvedValue([
      { id: 'ar-old', version: 1 },
    ]);
    (prisma.applicationAssessmentResult.create as jest.Mock).mockResolvedValue({
      id: 'ar-2', status: 'FROZEN', version: 2,
    });

    const result = await freezeAssessmentResult('app-1', 'u-2');

    expect(result.version).toBe(2);
    expect(prisma.applicationAssessmentResult.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ar-old'] } },
        data: { status: 'SUPERSEDED' },
      }),
    );
  });

  it('derives risk category as PROHIBITED for D rating', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-3', riskRating: 'D', totalScore: 10, missingInputs: null,
      bureauCapsApplied: [], inputSnapshot: null, ratingBandVersion: 1,
      calculationSource: 'MANUAL',
    });
    (prisma.applicationAssessmentResult.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.applicationAssessmentResult.create as jest.Mock).mockResolvedValue({
      id: 'ar-3', status: 'FROZEN', version: 1,
    });

    await freezeAssessmentResult('app-3', 'u-1');

    const createCall = (prisma.applicationAssessmentResult.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.riskCategory).toBe('PROHIBITED');
  });
});

describe('freezeAssessmentResult — atomicity (GAP-P1-06)', () => {
  beforeEach(() => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-atomic', riskRating: 'BBB', totalScore: 62, missingInputs: null,
      bureauCapsApplied: null, inputSnapshot: {}, ratingBandVersion: 3, calculationSource: 'AUTO',
    });
    (prisma.applicationAssessmentResult.findMany as jest.Mock).mockResolvedValue([{ id: 'prior-1', version: 1 }]);
    (prisma.applicationAssessmentResult.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.applicationAssessmentResult.create as jest.Mock).mockReset();
    (prisma as any).$transaction.mockClear();
  });

  it('performs supersede and create inside one transaction', async () => {
    (prisma.applicationAssessmentResult.create as jest.Mock).mockResolvedValue({ id: 'new-1', status: 'FROZEN', version: 2 });
    await freezeAssessmentResult('app-atomic', 'actor-1');
    expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.applicationAssessmentResult.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.applicationAssessmentResult.create).toHaveBeenCalledTimes(1);
  });

  it('propagates create failure within the transaction boundary', async () => {
    (prisma.applicationAssessmentResult.create as jest.Mock).mockRejectedValue(new Error('unique constraint violation'));
    await expect(freezeAssessmentResult('app-atomic', 'actor-1')).rejects.toThrow('unique constraint violation');
    expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('getLatestAssessmentResult', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the latest FROZEN result', async () => {
    (prisma.applicationAssessmentResult.findFirst as jest.Mock).mockResolvedValue({
      id: 'ar-1', status: 'FROZEN', version: 1, finalRiskRating: 'BBB',
    });
    const result = await getLatestAssessmentResult('app-1');
    expect(result?.id).toBe('ar-1');
  });
});