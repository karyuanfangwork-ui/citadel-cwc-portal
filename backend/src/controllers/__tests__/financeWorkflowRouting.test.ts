const mockTransitionRequest = jest.fn();
const mockGetTransitionMeta = jest.fn();
const mockPrisma = {
  request: { findUnique: jest.fn() },
  requestApproval: { findFirst: jest.fn(), create: jest.fn() },
  user: { findFirst: jest.fn() },
  requestType: { findFirst: jest.fn() },
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../utils/workflowTransitions', () => ({ getTransitionMeta: mockGetTransitionMeta }));
jest.mock('../../services/requestTransition.service', () => ({ transitionRequest: mockTransitionRequest }));
jest.mock('../../services/notification.service', () => ({ notify: jest.fn() }));
jest.mock('../../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));
jest.mock('../../services/attachmentAccess.service', () => ({ registerUpload: jest.fn() }));
jest.mock('../../services/purchaseRequisitionApprovalShadow.service', () => ({ runPurchaseRequisitionApprovalShadow: jest.fn() }));
jest.mock('../../services/sla-pause.service', () => ({ pauseSla: jest.fn() }));

import { cfoDecision, routeToCfo } from '../finance-workflow.controller';

function makeRequest() {
  return {
    id: 'request-1',
    status: 'FINANCE_ACKNOWLEDGED',
    tenantId: 'tenant-1',
    requesterId: 'requester-1',
    requestTypeId: 'type-1',
    serviceDesk: { code: 'FINANCE' },
    requestType: { workflow: { id: 'workflow-finance' } },
  };
}

function makeReq() {
  return { params: { id: 'request-1' }, body: { notes: 'Route for approval' }, user: { id: 'agent-1', roles: ['AGENT'] } } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Finance route-to-CFO edge assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.request.findUnique.mockResolvedValue(makeRequest());
    mockPrisma.requestApproval.findFirst.mockResolvedValue(null);
    mockPrisma.requestApproval.create.mockResolvedValue({ id: 'approval-1' });
    mockPrisma.requestType.findFirst.mockResolvedValue({ code: 'BUDGET_PROPOSAL' });
    mockTransitionRequest.mockResolvedValue({ success: true });
    mockGetTransitionMeta.mockResolvedValue({
      transitionLabel: 'SUBMIT',
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: 'edge-cfo-1',
    });
  });

  it('uses the active CFO configured on the published edge', async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'edge-cfo-1' });

    await routeToCfo(makeReq(), makeRes());

    expect(mockTransitionRequest).toHaveBeenCalledWith(
      'request-1',
      'PENDING_CFO_APPROVAL_FIN',
      expect.objectContaining({ requestPatch: { assignedToId: 'edge-cfo-1' } }),
    );
    expect(mockPrisma.requestApproval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ approverId: 'edge-cfo-1', approverType: 'CFO', status: 'PENDING' }),
    });
  });

  it('falls back to the first active CFO when the edge target is invalid', async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'fallback-cfo-1' });

    await routeToCfo(makeReq(), makeRes());

    expect(mockTransitionRequest).toHaveBeenCalledWith(
      'request-1',
      'PENDING_CFO_APPROVAL_FIN',
      expect.objectContaining({ requestPatch: { assignedToId: 'fallback-cfo-1' } }),
    );
  });

  it('returns the transition policy status instead of converting it to HTTP 500', async () => {
    const policyError = { statusCode: 403, message: 'Transition requires one of: CFO' };
    mockTransitionRequest.mockRejectedValueOnce(policyError);
    const res = makeRes();

    await cfoDecision(
      { params: { id: 'request-1' }, body: { decision: 'APPROVED' }, user: { id: 'cfo-1', roles: ['NORMAL_STAFF'], executiveRole: 'CFO' } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: policyError.message });
  });
});
