const mockPrisma: any = {
  request: { findUnique: jest.fn() },
  user: { findFirst: jest.fn() },
  requestApproval: { updateMany: jest.fn() },
  requestActivity: { create: jest.fn() },
};
const mockTransitionHttpRequest = jest.fn();
const mockAuditLog = jest.fn();
const mockNotify = jest.fn();

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../utils/httpRequestTransition', () => ({ transitionHttpRequest: mockTransitionHttpRequest }));
jest.mock('../utils/audit', () => ({ auditLog: mockAuditLog }));
jest.mock('../services/notification.service', () => ({ notify: mockNotify }));
jest.mock('../services/entityRouting.service', () => ({ allEntityApprovalsResolved: jest.fn() }));
jest.mock('../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));

import { AppError } from '../middleware/error.middleware';
import { managerDecision } from '../controllers/approval.controller';

const REQUEST_ID = '00000000-0000-0000-0000-000000000013';
const MANAGER_ID = '00000000-0000-0000-0000-000000000014';
const CANDIDATE_ID = '00000000-0000-0000-0000-000000000015';
const APPROVAL_ID = '00000000-0000-0000-0000-000000000016';

function makeResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeRequest(approvalStatus = 'PENDING') {
  return {
    id: REQUEST_ID,
    tenantId: 'tenant-1',
    referenceNumber: 'HR-00013',
    status: 'PENDING_MANAGER_REVIEW',
    requesterId: MANAGER_ID,
    requestType: { code: 'NEW_HIRING' },
    customFields: {},
    candidates: [{ id: CANDIDATE_ID, fullName: 'sam1' }],
    approvals: [{ id: APPROVAL_ID, approverType: 'HIRING_MANAGER', approverId: MANAGER_ID, status: approvalStatus, comments: null }],
  };
}

function makeExpressRequest(decision = 'APPROVED') {
  return {
    params: { id: REQUEST_ID },
    body: { decision, selectedCandidateIds: [CANDIDATE_ID], comments: 'Select for interview' },
    user: { id: MANAGER_ID, firstName: 'John', lastName: 'Doe', roles: ['HIRING_MANAGER'], tenantId: 'tenant-1' },
  } as any;
}

describe('managerDecision atomic workflow command', () => {
  const tx = {
    requestApproval: { updateMany: jest.fn() },
    requestActivity: { create: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.requestApproval.updateMany.mockResolvedValue({ count: 1 });
    tx.requestActivity.create.mockResolvedValue({ id: 'activity-1' });
    mockPrisma.request.findUnique.mockResolvedValue(makeRequest());
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'hr-agent-1', firstName: 'HR', lastName: 'Agent' });
    mockTransitionHttpRequest.mockImplementation(async (input: any) => {
      await input.transactionMutations(tx);
      return { id: REQUEST_ID, status: 'MANAGER_APPROVED' };
    });
    mockAuditLog.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
  });

  it('updates the pending approval and selected candidates inside the same transition command', async () => {
    const res = makeResponse();
    await managerDecision(makeExpressRequest(), res);

    const command = mockTransitionHttpRequest.mock.calls[0][0];
    expect(command.toStatus).toBe('MANAGER_APPROVED');
    expect(command.requestPatch).toEqual(expect.objectContaining({
      assignedToId: 'hr-agent-1',
      assignedTeam: 'HR',
      customFields: expect.objectContaining({ selectedCandidateIds: [CANDIDATE_ID] }),
    }));
    expect(command.transactionMutations).toEqual(expect.any(Function));
    expect(tx.requestApproval.updateMany).toHaveBeenCalledWith({
      where: { id: APPROVAL_ID, approverId: MANAGER_ID, status: 'PENDING' },
      data: { status: 'APPROVED', approverId: MANAGER_ID, comments: 'Select for interview' },
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('allows the same manager to resume a partial approval when the request is still pending', async () => {
    mockPrisma.request.findUnique.mockResolvedValue(makeRequest('APPROVED'));
    const res = makeResponse();

    await managerDecision(makeExpressRequest(), res);

    expect(tx.requestApproval.updateMany).toHaveBeenCalledWith({
      where: { id: APPROVAL_ID, approverId: MANAGER_ID, status: 'APPROVED' },
      data: { status: 'APPROVED', approverId: MANAGER_ID, comments: 'Select for interview' },
    });
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  it('does not mutate approval or assignment when the workflow transition is rejected', async () => {
    mockTransitionHttpRequest.mockRejectedValue(new AppError('Transition denied', 403));
    const res = makeResponse();

    await managerDecision(makeExpressRequest(), res);

    expect(mockPrisma.requestApproval.updateMany).not.toHaveBeenCalled();
    expect(tx.requestApproval.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
