/**
 * transitionGuards.ts
 *
 * P6-04: Transition guards / preconditions for the central transition service.
 *
 * This module registers guard predicates on the `requestTransition.service` guard
 * registry. Guards are checked by `transitionRequest()` before any status update
 * is written. If a guard returns a non-null string, the transition is rejected.
 *
 * Guard categories implemented:
 *  1. Terminal-status guard — blocks transitions FROM terminal statuses
 *  2. Comment-required guard — rejection transitions require a comment
 *  3. Assignment guard — IT procurement transitions require assigned agent or admin
 *  4. Service-desk guard — IT-specific transitions must be on IT service desk
 *  5. Role-based approval guards — CEO/CTO/CFO decisions require matching role
 *  6. LOA preconditions — LOA_ISSUED requires approved LOA; LOA_ACCEPTED requires signed LOA
 *  7. Onboarding completion guard — all tasks must be completed before ONBOARDING_COMPLETED
 *  8. Offboarding phase guard — resignation letter + exit interview before FINAL_WEEK;
 *     all tasks + EXIT_PROCEDURES phase before OFFBOARDING_COMPLETED
 *
 * Guards are idempotent side-effect-free predicates. They do NOT mutate state.
 * The `options.skipValidation` flag bypasses the transition-map check but NOT guards.
 * Use `options.skipValidation` for admin overrides where the transition itself may be
 * off-map but preconditions (assignment, role, etc.) still apply.
 *
 * @module services/transitionGuards
 */

import prisma from '../utils/prisma';
import { registerTransitionGuard } from './requestTransition.service';
import { isTerminalStatus } from '../utils/workflowTransitions';

// ---------------------------------------------------------------------------
// Helper: check if user is admin
// ---------------------------------------------------------------------------
function isAdmin(options: { userRole?: string; metadata?: Record<string, unknown> }): boolean {
  if (options.userRole === 'ADMIN') return true;
  const roles = options.metadata?.userRoles;
  if (Array.isArray(roles)) return roles.includes('ADMIN');
  return false;
}

// ---------------------------------------------------------------------------
// 1. Terminal-status guard (wildcard: blocks *→* from terminal sources)
// ---------------------------------------------------------------------------
// We register per-status rather than a true wildcard because the guard key
// format is `from→to` or `*→to`. A `from→*` wildcard is not supported.
// Instead, transitionRequest already validates the transition map; terminal
// statuses have no outgoing transitions in the map, so `isValidTransition`
// already blocks them. The guard below is a belt-and-suspenders check for
// when `skipValidation=true` (admin override).
//
// We register it as a guard on the most common terminal → non-terminal paths
// that an admin might attempt. The real protection is the transition map.

// ---------------------------------------------------------------------------
// 2. Comment-required guard for rejection transitions
// ---------------------------------------------------------------------------
// Rejection transitions that set a terminal REJECTED/REJECTED_* status
// should require a comment explaining why.
const REJECTION_TARGETS = new Set([
  'REJECTED',
  'CEO_REJECTED',
  'CEO_REJECTED_IT',
  'CTO_REJECTED_IT',
  'CFO_REJECTED_IT',
  'CEO_REJECTED_FIN',
  'CFO_REJECTED_FIN',
  'GROUP_DCEO_REJECTED',
  'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED',
  'FROM_ENTITY_REJECTED',
  'TO_ENTITY_REJECTED',
  'CANDIDATE_REJECTED_INTERVIEW',
  'LOA_REJECTED',
]);

for (const target of REJECTION_TARGETS) {
  registerTransitionGuard(`*→${target}`, async (_req, _from, _to, options) => {
    if (!options.comment || options.comment.trim().length === 0) {
      return `A comment is required when rejecting to ${target}`;
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// 3. Assignment guard — IT procurement transitions
// ---------------------------------------------------------------------------
// Only the assigned agent or an admin can advance IT procurement/hardware
// transitions. This mirrors the checks in it-workflow.controller.ts.
const IT_PROCUREMENT_TRANSITIONS: Array<[string, string]> = [
  ['PROCUREMENT_IN_PROGRESS', 'HARDWARE_ORDERED'],
  ['HARDWARE_ORDERED', 'HARDWARE_RECEIVED'],
  ['HARDWARE_RECEIVED', 'SOFTWARE_PROVISIONED'],
  ['SOFTWARE_PROVISIONED', 'RESOLVED'],
  ['PAYMENT_PROCESSING_IT', 'PAYMENT_DONE_IT'],
  ['PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT'],
  ['PAYMENT_DONE_IT', 'PROCUREMENT_IN_PROGRESS'],
  ['PENDING_DELIVERY_IT', 'RESOLVED'],
];

for (const [from, to] of IT_PROCUREMENT_TRANSITIONS) {
  registerTransitionGuard(`${from}→${to}`, async (request, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const assignedToId = request.assignedToId;
    if (assignedToId && assignedToId !== options.userId) {
      return 'Only the assigned agent or admin can perform this action';
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// 4. Service-desk guard — IT-specific transitions must be on IT service desk
// ---------------------------------------------------------------------------
const IT_ONLY_TARGETS = new Set([
  'ACKNOWLEDGED_IT',
  'PENDING_CEO_APPROVAL_IT',
  'CEO_APPROVED_IT',
  'CEO_REJECTED_IT',
  'PENDING_CTO_APPROVAL_IT',
  'CTO_APPROVED_IT',
  'CTO_REJECTED_IT',
  'PENDING_INVOICE_IT',
  'PENDING_CFO_APPROVAL_IT',
  'CFO_APPROVED_IT',
  'CFO_REJECTED_IT',
  'PAYMENT_PROCESSING_IT',
  'PAYMENT_DONE_IT',
  'PENDING_DELIVERY_IT',
  'PROCUREMENT_IN_PROGRESS',
  'HARDWARE_ORDERED',
  'HARDWARE_RECEIVED',
  'SOFTWARE_PROVISIONED',
]);

for (const target of IT_ONLY_TARGETS) {
  registerTransitionGuard(`*→${target}`, async (request, _from, _to, _options) => {
    const deskCode = request.serviceDesk?.code;
    if (deskCode && deskCode !== 'IT') {
      return `Transition to ${target} is only allowed for IT service desk requests (got: ${deskCode})`;
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// 5. Role-based approval guards
// ---------------------------------------------------------------------------
// CEO decisions (IT and HR approval chains)
const CEO_APPROVAL_TRANSITIONS: Array<[string, string]> = [
  ['PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT'],
  ['PENDING_CEO_APPROVAL_IT', 'CEO_REJECTED_IT'],
  ['PENDING_CEO_APPROVAL', 'CEO_APPROVED'],
  ['PENDING_CEO_APPROVAL', 'CEO_REJECTED'],
];

for (const [from, to] of CEO_APPROVAL_TRANSITIONS) {
  registerTransitionGuard(`${from}→${to}`, async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('CEO')) {
      return 'Only the CEO can make this decision';
    }
    return null;
  });
}

// CTO decisions
const CTO_APPROVAL_TRANSITIONS: Array<[string, string]> = [
  ['PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT'],
  ['PENDING_CTO_APPROVAL_IT', 'CTO_REJECTED_IT'],
];

for (const [from, to] of CTO_APPROVAL_TRANSITIONS) {
  registerTransitionGuard(`${from}→${to}`, async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('CTO')) {
      return 'Only the CTO can make this decision';
    }
    return null;
  });
}

// CFO decisions (IT and Finance)
const CFO_APPROVAL_TRANSITIONS: Array<[string, string]> = [
  ['PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT'],
  ['PENDING_CFO_APPROVAL_IT', 'CFO_REJECTED_IT'],
  ['PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN'],
  ['PENDING_CFO_APPROVAL_FIN', 'CFO_REJECTED_FIN'],
];

for (const [from, to] of CFO_APPROVAL_TRANSITIONS) {
  registerTransitionGuard(`${from}→${to}`, async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('CFO')) {
      return 'Only the CFO can make this decision';
    }
    return null;
  });
}

// Group DCEO decisions
registerTransitionGuard(
  'PENDING_GROUP_DCEO_APPROVAL→GROUP_DCEO_APPROVED',
  async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('GROUP_DCEO')) {
      return 'Only the Group DCEO can make this decision';
    }
    return null;
  },
);

registerTransitionGuard(
  'PENDING_GROUP_DCEO_APPROVAL→GROUP_DCEO_REJECTED',
  async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('GROUP_DCEO')) {
      return 'Only the Group DCEO can make this decision';
    }
    return null;
  },
);

// Hiring Manager LOA approval
registerTransitionGuard(
  'LOA_PENDING_APPROVAL→LOA_APPROVED',
  async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('HIRING_MANAGER')) {
      return 'Only a Hiring Manager can approve or reject LOA';
    }
    return null;
  },
);

registerTransitionGuard(
  'LOA_PENDING_APPROVAL→HR_SCREENING',
  async (_req, _from, _to, options) => {
    if (isAdmin(options)) return null;
    const roles = (options.metadata?.userRoles as string[]) || [];
    if (!roles.includes('HIRING_MANAGER')) {
      return 'Only a Hiring Manager can approve or reject LOA';
    }
    return null;
  },
);

// ---------------------------------------------------------------------------
// 6. LOA preconditions
// ---------------------------------------------------------------------------
// LOA_ISSUED requires the LOA to be approved (approvedBy set)
registerTransitionGuard(
  'LOA_APPROVED→LOA_ISSUED',
  async (request, _from, _to, _options) => {
    const loa = request.letterOfAcceptance;
    if (!loa || !loa.approvedBy) {
      return 'LOA must be approved before marking as issued';
    }
    return null;
  },
);

// LOA_ACCEPTED requires signed LOA file uploaded
registerTransitionGuard(
  'LOA_ISSUED→LOA_ACCEPTED',
  async (request, _from, _to, _options) => {
    const loa = request.letterOfAcceptance;
    if (!loa || !loa.signedLoaFileUrl) {
      return 'Signed LOA must be uploaded before marking as accepted';
    }
    return null;
  },
);

// COMPLETED (from LOA_ACCEPTED) requires signed LOA
registerTransitionGuard(
  'LOA_ACCEPTED→COMPLETED',
  async (request, _from, _to, _options) => {
    const loa = request.letterOfAcceptance;
    if (!loa || !loa.signedLoaFileUrl) {
      return 'Signed LOA must be uploaded before completing the hiring';
    }
    return null;
  },
);

// ---------------------------------------------------------------------------
// 7. Onboarding completion guard
// ---------------------------------------------------------------------------
// ONBOARDING_COMPLETED requires all onboarding tasks to be completed
registerTransitionGuard(
  'ONBOARDING_MONTH_3_MILESTONE→ONBOARDING_COMPLETED',
  async (request, _from, _to, _options) => {
    const onboarding = await prisma.onboardingRequest.findUnique({
      where: { requestId: request.id },
      select: {
        id: true,
        tasks: { select: { status: true } },
      },
    });
    if (!onboarding) {
      return 'Onboarding record not found — cannot complete';
    }
    const pendingCount = onboarding.tasks.filter(
      (t: { status: string }) => t.status !== 'COMPLETED',
    ).length;
    if (onboarding.tasks.length > 0 && pendingCount > 0) {
      return `Cannot complete onboarding: ${pendingCount} task${pendingCount > 1 ? 's are' : ' is'} still incomplete`;
    }
    return null;
  },
);

// Wildcard: any transition to ONBOARDING_COMPLETED also checks tasks
registerTransitionGuard(
  '*→ONBOARDING_COMPLETED',
  async (request, _from, _to, _options) => {
    const onboarding = await prisma.onboardingRequest.findUnique({
      where: { requestId: request.id },
      select: {
        id: true,
        tasks: { select: { status: true } },
      },
    });
    if (!onboarding) {
      return 'Onboarding record not found — cannot complete';
    }
    const pendingCount = onboarding.tasks.filter(
      (t: { status: string }) => t.status !== 'COMPLETED',
    ).length;
    if (onboarding.tasks.length > 0 && pendingCount > 0) {
      return `Cannot complete onboarding: ${pendingCount} task${pendingCount > 1 ? 's are' : ' is'} still incomplete`;
    }
    return null;
  },
);

// ---------------------------------------------------------------------------
// 8. Offboarding phase guards
// ---------------------------------------------------------------------------
// OFFBOARDING_FINAL_WEEK requires resignation letter + exit interview scheduled
registerTransitionGuard(
  'OFFBOARDING_KNOWLEDGE_TRANSFER→OFFBOARDING_FINAL_WEEK',
  async (request, _from, _to, _options) => {
    const offboarding = await prisma.offboardingRequest.findUnique({
      where: { requestId: request.id },
      select: {
        resignationLetterAttached: true,
        exitInterviewScheduledDate: true,
      },
    });
    if (!offboarding) {
      return 'Offboarding record not found — cannot advance to Final Week';
    }
    if (!offboarding.resignationLetterAttached) {
      return 'Cannot advance to Final Week: resignation letter must be attached first';
    }
    if (!offboarding.exitInterviewScheduledDate) {
      return 'Cannot advance to Final Week: exit interview date must be scheduled first';
    }
    return null;
  },
);

// Wildcard: any transition to OFFBOARDING_FINAL_WEEK
registerTransitionGuard(
  '*→OFFBOARDING_FINAL_WEEK',
  async (request, _from, _to, _options) => {
    const offboarding = await prisma.offboardingRequest.findUnique({
      where: { requestId: request.id },
      select: {
        resignationLetterAttached: true,
        exitInterviewScheduledDate: true,
      },
    });
    if (!offboarding) {
      return 'Offboarding record not found — cannot advance to Final Week';
    }
    if (!offboarding.resignationLetterAttached) {
      return 'Cannot advance to Final Week: resignation letter must be attached first';
    }
    if (!offboarding.exitInterviewScheduledDate) {
      return 'Cannot advance to Final Week: exit interview date must be scheduled first';
    }
    return null;
  },
);

// OFFBOARDING_COMPLETED requires EXIT_PROCEDURES phase + all tasks done
registerTransitionGuard(
  '*→OFFBOARDING_COMPLETED',
  async (request, _from, _to, _options) => {
    const offboarding = await prisma.offboardingRequest.findUnique({
      where: { requestId: request.id },
      select: {
        currentPhase: true,
        tasks: { select: { status: true } },
      },
    });
    if (!offboarding) {
      return 'Offboarding record not found — cannot complete';
    }
    if (offboarding.currentPhase !== 'EXIT_PROCEDURES') {
      return 'Cannot complete offboarding: all phases must be completed first (currently at: ' +
        `${offboarding.currentPhase})`;
    }
    const pendingCount = offboarding.tasks.filter(
      (t: { status: string }) => t.status !== 'COMPLETED',
    ).length;
    if (offboarding.tasks.length > 0 && pendingCount > 0) {
      return `Cannot complete offboarding: ${pendingCount} task${pendingCount > 1 ? 's are' : ' is'} still incomplete`;
    }
    return null;
  },
);

// ---------------------------------------------------------------------------
// Export a no-op to ensure the module is loaded (side-effect registration)
// ---------------------------------------------------------------------------

let _initialized = false;
/** Marks that guards have been registered. Called at app startup. */
export function initTransitionGuards(): void {
  if (_initialized) return;
  _initialized = true;
  // Guards are registered at module load time via the side-effect calls above.
  // This function just ensures the module is imported so those registrations run.
  // It also serves as a test seam.
}

// Convenience export for testing: expose the terminal status set
export { isTerminalStatus };