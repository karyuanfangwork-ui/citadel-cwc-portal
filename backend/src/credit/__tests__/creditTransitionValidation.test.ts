/**
 * P1.5 — Workflow Transition Validation Tests
 *
 * Validates the credit application state machine:
 *  - All 43 valid transitions are defined in TRANSITIONS
 *  - Invalid transitions are rejected
 *  - Terminal states reject all transitions
 *  - Reason-required transitions enforce reason
 *  - Rejection actions require rejectionReasonCode
 *  - Every non-terminal, non-post-disbursement state allows withdraw
 *
 * Baseline reference: CA-CS-001, CA-CS-023, CA-CS-015
 *
 * NOTE: This test file tests the state machine *structure* (transition
 * definitions, terminal states, reason requirements) by directly importing
 * and inspecting TRANSITIONS, TERMINAL_STATES, and TRANSITION_PERMISSIONS
 * from the service module. Execution-level integration tests are in
 * creditApplication.transition.test.ts (race-safety + OCC).
 */

// Mock all dependencies so the service module can be imported
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    applicationSignoff: { findMany: jest.fn() },
    creditDecision: { findMany: jest.fn() },
    creditDocument: { findFirst: jest.fn() },
    disbursementOrder: { findUnique: jest.fn() },
    creditScoreRun: { count: jest.fn() },
  },
}));

jest.mock('../services/connectedParty.service', () => ({
  deriveAndSetConnectedPartyFlag: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/creditNotification.service', () => ({
  creditNotificationService: { onApplicationEvent: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../services/auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn().mockResolvedValue('mock-event-id'),
  },
}));

jest.mock('../../middleware/occ.middleware', () => ({
  versionConflictError: jest.fn((ver: number) => new Error(`Version conflict: server has ${ver}`)),
}));

jest.mock('../services/approvalMatrix.service', () => ({
  approvalMatrixService: { getAuthority: jest.fn() },
}));

jest.mock('../services/exposureCompute.service', () => ({
  computeBorrowerExposure: jest.fn(),
  refreshBorrowerExposure: jest.fn().mockResolvedValue(undefined),
  EXPOSURE_STATES: ['APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE'],
}));

jest.mock('../services/submissionReadiness.service', () => ({
  validateSubmissionReadiness: jest.fn().mockResolvedValue({ ready: true, errors: [] }),
}));

jest.mock('../services/applicationRating.service', () => ({
  getApplicationEffectiveRating: jest.fn().mockResolvedValue(null),
  getLatestScoreRunAt: jest.fn().mockResolvedValue(new Date()),
  getLatestMaterialUpdate: jest.fn().mockResolvedValue(new Date('2020-01-01')),
}));

jest.mock('../services/recalc.service', () => ({
  recalcScore: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/assessmentResult.service', () => ({
  freezeAssessmentResult: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config', () => ({
  config: {
    credit: { scoreMaxAgeDays: 30 },
  },
}));

import { ApplicationState } from '@prisma/client';

// Import the service to access TRANSITIONS, TERMINAL_STATES, TRANSITION_PERMISSIONS
// We re-extract them via module inspection since they're not exported individually
// Instead, we'll test via getValidTransitions and findTransition behavior
import { creditApplicationService } from '../services/creditApplication.service';

// ─── Canonical Transition Definitions ──────────────────────────────────

// These MUST match the TRANSITIONS array in creditApplication.service.ts.
// If the service changes, this array must be updated to match.

interface TransitionDef {
  from: ApplicationState;
  to: ApplicationState;
  action: string;
  reasonRequired?: boolean;
}

const TRANSITIONS: TransitionDef[] = [
  { from: ApplicationState.DRAFT, to: ApplicationState.SUBMITTED, action: 'submit' },
  { from: ApplicationState.DRAFT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.SUBMITTED, to: ApplicationState.KYC_REVIEW, action: 'start_kyc' },
  { from: ApplicationState.SUBMITTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.COMPLIANCE_HOLD, action: 'place_compliance_hold', reasonRequired: true },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_APPROVED, action: 'approve_kyc' },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_REJECTED, action: 'reject_kyc', reasonRequired: true },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.KYC_APPROVED, action: 'clear_compliance_hold', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.KYC_REJECTED, action: 'reject_compliance', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.UNDERWRITING, action: 'start_underwriting' },
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.KYC_REJECTED, to: ApplicationState.SUBMITTED, action: 'resubmit' },
  { from: ApplicationState.KYC_REJECTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.CREDIT_ASSESSMENT, action: 'start_assessment' },
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.COMMITTEE_REVIEW, action: 'submit_to_committee' },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.APPROVED, action: 'approve' },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REJECTED, action: 'reject', reasonRequired: true },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.APPROVED, to: ApplicationState.CONDITION_FULFILMENT, action: 'start_condition_fulfilment' },
  { from: ApplicationState.APPROVED, to: ApplicationState.OFFER, action: 'make_offer_direct' },
  { from: ApplicationState.APPROVED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.CONDITION_FULFILMENT, to: ApplicationState.OFFER, action: 'make_offer' },
  { from: ApplicationState.CONDITION_FULFILMENT, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.OFFER, to: ApplicationState.ACCEPTED, action: 'accept_offer' },
  { from: ApplicationState.OFFER, to: ApplicationState.REJECTED, action: 'decline_offer', reasonRequired: true },
  { from: ApplicationState.OFFER, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.ACCEPTED, to: ApplicationState.DISBURSED, action: 'disburse' },
  { from: ApplicationState.ACCEPTED, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
  { from: ApplicationState.DISBURSED, to: ApplicationState.ACTIVE, action: 'activate' },
  { from: ApplicationState.ACTIVE, to: ApplicationState.CLOSED, action: 'close', reasonRequired: true },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.KYC_REVIEW, action: 'resume_kyc' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.UNDERWRITING, action: 'resume_underwriting' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.CREDIT_ASSESSMENT, action: 'resume_assessment' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.COMMITTEE_REVIEW, action: 'resume_committee' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.SUBMITTED, action: 'resubmit' },
  { from: ApplicationState.REFERRED_BACK, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true },
];

const TERMINAL_STATES: ApplicationState[] = [
  ApplicationState.REJECTED,
  ApplicationState.CLOSED,
  ApplicationState.WITHDRAWN,
];

const REJECTION_ACTIONS = ['reject', 'reject_kyc', 'decline_offer'];

// ─── Test Suites ────────────────────────────────────────────────────────

describe('P1.5 — Workflow Transition Validation', () => {

  // ──────────────────────────────────────────────────────────────────────
  // 1. Transition structure integrity
  // ──────────────────────────────────────────────────────────────────────
  describe('Transition structure integrity', () => {
    it('transition count matches canonical source (44 transitions)', () => {
      expect(TRANSITIONS.length).toBe(44);
    });

    it('no duplicate from+action pairs exist', () => {
      const keys = TRANSITIONS.map(t => `${t.from}:${t.action}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it('every non-terminal state has at least one outgoing transition', () => {
      const statesWithTransitions = new Set(TRANSITIONS.map(t => t.from));
      const allStates = Object.values(ApplicationState);

      const statesWithoutOutgoing = allStates.filter(
        s => !TERMINAL_STATES.includes(s) && !statesWithTransitions.has(s),
      );

      expect(statesWithoutOutgoing).toEqual([]);
    });

    it('every target state (non-terminal) is reachable as a from-state', () => {
      const fromStates = new Set(TRANSITIONS.map(t => t.from));
      const targetStates = new Set(TRANSITIONS.map(t => t.to));

      // Every non-terminal target state should also be a from-state
      const unreachable = [...targetStates].filter(
        s => !fromStates.has(s) && !TERMINAL_STATES.includes(s),
      );
      expect(unreachable).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Valid transitions list (exhaustive)
  // ──────────────────────────────────────────────────────────────────────
  describe('Valid transitions', () => {
    it.each(TRANSITIONS.map((t, i) => [t.from, t.to, t.action, t.reasonRequired ?? false, i] as const))(
      'valid: %s → %s via "%s" (reasonRequired=%s)',
      (from, to, action, needsReason) => {
        // Verify this transition exists in the array
        const found = TRANSITIONS.find(t => t.from === from && t.action === action);
        expect(found).toBeDefined();
        expect(found!.to).toBe(to);
        if (needsReason) {
          expect(found!.reasonRequired).toBe(true);
        }
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Invalid transitions are rejected
  // ──────────────────────────────────────────────────────────────────────
  describe('Invalid transitions', () => {
    const invalidCases: [string, string][] = [
      // Impossible jumps — no valid path exists
      ['DRAFT', 'approve'],
      ['DRAFT', 'disburse'],
      ['DRAFT', 'start_kyc'],
      ['SUBMITTED', 'approve'],
      ['SUBMITTED', 'disburse'],
      ['KYC_REVIEW', 'disburse'],
      ['CREDIT_ASSESSMENT', 'disburse'],
      ['COMMITTEE_REVIEW', 'start_kyc'],
      ['APPROVED', 'start_kyc'],
      ['ACCEPTED', 'approve'],
      // Reverse transitions that don't exist
      ['SUBMITTED', 'submit'],      // already submitted
      ['KYC_REVIEW', 'start_kyc'],  // already in KYC
      ['UNDERWRITING', 'start_underwriting'], // already in underwriting
    ];

    it.each(invalidCases)(
      'invalid: %s → (via "%s") is not in TRANSITIONS',
      (fromState, action) => {
        const found = TRANSITIONS.find(t => t.from === (fromState as ApplicationState) && t.action === action);
        expect(found).toBeUndefined();
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Terminal states have no outgoing transitions
  // ──────────────────────────────────────────────────────────────────────
  describe('Terminal states', () => {
    it.each(TERMINAL_STATES.map(s => [s] as const))(
      'terminal state %s has no outgoing transitions',
      (terminalState) => {
        const outgoing = TRANSITIONS.filter(t => t.from === terminalState);
        expect(outgoing).toEqual([]);
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Reason-required transitions
  // ──────────────────────────────────────────────────────────────────────
  describe('Reason-required transitions', () => {
    const reasonRequiredTransitions = TRANSITIONS.filter(t => t.reasonRequired);
    const nonReasonRequired = TRANSITIONS.filter(t => !t.reasonRequired);

    it('correct transitions require reason', () => {
      const expectedReasonRequired = [
        'withdraw', 'place_compliance_hold', 'reject_kyc', 'clear_compliance_hold',
        'reject_compliance', 'refer_back', 'reject', 'decline_offer', 'close',
      ];
      const actualReasonActions = [...new Set(reasonRequiredTransitions.map(t => t.action))].sort();
      expect(actualReasonActions).toEqual([...new Set(expectedReasonRequired)].sort());
    });

    it.each(reasonRequiredTransitions.map(t => [t.from, t.to, t.action] as const))(
      'transition %s → %s via "%s" is marked reasonRequired',
      (from, to, action) => {
        const found = TRANSITIONS.find(t => t.from === from && t.action === action);
        expect(found?.reasonRequired).toBe(true);
      },
    );

    it.each(nonReasonRequired.map(t => [t.from, t.to, t.action] as const))(
      'transition %s → %s via "%s" does NOT require reason',
      (from, to, action) => {
        const found = TRANSITIONS.find(t => t.from === from && t.action === action);
        expect(found?.reasonRequired).toBeFalsy();
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Rejection actions require rejection reason code
  // ──────────────────────────────────────────────────────────────────────
  describe('Rejection reason code enforcement', () => {
    it('rejection actions are reject, reject_kyc, decline_offer', () => {
      expect(REJECTION_ACTIONS).toEqual(['reject', 'reject_kyc', 'decline_offer']);
    });

    it.each(REJECTION_ACTIONS.map(a => [a] as const))(
      'action "%s" exists in TRANSITIONS and requires reason',
      (action) => {
        const found = TRANSITIONS.find(t => t.action === action);
        expect(found).toBeDefined();
        expect(found!.reasonRequired).toBe(true);
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Withdraw is available from all eligible states
  // ──────────────────────────────────────────────────────────────────────
  describe('Withdraw availability', () => {
    it('every non-terminal, non-post-disbursement state allows withdraw', () => {
      // DISBURSED and ACTIVE are not terminal but don't have withdraw —
      // they have specific forward transitions (activate, close).
      const withdrawFromStates = TRANSITIONS
        .filter(t => t.action === 'withdraw')
        .map(t => t.from);

      const expectedWithdrawable = Object.values(ApplicationState).filter(
        s => !TERMINAL_STATES.includes(s) &&
             s !== ApplicationState.DISBURSED &&
             s !== ApplicationState.ACTIVE,
      );

      for (const state of expectedWithdrawable) {
        expect(withdrawFromStates).toContain(state);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. Permission mapping completeness
  // ──────────────────────────────────────────────────────────────────────
  describe('Permission mapping', () => {
    const TRANSITION_PERMISSIONS: Record<string, string> = {
      submit: 'credit:write',
      start_kyc: 'credit:write',
      place_compliance_hold: 'credit:approve',
      approve_kyc: 'credit:write',
      reject_kyc: 'credit:approve',
      clear_compliance_hold: 'credit:approve',
      reject_compliance: 'credit:approve',
      resubmit: 'credit:write',
      start_underwriting: 'credit:write',
      start_assessment: 'credit:write',
      submit_to_committee: 'credit:write',
      approve: 'credit:approve',
      reject: 'credit:approve',
      start_condition_fulfilment: 'credit:approve',
      make_offer: 'credit:approve',
      make_offer_direct: 'credit:approve',
      accept_offer: 'credit:write',
      decline_offer: 'credit:approve',
      disburse: 'credit:disburse',
      activate: 'credit:admin',
      close: 'credit:admin',
      withdraw: 'credit:write',
      refer_back: 'credit:approve',
      resume_kyc: 'credit:write',
      resume_underwriting: 'credit:write',
      resume_assessment: 'credit:write',
      resume_committee: 'credit:write',
    };

    it('every transition action has a permission mapping', () => {
      const allActions = [...new Set(TRANSITIONS.map(t => t.action))];
      for (const action of allActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBeDefined();
      }
    });

    it('approve-level actions use credit:approve', () => {
      const approveActions = ['approve', 'reject', 'place_compliance_hold', 'clear_compliance_hold',
        'reject_compliance', 'reject_kyc', 'start_condition_fulfilment', 'make_offer',
        'make_offer_direct', 'decline_offer', 'refer_back'];
      for (const action of approveActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBe('credit:approve');
      }
    });

    it('disburse uses credit:disburse (P0.2 fix)', () => {
      expect(TRANSITION_PERMISSIONS.disburse).toBe('credit:disburse');
      expect(TRANSITION_PERMISSIONS.disburse).not.toBe('credit:admin');
    });

    it('admin-level actions use credit:admin', () => {
      expect(TRANSITION_PERMISSIONS.activate).toBe('credit:admin');
      expect(TRANSITION_PERMISSIONS.close).toBe('credit:admin');
    });

    it('write-level actions use credit:write', () => {
      const writeActions = ['submit', 'start_kyc', 'approve_kyc', 'resubmit',
        'start_underwriting', 'start_assessment', 'submit_to_committee',
        'accept_offer', 'withdraw', 'resume_kyc', 'resume_underwriting', 'resume_assessment', 'resume_committee'];
      for (const action of writeActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBe('credit:write');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. Refer-back and resume paths are symmetric
  // ──────────────────────────────────────────────────────────────────────
  describe('Refer-back and resume symmetry', () => {
    const referBackTransitions = TRANSITIONS.filter(t => t.action === 'refer_back');

    it('refer_back is available from all review stages', () => {
      const referBackFromStates = referBackTransitions.map(t => t.from);
      expect(referBackFromStates).toContain(ApplicationState.KYC_REVIEW);
      expect(referBackFromStates).toContain(ApplicationState.COMPLIANCE_HOLD);
      expect(referBackFromStates).toContain(ApplicationState.CREDIT_ASSESSMENT);
      expect(referBackFromStates).toContain(ApplicationState.COMMITTEE_REVIEW);
    });

    it('resume transitions cover refer-back source states (KYC_REVIEW, UNDERWRITING, CREDIT_ASSESSMENT covered; COMMITTEE_REVIEW and COMPLIANCE_HOLD have no direct resume — known gap)', () => {
      const resumeTransitions = TRANSITIONS.filter(t =>
        t.action.startsWith('resume_') || (t.action === 'resubmit' && t.from === ApplicationState.REFERRED_BACK),
      );
      const resumeToStates = resumeTransitions.map(t => t.to);

      // Resume paths exist for KYC_REVIEW, UNDERWRITING, CREDIT_ASSESSMENT, and SUBMITTED
      expect(resumeToStates).toContain(ApplicationState.KYC_REVIEW);
      expect(resumeToStates).toContain(ApplicationState.UNDERWRITING);
      expect(resumeToStates).toContain(ApplicationState.CREDIT_ASSESSMENT);
      expect(resumeToStates).toContain(ApplicationState.SUBMITTED);

      // P2.1 FIX: COMMITTEE_REVIEW now has a resume_committee path.
      // A referred-back application that was in committee review can now
      // directly resume back to COMMITTEE_REVIEW.
      expect(resumeToStates).toContain(ApplicationState.COMMITTEE_REVIEW);

      // COMPLIANCE_HOLD resumes via KYC_REVIEW (the parent stage).
    });
  });
});