import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findRequest = jest.fn();
const findUser = jest.fn();
const findHrAgent = jest.fn();
const findApprovals = jest.fn();
const createApproval = jest.fn();
const updateApprovals = jest.fn();
const createActivity = jest.fn();
const transition = jest.fn();
const notify = jest.fn();
const auditLog = jest.fn();

jest.mock('../utils/prisma', () => ({ __esModule: true, default: {
  request: { findUnique: findRequest },
  user: { findFirst: findHrAgent, findUnique: findUser },
  requestApproval: { findMany: findApprovals, create: createApproval, updateMany: updateApprovals },
  requestActivity: { create: createActivity },
} }));
jest.mock('../utils/httpRequestTransition', () => ({ transitionHttpRequest: transition }));
jest.mock('../services/notification.service', () => ({ notify }));
jest.mock('../utils/audit', () => ({ auditLog }));
jest.mock('../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));
jest.mock('../services/entityRouting.service', () => ({ allEntityApprovalsResolved: jest.fn() }));

import { routeToCEO, routeToGroupDceoHr, ceoDecision, groupDceoDecisionHr } from '../controllers/approval.controller';
import { AppError } from '../middleware/error.middleware';

const id = '00000000-0000-0000-0000-000000000001';
const executive = '00000000-0000-0000-0000-000000000002';
const hr = '00000000-0000-0000-0000-000000000003';
const tenant = '00000000-0000-0000-0000-000000000004';
const base = { id, tenantId: tenant, requesterId: 'requester', referenceNumber: 'HR-TEST', status: 'SUBMITTED', executiveApproverId: executive, executiveApproverRole: 'CEO', requestType: { code: 'NEW_HIRING' }, serviceDesk: { code: 'HR' } };
const tx = { requestApproval: { findMany: findApprovals, create: createApproval, updateMany: updateApprovals }, requestActivity: { create: createActivity }, request: { findFirst: findRequest } };
const response = () => { const res: any = {}; res.status = jest.fn(() => res); res.json = jest.fn(() => res); return res; };
const request = (body: object, actor = hr) => ({ params: { id }, body, user: { id: actor, roles: ['AGENT'], agentTeam: 'HR', tenantId: tenant, firstName: 'Test', lastName: 'User' }, get: () => undefined });

beforeEach(() => {
  jest.clearAllMocks();
  findRequest.mockResolvedValue(base as never);
  findUser.mockResolvedValue({ id: executive, tenantId: tenant, isActive: true, executiveRole: 'CEO', roles: [] } as never);
  findHrAgent.mockResolvedValue({ id: hr, firstName: 'HR', lastName: 'Agent' } as never);
  findApprovals.mockResolvedValue([] as never);
  createApproval.mockResolvedValue({ id: 'approval', status: 'PENDING' } as never);
  updateApprovals.mockResolvedValue({ count: 1 } as never);
  transition.mockResolvedValue({ id, status: 'PENDING_CEO_APPROVAL' } as never);
});

describe('HR one-of-two routing', () => {
  it('fails closed without a persisted choice', async () => {
    findRequest.mockResolvedValue({ ...base, executiveApproverId: null } as never);
    const res = response(); await routeToCEO(request({ ceoId: executive }) as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(transition).not.toHaveBeenCalled();
  });
  it('rejects a different named approver or a wrong role', async () => {
    const res = response(); await routeToCEO(request({ ceoId: hr }) as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    findRequest.mockResolvedValue({ ...base, executiveApproverRole: 'GROUP_DCEO' } as never);
    await routeToCEO(request({ ceoId: executive }) as any, response());
    expect(transition).not.toHaveBeenCalled();
  });
  it('rejects inactive, cross-tenant, wrong-role and self targets', async () => {
    for (const target of [
      { isActive: false, tenantId: tenant, executiveRole: 'CEO' },
      { isActive: true, tenantId: 'other', executiveRole: 'CEO' },
      { isActive: true, tenantId: tenant, executiveRole: 'CFO' },
    ]) {
      findHrAgent.mockImplementation(async ({ where }: any) => where.id &&
        (target.isActive === false || target.tenantId !== tenant || target.executiveRole !== 'CEO') ? null : { id: hr });
      const res = response(); await routeToCEO(request({ ceoId: executive }) as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    findRequest.mockResolvedValue({ ...base, requesterId: executive } as never);
    const res = response(); await routeToCEO(request({ ceoId: executive }) as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(transition).not.toHaveBeenCalled();
  });
  it('routes a CEO with approval creation inside transition only', async () => {
    const res = response(); await routeToCEO(request({ ceoId: executive }) as any, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledTimes(1);
    const input: any = transition.mock.calls[0][0];
    expect(input.toStatus).toBe('PENDING_CEO_APPROVAL');
    expect(input.requestPatch).toMatchObject({ assignedToId: executive });
    expect(createApproval).not.toHaveBeenCalled();
    await input.transactionMutations(tx);
    expect(createApproval).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approverId: executive, approverType: 'CEO' }) }));
  });
  it('routes Group DCEO directly from SUBMITTED with no fallback target', async () => {
    findRequest.mockResolvedValue({ ...base, executiveApproverRole: 'GROUP_DCEO' } as never);
    findUser.mockResolvedValue({ id: executive, isActive: true, tenantId: tenant, executiveRole: 'GROUP_DCEO', roles: [] } as never);
    const res = response(); await routeToGroupDceoHr(request({ groupDceoId: executive }) as any, res);
    expect(res.status).not.toHaveBeenCalled();
    expect((transition.mock.calls[0][0] as any).toStatus).toBe('PENDING_GROUP_DCEO_APPROVAL');
    await (transition.mock.calls[0][0] as any).transactionMutations(tx);
    expect(createApproval).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approverType: 'GROUP_DCEO', approverId: executive }) }));
  });
  it('does not write approval or notify when the transition fails', async () => {
    transition.mockRejectedValue(new AppError('Invalid status transition', 422) as never);
    const res = response(); await routeToCEO(request({ ceoId: executive }) as any, res);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(createApproval).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe.each([
  ['CEO', ceoDecision, 'PENDING_CEO_APPROVAL', 'CEO_APPROVED'],
  ['GROUP_DCEO', groupDceoDecisionHr, 'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED'],
] as const)('%s decision', (role, handler, pending, approved) => {
  it('approves once, updates the pending row in transaction and reassigns HR', async () => {
    findRequest.mockResolvedValue({ ...base, status: pending, executiveApproverRole: role, approvals: [{ id: 'approval', approverId: executive, status: 'PENDING' }] } as never);
    findUser.mockResolvedValue({ id: executive, isActive: true, tenantId: tenant, executiveRole: role, roles: [] } as never);
    const res = response(); await handler(request({ decision: 'APPROVED' }, executive) as any, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledTimes(1);
    const input: any = transition.mock.calls[0][0];
    expect(input.toStatus).toBe(approved);
    expect(input.requestPatch).toMatchObject({ assignedToId: hr, assignedTeam: 'HR' });
    expect(updateApprovals).not.toHaveBeenCalled();
    await input.transactionMutations(tx);
    expect(updateApprovals).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'approval', status: 'PENDING' }), data: expect.objectContaining({ status: 'APPROVED' }) }));
    expect(createApproval).not.toHaveBeenCalled();
  });
  it('rejects a different selected person even when the pending row names them', async () => {
    findRequest.mockResolvedValue({ ...base, status: pending, executiveApproverRole: role, approvals: [{ id: 'approval', approverId: hr, status: 'PENDING' }] } as never);
    const res = response(); await handler(request({ decision: 'APPROVED' }, hr) as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(transition).not.toHaveBeenCalled();
  });
});
