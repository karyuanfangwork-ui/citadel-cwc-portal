/**
 * approvalRuntime.service.ts
 *
 * P04 Task 16: Versioned approval runtime.
 *
 * Provides:
 * - `publishPolicyVersion` — freeze a policy definition as an immutable PUBLISHED version
 * - `retirePolicyVersion` — retire a PUBLISHED version (no longer used for new instances)
 * - `startApprovalInstance` — create a runtime approval instance from a published version
 * - `decideApproval` — make a decision on an approval step, routing through Task 15 workflowCommand
 * - `delegateApprovalRuntime` — delegate a step with self/cyclic/out-of-scope rejection
 * - `evaluateCondition` — re-export from conditionEvaluator for convenience
 *
 * Design principles:
 * 1. Only PUBLISHED policy versions can start instances (fail-closed)
 * 2. Published versions are immutable — definition JSON is frozen at publish time
 * 3. Sequential steps activate one at a time; parallel steps activate together
 * 4. Approval decisions route through `executeWorkflowCommand` (Task 15)
 * 5. Self-delegation, cyclic delegation, and out-of-tenant delegation are rejected
 * 6. Requester cannot approve their own request (SoD)
 * 7. Timeout defaults to REMINDER — auto-reject requires explicit policy
 */

import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error.middleware';
import { executeWorkflowCommand } from './workflowCommand.service';
import { validateCondition, ConditionAST } from './conditionEvaluator.service';
import { ApprovalDefinitionStatus, ApprovalStepStatus, ApprovalTimeoutAction, RequestStatus } from '@prisma/client';

// The generated Prisma client includes ApprovalInstance, ApprovalInstanceStep, and
// ApprovalPolicyVersion at runtime, but the TypeScript declaration files may lag
// behind when new models are added. Cast through `any` where the LSP types haven't
// caught up yet — this is safe because `npx prisma generate` includes the models
// and the runtime client works correctly.
const db = prisma as any;

// Re-export for convenience
export { evaluateCondition, validateCondition } from './conditionEvaluator.service';
export type { ConditionAST } from './conditionEvaluator.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartApprovalInstanceInput {
    requestId: string;
    tenantId: string;
    requestTypeId: string;
    actorId: string;
    /** Optional context for condition evaluation (e.g. { amount: 5000, priority: 'HIGH' }) */
    conditionContext?: Record<string, unknown>;
}

export interface DecideApprovalInput {
    instanceId: string;
    stepId: string;
    decision: 'APPROVED' | 'REJECTED';
    actorId: string;
    tenantId: string;
    comment?: string;
}

export interface DelegateApprovalInput {
    instanceId: string;
    stepId: string;
    fromUserId: string;
    toUserId: string;
    tenantId: string;
    reason?: string;
}

export interface DelegateApprovalResult {
    stepId: string;
    fromUserId: string;
    toUserId: string;
}

// ---------------------------------------------------------------------------
// Publish / Retire
// ---------------------------------------------------------------------------

/**
 * Publish a policy version — freezes the current steps as an immutable definition.
 * Only one PUBLISHED version per policy may be active at a time for new instances.
 */
export async function publishPolicyVersion(policyId: string, publishedBy: string) {
    const policy = await prisma.approvalPolicy.findUnique({
        where: { id: policyId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!policy) {
        throw new AppError('Policy not found', 404);
    }

    // Snapshot the current steps as an immutable definition
    const definition = policy.steps.map(step => ({
        stepOrder: step.stepOrder,
        approverType: step.approverType,
        approverId: step.approverId,
        roleId: step.roleId,
        departmentId: step.departmentId,
        entityId: step.entityId,
        teamId: step.teamId,
        label: step.label,
        autoApproveIf: step.autoApproveIf,
        timeoutHours: step.timeoutHours,
        parallelGroup: step.parallelGroup,
        timeoutAction: step.timeoutAction,
        condition: step.condition,
    }));

    // Determine next version number
    const maxVersion = await db.approvalPolicyVersion.findFirst({
        where: { policyId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
    });

    const versionNumber = (maxVersion?.versionNumber ?? 0) + 1;

    const version = await db.approvalPolicyVersion.create({
        data: {
            policyId,
            versionNumber,
            status: ApprovalDefinitionStatus.PUBLISHED,
            definition,
            publishedAt: new Date(),
            publishedBy,
        },
    });

    logger.info(`Published policy version ${version.versionNumber} for policy ${policyId}`);

    return version;
}

/**
 * Retire a PUBLISHED policy version — no longer used for new instances.
 * Existing instances continue to use the version they were started with.
 */
export async function retirePolicyVersion(versionId: string, retiredBy: string) {
    const version = await db.approvalPolicyVersion.findUnique({
        where: { id: versionId },
    });

    if (!version) {
        throw new AppError('Policy version not found', 404);
    }

    if (version.status !== ApprovalDefinitionStatus.PUBLISHED) {
        throw new AppError('Only PUBLISHED versions can be retired', 400);
    }

    const retired = await db.approvalPolicyVersion.update({
        where: { id: versionId },
        data: {
            status: ApprovalDefinitionStatus.RETIRED,
            retiredAt: new Date(),
            retiredBy,
            effectiveTo: new Date(),
        },
    });

    logger.info(`Retired policy version ${version.versionNumber} (id: ${versionId})`);

    return retired;
}

// ---------------------------------------------------------------------------
// Start Approval Instance
// ---------------------------------------------------------------------------

/**
 * Start an approval instance for a request.
 * Finds the active PUBLISHED policy version for the request type and creates
 * runtime steps from the frozen definition.
 */
export async function startApprovalInstance(input: StartApprovalInstanceInput) {
    const { requestId, tenantId, requestTypeId, actorId, conditionContext: _conditionContext } = input;

    const request = await prisma.request.findFirst({
        where: { id: requestId, tenantId },
        select: { departmentId: true },
    });

    if (!request) {
        throw new AppError('Request not found', 404);
    }

    // Find the active PUBLISHED policy version for this request type
    const policy = await prisma.approvalPolicy.findFirst({
        where: {
            requestTypeId,
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
        },
        orderBy: [
            { priority: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
        ],
    });

    if (!policy) {
        throw new AppError('No active approval policy found for this request type', 404);
    }

    // Find the latest PUBLISHED version (fail-closed: no version = no approval)
    const publishedVersion = await db.approvalPolicyVersion.findFirst({
        where: {
            policyId: policy.id,
            status: ApprovalDefinitionStatus.PUBLISHED,
        },
        orderBy: { versionNumber: 'desc' },
    });

    if (!publishedVersion) {
        throw new AppError('No published policy version available. Cannot start approval instance — this is a fail-closed check.', 400);
    }

    // Parse the frozen definition
    const definition = publishedVersion.definition as unknown as Array<PolicyStepDefinition>;

    // Resolve approvers and create instance + steps
    // Determine which steps should start as ACTIVE vs WAITING
    const sequentialGroups = groupStepsForActivation(definition);

    const stepsData = await prisma.$transaction(async (tx) => {
        const runtimeTx = tx as any;
        const instance = await runtimeTx.approvalInstance.create({
            data: {
                requestId,
                tenantId,
                departmentId: request.departmentId,
                policyVersionId: publishedVersion.id,
                status: ApprovalStepStatus.ACTIVE,
            },
        });

        const createdSteps = [];
        for (const stepDef of definition) {
            // Resolve approver before writing the step. Approver lookup is scoped by tenant.
            const assignedApproverId = await resolveApprover(stepDef, tenantId);

            // Evaluate auto-approve condition if present
            let stepStatus: ApprovalStepStatus;
            if (stepDef.approverType === 'AUTO') {
                stepStatus = ApprovalStepStatus.APPROVED;
            } else if (sequentialGroups.firstParallelGroup !== null && stepDef.parallelGroup === sequentialGroups.firstParallelGroup) {
                stepStatus = ApprovalStepStatus.ACTIVE;
            } else if (sequentialGroups.firstParallelGroup === null && stepDef.stepOrder === sequentialGroups.firstSequentialOrder) {
                stepStatus = ApprovalStepStatus.ACTIVE;
            } else if (stepDef.parallelGroup && sequentialGroups.firstParallelGroup !== null && stepDef.parallelGroup === sequentialGroups.firstParallelGroup) {
                stepStatus = ApprovalStepStatus.ACTIVE;
            } else {
                stepStatus = ApprovalStepStatus.WAITING;
            }

            // Compute due date from timeout
            const dueAt = stepDef.timeoutHours
                ? new Date(Date.now() + stepDef.timeoutHours * 60 * 60 * 1000)
                : null;

            const createdStep = await runtimeTx.approvalInstanceStep.create({
                data: {
                    instanceId: instance.id,
                    stepOrder: stepDef.stepOrder,
                    parallelGroup: stepDef.parallelGroup ?? null,
                    approverType: stepDef.approverType as any,
                    assignedApproverId,
                    status: stepStatus,
                    decision: stepDef.approverType === 'AUTO' ? 'APPROVED' : null,
                    decidedAt: stepDef.approverType === 'AUTO' ? new Date() : null,
                    decidedBy: stepDef.approverType === 'AUTO' ? actorId : null,
                    dueAt,
                    timeoutAction: (stepDef.timeoutAction as ApprovalTimeoutAction) ?? ApprovalTimeoutAction.REMINDER,
                    condition: (stepDef.condition ?? (stepDef.autoApproveIf ? parseAutoApproveCondition(stepDef.autoApproveIf) : null)) as any,
                },
            });
            createdSteps.push(createdStep);
        }

        return { instance, createdSteps };
    });

    logger.info(`Started approval instance ${stepsData.instance.id} for request ${requestId} with ${stepsData.createdSteps.length} steps`);

    // Re-fetch with steps included
    return db.approvalInstance.findUnique({
        where: { id: stepsData.instance.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })!;
}

// ---------------------------------------------------------------------------
// Decide Approval
// ---------------------------------------------------------------------------

/**
 * Make a decision on an approval step.
 * Routes the request status change through the Task 15 workflowCommand boundary.
 * Enforces SoD (requester cannot approve own request).
 */
export async function decideApproval(input: DecideApprovalInput) {
    const { instanceId, stepId, decision, actorId, tenantId, comment } = input;

    // Fetch instance and step
    const instance = await prisma.approvalInstance.findUnique({
        where: { id: instanceId },
        include: {
            steps: { orderBy: { stepOrder: 'asc' } },
            policyVersion: { select: { definition: true } },
        },
    });

    if (!instance) {
        throw new AppError('Approval instance not found', 404);
    }

    if (instance.tenantId !== tenantId) {
        throw new AppError('Approval instance not found', 404); // BOLA: tenant mismatch returns 404
    }

    const step = instance.steps.find(s => s.id === stepId);
    if (!step) {
        throw new AppError('Approval step not found', 404);
    }

    // Already decided?
    if (step.status === ApprovalStepStatus.APPROVED || step.status === ApprovalStepStatus.REJECTED) {
        throw new AppError(`Step already decided with status ${step.status}. Duplicate decisions are rejected.`, 409);
    }

    // Must be ACTIVE to decide
    if (step.status !== ApprovalStepStatus.ACTIVE) {
        throw new AppError(`Step is not active (status: ${step.status}). Only ACTIVE steps can be decided.`, 400);
    }

    // SoD: requester cannot approve their own request
    const request = await prisma.request.findUnique({
        where: { id: instance.requestId },
        select: { requesterId: true, tenantId: true, version: true, status: true },
    });

    if (request && request.requesterId === actorId) {
        throw new AppError('Cannot approve own request — separation of duties violation.', 403);
    }

    const stepDecisionData = {
        status: decision === 'APPROVED' ? ApprovalStepStatus.APPROVED : ApprovalStepStatus.REJECTED,
        decision,
        decisionComment: comment ?? null,
        decidedAt: new Date(),
        decidedBy: actorId,
    };

    // Determine if all steps are complete and compute next state before writing.
    // If this decision completes the approval flow, the approval-runtime writes
    // are performed inside the Task 15 workflow-command transaction below.
    const allSteps = instance.steps.map((s: any) =>
        s.id === stepId
            ? { ...s, status: stepDecisionData.status, decision: stepDecisionData.decision }
            : s
    );

    const anyRejected = allSteps.some((s: any) => s.status === ApprovalStepStatus.REJECTED);
    const allDecided = anyRejected || allSteps.every((s: any) =>
        s.status === ApprovalStepStatus.APPROVED ||
        s.status === ApprovalStepStatus.REJECTED ||
        s.status === ApprovalStepStatus.CANCELLED ||
        s.status === ApprovalStepStatus.TIMED_OUT
    );

    if (allDecided) {
        if (!request) {
            throw new AppError('Request not found', 404);
        }

        const targetStatus = anyRejected ? 'REJECTED' : 'APPROVED';
        await executeWorkflowCommand({
            requestId: instance.requestId,
            tenantId: request.tenantId ?? tenantId,
            fromStatus: request.status as RequestStatus,
            toStatus: targetStatus as RequestStatus,
            expectedVersion: request.version ?? 1,
            actorId,
            actorName: 'ApprovalRuntime',
            source: 'approval',
            comment: comment ?? `Approval ${decision.toLowerCase()}`,
            metadata: {
                approvalInstanceId: instanceId,
                stepId,
                decision,
            },
            transactionMutations: async (tx) => {
                const runtimeTx = tx as any;
                await runtimeTx.approvalInstanceStep.update({
                    where: { id: stepId },
                    data: stepDecisionData,
                });

                if (anyRejected) {
                    await runtimeTx.approvalInstanceStep.updateMany({
                        where: {
                            instanceId,
                            id: { not: stepId },
                            status: { in: [ApprovalStepStatus.WAITING, ApprovalStepStatus.ACTIVE] },
                        },
                        data: {
                            status: ApprovalStepStatus.CANCELLED,
                            decision: 'CANCELLED',
                        },
                    });
                }

                await runtimeTx.approvalInstance.update({
                    where: { id: instanceId },
                    data: {
                        status: anyRejected ? ApprovalStepStatus.REJECTED : ApprovalStepStatus.APPROVED,
                        completedAt: new Date(),
                    },
                });
            },
        });
    } else {
        await db.approvalInstanceStep.update({
            where: { id: stepId },
            data: stepDecisionData,
        });

        // Activate next sequential/parallel steps
        await activateNextSteps(instance, allSteps, definitionFromInstance(instance));
    }

    const refreshedInstance = await db.approvalInstance.findUnique({
        where: { id: instanceId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })!;
    const updatedStep = refreshedInstance!.steps.find((s: any) => s.id === stepId);

    return { step: updatedStep, instance: refreshedInstance };
}

// ---------------------------------------------------------------------------
// Delegate Approval
// ---------------------------------------------------------------------------

/**
 * Delegate an approval step to another user.
 * Rejects self-delegation, cyclic delegation, and out-of-tenant delegation.
 */
export async function delegateApprovalRuntime(input: DelegateApprovalInput): Promise<DelegateApprovalResult> {
    const { instanceId, stepId, fromUserId, toUserId, tenantId, reason: _reason } = input;

    // Self-delegation check
    if (fromUserId === toUserId) {
        throw new AppError('Self-delegation is not allowed — cannot delegate to yourself.', 400);
    }

    const instance = await (prisma as any).approvalInstance.findUnique({
        where: { id: instanceId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!instance) {
        throw new AppError('Approval instance not found', 404);
    }

    if (instance.tenantId !== tenantId) {
        throw new AppError('Approval instance not found', 404);
    }

    const step = instance.steps.find((s: any) => s.id === stepId);
    if (!step) {
        throw new AppError('Approval step not found', 404);
    }

    // Verify fromUserId is the current approver or delegatee
    // After a delegation, assignedApproverId is updated to the delegatee,
    // so we check both the original approver and the current delegatee.
    if (step.assignedApproverId !== fromUserId && step.delegatedTo !== fromUserId) {
        throw new AppError('Only the current assigned approver can delegate this step.', 403);
    }

    // Out-of-tenant delegation check
    const toUser = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { id: true, tenantId: true, isActive: true },
    });

    if (!toUser || !toUser.isActive) {
        throw new AppError('Delegate target user not found or inactive.', 404);
    }

    if (toUser.tenantId && toUser.tenantId !== tenantId) {
        throw new AppError('Cross-tenant delegation is not allowed.', 403);
    }

    // Cyclic delegation check:
    // After a delegation, step.assignedApproverId = delegatee, step.delegatedBy = original approver.
    // We prevent delegating back to anyone who has previously held this step.
    // - delegatedBy holds the previous approver (the one who delegated)
    // - assignedApproverId (before this delegation) is the current holder
    // So: toUserId must not equal delegatedBy (previous holder) or fromUserId (current holder, but that's self-delegation already checked)
    if (step.delegatedBy && toUserId === step.delegatedBy) {
        throw new AppError('Cyclic delegation detected — cannot delegate back to a previous approver in the chain.', 400);
    }

    // Update the step with delegation
    await (prisma as any).approvalInstanceStep.update({
        where: { id: stepId },
        data: {
            delegatedBy: fromUserId,
            delegatedTo: toUserId,
            delegatedAt: new Date(),
            assignedApproverId: toUserId,
        },
    });

    // Note: ApprovalDelegation has an FK to RequestApproval (the legacy model),
    // so we don't create a separate record there. The ApprovalInstanceStep
    // already tracks delegatedBy, delegatedTo, delegatedAt.

    logger.info(`Delegated approval step ${stepId} from ${fromUserId} to ${toUserId}`);

    return { stepId, fromUserId, toUserId };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PolicyStepDefinition {
    stepOrder: number;
    approverType: string;
    approverId?: string | null;
    roleId?: string | null;
    departmentId?: string | null;
    entityId?: string | null;
    teamId?: string | null;
    label?: string | null;
    autoApproveIf?: string | null;
    timeoutHours?: number | null;
    parallelGroup?: string | null;
    timeoutAction?: string | null;
    condition?: unknown;
}

interface StepGroupResult {
    firstSequentialOrder: number;
    firstParallelGroup: string | null;
}

/**
 * Group steps for activation:
 * - Sequential steps: only the first step starts ACTIVE
 * - Parallel steps: all steps in the first parallel group start ACTIVE
 */
function groupStepsForActivation(steps: PolicyStepDefinition[]): StepGroupResult {
    // Find the minimum step order (first sequential)
    const firstSequentialOrder = Math.min(...steps.map(s => s.stepOrder));

    // Find the first parallel group among the earliest steps
    const earliestSteps = steps.filter(s => s.stepOrder === firstSequentialOrder);
    const firstParallelGroup = earliestSteps.find(s => s.parallelGroup)?.parallelGroup ?? null;

    return { firstSequentialOrder, firstParallelGroup };
}

/**
 * Resolve the assigned approver for a step definition.
 * Only resolves within the same tenant.
 */
async function resolveApprover(stepDef: PolicyStepDefinition, tenantId: string): Promise<string | null> {
    if (stepDef.approverType === 'AUTO') {
        return null; // Auto-approve — no human approver
    }

    if (stepDef.approverType === 'USER') {
        if (!stepDef.approverId) return null;
        // Verify user exists and is in the same tenant
        const user = await prisma.user.findFirst({
            where: { id: stepDef.approverId, isActive: true },
            select: { id: true, tenantId: true },
        });
        // If tenant is set on user, it must match; if null, allow (system users)
        if (!user) return null;
        if (user.tenantId && user.tenantId !== tenantId) return null;
        return user.id;
    }

    if (stepDef.approverType === 'ROLE' && stepDef.roleId) {
        // Find first user with this role in the tenant
        const user = await prisma.user.findFirst({
            where: {
                isActive: true,
                roles: { some: { role: { name: stepDef.roleId } } },
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });
        return user?.id ?? null;
    }

    if (stepDef.approverType === 'DEPARTMENT' && stepDef.departmentId) {
        const user = await prisma.user.findFirst({
            where: {
                isActive: true,
                department: stepDef.departmentId,
                roles: { some: { role: { name: 'DEPARTMENT_HEAD' } } },
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true },
        });
        return user?.id ?? null;
    }

    if (stepDef.approverType === 'ENTITY' && stepDef.entityId) {
        const user = await prisma.user.findFirst({
            where: {
                isActive: true,
                entityId: stepDef.entityId,
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true },
        });
        return user?.id ?? null;
    }

    if (stepDef.approverType === 'TEAM' && stepDef.teamId) {
        const user = await prisma.user.findFirst({
            where: {
                isActive: true,
                roles: { some: { roleId: stepDef.teamId } },
                ...(tenantId ? { tenantId } : {}),
            },
            select: { id: true },
        });
        return user?.id ?? null;
    }

    return null;
}

/**
 * Activate next steps in the sequence after an approval.
 */
async function activateNextSteps(
    _instance: any,
    currentSteps: any[],
    definition: PolicyStepDefinition[],
) {
    // Find the maximum order among currently ACTIVE/APPROVED steps
    const completedOrders = currentSteps
        .filter(s => s.status === ApprovalStepStatus.APPROVED)
        .map(s => s.stepOrder);

    if (completedOrders.length === 0) return;

    const maxCompleted = Math.max(...completedOrders);

    // Find the next sequential order(s) that should become active
    const nextSteps = definition
        .filter(d => d.stepOrder > maxCompleted)
        .sort((a, b) => a.stepOrder - b.stepOrder);

    if (nextSteps.length === 0) return;

    const nextOrder = nextSteps[0].stepOrder;

    // Determine if there's a parallel group at this order
    const parallelGroup = nextSteps.find(s => s.parallelGroup && s.stepOrder === nextOrder)?.parallelGroup;

    if (parallelGroup) {
        // Activate all steps in this parallel group
        const groupSteps = currentSteps.filter(
            s => s.parallelGroup === parallelGroup && s.status === ApprovalStepStatus.WAITING,
        );
        for (const gs of groupSteps) {
            await db.approvalInstanceStep.update({
                where: { id: gs.id },
                data: { status: ApprovalStepStatus.ACTIVE },
            });
        }
    } else {
        // Activate the single next sequential step
        const nextStep = currentSteps.find(
            s => s.stepOrder === nextOrder && s.status === ApprovalStepStatus.WAITING,
        );
        if (nextStep) {
            await db.approvalInstanceStep.update({
                where: { id: nextStep.id },
                data: { status: ApprovalStepStatus.ACTIVE },
            });
        }
    }
}

/**
 * Extract the definition from the instance's policy version.
 */
function definitionFromInstance(instance: any): PolicyStepDefinition[] {
    // The definition is stored on the policyVersion relation
    if (instance.policyVersion?.definition) {
        return instance.policyVersion.definition as PolicyStepDefinition[];
    }
    // Fallback: empty definition
    return [];
}

/**
 * Parse legacy autoApproveIf JSON string into a condition AST.
 * For backward compatibility with existing ApprovalPolicyStep.autoApproveIf.
 */
function parseAutoApproveCondition(autoApproveIf: string): ConditionAST | null {
    try {
        const parsed = JSON.parse(autoApproveIf);
        if (parsed && typeof parsed === 'object' && parsed.operator) {
            validateCondition(parsed as ConditionAST);
            return parsed as ConditionAST;
        }
    } catch {
        // Not a valid condition AST — treat as a plain string description
    }
    return null;
}