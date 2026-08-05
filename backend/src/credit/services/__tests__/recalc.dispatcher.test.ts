jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScoreRun: { findFirst: jest.fn() },
  },
}));

jest.mock('../scoring.service', () => ({
  scoringService: { executeScore: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { recalcScore } from '../recalc.service';
import prisma from '../../../utils/prisma';
import { scoringService } from '../scoring.service';

describe('recalcScore dispatcher', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls executeScore when no prior score run exists', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    (scoringService.executeScore as jest.Mock).mockResolvedValue({
      scoreRun: { id: 'run-1' }, totalScore: 70, riskRating: 'A',
    });

    const result = await recalcScore('app-1', 'financial_approval');

    expect(scoringService.executeScore).toHaveBeenCalledWith(
      'app-1', undefined, { actorId: null, source: 'AUTO' },
    );
    expect(result.recalculated).toBe(true);
    expect(result.scoreRunId).toBe('run-1');
  });

  it('calls executeScore when the triggering change is newer than the latest run', async () => {
    const runAt = new Date('2026-06-20T10:00:00Z');
    const changeTime = new Date('2026-06-24T10:00:00Z');
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-old', runAt,
    });
    (scoringService.executeScore as jest.Mock).mockResolvedValue({
      scoreRun: { id: 'run-new' }, totalScore: 75, riskRating: 'A',
    });

    const result = await recalcScore('app-1', 'retail_income_save', {
      sourceUpdatedAt: changeTime,
    });

    expect(scoringService.executeScore).toHaveBeenCalled();
    expect(result.recalculated).toBe(true);
  });

  it('skips recalc when the latest score run is newer than the triggering change (idempotent)', async () => {
    const runAt = new Date('2026-06-24T10:00:00Z');
    const changeTime = new Date('2026-06-20T10:00:00Z');
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-fresh', runAt,
    });

    const result = await recalcScore('app-1', 'document_verified', {
      sourceUpdatedAt: changeTime,
    });

    expect(scoringService.executeScore).not.toHaveBeenCalled();
    expect(result.recalculated).toBe(false);
    expect(result.reason).toMatch(/newer than/i);
  });

  it('recalcs when no sourceUpdatedAt is provided (conservative — always recalc on explicit trigger)', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-old', runAt: new Date('2026-06-20T10:00:00Z'),
    });
    (scoringService.executeScore as jest.Mock).mockResolvedValue({
      scoreRun: { id: 'run-2' }, totalScore: 68, riskRating: 'BBB',
    });

    const result = await recalcScore('app-1', 'manual_trigger');

    expect(scoringService.executeScore).toHaveBeenCalled();
    expect(result.recalculated).toBe(true);
  });

  it('logs and returns error when executeScore throws (fire-and-log, does not throw)', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    (scoringService.executeScore as jest.Mock).mockRejectedValue(new Error('No active scorecard'));

    const result = await recalcScore('app-1', 'financial_approval');

    expect(result.recalculated).toBe(false);
    expect(result.error).toMatch(/No active scorecard/);
  });
});