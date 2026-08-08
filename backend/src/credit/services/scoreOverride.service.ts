/**
 * Score Override Approval Service — §1.6
 *
 * Dual-approval for credit score overrides ≥ 2 notches.
 *
 * Flow:
 *   1. RM requests override → creates ScoreOverrideApproval (status: PENDING_SECOND_APPROVAL)
 *      - firstApproverId = the admin who initiated the override
 *   2. Second admin approves → status → APPROVED
 *      - (or rejects → status → REJECTED)
 *   3. Only then can the application's score actually be changed
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { ScoreOverrideStatus } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { notchDelta, MATERIAL_OVERRIDE_NOTCHES, isKnownRating } from './ratingScale';
import { AppError } from '../../middleware/error.middleware';

// Minimum notch delta that requires dual approval.
const DUAL_APPROVAL_THRESHOLD = MATERIAL_OVERRIDE_NOTCHES;

/**
 * Notch delta between two ratings, on the module's single canonical scale.
 *
 * This previously used a local 20-notch scale with modifier grades (AA+, BBB-,
 * ...) that this system does not issue and which omitted CC, C and NR. Deltas
 * involving those three grades silently returned exactly the dual-approval
 * threshold, and adjacent real grades measured as two notches.
 */
export function calculateNotchDelta(originalRating: string, overrideRating: string): number {
  return notchDelta(originalRating, overrideRating);
}

/**
 * Request a score override. If the delta is < 2 notches, auto-approve.
 * If ≥ 2, require a second approver (mark PENDING_SECOND_APPROVAL).
 *
 * LOS-008 — originalRating and scoreRunId are now derived from the latest
 * CreditScoreRun, never accepted from the client. Previously originalRating
 * arrived in the request body (allowing the caller to choose the notch delta)
 * and scoreRunId was never persisted (making every approved override inert).
 */
export async function requestScoreOverride(params: {
  applicationId: string;
  overrideRating: string;
  justification: string;
  approverId: string;
}): Promise<{
  id: string;
  status: ScoreOverrideStatus;
  notchDelta: number;
  requiresSecondApproval: boolean;
  scoreRunId: string;
  originalRating: string;
}> {
  const { applicationId, overrideRating, justification, approverId } = params;

  // LOS-008 — Derive the subject of the override from the server, never the
  // client. Previously `originalRating` arrived in the request body, so the
  // caller chose the notch delta and therefore whether dual approval applied;
  // and `scoreRunId` was never persisted at all, which made every approved
  // override inert (resolveScoreOverride only applies when scoreRunId is set).
  const latestRun = await prisma.creditScoreRun.findFirst({
    where: { applicationId },
    orderBy: { runAt: 'desc' },
    select: { id: true, riskRating: true },
  });

  if (!latestRun) {
    throw new AppError(
      'Cannot override a rating before the application has been scored.',
      400,
      { code: 'SCORE_OVERRIDE_NO_RUN' },
    );
  }

  if (!isKnownRating(overrideRating)) {
    throw new AppError(
      `Unknown override rating '${overrideRating}'.`,
      400,
      { code: 'SCORE_OVERRIDE_INVALID_RATING' },
    );
  }

  const originalRating = latestRun.riskRating as string;

  if (originalRating === overrideRating) {
    throw new AppError(
      'The override rating matches the current rating — nothing to override.',
      400,
      { code: 'SCORE_OVERRIDE_NO_CHANGE' },
    );
  }

  const nd = notchDelta(originalRating, overrideRating);
  const requiresSecondApproval = nd >= DUAL_APPROVAL_THRESHOLD;

  const status: ScoreOverrideStatus = requiresSecondApproval
    ? ScoreOverrideStatus.PENDING_SECOND_APPROVAL
    : ScoreOverrideStatus.APPROVED;

  const override = await prisma.scoreOverrideApproval.create({
    data: {
      applicationId,
      originalRating,
      overrideRating,
      notchDelta: nd,
      justification,
      firstApproverId: approverId,
      firstApprovedAt: new Date(),
      status,
      scoreRunId: latestRun.id,
      ...(requiresSecondApproval ? {} : { secondApproverId: approverId, secondApprovedAt: new Date() }),
    },
  });

  // Log audit event via chain service
  await AuditChainService.appendEvent(
    applicationId,
    'SCORE_OVERRIDE_REQUESTED',
    approverId,
    `Override ${originalRating} → ${overrideRating} (Δ${nd} notches)`,
    originalRating,
    overrideRating,
    { overrideId: override.id, notchDelta: nd, requiresSecondApproval, autoApproved: !requiresSecondApproval },
  );

  logger.info(
    `[ScoreOverride] ${requiresSecondApproval ? 'PENDING second approval' : 'Auto-approved'}: ${originalRating} → ${overrideRating} (Δ${nd}) for application ${applicationId}`,
  );

  return {
    id: override.id,
    status,
    notchDelta: nd,
    requiresSecondApproval,
    scoreRunId: latestRun.id,
    originalRating,
  };
}

/**
 * Second approver approves or rejects a pending score override.
 */
export async function resolveScoreOverride(params: {
  overrideId: string;
  secondApproverId: string;
  approved: boolean;
}): Promise<{ id: string; status: ScoreOverrideStatus }> {
  const { overrideId, secondApproverId, approved } = params;

  const existing = await prisma.scoreOverrideApproval.findUnique({
    where: { id: overrideId },
  });

  if (!existing) {
    throw new Error(`Score override ${overrideId} not found`);
  }

  if (existing.status !== ScoreOverrideStatus.PENDING_SECOND_APPROVAL) {
    throw new Error(`Score override ${overrideId} is not pending second approval (status: ${existing.status})`);
  }

  // Prevent self-approval: second approver must differ from first
  if (existing.firstApproverId === secondApproverId) {
    throw new Error('Second approver must be a different user from the first approver (SOD requirement)');
  }

  const newStatus = approved ? ScoreOverrideStatus.APPROVED : ScoreOverrideStatus.REJECTED;

  // Atomically flip the override status AND apply the override to the linked
  // CreditScoreRun (when approved) in a single transaction, so the run and the
  // approval record never diverge. The audit event is appended inside the same
  // transaction so it shares the same all-or-nothing boundary.
  const override = await prisma.$transaction(async (tx) => {
    const updated = await tx.scoreOverrideApproval.update({
      where: { id: overrideId },
      data: {
        secondApproverId,
        secondApprovedAt: new Date(),
        status: newStatus,
      },
    });

    if (approved && existing.scoreRunId) {
      await tx.creditScoreRun.update({
        where: { id: existing.scoreRunId },
        data: {
          riskRating: existing.overrideRating as any,
          isOverride: true,
          overrideReason: existing.justification ?? undefined,
          overrideApprovedById: secondApproverId,
          overrideApprovedAt: new Date(),
        },
      });
    }

    await AuditChainService.appendEvent(
      existing.applicationId,
      approved ? 'SCORE_RUN_OVERRIDDEN' : 'SCORE_OVERRIDE_REJECTED',
      secondApproverId,
      'override',
      existing.originalRating,
      approved ? existing.overrideRating : existing.originalRating,
      { overrideId, scoreRunId: existing.scoreRunId, notchDelta: existing.notchDelta },
      tx as any,
    );

    return updated;
  });

  logger.info(
    `[ScoreOverride] ${approved ? 'APPROVED' : 'REJECTED'} by second approver ${secondApproverId}: override ${overrideId}`,
  );

  return { id: override.id, status: newStatus };
}

/**
 * Check if an application has any pending score overrides.
 * Used by the transition validator to block state changes until resolved.
 */
export async function hasPendingScoreOverride(applicationId: string): Promise<boolean> {
  const count = await prisma.scoreOverrideApproval.count({
    where: {
      applicationId,
      status: ScoreOverrideStatus.PENDING_SECOND_APPROVAL,
    },
  });
  return count > 0;
}

/**
 * Get all score overrides for an application.
 */
export async function getScoreOverrides(applicationId: string) {
  return prisma.scoreOverrideApproval.findMany({
    where: { applicationId },
    include: {
      firstApprover: { select: { id: true, firstName: true, lastName: true, email: true } },
      secondApprover: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}