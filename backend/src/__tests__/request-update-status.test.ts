import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindUnique: any = jest.fn();
const mockFindFirstOrThrow: any = jest.fn();
const mockParticipantFindMany: any = jest.fn();
const mockWorkflowTransitionFindFirst: any = jest.fn();
const mockTransitionHttpRequest: any = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: {
            findUnique: mockFindUnique,
            findFirstOrThrow: mockFindFirstOrThrow,
        },
        requestParticipant: { findMany: mockParticipantFindMany },
        workflowTransition: { findFirst: mockWorkflowTransitionFindFirst },
    },
}));
jest.mock('../utils/httpRequestTransition', () => ({
    transitionHttpRequest: mockTransitionHttpRequest,
}));
jest.mock('../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../services/notification.service', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/sla-pause.service', () => ({
    pauseSla: jest.fn(),
    getEffectiveSlaDueAt: jest.fn(),
}));
jest.mock('../utils/workflowTransitions', () => ({
    isValidTransition: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/autoAssignment.service', () => ({
    autoAssignRequest: jest.fn().mockResolvedValue(undefined),
}));

import { requestController } from '../controllers/request.controller';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const REQUEST_ID = '00000000-0000-0000-0000-000000000003';

function makeRequest(status: string) {
    return {
        id: REQUEST_ID,
        tenantId: TENANT_ID,
        status,
        serviceDesk: { code: 'IT' },
        requesterId: 'requester-1',
        referenceNumber: 'IT-3',
    };
}

function responseHarness() {
    let resolveResponse!: () => void;
    let resolveNext!: (error?: unknown) => void;
    const responseDone = new Promise<void>((resolve) => { resolveResponse = resolve; });
    const nextDone = new Promise<unknown>((resolve) => { resolveNext = resolve; });
    const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation(() => resolveResponse()),
    };
    const next = jest.fn().mockImplementation((error?: unknown) => resolveNext(error));
    return { res, next, responseDone, nextDone };
}

async function invoke(status: string, comment?: string) {
    const harness = responseHarness();
    const req: any = {
        params: { id: REQUEST_ID },
        body: { status, ...(comment ? { comment } : {}) },
        user: { id: 'admin-1', roles: ['ADMIN'], tenantId: TENANT_ID },
    };
    requestController.updateStatus(req, harness.res, harness.next);
    await Promise.race([harness.responseDone, harness.nextDone]);
    return harness;
}

describe('updateStatus uses the workflow-command boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParticipantFindMany.mockResolvedValue([]);
        mockWorkflowTransitionFindFirst.mockResolvedValue(null);
        mockTransitionHttpRequest.mockResolvedValue(undefined);
    });

    it('stamps closedAt atomically for a terminal status', async () => {
        mockFindUnique.mockResolvedValue(makeRequest('PENDING_GROUP_DCEO_APPROVAL'));
        mockFindFirstOrThrow.mockResolvedValue(makeRequest('GROUP_DCEO_REJECTED'));

        const { next } = await invoke('GROUP_DCEO_REJECTED');
        expect(next).not.toHaveBeenCalled();
        expect(mockTransitionHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
            toStatus: 'GROUP_DCEO_REJECTED',
            requestPatch: expect.objectContaining({ closedAt: expect.any(Date) }),
        }));
    });

    it('does not stamp closedAt for a non-terminal status', async () => {
        mockFindUnique.mockResolvedValue(makeRequest('SUBMITTED'));
        mockFindFirstOrThrow.mockResolvedValue(makeRequest('IN_REVIEW'));

        await invoke('IN_REVIEW');
        const input = mockTransitionHttpRequest.mock.calls[0][0] as any;
        expect(input.requestPatch.closedAt).toBeUndefined();
    });

    it.each(['REJECTED', 'CANCELLED'])('requires a reason for %s', async (status) => {
        mockFindUnique.mockResolvedValue(makeRequest('SUBMITTED'));

        const { next } = await invoke(status);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/reason/i),
        }));
        expect(mockTransitionHttpRequest).not.toHaveBeenCalled();
    });

    it.each(['REJECTED', 'CANCELLED'])('passes the %s reason into the atomic command', async (status) => {
        mockFindUnique.mockResolvedValue(makeRequest('SUBMITTED'));
        mockFindFirstOrThrow.mockResolvedValue(makeRequest(status));

        const { next } = await invoke(status, 'Duplicate request');
        expect(next).not.toHaveBeenCalled();
        expect(mockTransitionHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
            toStatus: status,
            comment: 'Duplicate request',
            requestPatch: expect.objectContaining({ closedAt: expect.any(Date) }),
        }));
    });
});