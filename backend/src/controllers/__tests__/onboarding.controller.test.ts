import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockPrisma = {
    request: { findUnique: jest.fn() },
    onboardingRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    onboardingTask: {
        groupBy: jest.fn(),
    },
    requestActivity: { create: jest.fn() },
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../utils/resolve', () => ({ resolveRequestId: jest.fn() }));
jest.mock('../../utils/httpRequestTransition', () => ({ transitionHttpRequest: jest.fn() }));
jest.mock('../../services/notification.service', () => ({ notify: jest.fn() }));
jest.mock('../../utils/audit', () => ({ auditLog: jest.fn() }));

import { updateOnboardingStatus } from '../onboarding.controller';
import { resolveRequestId } from '../../utils/resolve';

const mockResolveRequestId = resolveRequestId as jest.MockedFunction<typeof resolveRequestId>;

describe('updateOnboardingStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockResolveRequestId.mockResolvedValue('request-id');
        (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
            id: 'request-id',
            status: 'ONBOARDING_WEEK_1_INTEGRATION',
            requesterId: 'requester-id',
            referenceNumber: 'HR-00007',
        });
        (mockPrisma.onboardingRequest.update as any).mockResolvedValue({
            id: 'onboarding-id',
            requestId: 'request-id',
            overallStatus: 'COMPLETED',
            currentPhase: 'WEEK_1',
            tasks: [],
        });
        (mockPrisma.onboardingTask.groupBy as any).mockResolvedValue([
            { status: 'COMPLETED', _count: 4 },
            { status: 'PENDING', _count: 4 },
        ]);
    });

    it('rejects completion with pending tasks before mutating onboarding status', async () => {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        } as any;

        await updateOnboardingStatus(
            {
                params: { id: 'HR-00007' },
                body: { overallStatus: 'COMPLETED' },
                user: { id: 'user-id', firstName: 'Test', lastName: 'User', roles: ['AGENT'] },
            } as any,
            res,
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Cannot complete onboarding',
            pendingCount: 4,
            totalCount: 8,
        }));
        expect(mockPrisma.onboardingRequest.update).not.toHaveBeenCalled();
    });
});
