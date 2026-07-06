import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
    request: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
    },
    requestApproval: {
        update: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
    },
    requestActivity: {
        create: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },
}));

vi.mock('../utils/prisma', () => ({ default: mockPrisma }));
vi.mock('../utils/audit', () => ({ auditLog: vi.fn() }));
vi.mock('../services/notification.service', () => ({ notify: vi.fn() }));
vi.mock('../services/entityRouting.service', () => ({ allEntityApprovalsResolved: vi.fn() }));
vi.mock('../services/reassign.service', () => ({ reassignToTeam: vi.fn() }));
vi.mock('../services/sla-pause.service', () => ({ pauseSla: vi.fn(), resumeSla: vi.fn() }));

import { ceoDecision, groupDceoDecisionHr, assertDesignatedApprover } from '../controllers/approval.controller';

// Use UUID-format IDs so resolveRequestId passes them through without calling findFirst
const CEO_USER_ID = '00000000-0000-0000-0000-000000000001';
const IMPOSTOR_USER_ID = '00000000-0000-0000-0000-000000000002';
const DCEO_USER_ID = '00000000-0000-0000-0000-000000000003';
const REQ_ID = '00000000-0000-0000-0000-000000000010';
const REQ_ID_2 = '00000000-0000-0000-0000-000000000011';

function makeRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

describe('assertDesignatedApprover', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows when caller matches the approval approverId', async () => {
        const result = await assertDesignatedApprover(CEO_USER_ID, { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('rejects a caller who is not the approver, not an admin, and not the matching executive role', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: IMPOSTOR_USER_ID,
            executiveRole: null,
            roles: [{ role: { name: 'NORMAL_STAFF' } }],
        });
        const result = await assertDesignatedApprover(IMPOSTOR_USER_ID, { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(false);
    });

    it('allows an ADMIN even if not the designated approver', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 'admin-user',
            executiveRole: null,
            roles: [{ role: { name: 'ADMIN' } }],
        });
        const result = await assertDesignatedApprover('admin-user', { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('allows a user with the matching executiveRole when the approval has no assigned approverId (role-based routing)', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 'ceo-role-user',
            executiveRole: 'CEO',
            roles: [],
        });
        const result = await assertDesignatedApprover('ceo-role-user', { approverId: null }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('rejects a user with a different executiveRole when the approval has no assigned approverId', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 'cfo-user',
            executiveRole: 'CFO',
            roles: [],
        });
        const result = await assertDesignatedApprover('cfo-user', { approverId: null }, 'CEO');
        expect(result.ok).toBe(false);
    });
});

describe('ceoDecision authorization', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 403 when the caller is not the designated CEO approver', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID,
            status: 'PENDING_CEO_APPROVAL',
            requesterId: 'requester-1',
            requester: {},
            approvals: [{ id: 'appr-1', approverId: CEO_USER_ID, approverType: 'CEO', status: 'PENDING' }],
        });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: IMPOSTOR_USER_ID,
            executiveRole: null,
            roles: [],
        });

        const req: any = {
            params: { id: REQ_ID },
            body: { decision: 'REJECTED', comments: 'nope' },
            user: { id: IMPOSTOR_USER_ID },
        };
        const res = makeRes();

        await ceoDecision(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(mockPrisma.requestApproval.update).not.toHaveBeenCalled();
        expect(mockPrisma.request.update).not.toHaveBeenCalled();
    });

    it('allows the designated CEO approver to reject', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID,
            referenceNumber: 'HR-1',
            status: 'PENDING_CEO_APPROVAL',
            requesterId: 'requester-1',
            requester: {},
            approvals: [{ id: 'appr-1', approverId: CEO_USER_ID, approverType: 'CEO', status: 'PENDING' }],
        });
        mockPrisma.requestApproval.update.mockResolvedValue({ id: 'appr-1', status: 'REJECTED' });
        mockPrisma.request.update.mockResolvedValue({ id: REQ_ID, status: 'CEO_REJECTED' });

        const req: any = {
            params: { id: REQ_ID },
            body: { decision: 'REJECTED', comments: 'not aligned with budget' },
            user: { id: CEO_USER_ID, firstName: 'C', lastName: 'EO' },
        };
        const res = makeRes();

        await ceoDecision(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(mockPrisma.requestApproval.update).toHaveBeenCalled();
        expect(mockPrisma.request.update).toHaveBeenCalled();
    });
});

describe('groupDceoDecisionHr authorization', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 403 when the caller is not the designated Group Deputy CEO approver', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID_2,
            referenceNumber: 'HR-2',
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            requesterId: 'requester-1',
            approvals: [{ id: 'appr-2', approverId: DCEO_USER_ID, approverType: 'GROUP_DCEO', status: 'PENDING' }],
        });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: IMPOSTOR_USER_ID,
            executiveRole: null,
            roles: [],
        });

        const req: any = {
            params: { id: REQ_ID_2 },
            body: { decision: 'REJECTED', comments: 'nope' },
            user: { id: IMPOSTOR_USER_ID },
        };
        const res = makeRes();

        await groupDceoDecisionHr(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(mockPrisma.requestApproval.update).not.toHaveBeenCalled();
        expect(mockPrisma.request.update).not.toHaveBeenCalled();
    });

    it('allows the designated Group Deputy CEO approver to reject', async () => {
        mockPrisma.request.findUnique.mockResolvedValue({
            id: REQ_ID_2,
            referenceNumber: 'HR-2',
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            requesterId: 'requester-1',
            approvals: [{ id: 'appr-2', approverId: DCEO_USER_ID, approverType: 'GROUP_DCEO', status: 'PENDING' }],
        });
        mockPrisma.request.update.mockResolvedValue({ id: REQ_ID_2, status: 'GROUP_DCEO_REJECTED' });
        mockPrisma.requestApproval.update.mockResolvedValue({ id: 'appr-2', status: 'REJECTED' });

        const req: any = {
            params: { id: REQ_ID_2 },
            body: { decision: 'REJECTED', comments: 'final rejection' },
            user: { id: DCEO_USER_ID, firstName: 'D', lastName: 'CEO' },
        };
        const res = makeRes();

        await groupDceoDecisionHr(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(mockPrisma.request.update).toHaveBeenCalled();
    });
});