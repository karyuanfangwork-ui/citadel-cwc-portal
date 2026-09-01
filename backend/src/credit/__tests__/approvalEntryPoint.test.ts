/**
 * LOS-001 — approval actions must be impossible before COMMITTEE_REVIEW, so the
 * canonical submit_to_committee transition (readiness + assessment freeze +
 * memo lock) cannot be bypassed.
 */
import { ApplicationState } from '@prisma/client';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    creditDecision: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    applicationSignoff: { findMany: jest.fn() },
    condition: { createMany: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn({
      creditDecision: { create: jest.fn().mockResolvedValue({ id: 'dec-1', applicationId: 'app-1', decisionType: 'APPROVE', decisionById: 'u-1', authorityLevel: 'MANAGER', comments: null, createdAt: new Date() }) },
      creditApplication: { update: jest.fn() },
    })),
  },
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
  ratingToOrdinal: jest.fn((r: string) => {
    const map: Record<string, number> = { AAA:1,AA:2,A:3,BBB:4,BB:5,B:6,CCC:7,CC:8,C:9,D:10,NR:11 };
    return map[r] ?? 99;
  }),
}));

jest.mock('../services/assessmentResult.service', () => ({
  __esModule: true,
  getLatestAssessmentResult: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/applicationRating.service', () => ({
  __esModule: true,
  getApplicationEffectiveRating: jest.fn().mockResolvedValue('BBB'),
}));

jest.mock('../services/exposureCompute.service', () => ({
  __esModule: true,
  computeBorrowerExposure: jest.fn().mockResolvedValue({ totalExposure: 100000 }),
}));

jest.mock('../services/authority.service', () => ({
  __esModule: true,
  AUTHORITY_HIERARCHY: { RM:1, MANAGER:2, SENIOR_MANAGER:3, COMMITTEE:4, BOARD:5, CREDIT_RM:1, CREDIT_MANAGER:2, SENIOR_CREDIT_OFFICER:3, CREDIT_COMMITTEE:4, CREDIT_ADMIN:5, ADMIN:5, BOARD_RISK_COMMITTEE:5 },
  hasSufficientAuthority: jest.fn().mockReturnValue(true),
  getRoleNamesForAuthorityLevel: jest.fn().mockReturnValue(['MANAGER']),
  getHighestAuthorityLevelName: jest.fn().mockReturnValue('MANAGER'),
  getUserAuthorityLevel: jest.fn().mockReturnValue(2),
}));

jest.mock('../middleware/sod.middleware', () => ({
  __esModule: true,
  checkSodConflict: jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/auditChain.service', () => ({
  __esModule: true,
  AuditChainService: { appendEvent: jest.fn().mockResolvedValue('mock-event-id') },
}));

jest.mock('../../services/notification.service', () => ({
  __esModule: true,
  notify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/sseClients', () => ({
  __esModule: true,
  pushToUser: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../utils/formatCurrency', () => ({
  __esModule: true,
  formatCurrency: jest.fn().mockReturnValue(100000),
}));

import prisma from '../../utils/prisma';
import { approvalActionService, APPROVAL_ELIGIBLE_STATES } from '../services/approvalAction.service';

const mocked = prisma as unknown as {
  creditApplication: { findUnique: jest.Mock };
  applicationSignoff: { findMany: jest.Mock };
};

const APP_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function stubApplication(state: ApplicationState) {
  mocked.creditApplication.findUnique.mockResolvedValue({
    id: APP_ID,
    state,
    assignedRmId: 'someone-else',
    borrowerProfileId: 'b-1',
    requestedAmount: 100_000,
    branchId: null,
    lane: 'RETAIL',
    applicationNo: 'APP-001',
    decisions: [],
  });
  mocked.applicationSignoff.findMany.mockResolvedValue([]);
}

describe('LOS-001 approval entry point', () => {
  it('exposes COMMITTEE_REVIEW as the only eligible state', () => {
    expect(APPROVAL_ELIGIBLE_STATES).toEqual([ApplicationState.COMMITTEE_REVIEW]);
  });

  it.each([
    ApplicationState.UNDERWRITING,
    ApplicationState.CREDIT_ASSESSMENT,
  ])('rejects an approval submitted in %s', async (state) => {
    stubApplication(state);
    await expect(
      approvalActionService.submitApprovalAction({
        applicationId: APP_ID,
        decision: 'APPROVE',
        actorId: ACTOR_ID,
        actorRoles: ['CREDIT_MANAGER'],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('not allowed'),
    });
  });

  it('names the canonical path in the rejection message', async () => {
    stubApplication(ApplicationState.CREDIT_ASSESSMENT);
    await expect(
      approvalActionService.submitApprovalAction({
        applicationId: APP_ID,
        decision: 'APPROVE',
        actorId: ACTOR_ID,
        actorRoles: ['CREDIT_MANAGER'],
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('submit_to_committee'),
    });
  });
});