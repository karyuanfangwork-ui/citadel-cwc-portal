import prisma from '../../utils/prisma';
import { scoringService } from './scoring.service';
import { logger } from '../../utils/logger';

export interface RecalcResult {
  recalculated: boolean;
  scoreRunId?: string;
  reason?: string;
  error?: string;
}

/**
 * Recalculate the credit score for an application when a material input changes.
 *
 * Idempotency: if `sourceUpdatedAt` is provided and the latest CreditScoreRun
 * was created AFTER that timestamp, the recalc is skipped (the score already
 * reflects the change). Without a timestamp we always recalc — the caller is
 * explicitly triggering a recalculation.
 *
 * This is fire-and-log: a scoring failure (e.g. no active scorecard) is logged
 * and returned as an error result, never thrown — so the business write that
 * triggered the recalc is not blocked.
 */
export async function recalcScore(
  applicationId: string,
  reason: string,
  opts: { sourceUpdatedAt?: Date } = {},
): Promise<RecalcResult> {
  try {
    // Idempotency check — skip if the latest run is newer than the triggering change
    if (opts.sourceUpdatedAt) {
      const latest = await prisma.creditScoreRun.findFirst({
        where: { applicationId },
        orderBy: { runAt: 'desc' },
        select: { id: true, runAt: true },
      });
      if (latest && latest.runAt >= opts.sourceUpdatedAt) {
        logger.info(
          `[Recalc] Skipping for ${applicationId}: latest score run ${latest.id} is newer than the triggering change (${reason})`,
        );
        return {
          recalculated: false,
          reason: `Latest score run is newer than the triggering change (${reason})`,
        };
      }
    }

    const result = await scoringService.executeScore(applicationId, undefined, {
      actorId: null,
      source: 'AUTO',
    });

    logger.info(
      `[Recalc] Score recalculated for ${applicationId} (${reason}): run ${result.scoreRun.id}, rating ${result.riskRating}, score ${result.totalScore}`,
    );

    return {
      recalculated: true,
      scoreRunId: result.scoreRun.id,
    };
  } catch (err: any) {
    logger.error(
      `[Recalc] Failed for ${applicationId} (${reason}): ${err.message}`,
    );
    return {
      recalculated: false,
      error: err.message || 'Unknown scoring error',
    };
  }
}