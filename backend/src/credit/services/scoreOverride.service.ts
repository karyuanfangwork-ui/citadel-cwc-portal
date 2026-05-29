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

// Minimum notch delta that requires dual approval
const DUAL_APPROVAL_THRESHOLD = 2;

/**
 * Calculate the notch delta between two rating strings.
 * Uses the standard 20-notch scale: AAA=1, AA+=2, ..., D=20
 */
const RATING_SCALE: Record<string, number> = {
  AAA: 1, 'AA+': 2, AA: 3, 'AA-': 4,
  'A+': 5, A: 6, 'A-': 7,
  'BBB+': 8, BBB: 9, 'BBB-': 10,
  'BB+': 11, BB: 12, 'BB-': 13,
  'B+': 14, B: 15, 'B-': 16,
  'CCC+': 17, CCC: 18, 'CCC-': 19,
  D: 20,
};

export function calculateNotchDelta(originalRating: string, overrideRating: string): number {
  const orig = RATING_SCALE[originalRating] ?? 0;
  const over = RATING_SCALE[overrideRating] ?? 0;
  if (orig === 0 || over === 0) {
    // Unknown rating format — conservatively require approval
    return DUAL_APPROVAL_THRESHOLD;
  }
  return Math.abs(orig - over);
}

/**
 * Request a score override. If the delta is < 2 notches, auto-approve.
 * If ≥ 2, require a second approver (mark PENDING_SECOND_APPROVAL).
 */
export async function requestScoreOverride(params: {
  applicationId: string;
  originalRating: string;
  overrideRating: string;
  justification: string;
  approverId: string;
}): Promise<{ id: string; status: ScoreOverrideStatus; notchDelta: number; requiresSecondApproval: boolean }> {
  const { applicationId, originalRating, overrideRating, justification, approverId } = params;

  const notchDelta = calculateNotchDelta(originalRating, overrideRating);
  const requiresSecondApproval = notchDelta >= DUAL_APPROVAL_THRESHOLD;

  const status: ScoreOverrideStatus = requiresSecondApproval
    ? ScoreOverrideStatus.PENDING_SECOND_APPROVAL
    : ScoreOverrideStatus.APPROVED;

  const override = await prisma.scoreOverrideApproval.create({
    data: {
      applicationId,
      originalRating,
      overrideRating,
      notchDelta,
      justification,
      firstApproverId: approverId,
      firstApprovedAt: new Date(),
      status,
      ...(requiresSecondApproval ? {} : { secondApproverId: approverId, secondApprovedAt: new Date() }),
    },
  });

  // Log audit event
  await prisma.creditAuditEvent.create({
    data: {
      applicationId,
      eventType: 'SCORE_OVERRIDE_REQUESTED',
      actorId: approverId,
      action: `Override ${originalRating} → ${overrideRating} (Δ${notchDelta} notches)`,
      oldState: originalRating,
      newState: overrideRating,
      metadata: {
        overrideId: override.id,
        notchDelta,
        requiresSecondApproval,
        autoApproved: !requiresSecondApproval,
      },
    },
  });

  logger.info(
    `[ScoreOverride] ${requiresSecondApproval ? 'PENDING second approval' : 'Auto-approved'}: ${originalRating} → ${overrideRating} (Δ${notchDelta}) for application ${applicationId}`,
  );

  return {
    id: override.id,
    status,
    notchDelta,
    requiresSecondApproval,
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

  const override = await prisma.scoreOverrideApproval.update({
    where: { id: overrideId },
    data: {
      secondApproverId,
      secondApprovedAt: new Date(),
      status: newStatus,
    },
  });

  // Log audit event
  await prisma.creditAuditEvent.create({
    data: {
      applicationId: existing.applicationId,
      eventType: approved ? 'SCORE_OVERRIDE_APPROVED' : 'SCORE_OVERRIDE_REJECTED',
      actorId: secondApproverId,
      action: approved
        ? `Second approval granted: ${existing.originalRating} → ${existing.overrideRating}`
        : `Second approval denied: ${existing.originalRating} → ${existing.overrideRating}`,
      oldState: ScoreOverrideStatus.PENDING_SECOND_APPROVAL,
      newState: newStatus,
      metadata: {
        overrideId,
        notchDelta: existing.notchDelta,
        firstApproverId: existing.firstApproverId,
        secondApproverId,
      },
    },
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