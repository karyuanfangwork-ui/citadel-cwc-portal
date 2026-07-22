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

    // Request
    const request = await prisma.request.create({
        data: {
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
        await prisma.workflowHistory.deleteMany({ where: { requestId: testRequestId } });
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
        await prisma.request.update({
            where: { id: testRequestId },
            data: { status: 'SUBMITTED' as RequestStatus, version: 1 },
        });
        await prisma.workflowCommandResult.deleteMany({ where: { requestId: testRequestId } });
        await prisma.workflowHistory.deleteMany({ where: { requestId: testRequestId } });
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: testRequestId } });
        await prisma.requestActivity.deleteMany({ where: { requestId: testRequestId } });
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

    it('rejects concurrent commands with same expected version (optimistic lock)', async () => {
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

        // First command succeeds
        const result1 = await executeWorkflowCommand(command);
        expect(result1.success).toBe(true);

        // Second command with same expected version fails
        await expect(executeWorkflowCommand(command)).rejects.toThrow(/conflict/i);
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