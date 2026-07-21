/**
 * P5-06: Approval Policy Service Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock prisma
const mockPrisma = {
    approvalPolicy: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    requestApproval: {
        create: jest.fn(),
    },
    user: {
        findFirst: jest.fn(),
    },
};

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: mockPrisma,
}));

import { approvalPolicyService } from '../services/approvalPolicy.service';

const samplePolicy = {
    id: 'policy-1',
    name: 'IT Equipment Approval',
    description: 'Approval workflow for IT equipment requests',
    requestTypeId: 'rt-1',
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
        {
            id: 'step-1',
            policyId: 'policy-1',
            stepOrder: 1,
            approverType: 'ROLE',
            roleId: 'IT_MANAGER',
            label: 'IT Manager Approval',
            timeoutHours: 48,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: 'step-2',
            policyId: 'policy-1',
            stepOrder: 2,
            approverType: 'AUTO',
            label: 'Auto-approve',
            autoApproveIf: null,
            timeoutHours: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ],
};

describe('ApprovalPolicyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPolicy', () => {
        it('should create a policy with steps', async () => {
            mockPrisma.approvalPolicy.create.mockResolvedValue(samplePolicy);

            const result = await approvalPolicyService.createPolicy({
                name: 'IT Equipment Approval',
                requestTypeId: 'rt-1',
                steps: [
                    { stepOrder: 1, approverType: 'ROLE', roleId: 'IT_MANAGER', label: 'IT Manager Approval' },
                    { stepOrder: 2, approverType: 'AUTO', label: 'Auto-approve' },
                ],
            });

            expect(result).toEqual(samplePolicy);
            expect(mockPrisma.approvalPolicy.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: 'IT Equipment Approval',
                        requestTypeId: 'rt-1',
                        steps: { create: expect.arrayContaining([expect.objectContaining({ stepOrder: 1 })]) },
                    }),
                }),
            );
        });
    });

    describe('getPolicy', () => {
        it('should return a policy by ID with steps', async () => {
            mockPrisma.approvalPolicy.findUnique.mockResolvedValue(samplePolicy);

            const result = await approvalPolicyService.getPolicy('policy-1');

            expect(result).toEqual(samplePolicy);
            expect(mockPrisma.approvalPolicy.findUnique).toHaveBeenCalledWith({
                where: { id: 'policy-1' },
                include: { steps: { orderBy: { stepOrder: 'asc' } } },
            });
        });

        it('should return null for non-existent policy', async () => {
            mockPrisma.approvalPolicy.findUnique.mockResolvedValue(null);

            const result = await approvalPolicyService.getPolicy('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('listPolicies', () => {
        it('should list policies for a request type', async () => {
            mockPrisma.approvalPolicy.findMany.mockResolvedValue([samplePolicy]);

            const result = await approvalPolicyService.listPolicies('rt-1');

            expect(result).toEqual([samplePolicy]);
            expect(mockPrisma.approvalPolicy.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { requestTypeId: 'rt-1' },
                }),
            );
        });
    });

    describe('resolvePolicy', () => {
        it('should find the first active policy by priority', async () => {
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(samplePolicy);

            const result = await approvalPolicyService.resolvePolicy('rt-1');

            expect(result).toEqual(samplePolicy);
            expect(mockPrisma.approvalPolicy.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { requestTypeId: 'rt-1', isActive: true },
                    orderBy: { priority: 'asc' },
                }),
            );
        });

        it('should return null when no active policy exists', async () => {
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(null);

            const result = await approvalPolicyService.resolvePolicy('rt-no-policy');

            expect(result).toBeNull();
        });
    });

    describe('updatePolicy', () => {
        it('should update policy without replacing steps', async () => {
            const updated = { ...samplePolicy, name: 'Updated Name' };
            mockPrisma.approvalPolicy.update.mockResolvedValue(updated);

            const result = await approvalPolicyService.updatePolicy('policy-1', { name: 'Updated Name' });

            expect(result.name).toBe('Updated Name');
            expect(mockPrisma.approvalPolicy.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'policy-1' },
                    data: { name: 'Updated Name' },
                }),
            );
        });

        it('should replace steps when provided', async () => {
            const updated = { ...samplePolicy };
            mockPrisma.approvalPolicy.update.mockResolvedValue(updated);

            await approvalPolicyService.updatePolicy('policy-1', {
                steps: [{ stepOrder: 1, approverType: 'USER', approverId: 'user-1' }],
            });

            expect(mockPrisma.approvalPolicy.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        steps: { deleteMany: {}, create: expect.any(Array) },
                    }),
                }),
            );
        });
    });

    describe('deletePolicy', () => {
        it('should delete a policy by ID', async () => {
            mockPrisma.approvalPolicy.delete.mockResolvedValue(samplePolicy);

            await approvalPolicyService.deletePolicy('policy-1');

            expect(mockPrisma.approvalPolicy.delete).toHaveBeenCalledWith({
                where: { id: 'policy-1' },
            });
        });
    });

    describe('createApprovalsFromPolicy', () => {
        it('should return empty array when no policy exists', async () => {
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(null);

            const result = await approvalPolicyService.createApprovalsFromPolicy('req-1', 'rt-1', 'user-1');

            expect(result).toEqual([]);
        });

        it('should auto-approve AUTO steps', async () => {
            const policyWithAutoStep = {
                ...samplePolicy,
                steps: [
                    { id: 's1', policyId: 'p1', stepOrder: 1, approverType: 'AUTO', label: 'Auto', autoApproveIf: null, timeoutHours: null },
                ],
            };
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(policyWithAutoStep);
            mockPrisma.requestApproval.create.mockResolvedValue({ id: 'approval-1' });

            const result = await approvalPolicyService.createApprovalsFromPolicy('req-1', 'rt-1', 'user-1');

            expect(result).toHaveLength(1);
            expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        approverType: 'AUTO',
                        status: 'APPROVED',
                    }),
                }),
            );
        });

        it('should resolve ROLE-based approver from user lookup', async () => {
            const policyWithRole = {
                ...samplePolicy,
                steps: [
                    { id: 's1', policyId: 'p1', stepOrder: 1, approverType: 'ROLE', roleId: 'IT_MANAGER', label: 'IT Manager' },
                ],
            };
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(policyWithRole);
            mockPrisma.user.findFirst.mockResolvedValue({ id: 'manager-1' });
            mockPrisma.requestApproval.create.mockResolvedValue({ id: 'approval-1' });

            await approvalPolicyService.createApprovalsFromPolicy('req-1', 'rt-1', 'user-1');

            expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        roles: { some: { roleId: 'IT_MANAGER' } },
                    }),
                }),
            );
            expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        approverId: 'manager-1',
                    }),
                }),
            );
        });

        it('should set approverId to null when no matching user found for ROLE', async () => {
            const policyWithRole = {
                ...samplePolicy,
                steps: [
                    { id: 's1', policyId: 'p1', stepOrder: 1, approverType: 'ROLE', roleId: 'NONEXISTENT_ROLE' },
                ],
            };
            mockPrisma.approvalPolicy.findFirst.mockResolvedValue(policyWithRole);
            mockPrisma.user.findFirst.mockResolvedValue(null);
            mockPrisma.requestApproval.create.mockResolvedValue({ id: 'approval-1' });

            await approvalPolicyService.createApprovalsFromPolicy('req-1', 'rt-1', 'user-1');

            expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        approverId: null,
                    }),
                }),
            );
        });
    });
});