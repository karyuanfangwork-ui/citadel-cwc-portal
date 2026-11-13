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
jest.mock('../services/onboarding.service', () => ({ createOnboardingFromHiring: jest.fn().mockResolvedValue(null) }));

import { AppError } from '../middleware/error.middleware';
import { markLOAAccepted } from '../controllers/loa.controller';

function makeResponse() {
  const response: any = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}

const req: any = {
  params: { id: 'HR-00011' },
  body: { notes: 'Signed LOA confirmed' },
  user: { id: 'hr-agent-id', firstName: 'Sasha', lastName: 'Nair' },
};

function makeAcceptedRequest() {
  return {
    id: 'request-id',
    tenantId: 'tenant-id',
    status: 'LOA_ACCEPTED',
    letterOfAcceptance: { id: 'loa-id', signedLoaFileUrl: 'cwc/signed.pdf' },
  };
}

describe('markLOAAccepted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveRequestId.mockResolvedValue('request-id');
    mockPrisma.request.findUnique.mockResolvedValue(makeAcceptedRequest());
    mockPrisma.requestActivity.create.mockResolvedValue({ id: 'activity-id' });
  });

  it('writes acceptedDate in the same transaction as completion', async () => {
    const txUpdate = jest.fn().mockResolvedValue({ id: 'loa-id', acceptedDate: new Date() });
    mockTransitionHttpRequest.mockImplementation(async ({ transactionMutations }: any) => {
      expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
      await transactionMutations({ letterOfAcceptance: { update: txUpdate } }, {});
      return { id: 'request-id', status: 'COMPLETED' };
    });
    const response = makeResponse();

    await markLOAAccepted(req, response);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 'loa-id' },
      data: { acceptedDate: expect.any(Date) },
    });
    expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('preserves AppError status and does not write acceptedDate on a rejected transition', async () => {
    mockTransitionHttpRequest.mockRejectedValue(new AppError('Transition guard blocked', 403));
    const response = makeResponse();

    await markLOAAccepted(req, response);

    expect(mockPrisma.letterOfAcceptance.update).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ status: 'error', message: 'Transition guard blocked' });
  });
});
