const mockPrisma: any = {
  request: { findUnique: jest.fn() },
  requestActivity: { create: jest.fn() },
  letterOfAcceptance: { update: jest.fn() },
};
const mockResolveRequestId = jest.fn();
const mockTransitionHttpRequest = jest.fn();

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../utils/resolve', () => ({ resolveRequestId: mockResolveRequestId }));
jest.mock('../utils/httpRequestTransition', () => ({ transitionHttpRequest: mockTransitionHttpRequest }));
jest.mock('../services/onboarding.service', () => ({ createOnboardingFromHiring: jest.fn() }));

import { AppError } from '../middleware/error.middleware';
import { managerApproveLOA, markLOAIssued } from '../controllers/loa.controller';

function makeResponse() {
  const response: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function makeRequest() {
  return {
    params: { id: 'HR-00011' },
    body: { notes: 'Approved LOA sent to candidate' },
    user: { id: 'hr-agent-id', firstName: 'Sasha', lastName: 'Nair' },
  } as any;
}

function makeApprovedRequest() {
  return {
    id: 'request-id',
    tenantId: 'tenant-id',
    status: 'LOA_APPROVED',
    letterOfAcceptance: { id: 'loa-id', approvedBy: 'manager-id' },
  };
}

describe('markLOAIssued', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveRequestId.mockResolvedValue('request-id');
    mockPrisma.request.findUnique.mockResolvedValue(makeApprovedRequest());
    mockPrisma.requestActivity.create.mockResolvedValue({ id: 'activity-id' });
  });

  it('writes issuedDate in the same transition transaction', async () => {
    const txUpdate = jest.fn().mockResolvedValue({ id: 'loa-id', issuedDate: new Date() });
    mockTransitionHttpRequest.mockImplementation(async ({ transactionMutations }: any) => {
      expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
      await transactionMutations({ letterOfAcceptance: { update: txUpdate } }, {});
      return { id: 'request-id', status: 'LOA_ISSUED' };
    });
    const response = makeResponse();

    await markLOAIssued(makeRequest(), response);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 'loa-id' },
      data: { issuedDate: expect.any(Date) },
    });
    expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('preserves AppError status and makes no LOA write when the transition is rejected', async () => {
    mockTransitionHttpRequest.mockRejectedValue(new AppError('Transition guard blocked', 403));
    const response = makeResponse();

    await markLOAIssued(makeRequest(), response);

    expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ status: 'error', message: 'Transition guard blocked' });
  });
});

describe('managerApproveLOA', () => {
  const managerId = 'manager-user-id';
  const requestId = 'request-id';
  const loaId = 'loa-id';
  const txUpdate = jest.fn();
  const txActivityCreate = jest.fn();
  const tx = {
    letterOfAcceptance: { update: txUpdate },
    requestActivity: { create: txActivityCreate },
  };

  function makePendingLOARequest(requesterId = managerId) {
    return {
      id: requestId,
      tenantId: 'tenant-id',
      status: 'LOA_PENDING_APPROVAL',
      requesterId,
      referenceNumber: 'HR-00013',
      letterOfAcceptance: { id: loaId, approvedBy: null },
    };
  }

  function makeManagerRequest(userId = managerId, roles = ['NORMAL_STAFF', 'HIRING_MANAGER'], decision = 'APPROVE') {
    return {
      params: { id: 'HR-00013' },
      body: { decision, comments: 'Approved for issue' },
      user: { id: userId, firstName: 'John', lastName: 'Doe', roles },
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveRequestId.mockResolvedValue(requestId);
    mockPrisma.request.findUnique.mockResolvedValue(makePendingLOARequest());
    txUpdate.mockResolvedValue({ id: loaId, approvedBy: managerId });
    txActivityCreate.mockResolvedValue({ id: 'activity-id' });
  });

  it('writes LOA approval and activity inside the status-transition transaction', async () => {
    mockTransitionHttpRequest.mockImplementation(async ({ transactionMutations, toStatus }: any) => {
      await transactionMutations(tx, {});
      return { id: requestId, status: toStatus };
    });
    const response = makeResponse();

    await managerApproveLOA(makeManagerRequest(), response);

    expect(mockTransitionHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      toStatus: 'LOA_APPROVED',
      source: 'loa.manager-decision',
      transactionMutations: expect.any(Function),
    }));
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: loaId },
      data: { approvedBy: managerId, approvalDate: expect.any(Date), approvalComments: 'Approved for issue' },
    });
    expect(txActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
    expect(mockPrisma.requestActivity.create).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('rejects an HR agent before attempting a manager decision', async () => {
    const response = makeResponse();
    await managerApproveLOA(makeManagerRequest('hr-agent-id', ['AGENT']), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(mockTransitionHttpRequest).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('rejects a different hiring manager who is not the requester', async () => {
    mockPrisma.request.findUnique.mockResolvedValue(makePendingLOARequest('john-user-id'));
    const response = makeResponse();
    await managerApproveLOA(makeManagerRequest('other-manager-id'), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(mockTransitionHttpRequest).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it('preserves transition authorization errors without writing LOA approval data', async () => {
    mockTransitionHttpRequest.mockRejectedValue(new AppError('Hiring manager role is not allowed for this edge', 403));
    const response = makeResponse();
    await managerApproveLOA(makeManagerRequest(), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Hiring manager role is not allowed for this edge',
    });
    expect(txUpdate).not.toHaveBeenCalled();
    expect(txActivityCreate).not.toHaveBeenCalled();
  });
});
