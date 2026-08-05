/**
 * Task 16: Approval Runtime — Integration Tests
 *
 * Tests immutable published versions, sequential/parallel step execution,
 * deterministic authority resolution, condition evaluation (typed AST),
 * delegation (self/cyclic/out-of-scope rejection), SoD, and quorum.
 *
 * All approval decisions route through the Task 15 workflowCommand boundary.
 */

import prisma from '../../utils/prisma';
import {
    startApprovalInstance,
    decideApproval,
    delegateApprovalRuntime,
    evaluateCondition,
    publishPolicyVersion,
    retirePolicyVersion,
} from '../approvalRuntime.service';
import { ConditionAST, ConditionOperator, validateCondition } from '../conditionEvaluator.service';
import { RequestStatus } from '@prisma/client';

// ── Test fixtures ────────────────────────────────────────────────────────

let tenantId: string;
let departmentIdIT: string;
let departmentIdHR: string;
let departmentIdFinance: string;
let itAgentId: string;
let hrAgentId: string;
let financeApproverId: string;
let itManagerId: string;
let requestTypeId: string;
const requestIdsToCleanup = new Set<string>();

beforeAll(async () => {
    // Tenant
    const tenant = await prisma.tenant.upsert({
        where: { id: 'b0000000-0000-0000-0000-000000000001' },
        update: {},
        create: { id: 'b0000000-0000-0000-0000-000000000001', name: 'Approval Runtime Tenant', slug: 'approval-runtime-tenant', isActive: true },
    });
    tenantId = tenant.id;

    // Departments
    const itDept = await prisma.department.upsert({
        where: { id: 'b0000000-0000-0000-0000-000000000010' },
        update: {},
        create: { id: 'b0000000-0000-0000-0000-000000000010', tenantId, code: 'APPRV_IT', name: 'IT Department' },
    });
    departmentIdIT = itDept.id;

    const hrDept = await prisma.department.upsert({
        where: { id: 'b0000000-0000-0000-0000-000000000011' },
        update: {},
        create: { id: 'b0000000-0000-0000-0000-000000000011', tenantId, code: 'APPRV_HR', name: 'HR Department' },
    });
    departmentIdHR = hrDept.id;

    const finDept = await prisma.department.upsert({
        where: { id: 'b0000000-0000-0000-0000-000000000012' },
        update: {},
        create: { id: 'b0000000-0000-0000-0000-000000000012', tenantId, code: 'APPRV_FIN', name: 'Finance Department' },
    });
    departmentIdFinance = finDept.id;

    // Roles
    const itRole = await prisma.role.upsert({ where: { name: 'APPRV_IT_AGENT' }, update: {}, create: { name: 'APPRV_IT_AGENT', description: 'IT Agent' } });
    const hrRole = await prisma.role.upsert({ where: { name: 'APPRV_HR_AGENT' }, update: {}, create: { name: 'APPRV_HR_AGENT', description: 'HR Agent' } });
    const finRole = await prisma.role.upsert({ where: { name: 'APPRV_FIN_APPROVER' }, update: {}, create: { name: 'APPRV_FIN_APPROVER', description: 'Finance Approver' } });
    const itMgrRole = await prisma.role.upsert({ where: { name: 'APPRV_IT_MANAGER' }, update: {}, create: { name: 'APPRV_IT_MANAGER', description: 'IT Manager' } });

    // Users — use upsert-like pattern with unique emails
    const existingItAgent = await prisma.user.findFirst({ where: { email: 'aprv-it@test.local' } });
    if (existingItAgent) {
        itAgentId = existingItAgent.id;
    } else {
        const itAgent = await prisma.user.create({
            data: { email: 'aprv-it@test.local', firstName: 'IT', lastName: 'Agent', passwordHash: '$2a$10$dummyhash', isActive: true, mustResetPassword: false, tenantId, department: 'APPRV_IT', roles: { create: { roleId: itRole.id } } },
        });
        itAgentId = itAgent.id;
    }

    const existingHrAgent = await prisma.user.findFirst({ where: { email: 'aprv-hr@test.local' } });
    if (existingHrAgent) {
        hrAgentId = existingHrAgent.id;
    } else {
        const hrAgent = await prisma.user.create({
            data: { email: 'aprv-hr@test.local', firstName: 'HR', lastName: 'Agent', passwordHash: '$2a$10$dummyhash', isActive: true, mustResetPassword: false, tenantId, department: 'APPRV_HR', roles: { create: { roleId: hrRole.id } } },
        });
        hrAgentId = hrAgent.id;
    }

    const existingFinApprover = await prisma.user.findFirst({ where: { email: 'aprv-fin@test.local' } });
    if (existingFinApprover) {
        financeApproverId = existingFinApprover.id;
    } else {
        const finApprover = await prisma.user.create({
            data: { email: 'aprv-fin@test.local', firstName: 'Finance', lastName: 'Approver', passwordHash: '$2a$10$dummyhash', isActive: true, mustResetPassword: false, tenantId, department: 'APPRV_FIN', roles: { create: { roleId: finRole.id } } },
        });
        financeApproverId = finApprover.id;
    }

    const existingItMgr = await prisma.user.findFirst({ where: { email: 'aprv-itmgr@test.local' } });
    if (existingItMgr) {
        itManagerId = existingItMgr.id;
    } else {
        const itManager = await prisma.user.create({
            data: { email: 'aprv-itmgr@test.local', firstName: 'IT', lastName: 'Manager', passwordHash: '$2a$10$dummyhash', isActive: true, mustResetPassword: false, tenantId, department: 'APPRV_IT', roles: { create: { roleId: itMgrRole.id } } },
        });
        itManagerId = itManager.id;
    }

    // Service desk → category → request type (use upsert)
    const desk = await prisma.serviceDesk.upsert({
        where: { tenantId_code: { tenantId, code: 'APPRV_DESK' } },
        update: {},
        create: { name: 'Approval Runtime Desk', code: 'APPRV_DESK', tenantId },
    });

    const existingCat = await prisma.serviceCategory.findFirst({ where: { serviceDeskId: desk.id, name: 'Approval Runtime Category' } });
    let categoryId: string;
    if (existingCat) {
        categoryId = existingCat.id;
    } else {
        const category = await prisma.serviceCategory.create({
            data: { name: 'Approval Runtime Category', serviceDeskId: desk.id, tenantId },
        });
        categoryId = category.id;
    }

    // A unique request type isolates policy selection from stale fixtures left by
    // interrupted or previously failed integration-test runs.
    const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const reqType = await prisma.requestType.create({
        data: {
            name: `Approval Runtime Type ${runSuffix}`,
            code: `APPRV_${runSuffix}`,
            serviceCategoryId: categoryId,
            tenantId,
        },
    });
    requestTypeId = reqType.id;
});

afterAll(async () => {
    if (requestTypeId) {
        await prisma.requestType.delete({ where: { id: requestTypeId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
});

afterEach(async () => {
    for (const requestId of [...requestIdsToCleanup]) {
        await cleanupRequest(requestId);
    }
});

// ── Helper: create a request for testing ──────────────────────────────────

async function createTestRequest(suffix = ''): Promise<string> {
    const req = await prisma.request.create({
        data: {
            tenantId,
            departmentId: departmentIdIT,
            referenceNumber: `APPRV-${Date.now()}${suffix}`,
            requesterId: itAgentId,
            requesterEmail: 'aprv-it@test.local',
            summary: 'Approval runtime test request',
            status: 'SUBMITTED' as RequestStatus,
        },
    });
    requestIdsToCleanup.add(req.id);
    return req.id;
}

async function cleanupRequest(requestId: string) {
    try {
        await prisma.approvalInstanceStep.deleteMany({ where: { instance: { requestId } } });
        await prisma.approvalInstance.deleteMany({ where: { requestId } } as any);
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: requestId } });
        await prisma.workflowCommandResult.deleteMany({ where: { requestId } } as any);
        await prisma.requestActivity.deleteMany({ where: { requestId } } as any);
        // Workflow history is append-only. Deleting the parent test request
        // invokes the database-controlled cascade allowed by the immutability trigger.
        await prisma.request.delete({ where: { id: requestId } });
    } catch (_e) {
        // Best-effort
    } finally {
        requestIdsToCleanup.delete(requestId);
    }
}

async function createAndPublishPolicy(name: string, stepsData: any[]): Promise<string> {
    const policy = await prisma.approvalPolicy.create({
        data: {
            tenantId,
            name: `${name} ${Date.now()}`,
            requestTypeId,
            isActive: true,
            priority: 10,
            steps: { create: stepsData },
        },
        include: { steps: true },
    });
    await publishPolicyVersion(policy.id, itManagerId);
    return policy.id;
}

async function cleanupPolicy(policyId: string) {
    try {
        await (prisma as any).approvalPolicyVersion.deleteMany({ where: { policyId } });
        await prisma.approvalPolicyStep.deleteMany({ where: { policyId } });
        await prisma.approvalPolicy.delete({ where: { id: policyId } });
    } catch (_e) {
        // Best-effort
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Immutability: published policy versions cannot be mutated
// ══════════════════════════════════════════════════════════════════════════

describe('Approval Policy Version Immutability', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('Immutability Test Policy', [
            { stepOrder: 1, approverType: 'ROLE', roleId: 'APPRV_IT_MANAGER', label: 'Manager Step' },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('publishes a DRAFT policy version, creating an immutable snapshot', async () => {
        const version = await publishPolicyVersion(policyId, itManagerId);

        expect(version).toBeDefined();
        expect(version.status).toBe('PUBLISHED');
        expect(version.policyId).toBe(policyId);
        expect(version.versionNumber).toBeGreaterThanOrEqual(1);
        expect(version.publishedAt).toBeDefined();
    });

    it('re-publishing creates a new version, not updating the existing one', async () => {
        const version1 = await publishPolicyVersion(policyId, itManagerId);
        const version2 = await publishPolicyVersion(policyId, itManagerId);

        expect(version2.versionNumber).toBeGreaterThan(version1.versionNumber);
        expect(version2.id).not.toBe(version1.id);
        expect(version2.status).toBe('PUBLISHED');
    });

    it('retires a PUBLISHED version', async () => {
        const version = await publishPolicyVersion(policyId, itManagerId);
        const retired = await retirePolicyVersion(version.id, itManagerId);

        expect(retired.status).toBe('RETIRED');
        expect(retired.retiredAt).toBeDefined();
    });

    it('DRAFT policy (no published version) cannot start an approval instance', async () => {
        const draftPolicy = await prisma.approvalPolicy.create({
            data: {
                tenantId,
                name: `Draft Only Policy ${Date.now()}`,
                requestTypeId,
                isActive: true,
                // This policy must be the selected (highest-priority) policy so the
                // test exercises its missing published version rather than the
                // published policy owned by this describe block.
                priority: 0,
                steps: { create: [{ stepOrder: 1, approverType: 'AUTO', label: 'Auto' }] },
            },
            include: { steps: true },
        });

        const requestId = await createTestRequest('-draft');

        await expect(
            startApprovalInstance({
                requestId,
                tenantId,
                requestTypeId,
                actorId: itAgentId,
            }),
        ).rejects.toThrow(/no published.*version/i);

        await cleanupRequest(requestId);
        await cleanupPolicy(draftPolicy.id);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. Sequential step execution
// ══════════════════════════════════════════════════════════════════════════

describe('Sequential Approval Steps', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('Sequential Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Step 1: IT Manager', timeoutHours: 48 },
            { stepOrder: 2, approverType: 'USER', approverId: financeApproverId, label: 'Step 2: Finance Approver', timeoutHours: 72 },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('starts an approval instance with step 1 ACTIVE and step 2 WAITING', async () => {
        const requestId = await createTestRequest('-seq1');

        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        expect(instance).toBeDefined();
        expect(instance!.steps).toBeDefined();
        expect(instance!.steps.length).toBe(2);

        const step1 = instance!.steps.find((s: any) => s.stepOrder === 1);
        const step2 = instance!.steps.find((s: any) => s.stepOrder === 2);

        expect(step1?.status).toBe('ACTIVE');
        expect(step2?.status).toBe('WAITING');

        await cleanupRequest(requestId);
    });

    it('after deciding step 1 APPROVED, step 2 becomes ACTIVE', async () => {
        const requestId = await createTestRequest('-seq2');

        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        const step1 = instance!.steps.find((s: any) => s.stepOrder === 1);

        const result = await decideApproval({
            instanceId: instance!.id,
            stepId: step1!.id,
            decision: 'APPROVED',
            actorId: itManagerId,
            tenantId,
            comment: 'Approved by IT Manager',
        });

        expect(result.step.status).toBe('APPROVED');

        // Step 2 should now be ACTIVE
        const step2 = instance!.steps.find((s: any) => s.stepOrder === 2);
        const refreshedStep2 = await (prisma as any).approvalInstanceStep.findUnique({ where: { id: step2!.id } });
        expect(refreshedStep2?.status).toBe('ACTIVE');

        await cleanupRequest(requestId);
    });

    it('REJECT on step 1 cancels later steps', async () => {
        const requestId = await createTestRequest('-seq3');

        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        const step1 = instance!.steps.find((s: any) => s.stepOrder === 1);

        const result = await decideApproval({
            instanceId: instance!.id,
            stepId: step1!.id,
            decision: 'REJECTED',
            actorId: itManagerId,
            tenantId,
            comment: 'Rejected by IT Manager',
        });

        expect(result.step.status).toBe('REJECTED');

        // Step 2 should be CANCELLED
        const step2 = instance!.steps.find((s: any) => s.stepOrder === 2);
        const refreshedStep2 = await (prisma as any).approvalInstanceStep.findUnique({ where: { id: step2!.id } });
        expect(refreshedStep2?.status).toBe('CANCELLED');

        await cleanupRequest(requestId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. Parallel step execution
// ══════════════════════════════════════════════════════════════════════════

describe('Parallel Approval Steps', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('Parallel Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Parallel: IT Manager', parallelGroup: 'A', timeoutHours: 48 },
            { stepOrder: 2, approverType: 'USER', approverId: financeApproverId, label: 'Parallel: Finance', parallelGroup: 'A', timeoutHours: 48 },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('activates all steps in the same parallel group', async () => {
        const requestId = await createTestRequest('-par1');

        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        const step1 = instance!.steps.find((s: any) => s.stepOrder === 1);
        const step2 = instance!.steps.find((s: any) => s.stepOrder === 2);

        // Both should be ACTIVE since they share parallelGroup 'A'
        expect(step1?.status).toBe('ACTIVE');
        expect(step2?.status).toBe('ACTIVE');

        await cleanupRequest(requestId);
    });

    it('quorum: a user can only decide once per step', async () => {
        const requestId = await createTestRequest('-par2');

        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        const step1 = instance!.steps.find((s: any) => s.stepOrder === 1);

        // First decision succeeds
        const result = await decideApproval({
            instanceId: instance!.id,
            stepId: step1!.id,
            decision: 'APPROVED',
            actorId: itManagerId,
            tenantId,
            comment: 'Approved',
        });
        expect(result.step.status).toBe('APPROVED');

        // Same user deciding again on the same step should be rejected
        await expect(
            decideApproval({
                instanceId: instance!.id,
                stepId: step1!.id,
                decision: 'APPROVED',
                actorId: itManagerId,
                tenantId,
                comment: 'Duplicate',
            }),
        ).rejects.toThrow(/already.*decided|already.*voted/i);

        await cleanupRequest(requestId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. Condition evaluation (typed AST)
// ══════════════════════════════════════════════════════════════════════════

describe('Condition Evaluator (Typed AST)', () => {
    it('evaluates a simple equality condition', () => {
        const ast: ConditionAST = {
            operator: 'EQ' as ConditionOperator,
            field: 'amount',
            value: 5000,
        };

        expect(evaluateCondition(ast, { amount: 5000 })).toBe(true);
        expect(evaluateCondition(ast, { amount: 10000 })).toBe(false);
    });

    it('evaluates a comparison condition', () => {
        const ast: ConditionAST = {
            operator: 'GT' as ConditionOperator,
            field: 'amount',
            value: 1000,
        };

        expect(evaluateCondition(ast, { amount: 5000 })).toBe(true);
        expect(evaluateCondition(ast, { amount: 500 })).toBe(false);
    });

    it('evaluates AND conjunction', () => {
        const ast: ConditionAST = {
            operator: 'AND' as ConditionOperator,
            children: [
                { operator: 'GT' as ConditionOperator, field: 'amount', value: 1000 },
                { operator: 'EQ' as ConditionOperator, field: 'category', value: 'IT' },
            ],
        };

        expect(evaluateCondition(ast, { amount: 5000, category: 'IT' })).toBe(true);
        expect(evaluateCondition(ast, { amount: 500, category: 'IT' })).toBe(false);
        expect(evaluateCondition(ast, { amount: 5000, category: 'HR' })).toBe(false);
    });

    it('evaluates OR disjunction', () => {
        const ast: ConditionAST = {
            operator: 'OR' as ConditionOperator,
            children: [
                { operator: 'EQ' as ConditionOperator, field: 'priority', value: 'HIGH' },
                { operator: 'GT' as ConditionOperator, field: 'amount', value: 10000 },
            ],
        };

        expect(evaluateCondition(ast, { priority: 'HIGH', amount: 100 })).toBe(true);
        expect(evaluateCondition(ast, { priority: 'LOW', amount: 50000 })).toBe(true);
        expect(evaluateCondition(ast, { priority: 'LOW', amount: 100 })).toBe(false);
    });

    it('rejects arbitrary JavaScript — fail closed on unknown operators', () => {
        expect(() =>
            evaluateCondition(
                { operator: 'EVAL' as any, field: 'x', value: 'process.exit(1)' } as any,
                { x: 1 },
            ),
        ).toThrow(/unknown operator|fail.closed/i);
    });

    it('fails closed on missing field', () => {
        const ast: ConditionAST = {
            operator: 'GT' as ConditionOperator,
            field: 'nonexistent',
            value: 100,
        };

        expect(evaluateCondition(ast, { otherField: 500 })).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Delegation: self-delegation, cyclic, out-of-scope rejection
// ══════════════════════════════════════════════════════════════════════════

describe('Approval Delegation Controls', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('Delegation Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Manager Step', timeoutHours: 48 },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('rejects self-delegation', async () => {
        const requestId = await createTestRequest('-del1');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        await expect(
            delegateApprovalRuntime({
                instanceId: instance!.id,
                stepId: step!.id,
                fromUserId: itManagerId,
                toUserId: itManagerId, // self-delegation
                tenantId,
                reason: 'Self delegation attempt',
            }),
        ).rejects.toThrow(/self.delegation|cannot delegate to self/i);

        await cleanupRequest(requestId);
    });

    it('rejects cyclic delegation (A→B then B→A)', async () => {
        const requestId = await createTestRequest('-del2');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        // Delegate IT Manager → Finance Approver
        const delegationResult = await delegateApprovalRuntime({
            instanceId: instance!.id,
            stepId: step!.id,
            fromUserId: itManagerId,
            toUserId: financeApproverId,
            tenantId,
            reason: 'Out of office',
        });
        expect(delegationResult.toUserId).toBe(financeApproverId);

        // Now the step's delegatedTo is financeApproverId
        // Finance Approver (now the delegatee) tries to delegate back to IT Manager (cycle)
        await expect(
            delegateApprovalRuntime({
                instanceId: instance!.id,
                stepId: step!.id,
                fromUserId: financeApproverId,
                toUserId: itManagerId, // cycle back to original approver
                tenantId,
                reason: 'Cycle attempt',
            }),
        ).rejects.toThrow(/cyclic|cycle|delegation chain|original approver/i);

        await cleanupRequest(requestId);
    });

    it('rejects out-of-tenant delegation', async () => {
        const requestId = await createTestRequest('-del3');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        await expect(
            delegateApprovalRuntime({
                instanceId: instance!.id,
                stepId: step!.id,
                fromUserId: itManagerId,
                toUserId: '00000000-0000-0000-0000-000000000999', // non-existent / other tenant
                tenantId,
                reason: 'Out-of-scope delegation',
            }),
        ).rejects.toThrow(/not found|inactive|tenant|scope/i);

        await cleanupRequest(requestId);
    });

    it('records delegation history', async () => {
        const requestId = await createTestRequest('-del4');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        const result = await delegateApprovalRuntime({
            instanceId: instance!.id,
            stepId: step!.id,
            fromUserId: itManagerId,
            toUserId: financeApproverId,
            tenantId,
            reason: 'Vacation coverage',
        });

        expect(result.fromUserId).toBe(itManagerId);
        expect(result.toUserId).toBe(financeApproverId);

        // Verify delegation on the step
        const refreshedStep = await (prisma as any).approvalInstanceStep.findUnique({ where: { id: step!.id } });
        expect(refreshedStep?.delegatedTo).toBe(financeApproverId);

        await cleanupRequest(requestId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 6. Tenant-scoped authority resolution
// ══════════════════════════════════════════════════════════════════════════

describe('Tenant-scoped Approver Resolution', () => {
    it('resolves approvers within the same tenant only', async () => {
        const policyId = await createAndPublishPolicy('Authority Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'IT Manager User Step', timeoutHours: 48 },
        ]);

        const requestId = await createTestRequest('-auth1');
        const instance = await startApprovalInstance({
            requestId,
            tenantId,
            requestTypeId,
            actorId: itAgentId,
        });

        // Step should have resolved to an approver within the same tenant
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);
        expect(step?.assignedApproverId).toBeDefined();
        // For USER type, resolveApprover should return the exact user ID
        expect(step?.assignedApproverId).toBe(itManagerId);

        await cleanupRequest(requestId);
        await cleanupPolicy(policyId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 7. SoD: same user cannot approve their own request
// ══════════════════════════════════════════════════════════════════════════

describe('Separation of Duties (SoD)', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('SoD Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Manager Step', timeoutHours: 48 },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('rejects decision by the requester (SoD violation)', async () => {
        const requestId = await createTestRequest('-sod1');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        // The requester (itAgentId) should not be able to approve their own request
        await expect(
            decideApproval({
                instanceId: instance!.id,
                stepId: step!.id,
                decision: 'APPROVED',
                actorId: itAgentId, // requester trying to approve
                tenantId,
                comment: 'Self-approval attempt',
            }),
        ).rejects.toThrow(/cannot approve.*own|SoD|separation.of.duties|requester/i);

        await cleanupRequest(requestId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 8. Approval decisions route through Task 15 workflowCommand boundary
// ══════════════════════════════════════════════════════════════════════════

describe('Approval Decisions Route Through WorkflowCommand', () => {
    let policyId: string;

    beforeAll(async () => {
        policyId = await createAndPublishPolicy('Workflow Command Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Step 1', timeoutHours: 48 },
        ]);
    });

    afterAll(async () => {
        await cleanupPolicy(policyId);
    });

    it('approval decision creates workflow history and outbox event', async () => {
        const requestId = await createTestRequest('-wf1');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        await decideApproval({
            instanceId: instance!.id,
            stepId: step!.id,
            decision: 'APPROVED',
            actorId: itManagerId,
            tenantId,
            comment: 'Approved via workflow command',
        });

        // Verify workflow history was created
        const history = await prisma.workflowHistory.findMany({
            where: { requestId },
            orderBy: { createdAt: 'desc' },
        });
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[0].source).toMatch(/approval/);

        // Verify outbox event was created
        const events = await (prisma as any).outboxEvent.findMany({
            where: { aggregateId: requestId },
            orderBy: { createdAt: 'desc' },
        });
        expect(events.length).toBeGreaterThanOrEqual(1);

        await cleanupRequest(requestId);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// 9. Timeout: defaults to REMINDER, never rejects without explicit policy
// ══════════════════════════════════════════════════════════════════════════

describe('Approval Timeout Behavior', () => {
    it('timeout action defaults to REMINDER when no explicit policy', async () => {
        const policyId = await createAndPublishPolicy('Timeout Policy', [
            { stepOrder: 1, approverType: 'USER', approverId: itManagerId, label: 'Timed Step', timeoutHours: 1 },
        ]);

        const requestId = await createTestRequest('-tmout1');
        const instance = await startApprovalInstance({ requestId, tenantId, requestTypeId, actorId: itAgentId });
        const step = instance!.steps.find((s: any) => s.stepOrder === 1);

        // Default timeout action should be REMINDER (not REJECT)
        expect(step?.timeoutAction).toBe('REMINDER');

        await cleanupRequest(requestId);
        await cleanupPolicy(policyId);
    });
});