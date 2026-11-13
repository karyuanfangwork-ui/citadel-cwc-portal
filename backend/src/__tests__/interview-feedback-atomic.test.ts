import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRequestFindUnique = jest.fn();
const mockFeedbackFindMany = jest.fn();
const mockFeedbackCreate = jest.fn();
const mockCandidateFindUnique = jest.fn();
const mockActivityCreate = jest.fn();
const mockTransaction = jest.fn();
const mockTransitionHttpRequest = jest.fn();
const txFeedbackCreate = jest.fn();
const txActivityCreate = jest.fn();

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    request: { findUnique: mockRequestFindUnique },
    interviewFeedback: { findMany: mockFeedbackFindMany, create: mockFeedbackCreate },
    candidate: { findUnique: mockCandidateFindUnique },
    requestActivity: { create: mockActivityCreate },
    $transaction: mockTransaction,
  },
}));
jest.mock('../utils/resolve', () => ({ resolveRequestId: jest.fn(async (id: string) => id) }));
jest.mock('../utils/httpRequestTransition', () => ({ transitionHttpRequest: mockTransitionHttpRequest }));

import { submitInterviewFeedback } from '../controllers/interview.controller';
import { AppError } from '../middleware/error.middleware';

const REQUEST_ID = '00000000-0000-4000-8000-000000000013';
const MANAGER_ID = '00000000-0000-4000-8000-000000000014';
const CANDIDATE_ID = '00000000-0000-4000-8000-000000000015';

const tx = {
  interviewFeedback: { create: txFeedbackCreate },
  requestActivity: { create: txActivityCreate },
};

function makeRequest(selectedCandidateIds = [CANDIDATE_ID]) {
  return {
    id: REQUEST_ID,
    tenantId: 'tenant-1',
    status: 'INTERVIEW_SCHEDULED',
    requesterId: MANAGER_ID,
    customFields: { selectedCandidateIds },
  };
}

function makeExpressRequest(roles = ['NORMAL_STAFF', 'HIRING_MANAGER']) {
  return {
    params: { id: REQUEST_ID },
    body: {
      candidateId: CANDIDATE_ID,
      decision: 'PROCEED',
      overallRating: 4,
      technicalSkills: 4,
      culturalFit: 4,
      communication: 4,
      feedback: 'Good interview; proceed.',
      concerns: '',
    },
    user: { id: MANAGER_ID, firstName: 'John', lastName: 'Doe', email: 'john.doe@test.local', roles },
    get: jest.fn().mockReturnValue(undefined),
    ip: '127.0.0.1',
  } as any;
}

function makeResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('submitInterviewFeedback workflow command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestFindUnique.mockResolvedValue(makeRequest() as never);
    mockFeedbackFindMany.mockResolvedValue([] as never);
    mockCandidateFindUnique.mockResolvedValue({ fullName: 'Candidate A' } as never);
    txFeedbackCreate.mockResolvedValue({ id: 'feedback-1', candidateId: CANDIDATE_ID } as never);
    txActivityCreate.mockResolvedValue({ id: 'activity-1' } as never);
    mockTransaction.mockImplementation(async (callback: any) => callback(tx));
    mockTransitionHttpRequest.mockImplementation(async (input: any) => {
      if (input.transactionMutations) await input.transactionMutations(tx, {});
      return { id: REQUEST_ID, status: input.toStatus };
    });
  });

  it('stores final feedback and its activity in the same HIRING_MANAGER status-transition command', async () => {
    const res = makeResponse();
    await submitInterviewFeedback(makeExpressRequest(), res);

    const command = mockTransitionHttpRequest.mock.calls[0][0] as any;
    expect(command.toStatus).toBe('INTERVIEW_FEEDBACK_PENDING');
    expect(command.source).toBe('interview.feedback');
    expect(command.transactionMutations).toEqual(expect.any(Function));
    expect(txFeedbackCreate).toHaveBeenCalledTimes(1);
    expect(txActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    expect(mockActivityCreate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      data: expect.objectContaining({ allFeedbackReceived: true }),
    }));
  });

  it('rejects a requester without the HIRING_MANAGER role before persisting feedback', async () => {
    const res = makeResponse();
    await submitInterviewFeedback(makeExpressRequest(['NORMAL_STAFF']), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockTransitionHttpRequest).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    expect(txFeedbackCreate).not.toHaveBeenCalled();
  });

  it('preserves transition authorization errors and writes no feedback when the command is rejected', async () => {
    mockTransitionHttpRequest.mockRejectedValue(new AppError('Hiring manager role is not allowed for this edge', 403) as never);
    const res = makeResponse();
    await submitInterviewFeedback(makeExpressRequest(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Hiring manager role is not allowed for this edge',
    });
    expect(txFeedbackCreate).not.toHaveBeenCalled();
    expect(txActivityCreate).not.toHaveBeenCalled();
  });

  it('resumes a same-manager partial feedback attempt without creating duplicate feedback', async () => {
    mockFeedbackFindMany.mockResolvedValue([{
      id: 'feedback-existing',
      candidateId: CANDIDATE_ID,
      decision: 'PROCEED',
      submittedBy: MANAGER_ID,
      feedback: 'Good interview; proceed.',
    }] as never);
    const res = makeResponse();
    await submitInterviewFeedback(makeExpressRequest(), res);

    expect(mockTransitionHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      toStatus: 'INTERVIEW_FEEDBACK_PENDING',
      source: 'interview.feedback',
    }));
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    expect(txFeedbackCreate).not.toHaveBeenCalled();
    expect(txActivityCreate).not.toHaveBeenCalled();
  });

  it('saves non-final candidate feedback and activity together without advancing early', async () => {
    mockRequestFindUnique.mockResolvedValue(makeRequest([CANDIDATE_ID, '00000000-0000-4000-8000-000000000016']) as never);
    const res = makeResponse();
    await submitInterviewFeedback(makeExpressRequest(), res);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txFeedbackCreate).toHaveBeenCalledTimes(1);
    expect(txActivityCreate).toHaveBeenCalledTimes(1);
    expect(mockTransitionHttpRequest).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      data: expect.objectContaining({ allFeedbackReceived: false }),
    }));
  });
});
