/**
 * P5-08: Approval Delegation, Fallback, and Reminders Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma
const mockPrisma = {
    requestApproval: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
    approvalDelegation: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    approvalReminder: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
};

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: mockPrisma,
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('Approval Delegation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('delegateApproval', () => {
        it('should delegate a PENDING approval to another user', async () => {
            const { delegateApproval } = await import('../services/approvalDelegation.service');

            mockPrisma.requestApproval.findUnique.mockResolvedValue({
                id: 'approval-1',
                status: 'PENDING',
                approverId: 'user-1',
            });

            mockPrisma.requestApproval.update.mockResolvedValue({
                id: 'approval-1',
                approverId: 'user-2',
                delegatedBy: 'user-1',
                delegatedTo: 'user-2',
            });

            mockPrisma.approvalDelegation.create.mockResolvedValue({
                id: 'delegation-1',
                approvalId: 'approval-1',
                fromUserId: 'user-1',
                toUserId: 'user-2',
            });

            const result = await delegateApproval({
                approvalId: 'approval-1',
                fromUserId: 'user-1',
                toUserId: 'user-2',
                reason: 'Out of office',
            });

            expect(result.approverId).toBe('user-2');
            expect(mockPrisma.requestApproval.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        delegatedBy: 'user-1',
                        delegatedTo: 'user-2',
                        approverId: 'user-2',
                    }),
                }),
            );
            expect(mockPrisma.approvalDelegation.create).toHaveBeenCalled();
        });

        it('should reject delegation of a non-PENDING approval', async () => {
            const { delegateApproval } = await import('../services/approvalDelegation.service');

            mockPrisma.requestApproval.findUnique.mockResolvedValue({
                id: 'approval-1',
                status: 'APPROVED',
                approverId: 'user-1',
            });

            await expect(
                delegateApproval({
                    approvalId: 'approval-1',
                    fromUserId: 'user-1',
                    toUserId: 'user-2',
                }),
            ).rejects.toThrow('Cannot delegate approval in status APPROVED');
        });

        it('should reject delegation by a non-approver', async () => {
            const { delegateApproval } = await import('../services/approvalDelegation.service');

            mockPrisma.requestApproval.findUnique.mockResolvedValue({
                id: 'approval-1',
                status: 'PENDING',
                approverId: 'user-1',
                delegatedTo: null,
            });

            await expect(
                delegateApproval({
                    approvalId: 'approval-1',
                    fromUserId: 'user-3', // Not the approver
                    toUserId: 'user-2',
                }),
            ).rejects.toThrow('Only the current approver can delegate');
        });
    });

    describe('checkApprovalTimeouts', () => {
        it('should auto-reject overdue PENDING approvals', async () => {
            const { checkApprovalTimeouts } = await import('../services/approvalDelegation.service');

            const overdueApproval = {
                id: 'approval-1',
                status: 'PENDING',
                dueAt: new Date('2025-01-01'), // Past
                policy: { steps: [{ stepOrder: 1, timeoutHours: 48 }] },
                stepOrder: 1,
            };

            mockPrisma.requestApproval.findMany.mockResolvedValue([overdueApproval]);
            mockPrisma.requestApproval.update.mockResolvedValue({ id: 'approval-1', status: 'REJECTED' });

            const count = await checkApprovalTimeouts();
            expect(count).toBe(1);
            expect(mockPrisma.requestApproval.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'REJECTED' }),
                }),
            );
        });

        it('should return 0 when no overdue approvals', async () => {
            const { checkApprovalTimeouts } = await import('../services/approvalDelegation.service');

            mockPrisma.requestApproval.findMany.mockResolvedValue([]);
            const count = await checkApprovalTimeouts();
            expect(count).toBe(0);
        });
    });

    describe('checkAndSendReminders', () => {
        it('should send FIRST reminder for approvals older than 24h', async () => {
            const { checkAndSendReminders } = await import('../services/approvalDelegation.service');

            const oldApproval = {
                id: 'approval-1',
                status: 'PENDING',
                approverId: 'user-1',
                createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
                request: { id: 'req-1', summary: 'Test request' },
                reminders: [],
            };

            mockPrisma.requestApproval.findMany.mockResolvedValue([oldApproval]);
            mockPrisma.approvalReminder.create.mockResolvedValue({ id: 'rem-1' });
            mockPrisma.requestApproval.update.mockResolvedValue({ id: 'approval-1' });

            const count = await checkAndSendReminders();
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });
});