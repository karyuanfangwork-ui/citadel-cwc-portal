/**
 * P04 Task 15: versioned, tenant-scoped workflow command boundary.
 *
 * Every request status change must pass through this service. Request state,
 * terminal/assignment/SLA fields, immutable history, activity, audit, outbox,
 * and idempotency result are committed or rolled back as one unit.
 */

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { RequestStatus } from '../constants/requestStatusCompat';

import { AppError } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

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
    /** Tenant-scoped key. A replay must have the same complete command hash. */
    idempotencyKey?: string;
    /** Additional scalar request changes committed with status/version. */
    requestPatch?: Record<string, unknown>;
    /** SLA clock mutation computed from the locked request snapshot. */
    slaTransition?: 'PAUSE' | 'RESUME';
    /** HTTP/request attribution for the mandatory transactional audit row. */
    audit?: {
        userEmail?: string;
        ipAddress?: string;
        userAgent?: string;
    };
    /** Additional domain writes that must commit/rollback with the command. */
    transactionMutations?: (
        tx: any,
        context: {
            requestId: string;
            tenantId: string;
            departmentId: string | null;
            newVersion: number;
            historyId: string;
            now: Date;
        },
    ) => Promise<void>;
    /** Create the outbox event but mark it published without delivering notifications. */
    skipNotifications?: boolean;
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

const FORBIDDEN_PATCH_FIELDS = new Set([
    'id',
    'tenantId',
    'departmentId',
    'requesterId',
    'status',
    'version',
    'createdAt',
    'updatedAt',
    'deletedAt',
]);

function normalizeForHash(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(normalizeForHash);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, normalizeForHash(nested)]),
        );
    }
    return value;
}

function commandFingerprint(command: WorkflowCommand): string {
    const {
        idempotencyKey: _ignored,
        audit: _auditAttribution,
        transactionMutations: _transactionMutations,
        requestPatch = {},
        ...fingerprinted
    } = command;
    // Server-derived timestamps and network attribution can legitimately differ
    // when an HTTP request is retried. They must not turn the same logical
    // command into an idempotency conflict.
    const runtimeFields = new Set([
        'resolvedAt',
        'closedAt',
        'completedAt',
        'slaPausedAt',
        'slaPauseDurationMs',
        'slaDueAt',
    ]);
    const logicalPatch = Object.fromEntries(
        Object.entries(requestPatch).filter(([field]) => !runtimeFields.has(field)),
    );
    return createHash('sha256')
        .update(JSON.stringify(normalizeForHash({ ...fingerprinted, requestPatch: logicalPatch })))
        .digest('hex');
}

function replayResult(existing: {
    requestId: string;
    fromStatus: string;
    toStatus: string;
    result: Prisma.JsonValue;
}): WorkflowCommandResult {
    const payload = existing.result as unknown as Record<string, unknown>;
    return {
        success: true,
        requestId: existing.requestId,
        previousStatus: existing.fromStatus,
        newStatus: existing.toStatus,
        version: Number(payload.version),
        idempotent: true,
        historyId: String(payload.historyId ?? ''),
    };
}

/**
 * Execute a workflow command atomically.
 *
 * @throws AppError(404) for request/tenant mismatch (BOLA-safe)
 * @throws AppError(409) for stale version/status or idempotency mismatch
 */
export async function executeWorkflowCommandInTransaction(
    command: WorkflowCommand,
    tx: any,
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
        requestPatch = {},
        slaTransition,
        audit,
        transactionMutations,
        skipNotifications,
    } = command;

    if (!tenantId) throw new AppError('Request not found', 404);
    for (const field of Object.keys(requestPatch)) {
        if (FORBIDDEN_PATCH_FIELDS.has(field)) {
            throw new AppError(`Workflow command cannot patch protected request field: ${field}`, 400);
        }
    }

    const commandHash = commandFingerprint(command);
    const result = await (async () => {
        if (idempotencyKey) {
            const existing = await tx.workflowCommandResult.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                if (existing.commandHash !== commandHash) {
                    throw new AppError('Idempotency key conflict: key is bound to a different workflow command', 409);
                }
                return replayResult(existing);
            }
        }

        const current = await tx.request.findFirst({
            where: { id: requestId, tenantId },
            select: {
                id: true,
                departmentId: true,
                status: true,
                version: true,
                slaPausedAt: true,
                slaPauseDurationMs: true,
                slaDueAt: true,
            },
        });
        if (!current) throw new AppError('Request not found', 404);

        const now = new Date();
        const atomicPatch: Record<string, unknown> = { ...requestPatch };
        let slaActivity: Prisma.RequestActivityUncheckedCreateInput | undefined;

        if (slaTransition === 'PAUSE' && !current.slaPausedAt) {
            atomicPatch.slaPausedAt = now;
            slaActivity = {
                requestId,
                authorId: actorId ?? null,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: 'SLA timer paused — request entered approval status',
                isSystemGenerated: true,
                metadata: { action: 'sla_pause', pausedAt: now.toISOString() },
            };
        } else if (slaTransition === 'RESUME' && current.slaPausedAt) {
            const pauseDurationMs = now.getTime() - current.slaPausedAt.getTime();
            const totalPauseMs = current.slaPauseDurationMs + BigInt(pauseDurationMs);
            atomicPatch.slaPausedAt = null;
            atomicPatch.slaPauseDurationMs = totalPauseMs;
            if (current.slaDueAt) {
                atomicPatch.slaDueAt = new Date(current.slaDueAt.getTime() + pauseDurationMs);
            }
            const pauseMinutes = Math.floor(pauseDurationMs / 60_000);
            slaActivity = {
                requestId,
                authorId: actorId ?? null,
                authorName: 'System',
                activityType: 'SYSTEM',
                message: `SLA timer resumed — approval decision made (paused ${Math.floor(pauseMinutes / 60)}h ${pauseMinutes % 60}m)`,
                isSystemGenerated: true,
                metadata: {
                    action: 'sla_resume',
                    pausedAt: current.slaPausedAt.toISOString(),
                    resumedAt: now.toISOString(),
                    pauseDurationMs,
                    totalPauseMs: totalPauseMs.toString(),
                },
            };
        }

        const changed = await tx.request.updateMany({
            where: {
                id: requestId,
                tenantId,
                status: fromStatus,
                version: expectedVersion,
            },
            data: {
                ...(atomicPatch as Prisma.RequestUpdateManyMutationInput),
                status: toStatus,
                version: { increment: 1 },
            },
        });

        if (changed.count !== 1) {
            // A concurrent same-key command may have committed while this
            // transaction waited for the request row lock.
            if (idempotencyKey) {
                const replay = await tx.workflowCommandResult.findUnique({
                    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                });
                if (replay) {
                    if (replay.commandHash !== commandHash) {
                        throw new AppError('Idempotency key conflict: key is bound to a different workflow command', 409);
                    }
                    return replayResult(replay);
                }
            }

            const exists = await tx.request.findFirst({
                where: { id: requestId, tenantId },
                select: { status: true, version: true },
            });
            if (!exists) throw new AppError('Request not found', 404);
            if (exists.status !== fromStatus) {
                throw new AppError(
                    `Request status conflict: expected ${fromStatus} but was ${exists.status}`,
                    409,
                );
            }
            throw new AppError(
                `WORKFLOW_VERSION_CONFLICT: expected version ${expectedVersion} but was ${exists.version}`,
                409,
            );
        }

        const newVersion = expectedVersion + 1;
        const history = await tx.workflowHistory.create({
            data: {
                tenantId,
                departmentId: current.departmentId,
                requestId,
                fromStatus,
                toStatus,
                actorId: actorId ?? null,
                actorName: actorName ?? null,
                source,
                comment: comment ?? null,
                metadata: (metadata ?? {}) as Prisma.InputJsonValue,
                requestVersion: newVersion,
                idempotencyKey: idempotencyKey ?? null,
            },
        });

        await tx.requestActivity.create({
            data: {
                requestId,
                authorId: actorId ?? null,
                authorName: actorName ?? 'System',
                authorRole: null,
                activityType: 'STATUS_CHANGE',
                message: `Status changed from ${fromStatus} to ${toStatus}`,
                isSystemGenerated: !actorId,
                metadata: { fromStatus, toStatus, source, version: newVersion },
            },
        });
        if (slaActivity) await tx.requestActivity.create({ data: slaActivity });

        await tx.auditLog.create({
            data: {
                tenantId,
                userId: actorId ?? null,
                userEmail: audit?.userEmail ?? null,
                action: 'STATUS_TRANSITION',
                resourceType: 'request',
                resourceId: requestId,
                ipAddress: audit?.ipAddress ?? null,
                userAgent: audit?.userAgent ?? null,
                oldValues: { status: fromStatus, version: expectedVersion },
                newValues: {
                    status: toStatus,
                    version: newVersion,
                    source,
                    comment: comment ?? null,
                    requestPatch: normalizeForHash(requestPatch),
                    slaTransition: slaTransition ?? null,
                } as Prisma.InputJsonValue,
            },
        });

        await tx.outboxEvent.create({
            data: {
                tenantId,
                departmentId: current.departmentId,
                eventType: 'REQUEST_STATUS_CHANGED',
                aggregateId: requestId,
                aggregateVersion: newVersion,
                payload: {
                    requestId,
                    tenantId,
                    departmentId: current.departmentId,
                    fromStatus,
                    toStatus,
                    version: newVersion,
                    actorId: actorId ?? null,
                    source,
                    timestamp: now.toISOString(),
                },
            },
        });

        if (skipNotifications) {
            await tx.outboxEvent.updateMany({
                where: { aggregateId: requestId, aggregateVersion: newVersion, eventType: 'REQUEST_STATUS_CHANGED' },
                data: { status: 'PUBLISHED', published: true, publishedAt: new Date() },
            });
        }

        if (transactionMutations) {
            await transactionMutations(tx, {
                requestId,
                tenantId,
                departmentId: current.departmentId,
                newVersion,
                historyId: history.id,
                now,
            });
        }

        const resultPayload = {
            version: newVersion,
            historyId: history.id,
            fromStatus,
            toStatus,
        };
        if (idempotencyKey) {
            await tx.workflowCommandResult.create({
                data: {
                    tenantId,
                    departmentId: current.departmentId,
                    idempotencyKey,
                    commandHash,
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
    })();

    logger.info(
        `executeWorkflowCommand: ${requestId} ${fromStatus} → ${toStatus} v${result.version} (source: ${source})`,
    );
    return result;
}

export async function executeWorkflowCommand(
    command: WorkflowCommand,
): Promise<WorkflowCommandResult> {
    return prisma.$transaction(
        (tx: any) => executeWorkflowCommandInTransaction(command, tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
}