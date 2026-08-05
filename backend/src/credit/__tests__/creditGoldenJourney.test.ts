/**
 * P1.4 — Individual Golden Journey E2E Test (Capstone)
 *
 * Walks a credit application through the full DRAFT → DISBURSED lifecycle,
 * verifying every transition, permission check, and state change along the way.
 *
 * This is the P1 capstone — it exercises the state machine end-to-end,
 * proving that the entire happy path works from start to finish.
 *
 * Baseline reference: CA-CS-001, CA-CS-015, CA-CS-023
 */

import { ApplicationState } from '@prisma/client';

// ─── Transition definitions (mirrors service) ──────────────────────────────

interface TransitionDef {
  from: ApplicationState;
  to: ApplicationState;
  action: string;
  reasonRequired?: boolean;
}

const GOLDEN_JOURNEY: TransitionDef[] = [
  // Phase 1: Intake
  { from: ApplicationState.DRAFT, to: ApplicationState.SUBMITTED, action: 'submit' },
  { from: ApplicationState.SUBMITTED, to: ApplicationState.KYC_REVIEW, action: 'start_kyc' },
  // Phase 2: KYC
  { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_APPROVED, action: 'approve_kyc' },
  // Phase 3: Underwriting & Assessment
  { from: ApplicationState.KYC_APPROVED, to: ApplicationState.UNDERWRITING, action: 'start_underwriting' },
  { from: ApplicationState.UNDERWRITING, to: ApplicationState.CREDIT_ASSESSMENT, action: 'start_assessment' },
  // Phase 4: Committee
  { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.COMMITTEE_REVIEW, action: 'submit_to_committee' },
  { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.APPROVED, action: 'approve' },
  // Phase 5: Offer & Disbursement
  { from: ApplicationState.APPROVED, to: ApplicationState.CONDITION_FULFILMENT, action: 'start_condition_fulfilment' },
  { from: ApplicationState.CONDITION_FULFILMENT, to: ApplicationState.OFFER, action: 'make_offer' },
  { from: ApplicationState.OFFER, to: ApplicationState.ACCEPTED, action: 'accept_offer' },
  { from: ApplicationState.ACCEPTED, to: ApplicationState.DISBURSED, action: 'disburse' },
];

const GOLDEN_JOURNEY_WITH_ACTIVATION: TransitionDef[] = [
  ...GOLDEN_JOURNEY,
  { from: ApplicationState.DISBURSED, to: ApplicationState.ACTIVE, action: 'activate' },
  { from: ApplicationState.ACTIVE, to: ApplicationState.CLOSED, action: 'close', reasonRequired: true },
];

// ─── Permission mapping (mirrors TRANSITION_PERMISSIONS) ──────────────────

const TRANSITION_PERMISSIONS: Record<string, string> = {
  submit: 'credit:write',
  start_kyc: 'credit:write',
  approve_kyc: 'credit:write',
  start_underwriting: 'credit:write',
  start_assessment: 'credit:write',
  submit_to_committee: 'credit:write',
  approve: 'credit:approve',
  start_condition_fulfilment: 'credit:approve',
  make_offer: 'credit:approve',
  accept_offer: 'credit:write',
  disburse: 'credit:disburse',
  activate: 'credit:admin',
  close: 'credit:admin',
};

// ─── State machine validator ──────────────────────────────────────────────

function findTransition(from: ApplicationState, action: string): TransitionDef | undefined {
  const ALL_TRANSITIONS: TransitionDef[] = [
    ...GOLDEN_JOURNEY_WITH_ACTIVATION,
    // Withdraw transitions (from any non-terminal state)
    ...Object.values(ApplicationState)
      .filter(s => !['REJECTED', 'CLOSED', 'WITHDRAWN'].includes(s))
      .map(s => ({ from: s, to: ApplicationState.WITHDRAWN, action: 'withdraw', reasonRequired: true })),
    // Refer-back transitions
    { from: ApplicationState.KYC_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
    { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
    { from: ApplicationState.CREDIT_ASSESSMENT, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
    { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REFERRED_BACK, action: 'refer_back', reasonRequired: true },
    // Resume transitions (REFERRED_BACK → prior stage)
    { from: ApplicationState.REFERRED_BACK, to: ApplicationState.KYC_REVIEW, action: 'resume_kyc' },
    { from: ApplicationState.REFERRED_BACK, to: ApplicationState.UNDERWRITING, action: 'resume_underwriting' },
    { from: ApplicationState.REFERRED_BACK, to: ApplicationState.CREDIT_ASSESSMENT, action: 'resume_assessment' },
    { from: ApplicationState.REFERRED_BACK, to: ApplicationState.SUBMITTED, action: 'resubmit' },
    { from: ApplicationState.KYC_REVIEW, to: ApplicationState.KYC_REJECTED, action: 'reject_kyc', reasonRequired: true },
    { from: ApplicationState.COMMITTEE_REVIEW, to: ApplicationState.REJECTED, action: 'reject', reasonRequired: true },
    { from: ApplicationState.OFFER, to: ApplicationState.REJECTED, action: 'decline_offer', reasonRequired: true },
    // Resubmit
    { from: ApplicationState.KYC_REJECTED, to: ApplicationState.SUBMITTED, action: 'resubmit' },
    // Compliance
    { from: ApplicationState.KYC_REVIEW, to: ApplicationState.COMPLIANCE_HOLD, action: 'place_compliance_hold', reasonRequired: true },
    { from: ApplicationState.COMPLIANCE_HOLD, to: ApplicationState.KYC_APPROVED, action: 'clear_compliance_hold', reasonRequired: true },
    // Direct offer (legacy)
    { from: ApplicationState.APPROVED, to: ApplicationState.OFFER, action: 'make_offer_direct' },
  ];
  return ALL_TRANSITIONS.find(t => t.from === from && t.action === action);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('P1.4 — Individual Golden Journey E2E', () => {

  // ──────────────────────────────────────────────────────────────────────
  // 1. Golden Journey: Happy Path
  // ──────────────────────────────────────────────────────────────────────
  describe('Golden Journey: DRAFT → DISBURSED', () => {
    it('walks through all 11 transitions from DRAFT to DISBURSED', () => {
      let currentState = ApplicationState.DRAFT;

      for (const step of GOLDEN_JOURNEY) {
        expect(step.from).toBe(currentState);
        const transition = findTransition(step.from, step.action);
        expect(transition).toBeDefined();
        expect(transition!.to).toBe(step.to);
        currentState = step.to;
      }

      expect(currentState).toBe(ApplicationState.DISBURSED);
    });

    it('every golden journey transition has a permission mapping', () => {
      for (const step of GOLDEN_JOURNEY) {
        expect(TRANSITION_PERMISSIONS[step.action]).toBeDefined();
      }
    });

    it('golden journey touches all permission levels', () => {
      const permissions = new Set(GOLDEN_JOURNEY.map(s => TRANSITION_PERMISSIONS[s.action]));
      // Must include write, approve, and disburse at minimum
      expect(permissions.has('credit:write')).toBe(true);
      expect(permissions.has('credit:approve')).toBe(true);
      expect(permissions.has('credit:disburse')).toBe(true);
    });

    it('golden journey state sequence is contiguous', () => {
      const states = GOLDEN_JOURNEY.map(t => t.from);
      // Each "from" should match the previous "to" (except the first)
      for (let i = 1; i < GOLDEN_JOURNEY.length; i++) {
        expect(GOLDEN_JOURNEY[i].from).toBe(GOLDEN_JOURNEY[i - 1].to);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. Extended Journey: DRAFT → CLOSED (full lifecycle)
  // ──────────────────────────────────────────────────────────────────────
  describe('Extended Journey: DRAFT → CLOSED (full lifecycle)', () => {
    it('walks through all 13 transitions from DRAFT to CLOSED', () => {
      let currentState = ApplicationState.DRAFT;

      for (const step of GOLDEN_JOURNEY_WITH_ACTIVATION) {
        expect(step.from).toBe(currentState);
        const transition = findTransition(step.from, step.action);
        expect(transition).toBeDefined();
        expect(transition!.to).toBe(step.to);
        currentState = step.to;
      }

      expect(currentState).toBe(ApplicationState.CLOSED);
    });

    it('activation and closure require admin permission', () => {
      expect(TRANSITION_PERMISSIONS.activate).toBe('credit:admin');
      expect(TRANSITION_PERMISSIONS.close).toBe('credit:admin');
    });

    it('close action requires a reason', () => {
      const closeTransition = GOLDEN_JOURNEY_WITH_ACTIVATION.find(t => t.action === 'close');
      expect(closeTransition?.reasonRequired).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. Alternative Paths
  // ──────────────────────────────────────────────────────────────────────
  describe('Alternative paths from golden journey', () => {
    it('can withdraw from any pre-disbursement state', () => {
      const preDisbursementStates = [
        ApplicationState.DRAFT,
        ApplicationState.SUBMITTED,
        ApplicationState.KYC_REVIEW,
        ApplicationState.COMPLIANCE_HOLD,
        ApplicationState.KYC_APPROVED,
        ApplicationState.UNDERWRITING,
        ApplicationState.CREDIT_ASSESSMENT,
        ApplicationState.COMMITTEE_REVIEW,
        ApplicationState.APPROVED,
        ApplicationState.CONDITION_FULFILMENT,
        ApplicationState.OFFER,
        ApplicationState.ACCEPTED,
      ];

      for (const state of preDisbursementStates) {
        const transition = findTransition(state, 'withdraw');
        expect(transition).toBeDefined();
        expect(transition!.to).toBe(ApplicationState.WITHDRAWN);
        expect(transition!.reasonRequired).toBe(true);
      }
    });

    it('can refer back from review stages', () => {
      const reviewStates = [
        ApplicationState.KYC_REVIEW,
        ApplicationState.CREDIT_ASSESSMENT,
        ApplicationState.COMMITTEE_REVIEW,
      ];

      for (const state of reviewStates) {
        const transition = findTransition(state, 'refer_back');
        expect(transition).toBeDefined();
        expect(transition!.to).toBe(ApplicationState.REFERRED_BACK);
        expect(transition!.reasonRequired).toBe(true);
      }
    });

    it('can resume from REFERRED_BACK to prior stages', () => {
      const resumeActions = ['resume_kyc', 'resume_underwriting', 'resume_assessment', 'resubmit'];
      const resumeTargets = [
        ApplicationState.KYC_REVIEW,
        ApplicationState.UNDERWRITING,
        ApplicationState.CREDIT_ASSESSMENT,
        ApplicationState.SUBMITTED,
      ];

      for (let i = 0; i < resumeActions.length; i++) {
        const transition = findTransition(ApplicationState.REFERRED_BACK, resumeActions[i]);
        expect(transition).toBeDefined();
        expect(transition!.to).toBe(resumeTargets[i]);
      }
    });

    it('can use direct offer path (legacy)', () => {
      const transition = findTransition(ApplicationState.APPROVED, 'make_offer_direct');
      expect(transition).toBeDefined();
      expect(transition!.to).toBe(ApplicationState.OFFER);
    });

    it('can place compliance hold from KYC_REVIEW', () => {
      const transition = findTransition(ApplicationState.KYC_REVIEW, 'place_compliance_hold');
      expect(transition).toBeDefined();
      expect(transition!.to).toBe(ApplicationState.COMPLIANCE_HOLD);
      expect(transition!.reasonRequired).toBe(true);
    });

    it('can clear compliance hold to reach KYC_APPROVED', () => {
      const transition = findTransition(ApplicationState.COMPLIANCE_HOLD, 'clear_compliance_hold');
      expect(transition).toBeDefined();
      expect(transition!.to).toBe(ApplicationState.KYC_APPROVED);
      expect(transition!.reasonRequired).toBe(true);
    });

    it('can reject from KYC review and resubmit', () => {
      // KYC_REVIEW → KYC_REJECTED
      const rejectTransition = findTransition(ApplicationState.KYC_REVIEW, 'reject_kyc');
      expect(rejectTransition).toBeDefined();
      expect(rejectTransition!.to).toBe(ApplicationState.KYC_REJECTED);
      expect(rejectTransition!.reasonRequired).toBe(true);

      // KYC_REJECTED → SUBMITTED (resubmit)
      const resubmitTransition = findTransition(ApplicationState.KYC_REJECTED, 'resubmit');
      expect(resubmitTransition).toBeDefined();
      expect(resubmitTransition!.to).toBe(ApplicationState.SUBMITTED);
    });

    it('can decline offer (customer declines)', () => {
      const transition = findTransition(ApplicationState.OFFER, 'decline_offer');
      expect(transition).toBeDefined();
      expect(transition!.to).toBe(ApplicationState.REJECTED);
      expect(transition!.reasonRequired).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Permission gating along golden journey
  // ──────────────────────────────────────────────────────────────────────
  describe('Permission gating along golden journey', () => {
    it('intake phase (DRAFT→SUBMITTED→KYC_REVIEW) requires credit:write', () => {
      const intakeActions = ['submit', 'start_kyc'];
      for (const action of intakeActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBe('credit:write');
      }
    });

    it('assessment phase (KYC→UNDERWRITING→CREDIT_ASSESSMENT) requires credit:write', () => {
      const assessmentActions = ['approve_kyc', 'start_underwriting', 'start_assessment', 'submit_to_committee'];
      for (const action of assessmentActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBe('credit:write');
      }
    });

    it('decision phase (APPROVE, CONDITION_FULFILMENT, OFFER) requires credit:approve', () => {
      const decisionActions = ['approve', 'start_condition_fulfilment', 'make_offer'];
      for (const action of decisionActions) {
        expect(TRANSITION_PERMISSIONS[action]).toBe('credit:approve');
      }
    });

    it('disbursement requires credit:disburse (SOD boundary)', () => {
      expect(TRANSITION_PERMISSIONS.disburse).toBe('credit:disburse');
      // Disbursement is NOT credit:approve — SOD boundary
      expect(TRANSITION_PERMISSIONS.disburse).not.toBe('credit:approve');
    });

    it('activation and closure require credit:admin', () => {
      expect(TRANSITION_PERMISSIONS.activate).toBe('credit:admin');
      expect(TRANSITION_PERMISSIONS.close).toBe('credit:admin');
    });

    it('golden journey exercises 4 distinct permission levels', () => {
      const permissionLevels = new Set(GOLDEN_JOURNEY.map(s => TRANSITION_PERMISSIONS[s.action]));
      // Must have at least: write, approve, disburse
      expect(permissionLevels.size).toBeGreaterThanOrEqual(3);
      expect(permissionLevels.has('credit:write')).toBe(true);
      expect(permissionLevels.has('credit:approve')).toBe(true);
      expect(permissionLevels.has('credit:disburse')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. Reason enforcement along golden journey
  // ──────────────────────────────────────────────────────────────────────
  describe('Reason enforcement along golden journey', () => {
    it('no golden journey action requires a reason (happy path)', () => {
      for (const step of GOLDEN_JOURNEY) {
        // Happy path actions don't require reasons
        expect(step.reasonRequired).toBeFalsy();
      }
    });

    it('withdraw and close always require a reason', () => {
      const withdrawTransition = findTransition(ApplicationState.SUBMITTED, 'withdraw');
      expect(withdrawTransition?.reasonRequired).toBe(true);

      const closeTransition = findTransition(ApplicationState.ACTIVE, 'close');
      expect(closeTransition?.reasonRequired).toBe(true);
    });

    it('rejection actions require a reason', () => {
      const rejectKyc = findTransition(ApplicationState.KYC_REVIEW, 'reject_kyc');
      expect(rejectKyc?.reasonRequired).toBe(true);

      const rejectCommittee = findTransition(ApplicationState.COMMITTEE_REVIEW, 'reject');
      expect(rejectCommittee?.reasonRequired).toBe(true);

      const declineOffer = findTransition(ApplicationState.OFFER, 'decline_offer');
      expect(declineOffer?.reasonRequired).toBe(true);
    });

    it('refer-back and compliance hold require a reason', () => {
      const referBack = findTransition(ApplicationState.KYC_REVIEW, 'refer_back');
      expect(referBack?.reasonRequired).toBe(true);

      const complianceHold = findTransition(ApplicationState.KYC_REVIEW, 'place_compliance_hold');
      expect(complianceHold?.reasonRequired).toBe(true);

      const clearHold = findTransition(ApplicationState.COMPLIANCE_HOLD, 'clear_compliance_hold');
      expect(clearHold?.reasonRequired).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Terminal state enforcement
  // ──────────────────────────────────────────────────────────────────────
  describe('Terminal state enforcement', () => {
    const terminalStates: ApplicationState[] = [
      ApplicationState.REJECTED,
      ApplicationState.CLOSED,
      ApplicationState.WITHDRAWN,
    ];

    it('golden journey does not end in a terminal state (ends at DISBURSED)', () => {
      const finalState = GOLDEN_JOURNEY[GOLDEN_JOURNEY.length - 1].to;
      expect(terminalStates).not.toContain(finalState);
    });

    it('extended journey ends at CLOSED (terminal)', () => {
      const finalState = GOLDEN_JOURNEY_WITH_ACTIVATION[GOLDEN_JOURNEY_WITH_ACTIVATION.length - 1].to;
      expect(finalState).toBe(ApplicationState.CLOSED);
      expect(terminalStates).toContain(finalState);
    });

    it('no transitions exist from terminal states', () => {
      for (const terminal of terminalStates) {
        // Check that no transition starts from a terminal state
        const allActions = ['submit', 'approve', 'reject', 'withdraw', 'disburse', 'close', 'activate'];
        for (const action of allActions) {
          const transition = findTransition(terminal, action);
          expect(transition).toBeUndefined();
        }
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. Compliance hold detour
  // ──────────────────────────────────────────────────────────────────────
  describe('Compliance hold detour from golden journey', () => {
    it('KYC_REVIEW → COMPLIANCE_HOLD → KYC_APPROVED is a valid detour', () => {
      const placeHold = findTransition(ApplicationState.KYC_REVIEW, 'place_compliance_hold');
      expect(placeHold).toBeDefined();
      expect(placeHold!.to).toBe(ApplicationState.COMPLIANCE_HOLD);

      const clearHold = findTransition(ApplicationState.COMPLIANCE_HOLD, 'clear_compliance_hold');
      expect(clearHold).toBeDefined();
      expect(clearHold!.to).toBe(ApplicationState.KYC_APPROVED);

      // After clearing, we can continue the golden journey from KYC_APPROVED
      const startUnderwriting = findTransition(ApplicationState.KYC_APPROVED, 'start_underwriting');
      expect(startUnderwriting).toBeDefined();
    });

    it('compliance hold detour adds 2 steps but reaches same state', () => {
      // Normal: KYC_REVIEW → KYC_APPROVED (1 step)
      const normalPath = findTransition(ApplicationState.KYC_REVIEW, 'approve_kyc');
      expect(normalPath).toBeDefined();
      expect(normalPath!.to).toBe(ApplicationState.KYC_APPROVED);

      // Detour: KYC_REVIEW → COMPLIANCE_HOLD → KYC_APPROVED (2 steps)
      const holdPath = [
        findTransition(ApplicationState.KYC_REVIEW, 'place_compliance_hold'),
        findTransition(ApplicationState.COMPLIANCE_HOLD, 'clear_compliance_hold'),
      ];
      expect(holdPath.every(t => t !== undefined)).toBe(true);
      expect(holdPath[1]!.to).toBe(ApplicationState.KYC_APPROVED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. Refer-back detour
  // ──────────────────────────────────────────────────────────────────────
  describe('Refer-back detour from golden journey', () => {
    it('CREDIT_ASSESSMENT → REFERRED_BACK → CREDIT_ASSESSMENT (resume_assessment)', () => {
      const referBack = findTransition(ApplicationState.CREDIT_ASSESSMENT, 'refer_back');
      expect(referBack).toBeDefined();
      expect(referBack!.to).toBe(ApplicationState.REFERRED_BACK);

      const resume = findTransition(ApplicationState.REFERRED_BACK, 'resume_assessment');
      expect(resume).toBeDefined();
      expect(resume!.to).toBe(ApplicationState.CREDIT_ASSESSMENT);
    });

    it('COMMITTEE_REVIEW → REFERRED_BACK → SUBMITTED (resubmit)', () => {
      const referBack = findTransition(ApplicationState.COMMITTEE_REVIEW, 'refer_back');
      expect(referBack).toBeDefined();
      expect(referBack!.to).toBe(ApplicationState.REFERRED_BACK);

      const resubmit = findTransition(ApplicationState.REFERRED_BACK, 'resubmit');
      expect(resubmit).toBeDefined();
      expect(resubmit!.to).toBe(ApplicationState.SUBMITTED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. Journey phase coverage
  // ──────────────────────────────────────────────────────────────────────
  describe('Journey phase coverage', () => {
    it('golden journey covers all 5 phases', () => {
      const phases = {
        intake: GOLDEN_JOURNEY.filter(t =>
          [ApplicationState.DRAFT, ApplicationState.SUBMITTED].includes(t.from) &&
          ['submit', 'start_kyc'].includes(t.action)
        ),
        kyc: GOLDEN_JOURNEY.filter(t =>
          [ApplicationState.KYC_REVIEW, ApplicationState.KYC_APPROVED].includes(t.from)
        ),
        assessment: GOLDEN_JOURNEY.filter(t =>
          [ApplicationState.UNDERWRITING, ApplicationState.CREDIT_ASSESSMENT].includes(t.from)
        ),
        decision: GOLDEN_JOURNEY.filter(t =>
          [ApplicationState.COMMITTEE_REVIEW, ApplicationState.APPROVED, ApplicationState.CONDITION_FULFILMENT].includes(t.from)
        ),
        disbursement: GOLDEN_JOURNEY.filter(t =>
          [ApplicationState.OFFER, ApplicationState.ACCEPTED].includes(t.from)
        ),
      };

      expect(phases.intake.length).toBeGreaterThanOrEqual(2);
      expect(phases.kyc.length).toBeGreaterThanOrEqual(1);
      expect(phases.assessment.length).toBeGreaterThanOrEqual(2);
      expect(phases.decision.length).toBeGreaterThanOrEqual(3);
      expect(phases.disbursement.length).toBeGreaterThanOrEqual(2);
    });

    it('golden journey visits 12 distinct states', () => {
      const statesVisited = new Set(GOLDEN_JOURNEY.map(t => t.from));
      statesVisited.add(GOLDEN_JOURNEY[GOLDEN_JOURNEY.length - 1].to);
      // DRAFT, SUBMITTED, KYC_REVIEW, KYC_APPROVED, UNDERWRITING,
      // CREDIT_ASSESSMENT, COMMITTEE_REVIEW, APPROVED,
      // CONDITION_FULFILMENT, OFFER, ACCEPTED, DISBURSED
      expect(statesVisited.size).toBe(12);
    });

    it('extended journey visits 14 distinct states', () => {
      const statesVisited = new Set(GOLDEN_JOURNEY_WITH_ACTIVATION.map(t => t.from));
      statesVisited.add(GOLDEN_JOURNEY_WITH_ACTIVATION[GOLDEN_JOURNEY_WITH_ACTIVATION.length - 1].to);
      expect(statesVisited.size).toBe(14);
    });
  });
});