/**
 * Task 15: Workflow command boundary integration tests.
 *
 * Tests concurrency, idempotency, and BOLA protection for the versioned
 * transactional workflow command service.
 */

import prisma from '../../utils/prisma';
import { executeWorkflowCommand, WorkflowCommand } from '../workflowCommand.service';
import { RequestStatus } from '@prisma/client';

// Reusable test context
let testUserId: string;
let testRequestId: string;
let testTenantId: string;
let testDepartmentId: string;
let testRequesterEmail: string;

const TEST_REQUEST_ID = 'a0000000-0000-0000-0000-000000000003';
const TEST_REFERENCE = `WF-CMD-${Date.now()}`;

beforeAll(async () => {
    // Tenant
    const tenant = await prisma.tenant.upsert({
        where: { id: 'a0000000-0000-0000-0000-000000000001' },
        update: {},
        create: { id: 'a0000000-0000-0000-0000-000000000001', name: 'Test Tenant WF Cmd', slug: 'test-tenant-wf-cmd', isActive: true },
    });
    testTenantId = tenant.id;

    // Department
    const dept = await prisma.department.upsert({
        where: { id: 'a0000000-0000-0000-0000-000000000002' },
        update: {},
        create: { id: 'a0000000-0000-0000-0000-000000000002', tenantId: tenant.id, code: 'TSTDEPT', name: 'Test Dept WF' },
    });
    testDepartmentId = dept.id;

    // Role
    const role = await prisma.role.upsert({
        where: { name: 'WF_TEST_AGENT' },
        update: {},
        create: { name: 'WF_TEST_AGENT', description: 'Test role for workflow command tests' },
    });

    // User
    const user = await prisma.user.create({
        data: {
            email: `wf-cmd-test-${Date.now()}@test.local`,
            firstName: 'WF',
            lastName: 'Tester',
            passwordHash: '$2a$10$dummyhash',
            isActive: true,
            mustResetPassword: false,
            tenantId: tenant.id,
            roles: { create: { roleId: role.id } },
        },
    });
    testUserId = user.id;
    testRequesterEmail = user.email;

    // Request
    const request = await prisma.request.create({
        data: {
            id: TEST_REQUEST_ID,
            tenantId: tenant.id,
            departmentId: dept.id,
            referenceNumber: `WF-CMD-${Date.now()}`,
            requesterId: user.id,
            requesterEmail: user.email,
            summary: 'Workflow command test request',
            status: 'SUBMITTED' as RequestStatus,
        },
    });
    testRequestId = request.id;
});

afterAll(async () => {
    // Cleanup in reverse dependency order
    try {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: testRequestId } });
        await prisma.workflowCommandResult.deleteMany({ where: { requestId: testRequestId } });
        await prisma.auditLog.deleteMany({ where: { resourceId: testRequestId } });
        await prisma.requestActivity.deleteMany({ where: { requestId: testRequestId } });
        await prisma.request.delete({ where: { id: testRequestId } }).catch(() => {});
        await prisma.userRole.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
        await prisma.role.deleteMany({ where: { name: 'WF_TEST_AGENT' } });
        await prisma.department.delete({ where: { id: testDepartmentId } }).catch(() => {});
        await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
    } catch (e) {
        // Best-effort cleanup
    }
    await prisma.$disconnect();
});

describe('executeWorkflowCommand', () => {
    beforeEach(async () => {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: testRequestId } });
        await prisma.workflowCommandResult.deleteMany({ where: { requestId: testRequestId } });
        await prisma.auditLog.deleteMany({ where: { resourceId: testRequestId } });
        await prisma.requestActivity.deleteMany({ where: { requestId: testRequestId } });
        // Hard-delete the parent so immutable history is removed only by its FK cascade.
        await prisma.request.deleteMany({ where: { id: testRequestId } });
        await prisma.request.create({
            data: {
                id: TEST_REQUEST_ID,
                tenantId: testTenantId,
                departmentId: testDepartmentId,
                referenceNumber: TEST_REFERENCE,
                requesterId: testUserId,
                requesterEmail: testRequesterEmail,
                summary: 'Workflow command test request',
                status: 'SUBMITTED' as RequestStatus,
                version: 1,
            },
        });
    });

    it('transitions request status and increments version', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        const result = await executeWorkflowCommand(command);

        expect(result.success).toBe(true);
        expect(result.newStatus).toBe('IN_REVIEW');
        expect(result.version).toBe(2);

        const updated = await prisma.request.findUnique({ where: { id: testRequestId } });
        expect(updated?.status).toBe('IN_REVIEW');
        expect(updated?.version).toBe(2);
    });

    it('allows exactly one of two truly concurrent commands with the same expected version', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        const settled = await Promise.allSettled([
            executeWorkflowCommand({ ...command, idempotencyKey: `cas-a-${Date.now()}` }),
            executeWorkflowCommand({ ...command, idempotencyKey: `cas-b-${Date.now()}` }),
        ]);

        expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const rejected = settled.find((result) => result.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason.message).toMatch(/conflict/i);
    });

    it('returns original result when replaying same idempotency key', async () => {
        const idempotencyKey = `test-idem-${Date.now()}`;
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            idempotencyKey,
        };

        const result1 = await executeWorkflowCommand(command);
        expect(result1.success).toBe(true);

        // Replay with same idempotency key returns same result
        const result2 = await executeWorkflowCommand(command);
        expect(result2.success).toBe(true);
        expect(result2.version).toBe(result1.version);
        expect(result2.newStatus).toBe(result1.newStatus);
        expect(result2.idempotent).toBe(true);
    });

    it('returns the committed result to concurrent replays of the same command key', async () => {
        const idempotencyKey = `test-concurrent-idem-${Date.now()}`;
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            idempotencyKey,
        };

        const results = await Promise.all([
            executeWorkflowCommand(command),
            executeWorkflowCommand(command),
        ]);

        expect(results).toHaveLength(2);
        expect(results.every((result) => result.newStatus === 'IN_REVIEW' && result.version === 2)).toBe(true);
        expect(results.filter((result) => result.idempotent)).toHaveLength(1);
        expect(await prisma.workflowHistory.count({ where: { requestId: testRequestId } })).toBe(1);
    });

    it('rejects reuse of an idempotency key for a different command', async () => {
        const idempotencyKey = `test-idem-mismatch-${Date.now()}`;
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            idempotencyKey,
        };

        await executeWorkflowCommand(command);

        await expect(executeWorkflowCommand({
            ...command,
            toStatus: 'REJECTED' as RequestStatus,
        })).rejects.toThrow(/idempotency.*conflict/i);
    });

    it('never replays an idempotency result across tenant scope', async () => {
        const idempotencyKey = `test-idem-tenant-${Date.now()}`;
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            idempotencyKey,
        };

        await executeWorkflowCommand(command);

        await expect(executeWorkflowCommand({
            ...command,
            tenantId: '00000000-0000-0000-0000-000000000999',
        })).rejects.toThrow(/not found/i);
    });

    it('rolls back request, history, audit, activity, and outbox when a late transaction write fails', async () => {
        const command = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            idempotencyKey: `rollback-${'x'.repeat(220)}`,
            audit: { userEmail: testRequesterEmail },
        } as WorkflowCommand;

        await expect(executeWorkflowCommand(command)).rejects.toThrow();

        const [request, historyCount, activityCount, auditCount, outboxCount] = await Promise.all([
            prisma.request.findUniqueOrThrow({ where: { id: testRequestId } }),
            prisma.workflowHistory.count({ where: { requestId: testRequestId } }),
            prisma.requestActivity.count({ where: { requestId: testRequestId } }),
            prisma.auditLog.count({ where: { resourceId: testRequestId } }),
            prisma.outboxEvent.count({ where: { aggregateId: testRequestId } }),
        ]);
        expect(request.status).toBe('SUBMITTED');
        expect(request.version).toBe(1);
        expect([historyCount, activityCount, auditCount, outboxCount]).toEqual([0, 0, 0, 0]);
    });

    it('rolls back all command writes when the mandatory audit insert fails', async () => {
        const command = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            audit: { userEmail: testRequesterEmail, ipAddress: 'not-an-ip-address' },
        } as WorkflowCommand;

        await expect(executeWorkflowCommand(command)).rejects.toThrow();

        const [request, historyCount, activityCount, auditCount, outboxCount] = await Promise.all([
            prisma.request.findUniqueOrThrow({ where: { id: testRequestId } }),
            prisma.workflowHistory.count({ where: { requestId: testRequestId } }),
            prisma.requestActivity.count({ where: { requestId: testRequestId } }),
            prisma.auditLog.count({ where: { resourceId: testRequestId } }),
            prisma.outboxEvent.count({ where: { aggregateId: testRequestId } }),
        ]);
        expect(request.status).toBe('SUBMITTED');
        expect(request.version).toBe(1);
        expect([historyCount, activityCount, auditCount, outboxCount]).toEqual([0, 0, 0, 0]);
    });

    it('applies supplemental request and SLA pause mutations in the same versioned command', async () => {
        const resolvedAt = new Date('2026-07-22T12:00:00.000Z');
        const command = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            requestPatch: { resolvedAt },
            slaTransition: 'PAUSE',
            audit: { userEmail: testRequesterEmail },
        } as WorkflowCommand;

        await executeWorkflowCommand(command);

        const request = await prisma.request.findUniqueOrThrow({ where: { id: testRequestId } });
        expect(request.status).toBe('IN_REVIEW');
        expect(request.version).toBe(2);
        expect(request.resolvedAt).toEqual(resolvedAt);
        expect(request.slaPausedAt).toBeInstanceOf(Date);
        expect(await prisma.auditLog.count({ where: { resourceId: testRequestId } })).toBe(1);
    });

    it('resumes SLA atomically and extends the deadline by the paused interval', async () => {
        const pausedAt = new Date(Date.now() - 10 * 60_000);
        const originalDueAt = new Date(Date.now() + 60 * 60_000);
        await prisma.request.update({
            where: { id: testRequestId },
            data: {
                slaPausedAt: pausedAt,
                slaPauseDurationMs: 1_000n,
                slaDueAt: originalDueAt,
            },
        });

        await executeWorkflowCommand({
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            slaTransition: 'RESUME',
        });

        const request = await prisma.request.findUniqueOrThrow({ where: { id: testRequestId } });
        expect(request.slaPausedAt).toBeNull();
        expect(request.slaPauseDurationMs).toBeGreaterThan(1_000n);
        expect(request.slaDueAt?.getTime()).toBeGreaterThan(originalDueAt.getTime());
    });

    it('does not mutate SLA fields when the optimistic CAS fails', async () => {
        await expect(executeWorkflowCommand({
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 99,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
            slaTransition: 'PAUSE',
        })).rejects.toThrow(/workflow_version_conflict/i);

        const request = await prisma.request.findUniqueOrThrow({ where: { id: testRequestId } });
        expect(request.slaPausedAt).toBeNull();
        expect(request.version).toBe(1);
    });

    it('rejects direct mutation or deletion of workflow history rows', async () => {
        await executeWorkflowCommand({
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        });
        const history = await prisma.workflowHistory.findFirstOrThrow({ where: { requestId: testRequestId } });

        await expect(prisma.workflowHistory.update({
            where: { id: history.id },
            data: { comment: 'tampered' },
        })).rejects.toThrow(/immutable/i);
        await expect(prisma.workflowHistory.delete({ where: { id: history.id } })).rejects.toThrow(/immutable/i);
    });

    it('records immutable workflow history', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        await executeWorkflowCommand(command);

        const history = await prisma.workflowHistory.findMany({
            where: { requestId: testRequestId },
            orderBy: { createdAt: 'asc' },
        });

        expect(history.length).toBe(1);
        expect(history[0].fromStatus).toBe('SUBMITTED');
        expect(history[0].toStatus).toBe('IN_REVIEW');
        expect(history[0].requestVersion).toBe(2);
        expect(history[0].actorId).toBe(testUserId);
    });

    it('rejects transitions from wrong fromStatus', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'RESOLVED' as RequestStatus, // wrong — request is SUBMITTED
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        await expect(executeWorkflowCommand(command)).rejects.toThrow(/status.*conflict/i);
    });

    it('rejects transitions for wrong tenant (BOLA protection)', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: '00000000-0000-0000-0000-000000000999',
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        await expect(executeWorkflowCommand(command)).rejects.toThrow(/not found/i);
    });

    it('creates outbox event for downstream consumers', async () => {
        const command: WorkflowCommand = {
            requestId: testRequestId,
            tenantId: testTenantId,
            fromStatus: 'SUBMITTED' as RequestStatus,
            toStatus: 'IN_REVIEW' as RequestStatus,
            expectedVersion: 1,
            actorId: testUserId,
            actorName: 'WF Tester',
            source: 'test',
        };

        await executeWorkflowCommand(command);

        const events = await prisma.outboxEvent.findMany({
            where: { aggregateId: testRequestId },
            orderBy: { createdAt: 'desc' },
        });

        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].eventType).toBe('REQUEST_STATUS_CHANGED');
        expect(events[0].published).toBe(false);
        expect(events[0].payload).toBeDefined();
    });
});