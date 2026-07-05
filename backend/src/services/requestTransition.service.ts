/**
 * requestTransition.service.ts
 *
 * Central service for transitioning request status.
 * Replaces the scattered `prisma.request.update({ data: { status } })` pattern
 * across workflow controllers with a single, validated, side-effect-aware function.
 *
 * Features:
 * 1. DB-first transition validation (fallback to VALID_TRANSITIONS map)
 * 2. Consistent terminal status handling (resolvedAt, closedAt, completedAt)
 * 3. Automatic SLA pause/resume based on WorkflowStep.slaPause
 * 4. Auto-assignment from WorkflowTransition metadata
 * 5. Activity log creation
 * 6. Audit log creation
 * 7. Notification dispatch (requester + participants)
 * 8. Pluggable guard conditions (pre-transition predicates)
 *
 * @module services/requestTransition
 */

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { isValidTransition, getTransitionMeta, isTerminalStatus } from '../utils/workflowTransitions';
import { pauseSla, resumeSla } from './sla-pause.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionOptions {
  /** The user performing the transition (for activity log + audit) */
  userId: string;
  /** Display name for the activity log */
  userName: string;
  /** Role of the user performing the transition */
  userRole?: string;
  /** Optional comment (required if transition has requiresComment=true) */
  comment?: string;
  /** Whether to skip transition validation (for admin overrides / system actions) */
  skipValidation?: boolean;
  /** Whether to skip notifications (for bulk / system operations) */
  skipNotifications?: boolean;
  /** Whether to skip SLA pause/resume (for migrations / testing) */
  skipSlaPause?: boolean;
  /** Whether to skip auto-assignment (for manual reassignment scenarios) */
  skipAutoAssignment?: boolean;
  /** Optional metadata to attach to the activity log */
  metadata?: Record<string, unknown>;
  /** Source of the transition (e.g. 'it-workflow', 'approval', 'manual') */
  source?: string;
}

export interface TransitionResult {
  success: boolean;
  request: any; // Prisma Request with includes
  previousStatus: string;
  newStatus: string;
  activityId: string;
  validationSkipped: boolean;
}

// ---------------------------------------------------------------------------
// Guard condition registry
// ---------------------------------------------------------------------------

/**
 * A guard predicate that runs before a transition.
 * Receives the current request (already fetched by transitionRequest) to avoid
 * redundant DB reads.
 *
 * @returns null to allow the transition, or an error message string to block it.
 */
type GuardFn = (
  request: any,
  fromStatus: string,
  toStatus: string,
  options: TransitionOptions,
) => Promise<string | null>;

const guards: Record<string, GuardFn[]> = {};

/**
 * Register a guard condition for a transition.
 * Guards run before the transition. If any guard returns a non-null string,
 * the transition is rejected with that message as the error.
 *
 * @param transitionKey - `${fromStatus}→${toStatus}` or `*→${toStatus}` for wildcard
 * @param guard - async function returning null (allow) or error message (reject)
 */
export function registerTransitionGuard(transitionKey: string, guard: GuardFn): void {
  if (!guards[transitionKey]) {
    guards[transitionKey] = [];
  }
  guards[transitionKey].push(guard);
}

/**
 * Run all applicable guards for a transition.
 * Checks both specific (`from→to`) and wildcard (`*→to`) guards.
 */
async function runGuards(
  request: any,
  fromStatus: string,
  toStatus: string,
  options: TransitionOptions,
): Promise<string | null> {
  const keys = [`${fromStatus}→${toStatus}`, `*→${toStatus}`];
  for (const key of keys) {
    const fns = guards[key];
    if (!fns) continue;
    for (const fn of fns) {
      const error = await fn(request, fromStatus, toStatus, options);
      if (error) return error;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Terminal status sets
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set([
  'RESOLVED',
  'REJECTED',
  'COMPLETED',
  'OFFBOARDING_COMPLETED',
  'ONBOARDING_COMPLETED',
  'REIMBURSEMENT_CLOSED',
  'TICKET_CLOSED_FIN',
  'CHARGEBACK_COMPLETED',
  'LOA_REJECTED',
  'CEO_REJECTED',
  'CEO_REJECTED_IT',
  'CTO_REJECTED_IT',
  'CFO_REJECTED_IT',
  'CEO_REJECTED_FIN',
  'CFO_REJECTED_FIN',
  'GROUP_DCEO_REJECTED',
  'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED',
  'FROM_ENTITY_REJECTED',
  'TO_ENTITY_REJECTED',
  'CANDIDATE_REJECTED_INTERVIEW',
]);

const RESOLVE_STATUSES = new Set([
  'RESOLVED',
  'COMPLETED',
  'OFFBOARDING_COMPLETED',
  'ONBOARDING_COMPLETED',
  'REIMBURSEMENT_CLOSED',
  'TICKET_CLOSED_FIN',
  'CHARGEBACK_COMPLETED',
  'LOA_ACCEPTED',
]);

const CLOSE_STATUSES = new Set([
  'RESOLVED',
  'REJECTED',
  'COMPLETED',
  'OFFBOARDING_COMPLETED',
  'ONBOARDING_COMPLETED',
  'REIMBURSEMENT_CLOSED',
  'TICKET_CLOSED_FIN',
  'CHARGEBACK_COMPLETED',
]);

const COMPLETE_STATUSES = new Set([
  'COMPLETED',
  'ONBOARDING_COMPLETED',
  'OFFBOARDING_COMPLETED',
]);

// ---------------------------------------------------------------------------
// Main transition function
// ---------------------------------------------------------------------------

/**
 * Transition a request from one status to another with full validation
 * and side effects.
 *
 * @param requestId - UUID of the request
 * @param toStatus - Target status string (must be a valid RequestStatus enum value)
 * @param options - Transition options including user info and flags
 * @returns TransitionResult with the updated request
 * @throws AppError if transition is invalid, guard blocks it, or request not found
 */
export async function transitionRequest(
  requestId: string,
  toStatus: string,
  options: TransitionOptions,
): Promise<TransitionResult> {
  const {
    userId,
    userName,
    userRole,
    comment,
    skipValidation = false,
    skipNotifications = false,
    skipSlaPause = false,
    skipAutoAssignment = false,
    metadata,
    source = 'unknown',
  } = options;

  // ── 1. Fetch current request ────────────────────────────────────────────
  const currentRequest = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      serviceDesk: true,
      requestType: {
        include: {
          workflow: {
            include: { steps: true },
          },
        },
      },
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!currentRequest) {
    throw new Error(`Request not found: ${requestId}`);
  }

  const fromStatus = currentRequest.status;

  // Idempotent: no-op if already in target status
  if (fromStatus === toStatus) {
    return {
      success: true,
      request: currentRequest,
      previousStatus: fromStatus,
      newStatus: toStatus,
      activityId: '',
      validationSkipped: true,
    };
  }

  // ── 2. Validate transition ───────────────────────────────────────────────
  let validationSkipped = false;

  if (!skipValidation) {
    const valid = await isValidTransition(fromStatus, toStatus);
    if (!valid) {
      throw new Error(`Invalid status transition from ${fromStatus} to ${toStatus}`);
    }
  } else {
    validationSkipped = true;
  }

  // ── 3. Run guard conditions ──────────────────────────────────────────────
  const guardError = await runGuards(currentRequest, fromStatus, toStatus, options);
  if (guardError) {
    throw new Error(`Transition guard blocked: ${guardError}`);
  }

  // ── 4. Check requiresComment from transition metadata ────────────────────
  const transitionMeta = await getTransitionMeta(fromStatus, toStatus);
  if (transitionMeta?.requiresComment && !comment) {
    throw new Error(`Transition from ${fromStatus} to ${toStatus} requires a comment`);
  }

  // ── 5. Determine terminal timestamps ─────────────────────────────────────
  const isTerminal = TERMINAL_STATUSES.has(toStatus) || isTerminalStatus(toStatus);
  const shouldResolve = RESOLVE_STATUSES.has(toStatus);
  const shouldClose = CLOSE_STATUSES.has(toStatus);
  const shouldComplete = COMPLETE_STATUSES.has(toStatus);

  const updateData: Record<string, unknown> = {
    status: toStatus,
    ...(shouldResolve && { resolvedAt: new Date() }),
    ...(shouldClose && { closedAt: new Date() }),
    ...(shouldComplete && { completedAt: new Date() }),
  };

  // ── 6. Auto-assignment from transition metadata ──────────────────────────
  if (!skipAutoAssignment && transitionMeta) {
    if (transitionMeta.autoAssignUserId) {
      updateData.assignedToId = transitionMeta.autoAssignUserId;
    } else if (transitionMeta.autoAssignRole) {
      // Find a user with the specified role
      const candidate = await prisma.user.findFirst({
        where: {
          isActive: true,
          roles: { some: { role: { name: transitionMeta.autoAssignRole } } },
        },
        select: { id: true },
      });
      if (candidate) {
        updateData.assignedToId = candidate.id;
      }
    }
  }

  // ── 7. SLA pause/resume ──────────────────────────────────────────────────
  if (!skipSlaPause && currentRequest.requestType?.workflow) {
    const steps = currentRequest.requestType.workflow.steps;
    const targetStep = steps.find((s: any) => s.status === toStatus);
    const currentStep = steps.find((s: any) => s.status === fromStatus);

    // If entering a pause step, pause SLA
    if (targetStep?.slaPause && !currentRequest.slaPausedAt) {
      await pauseSla(requestId).catch((err: Error) =>
        logger.warn(`transitionRequest: Failed to pause SLA for ${requestId}`, { err: err.message }),
      );
    }

    // If leaving a pause step, resume SLA
    if (currentStep?.slaPause && currentRequest.slaPausedAt) {
      await resumeSla(requestId).catch((err: Error) =>
        logger.warn(`transitionRequest: Failed to resume SLA for ${requestId}`, { err: err.message }),
      );
    }
  }

  // ── 8. Update request status ─────────────────────────────────────────────
  const updatedRequest = await prisma.request.update({
    where: { id: requestId },
    data: updateData,
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      serviceDesk: true,
      requestType: true,
    },
  });

  // ── 9. Create activity log ───────────────────────────────────────────────
  const activity = await prisma.requestActivity.create({
    data: {
      requestId,
      authorId: userId,
      authorName: userName || 'System',
      authorRole: userRole || null,
      activityType: isTerminal ? 'STATUS_CHANGE' : 'STATUS_CHANGE',
      message: `Status changed from ${fromStatus} to ${toStatus}`,
      isSystemGenerated: !userId,
      metadata: {
        ...metadata,
        fromStatus,
        toStatus,
        source,
      },
    },
  });

  // ── 10. Audit log ────────────────────────────────────────────────────────
  try {
    const { auditLog } = await import('../utils/audit');
    await auditLog(
      { user: { id: userId, email: undefined, roles: userRole ? [userRole] : undefined } } as any,
      'STATUS_TRANSITION',
      'request',
      requestId,
      { fromStatus, toStatus, source, comment },
      { status: fromStatus },
    );
  } catch (err) {
    // Audit failures must never break the main operation
    logger.error('transitionRequest: Audit log write failed', { requestId, fromStatus, toStatus, err });
  }

  // ── 11. Notifications ────────────────────────────────────────────────────
  if (!skipNotifications) {
    try {
      const { notify } = await import('./notification.service');
      await notify({
        userId: updatedRequest.requesterId,
        eventType: 'STATUS_CHANGED',
        variables: {
          referenceNumber: updatedRequest.referenceNumber,
          newStatus: toStatus,
        },
        relatedRequestId: requestId,
      });

      // Also notify participants
      const participants = await prisma.requestParticipant.findMany({
        where: { requestId },
        select: { userId: true },
      });
      await Promise.all(
        participants.map((p) =>
          notify({
            userId: p.userId,
            eventType: 'STATUS_CHANGED',
            variables: {
              referenceNumber: updatedRequest.referenceNumber,
              newStatus: toStatus,
            },
            relatedRequestId: requestId,
          }).catch(() => {}),
        ),
      );
    } catch (err) {
      logger.warn(`transitionRequest: Notification dispatch failed for ${requestId}`, { err });
    }
  }

  logger.info(`transitionRequest: ${requestId} ${fromStatus} → ${toStatus} (source: ${source})`);

  return {
    success: true,
    request: updatedRequest,
    previousStatus: fromStatus,
    newStatus: toStatus,
    activityId: activity.id,
    validationSkipped,
  };
}

// ---------------------------------------------------------------------------
// Convenience: bulk transition (for migrations)
// ---------------------------------------------------------------------------

/**
 * Transition multiple requests in sequence.
 * Stops on first failure and returns partial results.
 */
export async function transitionMany(
  requestIds: string[],
  toStatus: string,
  options: TransitionOptions,
): Promise<{ results: TransitionResult[]; errors: Array<{ id: string; error: string }> }> {
  const results: TransitionResult[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of requestIds) {
    try {
      const result = await transitionRequest(id, toStatus, options);
      results.push(result);
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return { results, errors };
}