import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockApprovalUpdate = jest.fn();
const mockApprovalCreate = jest.fn();
const mockApprovalFindUnique = jest.fn();
const mockActivityCreate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: {
            findUnique: mockFindUnique,
            findFirst: mockFindFirst,
            update: mockUpdate,
        },
        requestApproval: {
            update: mockApprovalUpdate,
            create: mockApprovalCreate,
            findUnique: mockApprovalFindUnique,
        },
        requestActivity: {
            create: mockActivityCreate,
        },
        user: {
            findUnique: mockUserFindUnique,
            findFirst: mockUserFindFirst,
        },
    },
}));
jest.mock('../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../services/notification.service', () => ({ notify: jest.fn() }));
jest.mock('../services/entityRouting.service', () => ({ allEntityApprovalsResolved: jest.fn() }));
jest.mock('../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));
jest.mock('../services/sla-pause.service', () => ({ pauseSla: jest.fn(), resumeSla: jest.fn() }));

import { ceoDecision, groupDceoDecisionHr, assertDesignatedApprover } from '../controllers/approval.controller';

// Use UUID-format IDs so resolveRequestId passes them through without calling findFirst
const CEO_USER_ID = '00000000-0000-0000-0000-000000000001';
const IMPOSTOR_USER_ID = '00000000-0000-0000-0000-000000000002';
const DCEO_USER_ID = '00000000-0000-0000-0000-000000000003';
const REQ_ID = '00000000-0000-0000-0000-000000000010';
const REQ_ID_2 = '00000000-0000-0000-0000-000000000011';

function makeRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('assertDesignatedApprover', () => {
    beforeEach(() => jest.clearAllMocks());

    it('allows when caller matches the approval approverId', async () => {
        const result = await assertDesignatedApprover(CEO_USER_ID, { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('rejects a caller who is not the approver, not an admin, and not the matching executive role', async () => {
        mockUserFindUnique.mockResolvedValue({
            id: IMPOSTOR_USER_ID,
            executiveRole: null,
            roles: [{ role: { name: 'NORMAL_STAFF' } }],
        });
        const result = await assertDesignatedApprover(IMPOSTOR_USER_ID, { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(false);
    });

    it('allows an ADMIN even if not the designated approver', async () => {
        mockUserFindUnique.mockResolvedValue({
            id: 'admin-user',
            executiveRole: null,
            roles: [{ role: { name: 'ADMIN' } }],
        });
        const result = await assertDesignatedApprover('admin-user', { approverId: CEO_USER_ID }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('allows a user with the matching executiveRole when the approval has no assigned approverId (role-based routing)', async () => {
        mockUserFindUnique.mockResolvedValue({
            id: 'ceo-role-user',
            executiveRole: 'CEO',
            roles: [],
        });
        const result = await assertDesignatedApprover('ceo-role-user', { approverId: null }, 'CEO');
        expect(result.ok).toBe(true);
    });

    it('rejects a user with a different executiveRole when the approval has no assigned approverId', async () => {
        mockUserFindUnique.mockResolvedValue({
            id: 'cfo-user',
            executiveRole: 'CFO',
            roles: [],
        });
        const result = await assertDesignatedApprover('cfo-user', { approverId: null }, 'CEO');
        expect(result.ok).toBe(false);
    });
});

describe('ceoDecision authorization', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 403 when the caller is not the designated CEO approver', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID,
            status: 'PENDING_CEO_APPROVAL',
            requesterId: 'requester-1',
            requester: {},
            approvals: [{ id: 'appr-1', approverId: CEO_USER_ID, approverType: 'CEO', status: 'PENDING' }],
        });
        mockUserFindUnique.mockResolvedValue({
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
        expect(mockApprovalUpdate).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('allows the designated CEO approver to reject', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID,
            referenceNumber: 'HR-1',
            status: 'PENDING_CEO_APPROVAL',
            requesterId: 'requester-1',
            requester: {},
            approvals: [{ id: 'appr-1', approverId: CEO_USER_ID, approverType: 'CEO', status: 'PENDING' }],
        });
        mockApprovalUpdate.mockResolvedValue({ id: 'appr-1', status: 'REJECTED' });
        mockUpdate.mockResolvedValue({ id: REQ_ID, status: 'CEO_REJECTED' });

        const req: any = {
            params: { id: REQ_ID },
            body: { decision: 'REJECTED', comments: 'not aligned with budget' },
            user: { id: CEO_USER_ID, firstName: 'C', lastName: 'EO' },
        };
        const res = makeRes();

        await ceoDecision(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(mockApprovalUpdate).toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalled();
    });
});

describe('groupDceoDecisionHr authorization', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 403 when the caller is not the designated Group Deputy CEO approver', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_2,
            referenceNumber: 'HR-2',
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            requesterId: 'requester-1',
            approvals: [{ id: 'appr-2', approverId: DCEO_USER_ID, approverType: 'GROUP_DCEO', status: 'PENDING' }],
        });
        mockUserFindUnique.mockResolvedValue({
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
        expect(mockApprovalUpdate).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('allows the designated Group Deputy CEO approver to reject', async () => {
        mockFindUnique.mockResolvedValue({
            id: REQ_ID_2,
            referenceNumber: 'HR-2',
            status: 'PENDING_GROUP_DCEO_APPROVAL',
            requesterId: 'requester-1',
            approvals: [{ id: 'appr-2', approverId: DCEO_USER_ID, approverType: 'GROUP_DCEO', status: 'PENDING' }],
        });
        mockUpdate.mockResolvedValue({ id: REQ_ID_2, status: 'GROUP_DCEO_REJECTED' });
        mockApprovalUpdate.mockResolvedValue({ id: 'appr-2', status: 'REJECTED' });

        const req: any = {
            params: { id: REQ_ID_2 },
            body: { decision: 'REJECTED', comments: 'final rejection' },
            user: { id: DCEO_USER_ID, firstName: 'D', lastName: 'CEO' },
        };
        const res = makeRes();

        await groupDceoDecisionHr(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(mockUpdate).toHaveBeenCalled();
    });
});