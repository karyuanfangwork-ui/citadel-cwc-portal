import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// SEED REFERENCE — used for documentation and as fallback if DB is empty.
// This map is NOT the runtime source of truth.
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL_FIN', 'ACKNOWLEDGED_IT'],
  IN_REVIEW: ['IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING', 'REJECTED', 'RESOLVED'],
  IN_PROGRESS: ['ACTION_REQUIRED', 'WAITING', 'RESOLVED', 'REJECTED'],
  ACTION_REQUIRED: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
  WAITING: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED'],
  APPROVED: ['RESOLVED'],
  RESOLVED: [],
  REJECTED: [],
  PENDING_CEO_APPROVAL: ['CEO_APPROVED', 'CEO_REJECTED'],
  CEO_APPROVED: ['PENDING_GROUP_DCEO_APPROVAL'],
  PENDING_GROUP_DCEO_APPROVAL: ['GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED'],
  GROUP_DCEO_APPROVED: ['JOB_POSTED'],
  GROUP_DCEO_REJECTED: ['SUBMITTED'],
  CEO_REJECTED: ['SUBMITTED'],
  JOB_POSTED: ['PENDING_MANAGER_REVIEW'],
  PENDING_MANAGER_REVIEW: ['MANAGER_APPROVED'],
  MANAGER_APPROVED: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_FEEDBACK_PENDING'],
  INTERVIEW_FEEDBACK_PENDING: ['HR_SCREENING', 'CANDIDATE_REJECTED_INTERVIEW'],
  CANDIDATE_REJECTED_INTERVIEW: ['JOB_POSTED'],
  HR_SCREENING: ['LOA_PENDING_APPROVAL'],
  LOA_PENDING_APPROVAL: ['LOA_APPROVED', 'LOA_REJECTED'],
  LOA_APPROVED: ['LOA_ISSUED'],
  LOA_ISSUED: ['LOA_ACCEPTED'],
  LOA_ACCEPTED: ['COMPLETED'],
  COMPLETED: ['ONBOARDING_SUBMITTED'],
  PROCUREMENT_IN_PROGRESS: ['HARDWARE_ORDERED'],
  HARDWARE_ORDERED: ['HARDWARE_RECEIVED'],
  HARDWARE_RECEIVED: ['SOFTWARE_PROVISIONED'],
  SOFTWARE_PROVISIONED: ['RESOLVED'],
  ACKNOWLEDGED_IT: ['PENDING_CEO_APPROVAL_IT'],
  PENDING_CEO_APPROVAL_IT: ['CEO_APPROVED_IT', 'CEO_REJECTED_IT'],
  CEO_APPROVED_IT: ['PENDING_CTO_APPROVAL_IT'],
  CEO_REJECTED_IT: ['REJECTED'],
  PENDING_CTO_APPROVAL_IT: ['CTO_APPROVED_IT', 'CTO_REJECTED_IT'],
  CTO_APPROVED_IT: ['PENDING_INVOICE_IT'],
  CTO_REJECTED_IT: ['REJECTED'],
  PENDING_INVOICE_IT: ['PENDING_CFO_APPROVAL_IT'],
  PENDING_CFO_APPROVAL_IT: ['CFO_APPROVED_IT', 'CFO_REJECTED_IT'],
  CFO_APPROVED_IT: ['PAYMENT_PROCESSING_IT'],
  CFO_REJECTED_IT: ['REJECTED'],
  PAYMENT_PROCESSING_IT: ['PAYMENT_DONE_IT'],
  PAYMENT_DONE_IT: ['PENDING_DELIVERY_IT', 'PROCUREMENT_IN_PROGRESS'],
  PENDING_DELIVERY_IT: ['RESOLVED'],
  PENDING_MANAGER_APPROVAL_FIN: ['MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN'],
  MANAGER_APPROVED_FIN: ['PENDING_FINANCE_HEAD_APPROVAL'],
  // FIXED: was [] (dead-end — requester never notified)
  MANAGER_REJECTED_FIN: ['SUBMITTED'],
  PENDING_FINANCE_HEAD_APPROVAL: ['FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED'],
  FINANCE_HEAD_APPROVED: ['PAYMENT_PROCESSING'],
  // FIXED: was [] (dead-end)
  FINANCE_HEAD_REJECTED: ['SUBMITTED'],
  // Finance Purchase Requisition — CFO → DCEO (≤ threshold) / Group DCEO (> threshold)
  FINANCE_PENDING_ACK: ['FINANCE_ACKNOWLEDGED'],
  FINANCE_ACKNOWLEDGED: ['FINANCE_IN_PROGRESS', 'PENDING_CFO_APPROVAL_FIN'],
  FINANCE_IN_PROGRESS: ['PENDING_CFO_APPROVAL_FIN'],
  PENDING_CFO_APPROVAL_FIN: ['CFO_APPROVED_FIN', 'CFO_REJECTED_FIN'],
  CFO_APPROVED_FIN: ['PENDING_DCEO_APPROVAL_FIN', 'PENDING_GROUP_DCEO_APPROVAL', 'PAYMENT_PROCESSING_FIN', 'FINANCE_IN_PROGRESS'],
  CFO_REJECTED_FIN: ['REJECTED'],
  PENDING_DCEO_APPROVAL_FIN: ['DCEO_APPROVED_FIN', 'DCEO_REJECTED_FIN'],
  DCEO_APPROVED_FIN: ['PAYMENT_PROCESSING_FIN'],
  DCEO_REJECTED_FIN: ['REJECTED'],
  // Note: PENDING_GROUP_DCEO_APPROVAL, GROUP_DCEO_APPROVED, GROUP_DCEO_REJECTED
  // are defined above in the HR section. Finance adds PAYMENT_PROCESSING_FIN as a valid
  // target for GROUP_DCEO_APPROVED — the DB transitions table handles this at runtime.
  PAYMENT_PROCESSING_FIN: ['AWAITING_PAYMENT_CONFIRMATION'],
  AWAITING_PAYMENT_CONFIRMATION: ['PAYMENT_CONFIRMED_FIN', 'TICKET_CLOSED_FIN'],
  PAYMENT_CONFIRMED_FIN: ['TICKET_CLOSED_FIN'],
  TICKET_CLOSED_FIN: [],
  PAYMENT_PROCESSING: ['PAYMENT_COMPLETED'],
  PAYMENT_COMPLETED: ['REIMBURSEMENT_CLOSED'],
  REIMBURSEMENT_CLOSED: [],
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
): Promise<{ transitionLabel: string | null; requiresComment: boolean } | null> {
  const row = await prisma.workflowTransition.findUnique({
    where: { fromStatus_toStatus: { fromStatus: from, toStatus: to } },
    select: { transitionLabel: true, requiresComment: true },
  });
  return row;
}
