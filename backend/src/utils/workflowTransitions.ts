import prisma from '../utils/prisma';

// ---------------------------------------------------------------------------
// SEED REFERENCE — used for documentation and as fallback if DB is empty.
// This map is NOT the runtime source of truth.
// Updated P6-02: added 28 missing transitions identified in the comparison.
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  // ── Generic / IT Simple ──────────────────────────────────────────────────
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'CANCELLED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_FIN', 'ACKNOWLEDGED_IT', 'HR_SCREENING', 'PENDING_FROM_ENTITY_APPROVAL', 'PROCUREMENT_IN_PROGRESS', 'OFFBOARDING_SUBMITTED'],
  IN_REVIEW: ['IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING', 'REJECTED', 'CANCELLED', 'RESOLVED'],
  IN_PROGRESS: ['ACTION_REQUIRED', 'WAITING', 'RESOLVED', 'REJECTED', 'CANCELLED'],
  ACTION_REQUIRED: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
  WAITING: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CANCELLED'],
  APPROVED: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],
  CANCELLED: [],

  // ── HR Recruitment + ESM Travel Request (shared approval statuses) ───────
  PENDING_CEO_APPROVAL: ['CEO_APPROVED', 'CEO_REJECTED'],
  CEO_APPROVED: ['PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED'],  // ESM Travel: skip DCEO if CEO approver holds GROUP_DCEO role
  CEO_REJECTED: ['SUBMITTED', 'REJECTED'],  // SUBMITTED=HR, REJECTED=ESM Travel
  PENDING_GROUP_DCEO_APPROVAL: ['GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED'],
  GROUP_DCEO_APPROVED: ['JOB_POSTED', 'FINANCE_ACKNOWLEDGED', 'PAYMENT_PROCESSING_FIN'],  // JOB_POSTED=HR, FINANCE_ACKNOWLEDGED=ESM Travel, PAYMENT_PROCESSING_FIN=Finance
  GROUP_DCEO_REJECTED: ['SUBMITTED', 'REJECTED'],  // SUBMITTED=HR, REJECTED=ESM Travel
  JOB_POSTED: ['PENDING_MANAGER_REVIEW'],
  PENDING_MANAGER_REVIEW: ['MANAGER_APPROVED', 'INTERVIEW_SCHEDULED'],
  MANAGER_APPROVED: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW'],
  INTERVIEW_FEEDBACK_PENDING: ['HR_SCREENING', 'CANDIDATE_REJECTED_INTERVIEW'],
  CANDIDATE_REJECTED_INTERVIEW: ['JOB_POSTED'],
  HR_SCREENING: ['LOA_PENDING_APPROVAL', 'REJECTED', 'CANCELLED'],
  LOA_PENDING_APPROVAL: ['LOA_APPROVED', 'LOA_REJECTED', 'HR_SCREENING'],
  LOA_APPROVED: ['LOA_ISSUED'],
  LOA_REJECTED: ['HR_SCREENING'],
  LOA_ISSUED: ['LOA_ACCEPTED'],
  LOA_ACCEPTED: ['COMPLETED'],
  COMPLETED: ['RESOLVED', 'ONBOARDING_SUBMITTED'],

  // ── IT Procurement / Hardware ─────────────────────────────────────────────
  ACKNOWLEDGED_IT: ['PENDING_CEO_APPROVAL_IT', 'PROCUREMENT_IN_PROGRESS', 'CANCELLED'],
  PROCUREMENT_IN_PROGRESS: ['HARDWARE_ORDERED', 'CANCELLED'],
  HARDWARE_ORDERED: ['HARDWARE_RECEIVED', 'CANCELLED'],
  HARDWARE_RECEIVED: ['SOFTWARE_PROVISIONED', 'CANCELLED'],
  SOFTWARE_PROVISIONED: ['RESOLVED', 'PENDING_CEO_APPROVAL_IT', 'CANCELLED'],
  PENDING_CEO_APPROVAL_IT: ['CEO_APPROVED_IT', 'CEO_REJECTED_IT'],
  CEO_APPROVED_IT: ['PENDING_CTO_APPROVAL_IT'],
  CEO_REJECTED_IT: ['REJECTED'],
  PENDING_CTO_APPROVAL_IT: ['CTO_APPROVED_IT', 'CTO_REJECTED_IT', 'PENDING_CFO_APPROVAL_IT'],
  CTO_APPROVED_IT: ['PENDING_INVOICE_IT'],
  CTO_REJECTED_IT: ['REJECTED'],
  PENDING_INVOICE_IT: ['PENDING_CFO_APPROVAL_IT', 'CANCELLED'],
  PENDING_CFO_APPROVAL_IT: ['CFO_APPROVED_IT', 'CFO_REJECTED_IT'],
  CFO_APPROVED_IT: ['PAYMENT_PROCESSING_IT'],
  CFO_REJECTED_IT: ['REJECTED'],
  PAYMENT_PROCESSING_IT: ['PAYMENT_DONE_IT', 'CANCELLED'],
  PAYMENT_DONE_IT: ['PENDING_DELIVERY_IT', 'PROCUREMENT_IN_PROGRESS'],
  PENDING_DELIVERY_IT: ['RESOLVED'],

  // ── Finance Expense Reimbursement ──────────────────────────────────────────
  PENDING_MANAGER_APPROVAL_FIN: ['MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN'],
  MANAGER_APPROVED_FIN: ['PENDING_FINANCE_HEAD_APPROVAL'],
  MANAGER_REJECTED_FIN: ['SUBMITTED'],
  PENDING_FINANCE_HEAD_APPROVAL: ['FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED'],
  FINANCE_HEAD_APPROVED: ['PAYMENT_PROCESSING'],
  FINANCE_HEAD_REJECTED: ['SUBMITTED'],
  PAYMENT_PROCESSING: ['PAYMENT_COMPLETED', 'CANCELLED'],
  PAYMENT_COMPLETED: ['REIMBURSEMENT_CLOSED'],
  REIMBURSEMENT_CLOSED: [],

  // ── Finance Purchase Requisition ──────────────────────────────────────────
  FINANCE_PENDING_ACK: ['FINANCE_ACKNOWLEDGED', 'CANCELLED'],
  FINANCE_ACKNOWLEDGED: ['FINANCE_IN_PROGRESS', 'PENDING_CFO_APPROVAL_FIN', 'CANCELLED'],
  FINANCE_IN_PROGRESS: ['PENDING_CFO_APPROVAL_FIN', 'TICKET_CLOSED_FIN', 'CANCELLED'],
  PENDING_CFO_APPROVAL_FIN: ['CFO_APPROVED_FIN', 'CFO_REJECTED_FIN'],
  CFO_APPROVED_FIN: ['PENDING_GROUP_DCEO_APPROVAL', 'PAYMENT_PROCESSING_FIN', 'FINANCE_IN_PROGRESS', 'COMPLETED'],  // COMPLETED=ESM Travel
  CFO_REJECTED_FIN: ['REJECTED'],
  PAYMENT_PROCESSING_FIN: ['AWAITING_PAYMENT_CONFIRMATION'],
  AWAITING_PAYMENT_CONFIRMATION: ['PAYMENT_CONFIRMED_FIN', 'TICKET_CLOSED_FIN'],
  PAYMENT_CONFIRMED_FIN: ['TICKET_CLOSED_FIN'],
  TICKET_CLOSED_FIN: [],

  // ── Inter-Company Chargeback ─────────────────────────────────────────────
  PENDING_FROM_ENTITY_APPROVAL: ['FROM_ENTITY_APPROVED', 'FROM_ENTITY_REJECTED', 'PENDING_TO_ENTITY_APPROVAL'],
  FROM_ENTITY_APPROVED: ['PENDING_TO_ENTITY_APPROVAL'],
  FROM_ENTITY_REJECTED: ['SUBMITTED'],
  PENDING_TO_ENTITY_APPROVAL: ['TO_ENTITY_APPROVED', 'TO_ENTITY_REJECTED', 'CHARGEBACK_FINANCE_REVIEW'],
  TO_ENTITY_APPROVED: ['CHARGEBACK_FINANCE_REVIEW'],
  TO_ENTITY_REJECTED: ['SUBMITTED'],
  CHARGEBACK_FINANCE_REVIEW: ['AWAITING_CHARGEBACK_CONFIRMATION'],
  AWAITING_CHARGEBACK_CONFIRMATION: ['CHARGEBACK_COMPLETED'],
  CHARGEBACK_COMPLETED: [],

  // ── Onboarding ────────────────────────────────────────────────────────────
  ONBOARDING_SUBMITTED: ['ONBOARDING_PENDING_HR_APPROVAL'],
  ONBOARDING_PENDING_HR_APPROVAL: ['ONBOARDING_PRE_ARRIVAL_SETUP'],
  ONBOARDING_PRE_ARRIVAL_SETUP: ['ONBOARDING_READY_FOR_DAY_1'],
  ONBOARDING_READY_FOR_DAY_1: ['ONBOARDING_DAY_1_ORIENTATION'],
  ONBOARDING_DAY_1_ORIENTATION: ['ONBOARDING_WEEK_1_INTEGRATION'],
  ONBOARDING_WEEK_1_INTEGRATION: ['ONBOARDING_MONTH_1_MILESTONE'],
  ONBOARDING_MONTH_1_MILESTONE: ['ONBOARDING_MONTH_2_MILESTONE'],
  ONBOARDING_MONTH_2_MILESTONE: ['ONBOARDING_MONTH_3_MILESTONE'],
  ONBOARDING_MONTH_3_MILESTONE: ['ONBOARDING_COMPLETED'],
  ONBOARDING_COMPLETED: [],

  // ── Offboarding ────────────────────────────────────────────────────────────
  OFFBOARDING_SUBMITTED: ['OFFBOARDING_NOTICE_PERIOD'],
  OFFBOARDING_NOTICE_PERIOD: ['OFFBOARDING_KNOWLEDGE_TRANSFER'],
  OFFBOARDING_KNOWLEDGE_TRANSFER: ['OFFBOARDING_FINAL_WEEK'],
  OFFBOARDING_FINAL_WEEK: ['OFFBOARDING_EXIT_PROCEDURES'],
  OFFBOARDING_EXIT_PROCEDURES: ['OFFBOARDING_COMPLETED'],
  OFFBOARDING_COMPLETED: [],
};

// ---------------------------------------------------------------------------
// Runtime lookups — DB-first, fallback to seed map
// ---------------------------------------------------------------------------

/**
 * Check if a status transition is valid.
 * Uses DB as source of truth; falls back to the seed map if DB is empty.
 */
export async function isValidTransition(from: string, to: string): Promise<boolean> {
  const dbRows = await prisma.workflowTransition.count({
    where: { fromStatus: from, toStatus: to, isActive: true },
  });
  if (dbRows > 0) return true;

  // Fallback to seed map (for environments where the table hasn't been seeded yet)
  const valid = VALID_TRANSITIONS[from];
  return valid ? valid.includes(to) : false;
}

/**
 * Get all valid next statuses from a given status.
 * Uses DB as source of truth; falls back to the seed map.
 */
export async function getValidNextStatuses(from: string): Promise<string[]> {
  const rows = await prisma.workflowTransition.findMany({
    where: { fromStatus: from, isActive: true },
    select: { toStatus: true },
  });

  if (rows.length > 0) {
    return rows.map(r => r.toStatus);
  }

  // Fallback to seed map
  return VALID_TRANSITIONS[from] || [];
}

/**
 * Get a specific transition's metadata from DB.
 * Returns null if the transition doesn't exist or is inactive.
 */
export async function getTransitionMeta(
  from: string,
  to: string
): Promise<{ transitionLabel: string | null; requiresComment: boolean; autoAssignRole: string | null; autoAssignUserId: string | null } | null> {
  const row = await prisma.workflowTransition.findUnique({
    where: { fromStatus_toStatus: { fromStatus: from, toStatus: to } },
    select: { transitionLabel: true, requiresComment: true, autoAssignRole: true, autoAssignUserId: true },
  });
  return row;
}

/**
 * Get the WorkflowType associated with a request (via its RequestType).
 * Returns null if no workflow is linked.
 */
export async function getWorkflowForRequest(requestId: string): Promise<{ id: string; code: string; name: string } | null> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requestType: {
        include: {
          workflow: true,
        },
      },
    },
  });

  const workflow = request?.requestType?.workflow;
  if (!workflow) return null;
  return { id: workflow.id, code: workflow.code, name: workflow.name };
}

/**
 * Check if a status is a terminal (final) state — no outgoing transitions.
 */
export function isTerminalStatus(status: string): boolean {
  const terminalStatuses = [
    'RESOLVED', 'REJECTED', 'COMPLETED',
    'OFFBOARDING_COMPLETED', 'ONBOARDING_COMPLETED',
    'REIMBURSEMENT_CLOSED', 'TICKET_CLOSED_FIN',
    'CHARGEBACK_COMPLETED', 'LOA_REJECTED',
  ];
  return terminalStatuses.includes(status);
}