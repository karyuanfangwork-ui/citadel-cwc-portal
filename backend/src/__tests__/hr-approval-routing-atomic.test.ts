import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRequestFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockApprovalCreate = jest.fn();
const mockApprovalUpdateMany = jest.fn();
const mockActivityCreate = jest.fn();
const mockTransition = jest.fn();

jest.mock('../utils/prisma', () => ({ __esModule: true, default: {
  request: { findUnique: mockRequestFindUnique },
  user: { findFirst: mockUserFindFirst },
  requestApproval: { create: mockApprovalCreate, updateMany: mockApprovalUpdateMany },
  requestActivity: { create: mockActivityCreate },
} }));
jest.mock('../utils/httpRequestTransition', () => ({ transitionHttpRequest: mockTransition }));
jest.mock('../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../services/notification.service', () => ({ notify: jest.fn() }));
jest.mock('../services/entityRouting.service', () => ({ allEntityApprovalsResolved: jest.fn() }));
jest.mock('../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));

import { routeToCEO, routeToGroupDceoHr, ceoDecision, groupDceoDecisionHr } from '../controllers/approval.controller';
import { AppError } from '../middleware/error.middleware';

const requestId = '00000000-0000-4000-8000-000000000001';
const executiveId = '00000000-0000-4000-8000-000000000002';
const tenantId = '00000000-0000-4000-8000-000000000003';
const hrId = '00000000-0000-4000-8000-000000000004';
const requesterId = '00000000-0000-4000-8000-000000000005';
const base = { id: requestId, tenantId, referenceNumber: 'HR-test', requesterId, status: 'SUBMITTED',
  requestType: { code: 'NEW_HIRING' }, executiveApproverId: executiveId, executiveApproverRole: 'CEO' };
function response() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function call(handler: any, body: any, userId = hrId, overrides: Record<string, unknown> = {}) {
  const res = response();
  const req: any = { params: { id: requestId }, body,
    user: { id: userId, firstName: 'Test', lastName: 'User', roles: ['AGENT'], agentTeam: 'HR', tenantId, ...overrides }, get: () => undefined };
  return handler(req, res).then(() => res);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRequestFindUnique.mockResolvedValue(base);
  mockUserFindFirst.mockImplementation(async ({ where }: any) => where.id === executiveId
    ? { id: executiveId, firstName: 'Chosen', lastName: 'Executive' }
    : { id: hrId, firstName: 'HR', lastName: 'Agent' });
  mockApprovalCreate.mockResolvedValue({ id: 'approval-1', status: 'PENDING' });
  mockApprovalUpdateMany.mockResolvedValue({ count: 1 });
  mockTransition.mockResolvedValue({ id: requestId });
});

describe('HR executive one-of-two route', () => {
  it.each([['CEO', routeToCEO, 'ceoId', 'PENDING_CEO_APPROVAL'], ['GROUP_DCEO', routeToGroupDceoHr, 'groupDceoId', 'PENDING_GROUP_DCEO_APPROVAL']] as const)(
    'routes saved %s exactly once inside the transition transaction', async (role, handler, field, status) => {
      mockRequestFindUnique.mockResolvedValue({ ...base, executiveApproverRole: role });
      const res = await call(handler, { [field]: executiveId });
      expect(res.status).not.toHaveBeenCalled();
      expect(mockTransition).toHaveBeenCalledWith(expect.objectContaining({ toStatus: status,
        requestPatch: expect.objectContaining({ assignedToId: executiveId }), transactionMutations: expect.any(Function) }));
      expect(mockApprovalCreate).not.toHaveBeenCalled();
      const options = mockTransition.mock.calls[0][0] as any;
      await options.transactionMutations({ requestApproval: { create: mockApprovalCreate }, requestActivity: { create: mockActivityCreate } });
      expect(mockApprovalCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approverId: executiveId, approverType: role, status: 'PENDING' }) }));
    });
  it('rejects missing, conflicting, inactive or cross-tenant target', async () => {
    mockRequestFindUnique.mockResolvedValue({ ...base, executiveApproverId: null });
    expect((await call(routeToCEO, { ceoId: executiveId })).status).toHaveBeenCalledWith(409);
    mockRequestFindUnique.mockResolvedValue(base);
    expect((await call(routeToGroupDceoHr, { groupDceoId: executiveId })).status).toHaveBeenCalledWith(409);
    expect((await call(routeToCEO, { ceoId: hrId })).status).toHaveBeenCalledWith(409);
    mockUserFindFirst.mockResolvedValue(null);
    expect((await call(routeToCEO, { ceoId: executiveId })).status).toHaveBeenCalledWith(400);
    expect(mockTransition).not.toHaveBeenCalled();
  });
  it('rejects another desk, unprivileged actor and cross-tenant agent', async () => {
    expect((await call(routeToCEO, {}, hrId, { agentTeam: 'IT' })).status).toHaveBeenCalledWith(403);
    expect((await call(routeToCEO, {}, hrId, { roles: ['NORMAL_STAFF'] })).status).toHaveBeenCalledWith(403);
    expect((await call(routeToCEO, {}, hrId, { tenantId: 'other-tenant' })).status).toHaveBeenCalledWith(404);
    expect(mockTransition).not.toHaveBeenCalled();
  });
  it('does not create approval if transition fails and preserves AppError status', async () => {
    mockTransition.mockRejectedValue(new AppError('Workflow edge unavailable', 422));
    expect((await call(routeToCEO, { ceoId: executiveId })).status).toHaveBeenCalledWith(422);
    expect(mockApprovalCreate).not.toHaveBeenCalled();
  });
});

describe('HR executive decision', () => {
  it.each([['CEO', ceoDecision, 'PENDING_CEO_APPROVAL', 'CEO_APPROVED'], ['GROUP_DCEO', groupDceoDecisionHr, 'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED']] as const)(
    '%s approves once and atomically resolves approval and returns assignment to HR', async (role, handler, pending, approved) => {
      mockRequestFindUnique.mockResolvedValue({ ...base, executiveApproverRole: role, status: pending,
        approvals: [{ id: 'approval-1', approverId: executiveId, status: 'PENDING' }] });
      const res = await call(handler, { decision: 'APPROVED', comments: 'ok' }, executiveId);
      expect(res.status).not.toHaveBeenCalled();
      expect(mockTransition).toHaveBeenCalledTimes(1);
      const options = mockTransition.mock.calls[0][0] as any;
      expect(options.toStatus).toBe(approved);
      expect(options.requestPatch).toEqual(expect.objectContaining({ assignedToId: hrId, assignedTeam: 'HR' }));
      expect(mockApprovalUpdateMany).not.toHaveBeenCalled();
      await options.transactionMutations({ requestApproval: { updateMany: mockApprovalUpdateMany }, requestActivity: { create: mockActivityCreate }, request: { update: jest.fn() } });
      expect(mockApprovalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'approval-1', status: 'PENDING', approverId: executiveId }), data: expect.objectContaining({ status: 'APPROVED' }) }));
      expect(mockApprovalCreate).not.toHaveBeenCalled();
    });
  it.each([['CEO', ceoDecision, 'PENDING_CEO_APPROVAL', 'CEO_REJECTED'], ['GROUP_DCEO', groupDceoDecisionHr, 'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_REJECTED']] as const)(
    '%s rejection resolves only its pending approval', async (role, handler, pending, rejected) => {
      mockRequestFindUnique.mockResolvedValue({ ...base, executiveApproverRole: role, status: pending,
        approvals: [{ id: 'approval-1', approverId: executiveId, status: 'PENDING' }] });
      await call(handler, { decision: 'REJECTED', comments: 'reason' }, executiveId);
      const options = mockTransition.mock.calls[0][0] as any;
      expect(options.toStatus).toBe(rejected);
      await options.transactionMutations({ requestApproval: { updateMany: mockApprovalUpdateMany }, requestActivity: { create: mockActivityCreate }, request: { update: jest.fn() } });
      expect(mockApprovalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }));
    });
  it('rejects the other executive, cross-tenant actor and missing pending approval', async () => {
    mockRequestFindUnique.mockResolvedValue({ ...base, status: 'PENDING_CEO_APPROVAL', approvals: [{ id: 'approval-1', approverId: executiveId, status: 'PENDING' }] });
    expect((await call(ceoDecision, { decision: 'APPROVED' }, hrId)).status).toHaveBeenCalledWith(403);
    expect((await call(ceoDecision, { decision: 'APPROVED' }, executiveId, { tenantId: 'other-tenant' })).status).toHaveBeenCalledWith(404);
    mockRequestFindUnique.mockResolvedValue({ ...base, status: 'PENDING_CEO_APPROVAL', approvals: [] });
    expect((await call(ceoDecision, { decision: 'APPROVED' }, executiveId)).status).toHaveBeenCalledWith(409);
    expect(mockTransition).not.toHaveBeenCalled();
  });
  it('duplicate claim aborts transaction and failed transition does not resolve approval', async () => {
    mockRequestFindUnique.mockResolvedValue({ ...base, status: 'PENDING_CEO_APPROVAL', approvals: [{ id: 'approval-1', approverId: executiveId, status: 'PENDING' }] });
    await call(ceoDecision, { decision: 'REJECTED', comments: 'reason' }, executiveId);
    const options = mockTransition.mock.calls[0][0] as any;
    mockApprovalUpdateMany.mockResolvedValue({ count: 0 });
    await expect(options.transactionMutations({ requestApproval: { updateMany: mockApprovalUpdateMany }, requestActivity: { create: mockActivityCreate } })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockActivityCreate).not.toHaveBeenCalled();
    jest.clearAllMocks();
    mockRequestFindUnique.mockResolvedValue({ ...base, status: 'PENDING_CEO_APPROVAL', approvals: [{ id: 'approval-1', approverId: executiveId, status: 'PENDING' }] });
    mockUserFindFirst.mockResolvedValue({ id: hrId });
    mockTransition.mockRejectedValue(new Error('rollback'));
    expect((await call(ceoDecision, { decision: 'APPROVED' }, executiveId)).status).toHaveBeenCalledWith(500);
    expect(mockApprovalUpdateMany).not.toHaveBeenCalled();
  });
});
