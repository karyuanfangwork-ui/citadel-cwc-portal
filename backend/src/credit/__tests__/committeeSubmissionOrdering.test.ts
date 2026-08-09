/**
 * submit_to_committee must not freeze the assessment when readiness fails —
 * a failed submission must leave no frozen evidence behind.
 *
 * LOS-015 — the gate is now extracted to committeeEntryGate.ts and applies
 * to both submit_to_committee and resume_committee.
 */
const callOrder: string[] = [];

jest.mock('../services/committeeEntryGate', () => ({
  enforceCommitteeEntryGate: jest.fn(async () => {
    callOrder.push('gate');
    // Simulate a failed readiness check inside the gate
    const error = new Error('Cannot enter committee review — recommendation: required');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }),
  isCommitteeEntryAction: jest.fn((action: string) => action === 'submit_to_committee' || action === 'resume_committee'),
  COMMITTEE_ENTRY_ACTIONS: ['submit_to_committee', 'resume_committee'],
}));

jest.mock('../services/assessmentResult.service', () => ({
  freezeAssessmentResult: jest.fn(async () => { callOrder.push('freeze'); }),
}));

jest.mock('../services/submissionReadiness.service', () => ({
  validateSubmissionReadiness: jest.fn(async () => {
    callOrder.push('readiness');
    return { ready: false, errors: [{ field: 'recommendation', message: 'required' }], warnings: [], satisfied: [] };
  }),
}));

jest.mock('../services/creditMemoVersion.service', () => ({
  lockMemoVersionOnSubmission: jest.fn(async () => { callOrder.push('lockMemo'); }),
}));

jest.mock('../services/applicationRating.service', () => ({
  getApplicationEffectiveRating: jest.fn().mockResolvedValue('BBB'),
  getLatestScoreRunAt: jest.fn().mockResolvedValue(new Date('2026-08-01')),
  getLatestMaterialUpdate: jest.fn().mockResolvedValue(new Date('2026-07-15')),
}));

jest.mock('../services/exposureCompute.service', () => ({
  computeBorrowerExposure: jest.fn().mockResolvedValue({ totalExposure: 100000 }),
}));

jest.mock('../services/authority.service', () => ({
  AUTHORITY_HIERARCHY: {},
  hasSufficientAuthority: jest.fn().mockReturnValue(true),
  getRoleNamesForAuthorityLevel: jest.fn().mockReturnValue(['MANAGER']),
  getHighestAuthorityLevelName: jest.fn().mockReturnValue('MANAGER'),
  getUserAuthorityLevel: jest.fn().mockReturnValue(2),
}));

jest.mock('../middleware/sod.middleware', () => ({
  checkSodConflict: jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/auditChain.service', () => ({
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('mock-event-id') },
}));

jest.mock('../../services/notification.service', () => ({
  notify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/sseClients', () => ({
  pushToUser: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../services/approvalMatrix.service', () => ({
  __esModule: true,
  approvalMatrixService: {
    lookupApprovalAuthority: jest.fn().mockResolvedValue({
      authorityLevel: 'MANAGER',
      requiredApproverCount: 1,
      matrixId: 'mx-1',
      matrixName: 'Default',
    }),
  },
  ratingToOrdinal: jest.fn(),
}));

// Comprehensive prisma mock matching all submit_to_committee code paths
const mockSignoffs = [
  { role: 'PREPARED_BY', signedAt: new Date(), signedById: 'u-1' },
  { role: 'REVIEWED_BY', signedAt: new Date(), signedById: 'u-2' },
  { role: 'CONCURRED_BY', signedAt: new Date(), signedById: 'u-3' },
];

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app-1',
        state: 'CREDIT_ASSESSMENT',
        rmId: 'rm-1',
        requestedAmount: 500000,
        riskRating: 'BBB',
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'app-1',
        state: 'CREDIT_ASSESSMENT',
        rmId: 'rm-1',
        requestedAmount: 500000,
        riskRating: 'BBB',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'app-1',
        state: 'COMMITTEE_REVIEW',
      }),
    },
    applicationSignoff: {
      findMany: jest.fn().mockResolvedValue(mockSignoffs),
    },
    creditScoreRun: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue({ createdAt: new Date('2026-01-01') }),
    },
    $transaction: jest.fn(async (fn: any) => fn({
      creditApplication: { update: jest.fn().mockResolvedValue({ id: 'app-1', state: 'COMMITTEE_REVIEW' }) },
    })),
  },
}));

import { creditApplicationService } from '../services/creditApplication.service';

describe('submit_to_committee ordering', () => {
  beforeEach(() => { callOrder.length = 0; });

  it('calls the committee entry gate, which blocks when readiness fails', async () => {
    await expect(
      creditApplicationService.transitionApplication('app-1', 'submit_to_committee', 'u-1'),
    ).rejects.toThrow(/Cannot enter committee review/i);

    // The gate was called (and threw)
    expect(callOrder).toContain('gate');

    // freeze and lockMemo must NOT have been called — the gate threw before reaching them
    expect(callOrder).not.toContain('freeze');
    expect(callOrder).not.toContain('lockMemo');
  });
});