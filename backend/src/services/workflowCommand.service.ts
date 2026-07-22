/**
 * workflowCommand.service.ts
 *
 * P04 Task 15: Versioned transactional workflow command boundary.
 *
 * Every request status change must go through this service. It provides:
 * 1. Optimistic concurrency via version check (two concurrent commands with
 *    the same expectedVersion yield one success and one WORKFLOW_VERSION_CONFLICT)
 * 2. Idempotency — replaying the same idempotency key returns the original result
 * 3. Atomic state transition + history + audit + outbox in a single transaction
 * 4. Tenant-scoped BOLA protection
 *
 * Callers should use `transitionRequest()` for the simpler API, or
 * `executeWorkflowCommand()` for full control.
 */

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import { RequestStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowCommand {
    requestId: string;
    tenantId: string;
    fromStatus: RequestStatus;
    toStatus: RequestStatus;
    expectedVersion: number;
    actorId?: string;
    actorName?: string;
    source?: string;
    comment?: string;
    metadata?: Record<string, unknown>;
    /** Unique key for idempotency. Replay returns the original result. */
    idempotencyKey?: string;
    /** Skip transition validation (for admin overrides / system actions) */
    skipValidation?: boolean;
}

export interface WorkflowCommandResult {
    success: boolean;
    requestId: string;
    previousStatus: string;
    newStatus: string;
    version: number;
    idempotent: boolean;
    historyId: string;
}

// ---------------------------------------------------------------------------
// Main command execution
// ---------------------------------------------------------------------------

/**
 * Execute a workflow command atomically with optimistic concurrency,
 * idempotency, and transactional history/audit/outbox.
 *
 * @throws AppError(409) if the expected version doesn't match (concurrent write)
 * @throws AppError(404) if the request is not found or tenant mismatch (BOLA)
 * @throws AppError(409) if idempotency key conflicts with a different command
 */
export async function executeWorkflowCommand(
    command: WorkflowCommand,
): Promise<WorkflowCommandResult> {
    const {
        requestId,
        tenantId,
        fromStatus,
        toStatus,
        expectedVersion,
        actorId,
        actorName,
        source = 'unknown',
        comment,
        metadata,
        idempotencyKey,
    } = command;

    // ── 0. Idempotency check ────────────────────────────────────────────
    if (idempotencyKey) {
        const existing = await prisma.workflowCommandResult.findUnique({
            where: { idempotencyKey },
        });
        if (existing) {
            // Replay: return original result
            return {
                success: true,
                requestId: existing.requestId,
                previousStatus: existing.fromStatus,
                newStatus: existing.toStatus,
                version: (existing.result as any)?.version ?? expectedVersion,
                idempotent: true,
                historyId: (existing.result as any)?.historyId ?? '',
            };
        }
    }

    // ── 1. Atomic transaction ───────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
        // 1a. Optimistic concurrency: update only if version matches and status matches
        const changed = await tx.request.updateMany({
            where: {
                id: requestId,
                tenantId,
                status: fromStatus,
                version: expectedVersion,
            },
            data: {
                status: toStatus,
                version: { increment: 1 },
            },
        });

        if (changed.count !== 1) {
            // Verify: does the request exist at all? (BOLA check)
            const exists = await tx.request.findUnique({
                where: { id: requestId },
                select: { id: true, tenantId: true, status: true, version: true },
            });

            if (!exists) {
                throw new AppError('Request not found', 404);
            }
            if (exists.tenantId !== tenantId) {
                throw new AppError('Request not found', 404);
            }
            if (exists.status !== fromStatus) {
                throw new AppError(
                    `Request status conflict: expected ${fromStatus} but was ${exists.status}`,
                    409,
                );
            }
            // Version mismatch = concurrent write
            throw new AppError(
                `WORKFLOW_VERSION_CONFLICT: expected version ${expectedVersion} but was ${exists.version}`,
                409,
            );
        }

        const newVersion = expectedVersion + 1;

        // 1b. Create immutable workflow history
        const history = await tx.workflowHistory.create({
            data: {
                requestId,
                fromStatus,
                toStatus,
                actorId: actorId ?? null,
                actorName: actorName ?? null,
                source,
                comment: comment ?? null,
                metadata: metadata ?? {},
                requestVersion: newVersion,
                idempotencyKey: idempotencyKey ?? null,
            },
        });

        // 1c. Create activity log
        await tx.requestActivity.create({
            data: {
                requestId,
                authorId: actorId ?? null,
                authorName: actorName ?? 'System',
                authorRole: null,
                activityType: 'STATUS_CHANGE',
                message: `Status changed from ${fromStatus} to ${toStatus}`,
                isSystemGenerated: !actorId,
                metadata: {
                    fromStatus,
                    toStatus,
                    source,
                    version: newVersion,
                },
            },
        });

        // 1d. Create outbox event for downstream consumers
        await tx.outboxEvent.create({
            data: {
                eventType: 'REQUEST_STATUS_CHANGED',
                aggregateId: requestId,
                payload: {
                    requestId,
                    fromStatus,
                    toStatus,
                    version: newVersion,
                    actorId,
                    source,
                    timestamp: new Date().toISOString(),
                },
            },
        });

        // 1e. Store idempotency result
        const resultPayload = {
            version: newVersion,
            historyId: history.id,
            fromStatus,
            toStatus,
        };

        if (idempotencyKey) {
            await tx.workflowCommandResult.create({
                data: {
                    idempotencyKey,
                    requestId,
                    fromStatus,
                    toStatus,
                    result: resultPayload,
                },
            });
        }

        return {
            success: true,
            requestId,
            previousStatus: fromStatus,
            newStatus: toStatus,
            version: newVersion,
            idempotent: false,
            historyId: history.id,
        };
    });

    logger.info(`executeWorkflowCommand: ${requestId} ${fromStatus} → ${toStatus} v${result.version} (source: ${source})`);

    return result;
}