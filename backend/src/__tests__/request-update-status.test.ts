import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
    request: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
    },
    requestActivity: {
        create: vi.fn(),
    },
    requestParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
    },
    workflowTransition: {
        findFirst: vi.fn().mockResolvedValue(null),
    },
}));

vi.mock('../utils/prisma', () => ({ default: mockPrisma }));
vi.mock('../utils/audit', () => ({ auditLog: vi.fn() }));
vi.mock('../services/notification.service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/sla-pause.service', () => ({
    shouldResumeOnTransition: vi.fn().mockResolvedValue({ shouldPause: false, shouldResume: false }),
    pauseSla: vi.fn(),
    resumeSla: vi.fn(),
}));
vi.mock('../utils/workflowTransitions', () => ({
    isValidTransition: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/autoAssignment.service', () => ({
    autoAssignRequest: vi.fn().mockResolvedValue(undefined),
}));

import { requestController } from '../controllers/request.controller';

const REQ_ID = '00000000-0000-0000-0000-000000000003';
const REQ_ID_2 = '00000000-0000-0000-0000-000000000004';

function makeResWithDone() {
    let resolveResponse!: () => void;
    const responseDone = new Promise<void>(resolve => { resolveResponse = resolve; });
    const res: any = {
        status: vi.fn().mockImplementation(function(this: any) { return this; }),
        json: vi.fn().mockImplementation(() => { resolveResponse(); }),
    };
    return { res, responseDone };
}

function makeNextWithDone() {
    let resolveNext!: (err?: any) => void;
    const nextDone = new Promise<any>(resolve => { resolveNext = resolve; });
    const next = vi.fn().mockImplementation((err?: any) => { resolveNext(err); });
    return { next, nextDone };
}

describe('updateStatus terminal-status handling', () => {
    beforeEach(() => vi.clearAllMocks());

    it('stamps closedAt for GROUP_DCEO_REJECTED, which the old local list omitted', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID,
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            serviceDesk: { code: 'HR' },
            requesterId: 'requester-1',
            referenceNumber: 'HR-3',
        });
        mockPrisma.request.update.mockResolvedValue({
            id: REQ_ID,
            requesterId: 'requester-1',
            referenceNumber: 'HR-3',
            status: 'GROUP_DCEO_REJECTED',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID },
            body: { status: 'GROUP_DCEO_REJECTED' },
            user: { id: 'admin-1', roles: ['ADMIN'] },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
            throw next.mock.calls[0][0];
        }

        expect(mockPrisma.request.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ closedAt: expect.any(Date) }),
            })
        );
    });

    it('does not stamp closedAt for a non-terminal status', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID_2,
            status: 'SUBMITTED',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-4',
        });
        mockPrisma.request.update.mockResolvedValue({
            id: REQ_ID_2,
            requesterId: 'requester-1',
            referenceNumber: 'IT-4',
            status: 'IN_REVIEW',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID_2 },
            body: { status: 'IN_REVIEW' },
            user: { id: 'admin-1', roles: ['ADMIN'] },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
            throw next.mock.calls[0][0];
        }

        expect(mockPrisma.request.update).toHaveBeenCalled();
        const callArg = mockPrisma.request.update.mock.calls[0][0];
        expect(callArg.data.closedAt).toBeUndefined();
    });
});