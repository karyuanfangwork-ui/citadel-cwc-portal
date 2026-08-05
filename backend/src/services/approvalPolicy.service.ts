/**
 * P5-06: Approval Policy Service
 *
 * CRUD operations for ApprovalPolicy and ApprovalPolicyStep.
 * Includes policy resolution: given a request type, find the matching active policy
 * and return its ordered steps.
 */

import prisma from '../utils/prisma';

export interface CreatePolicyStepInput {
    stepOrder: number;
    approverType: 'ROLE' | 'DEPARTMENT' | 'ENTITY' | 'USER' | 'TEAM' | 'AUTO';
    approverId?: string;
    roleId?: string;
    departmentId?: string;
    entityId?: string;
    teamId?: string;
    label?: string;
    autoApproveIf?: string; // JSON condition
    timeoutHours?: number;
}

export interface CreatePolicyInput {
    name: string;
    description?: string;
    requestTypeId: string;
    isActive?: boolean;
    priority?: number;
    steps: CreatePolicyStepInput[];
}

export interface UpdatePolicyInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    priority?: number;
    steps?: CreatePolicyStepInput[];
}

class ApprovalPolicyService {
    /**
     * Create a new approval policy with steps.
     */
    async createPolicy(data: CreatePolicyInput) {
        const { steps, ...policyData } = data;

        return prisma.approvalPolicy.create({
            data: {
                ...policyData,
                steps: {
                    create: steps.map(step => ({ ...step })),
                },
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
    }

    /**
     * Get a policy by ID with steps.
     */
    async getPolicy(id: string) {
        return prisma.approvalPolicy.findUnique({
            where: { id },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
    }

    /**
     * List all policies for a request type.
     */
    async listPolicies(requestTypeId: string) {
        return prisma.approvalPolicy.findMany({
            where: { requestTypeId },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Update a policy (and optionally replace its steps).
     */
    async updatePolicy(id: string, data: UpdatePolicyInput) {
        const { steps, ...policyData } = data;

        // If steps provided, delete existing and recreate
        if (steps && steps.length > 0) {
            return prisma.approvalPolicy.update({
                where: { id },
                data: {
                    ...policyData,
                    steps: {
                        deleteMany: {},
                        create: steps.map(step => ({ ...step })),
                    },
                },
                include: { steps: { orderBy: { stepOrder: 'asc' } } },
            });
        }

        return prisma.approvalPolicy.update({
            where: { id },
            data: policyData,
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
    }

    /**
     * Delete a policy and its steps (cascade).
     */
    async deletePolicy(id: string) {
        return prisma.approvalPolicy.delete({
            where: { id },
        });
    }

    /**
     * Resolve the matching approval policy for a request type.
     * Returns the first active policy ordered by priority (lowest = highest priority).
     */
    async resolvePolicy(requestTypeId: string) {
        return prisma.approvalPolicy.findFirst({
            where: {
                requestTypeId,
                isActive: true,
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
            orderBy: { priority: 'asc' },
        });
    }

    /**
     * Create RequestApproval records from a policy for a given request.
     * This is the core function that bridges policy definition → runtime approval records.
     *
     * Returns the created approval records.
     */
    async createApprovalsFromPolicy(requestId: string, requestTypeId: string, _requesterId: string) {
        const policy = await this.resolvePolicy(requestTypeId);
        if (!policy) {
            return []; // No policy = no automatic approvals created
        }

        const approvals = [];

        for (const step of policy.steps) {
            // For AUTO steps, create an already-approved record
            if (step.approverType === 'AUTO') {
                approvals.push(
                    prisma.requestApproval.create({
                        data: {
                            requestId,
                            approverType: 'AUTO',
                            policyId: policy.id,
                            stepOrder: step.stepOrder,
                            status: 'APPROVED',
                            comments: step.autoApproveIf || 'Auto-approved by policy',
                            // P5-08: Set dueAt for timeout tracking even for auto steps
                            ...(step.timeoutHours ? { dueAt: new Date(Date.now() + step.timeoutHours * 60 * 60 * 1000) } : {}),
                        },
                    }),
                );
                continue;
            }

            // For other approver types, resolve the approver
            let approverId = step.approverId || null;

            // If ROLE-based, find the first user with that role
            if (step.approverType === 'ROLE' && step.roleId) {
                const roleUser = await prisma.user.findFirst({
                    where: {
                        roles: { some: { roleId: step.roleId } },
                        isActive: true,
                    },
                    orderBy: { createdAt: 'asc' },
                });
                approverId = roleUser?.id || null;
            }

            // If DEPARTMENT-based, find a user in that department
            if (step.approverType === 'DEPARTMENT' && step.departmentId) {
                // departmentId on the step stores the department name string
                // Look up users by their department field
                const deptHead = await prisma.user.findFirst({
                    where: {
                        department: step.departmentId,
                        roles: { some: { roleId: 'DEPARTMENT_HEAD' } },
                        isActive: true,
                    },
                });
                approverId = deptHead?.id || null;
            }

            // If ENTITY-based, find the entity head
            if (step.approverType === 'ENTITY' && step.entityId) {
                const entityHead = await prisma.user.findFirst({
                    where: {
                        entityId: step.entityId,
                        roles: { some: { roleId: 'ENTITY_HEAD' } },
                        isActive: true,
                    },
                });
                approverId = entityHead?.id || null;
            }

            // If TEAM-based, find the team lead
            if (step.approverType === 'TEAM' && step.teamId) {
                const teamLead = await prisma.user.findFirst({
                    where: {
                        roles: { some: { roleId: step.teamId } },
                        isActive: true,
                    },
                });
                approverId = teamLead?.id || null;
            }

            approvals.push(
                prisma.requestApproval.create({
                    data: {
                        requestId,
                        approverType: step.approverType,
                        approverId,
                        entityId: step.entityId,
                        policyId: policy.id,
                        stepOrder: step.stepOrder,
                        status: 'PENDING',
                        // P5-08: Set dueAt based on policy step timeoutHours
                        ...(step.timeoutHours ? { dueAt: new Date(Date.now() + step.timeoutHours * 60 * 60 * 1000) } : {}),
                    },
                }),
            );
        }

        return Promise.all(approvals);
    }
}

export const approvalPolicyService = new ApprovalPolicyService();
export default approvalPolicyService;