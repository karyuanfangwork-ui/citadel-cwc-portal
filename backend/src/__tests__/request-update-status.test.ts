import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Declare mock functions at module scope so jest.mock factory can access them
// via the hoisted variable pattern (Jest hoists jest.mock calls)
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockActivityCreate = jest.fn();
const mockParticipantFindMany = jest.fn().mockResolvedValue([]);
const mockWorkflowTransitionFindFirst = jest.fn().mockResolvedValue(null);

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: {
            findUnique: mockFindUnique,
            findFirst: mockFindFirst,
            update: mockUpdate,
        },
        requestActivity: {
            create: mockActivityCreate,
        },
        requestParticipant: {
            findMany: mockParticipantFindMany,
        },
        workflowTransition: {
            findFirst: mockWorkflowTransitionFindFirst,
        },
    },
}));
jest.mock('../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../services/notification.service', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/sla-pause.service', () => ({
    shouldResumeOnTransition: jest.fn().mockResolvedValue({ shouldPause: false, shouldResume: false }),
    pauseSla: jest.fn(),
    resumeSla: jest.fn(),
}));
jest.mock('../utils/workflowTransitions', () => ({
    isValidTransition: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/autoAssignment.service', () => ({
    autoAssignRequest: jest.fn().mockResolvedValue(undefined),
}));

import { requestController } from '../controllers/request.controller';

const REQ_ID = '00000000-0000-0000-0000-000000000003';
const REQ_ID_2 = '00000000-0000-0000-0000-000000000004';
const REQ_ID_3 = '00000000-0000-0000-0000-000000000005';
const REQ_ID_4 = '00000000-0000-0000-0000-000000000006';

function makeResWithDone() {
    let resolveResponse!: () => void;
    const responseDone = new Promise<void>(resolve => { resolveResponse = resolve; });
    const res: any = {
        status: jest.fn().mockImplementation(function(this: any) { return this; }),
        json: jest.fn().mockImplementation(() => { resolveResponse(); }),
    };
    return { res, responseDone };
}

function makeNextWithDone() {
    let resolveNext!: (err?: any) => void;
    const nextDone = new Promise<any>(resolve => { resolveNext = resolve; });
    const next = jest.fn().mockImplementation((err?: any) => { resolveNext(err); });
    return { next, nextDone };
}

describe('updateStatus terminal-status handling', () => {
    beforeEach(() => jest.clearAllMocks());

    it('stamps closedAt for GROUP_DCEO_REJECTED, which the old local list omitted', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID,
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            serviceDesk: { code: 'HR' },
            requesterId: 'requester-1',
            referenceNumber: 'HR-3',
        });
        mockUpdate.mockResolvedValue({
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

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ closedAt: expect.any(Date) }),
            }),
        );
    });

    it('does not stamp closedAt for a non-terminal status', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_2,
            status: 'SUBMITTED',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-4',
        });
        mockUpdate.mockResolvedValue({
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

        expect(mockUpdate).toHaveBeenCalled();
        const callArg = mockUpdate.mock.calls[0][0];
        expect(callArg.data.closedAt).toBeUndefined();
    });
});

describe('updateStatus rejection comment requirement', () => {
    beforeEach(() => jest.clearAllMocks());

    it('rejects with 400 when status is REJECTED and no comment is provided', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_3,
            status: 'SUBMITTED',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-5',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID_3 },
            body: { status: 'REJECTED' },
            user: { id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/reason/i),
        }));
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('accepts REJECTED with a comment and stores it on the activity log', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_4,
            status: 'SUBMITTED',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-6',
        });
        mockUpdate.mockResolvedValue({
            id: REQ_ID_4,
            requesterId: 'requester-1',
            referenceNumber: 'IT-6',
            status: 'REJECTED',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID_4 },
            body: { status: 'REJECTED', comment: 'Duplicate of IT-2' },
            user: { id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
            throw next.mock.calls[0][0];
        }

        expect(mockActivityCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: expect.stringContaining('Duplicate of IT-2'),
                }),
            }),
        );
    });
});

describe('updateStatus CANCELLED handling', () => {
    beforeEach(() => jest.clearAllMocks());

    it('rejects with 400 when status is CANCELLED and no comment is provided', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID,
            status: 'PROCUREMENT_IN_PROGRESS',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-3',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID },
            body: { status: 'CANCELLED' },
            user: { id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/reason/i),
        }));
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('accepts CANCELLED with a comment, stamps closedAt, and stores the reason', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_2,
            status: 'PROCUREMENT_IN_PROGRESS',
            serviceDesk: { code: 'IT' },
            requesterId: 'requester-1',
            referenceNumber: 'IT-4',
        });
        mockUpdate.mockResolvedValue({
            id: REQ_ID_2,
            requesterId: 'requester-1',
            referenceNumber: 'IT-4',
            status: 'CANCELLED',
        });

        const { res, responseDone } = makeResWithDone();
        const { next, nextDone } = makeNextWithDone();
        const req: any = {
            params: { id: REQ_ID_2 },
            body: { status: 'CANCELLED', comment: 'Submitted against the wrong asset by mistake' },
            user: { id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' },
        };

        requestController.updateStatus(req, res, next);
        await Promise.race([responseDone, nextDone]);

        if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
            throw next.mock.calls[0][0];
        }

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ closedAt: expect.any(Date) }),
            }),
        );
        expect(mockActivityCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: expect.stringContaining('Submitted against the wrong asset by mistake'),
                }),
            }),
        );
    });
});