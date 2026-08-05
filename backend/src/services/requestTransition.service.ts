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
import { isValidTransition, getTransitionMeta } from '../utils/workflowTransitions';
import { executeWorkflowCommand } from './workflowCommand.service';
import { RequestStatus } from '@prisma/client';
import { registerOutboxHandler } from './outboxDispatcher.service';
import { AppError } from '../middleware/error.middleware';
import { canActorTransition, TransitionActor } from './transitionPolicy.service';

// ---------------------------------------------------------------------------
// Outbox handler: durable notification delivery for status changes
// ---------------------------------------------------------------------------

registerOutboxHandler('REQUEST_STATUS_CHANGED', async (event) => {
  const { requestId, toStatus } = event.payload as { requestId: string; toStatus: string };
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { requesterId: true, referenceNumber: true },
  });
  if (!request) return; // request deleted; nothing to deliver

  const { notify } = await import('./notification.service');
  const participants = await prisma.requestParticipant.findMany({
    where: { requestId },
    select: { userId: true },
  });
  const recipients = [request.requesterId, ...participants.map((p) => p.userId)];
  // Throwing propagates to the dispatcher, which retries with backoff.
  for (const userId of new Set(recipients)) {
    await notify({
      userId,
      eventType: 'STATUS_CHANGED',
      variables: { referenceNumber: request.referenceNumber, newStatus: toStatus },
      relatedRequestId: requestId,
    });
  }
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionOptions {
  /** The user performing the transition (for activity log + audit) */
  userId?: string;
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
  /** Optional tenant assertion supplied by authenticated callers. */
  tenantId?: string;
  /** Additional request scalar fields committed atomically with the transition. */
  requestPatch?: Record<string, unknown>;
  /** Tenant-scoped idempotency key supplied by retryable callers. */
  idempotencyKey?: string;
  /** Actor to authorize against transition policy (opt-in). When provided, canActorTransition is checked before guards. */
  actor?: TransitionActor;
  /** Audit attribution captured by the HTTP boundary. */
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
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
    comment,
    skipValidation = false,
    skipNotifications = false,
    skipSlaPause = false,
    skipAutoAssignment = false,
    metadata,
    source = 'unknown',
    tenantId,
    requestPatch,
    idempotencyKey,
    userEmail,
    ipAddress,
    userAgent,
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

  if (!currentRequest || (tenantId && currentRequest.tenantId !== tenantId)) {
    throw new AppError(`Request not found: ${requestId}`, 404);
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
      throw new AppError(`Invalid status transition from ${fromStatus} to ${toStatus}`, 422);
    }
  } else {
    validationSkipped = true;
  }

  // ── 2b. Authorize the actor against transition policy (opt-in) ──────────
  if (options.actor) {
    const decision = await canActorTransition({
      actor: options.actor,
      tenantId: currentRequest.tenantId ?? null,
      workflowTypeId: (currentRequest.requestType as any)?.workflowTypeId ?? null,
      fromStatus,
      toStatus,
    });
    if (!decision.allowed) {
      throw new AppError(decision.reason ?? 'Transition not permitted', 403);
    }
  }

  // ── 3. Run guard conditions ──────────────────────────────────────────────
  const guardError = await runGuards(currentRequest, fromStatus, toStatus, options);
  if (guardError) {
    throw new AppError(`Transition guard blocked: ${guardError}`, 403);
  }

  // ── 4. Check requiresComment from transition metadata ────────────────────
  const transitionMeta = await getTransitionMeta(fromStatus, toStatus);
  if (transitionMeta?.requiresComment && !comment) {
    throw new AppError(`Transition from ${fromStatus} to ${toStatus} requires a comment`, 400);
  }

  // ── 5. Determine terminal timestamps ─────────────────────────────────────
  const shouldResolve = RESOLVE_STATUSES.has(toStatus);
  const shouldClose = CLOSE_STATUSES.has(toStatus);
  const shouldComplete = COMPLETE_STATUSES.has(toStatus);

  const updateData: Record<string, unknown> = {
    ...(requestPatch ?? {}),
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

  // ── 7. Determine SLA clock mutation; execution remains inside the command.
  let slaTransition: 'PAUSE' | 'RESUME' | undefined;
  if (!skipSlaPause && currentRequest.requestType?.workflow) {
    const steps = currentRequest.requestType.workflow.steps;
    const targetStep = steps.find((s: any) => s.status === toStatus);
    const currentStep = steps.find((s: any) => s.status === fromStatus);

    if (targetStep?.slaPause && !currentRequest.slaPausedAt) {
      slaTransition = 'PAUSE';
    }

    if (currentStep?.slaPause && currentRequest.slaPausedAt) {
      slaTransition = 'RESUME';
    }
  }

  // ── 8. Execute versioned workflow command ──────────────────────────────────
  // Task 15: Use the transactional command boundary for atomic state transition,
  // version increment, workflow history, activity log, and outbox event.
  const commandResult = await executeWorkflowCommand({
    requestId,
    tenantId: currentRequest.tenantId ?? '',
    fromStatus: fromStatus as RequestStatus,
    toStatus: toStatus as RequestStatus,
    expectedVersion: (currentRequest as any).version ?? 1,
    actorId: userId,
    actorName: userName || 'System',
    source,
    comment,
    metadata,
    idempotencyKey,
    requestPatch: updateData,
    slaTransition,
    audit: { userEmail, ipAddress, userAgent },
  });

  // Re-fetch the updated request with includes for notifications
  const updatedRequest = await prisma.request.findUniqueOrThrow({
    where: { id: requestId },
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

  // ── 9. Notifications
  // Notifications are delivered by the outbox handler registered above, so a
  // crash or provider outage after commit retries instead of silently dropping.
  // `skipNotifications` is retained for bulk/migration callers — it marks the
  // outbox event as already published so the dispatcher never retries it.
  if (skipNotifications) {
    await (prisma as any).outboxEvent.updateMany({
      where: { aggregateId: requestId, aggregateVersion: commandResult.version, eventType: 'REQUEST_STATUS_CHANGED' },
      data: { status: 'PUBLISHED', published: true, publishedAt: new Date() },
    });
  }

  logger.info(`transitionRequest: ${requestId} ${fromStatus} → ${toStatus} (source: ${source})`);

  return {
    success: true,
    request: updatedRequest,
    previousStatus: fromStatus,
    newStatus: toStatus,
    activityId: commandResult.historyId,
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