import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// ESM Workflow Transitions Seed
// Populates the workflow_transitions table for all 9 ESM workflow types.
// Mirrors the VALID_TRANSITIONS map in src/utils/workflowTransitions.ts.
// ---------------------------------------------------------------------------

interface TransitionDef {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string;
  requiresComment: boolean;
}

// ── Generic / IT Simple ──────────────────────────────────────────────────
const IT_SIMPLE: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'IN_REVIEW', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'SUBMITTED', toStatus: 'REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'IN_REVIEW', toStatus: 'IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'IN_REVIEW', toStatus: 'ACTION_REQUIRED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'IN_REVIEW', toStatus: 'WAITING', transitionLabel: 'HOLD', requiresComment: false },
  { fromStatus: 'IN_REVIEW', toStatus: 'REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'IN_REVIEW', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
  { fromStatus: 'IN_PROGRESS', toStatus: 'ACTION_REQUIRED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'IN_PROGRESS', toStatus: 'WAITING', transitionLabel: 'HOLD', requiresComment: false },
  { fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
  { fromStatus: 'IN_PROGRESS', toStatus: 'REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'ACTION_REQUIRED', toStatus: 'IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ACTION_REQUIRED', toStatus: 'IN_REVIEW', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'ACTION_REQUIRED', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
  { fromStatus: 'ACTION_REQUIRED', toStatus: 'REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'WAITING', toStatus: 'IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'WAITING', toStatus: 'IN_REVIEW', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'WAITING', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
  { fromStatus: 'APPROVED', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
];

// ── HR Recruitment ────────────────────────────────────────────────────────
const HR_RECRUITMENT: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'PENDING_CEO_APPROVAL', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL', toStatus: 'CEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL', toStatus: 'CEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CEO_APPROVED', toStatus: 'PENDING_GROUP_DCEO_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CEO_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'GROUP_DCEO_APPROVED', toStatus: 'JOB_POSTED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'GROUP_DCEO_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'JOB_POSTED', toStatus: 'PENDING_MANAGER_REVIEW', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_REVIEW', toStatus: 'MANAGER_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_REVIEW', toStatus: 'INTERVIEW_SCHEDULED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'MANAGER_APPROVED', toStatus: 'INTERVIEW_SCHEDULED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_FEEDBACK_PENDING', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'CANDIDATE_REJECTED_INTERVIEW', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'INTERVIEW_FEEDBACK_PENDING', toStatus: 'HR_SCREENING', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'INTERVIEW_FEEDBACK_PENDING', toStatus: 'CANDIDATE_REJECTED_INTERVIEW', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CANDIDATE_REJECTED_INTERVIEW', toStatus: 'JOB_POSTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'HR_SCREENING', toStatus: 'LOA_PENDING_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'HR_SCREENING', toStatus: 'REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'LOA_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'LOA_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'HR_SCREENING', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'LOA_APPROVED', toStatus: 'LOA_ISSUED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'LOA_REJECTED', toStatus: 'HR_SCREENING', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'LOA_ISSUED', toStatus: 'LOA_ACCEPTED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'LOA_ACCEPTED', toStatus: 'COMPLETED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── IT Procurement ────────────────────────────────────────────────────────
const IT_PROCUREMENT: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'ACKNOWLEDGED_IT', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'ACKNOWLEDGED_IT', toStatus: 'PENDING_CEO_APPROVAL_IT', transitionLabel: 'ESCALATE', requiresComment: false },
  { fromStatus: 'ACKNOWLEDGED_IT', toStatus: 'PROCUREMENT_IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL_IT', toStatus: 'CEO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL_IT', toStatus: 'CEO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CEO_APPROVED_IT', toStatus: 'PENDING_CTO_APPROVAL_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CEO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'CTO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'CTO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'PENDING_CFO_APPROVAL_IT', transitionLabel: 'ESCALATE', requiresComment: false },
  { fromStatus: 'CTO_APPROVED_IT', toStatus: 'PENDING_INVOICE_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CTO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_INVOICE_IT', toStatus: 'PENDING_CFO_APPROVAL_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_IT', toStatus: 'CFO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_IT', toStatus: 'CFO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CFO_APPROVED_IT', toStatus: 'PAYMENT_PROCESSING_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING_IT', toStatus: 'PAYMENT_DONE_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PAYMENT_DONE_IT', toStatus: 'PENDING_DELIVERY_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PAYMENT_DONE_IT', toStatus: 'PROCUREMENT_IN_PROGRESS', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PENDING_DELIVERY_IT', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
];

// ── IT Hardware Procurement ───────────────────────────────────────────────
const IT_HARDWARE: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'ACKNOWLEDGED_IT', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'SUBMITTED', toStatus: 'PROCUREMENT_IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ACKNOWLEDGED_IT', toStatus: 'PROCUREMENT_IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ACKNOWLEDGED_IT', toStatus: 'PENDING_CEO_APPROVAL_IT', transitionLabel: 'ESCALATE', requiresComment: false },
  { fromStatus: 'PROCUREMENT_IN_PROGRESS', toStatus: 'HARDWARE_ORDERED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'HARDWARE_ORDERED', toStatus: 'HARDWARE_RECEIVED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'HARDWARE_RECEIVED', toStatus: 'SOFTWARE_PROVISIONED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'SOFTWARE_PROVISIONED', toStatus: 'RESOLVED', transitionLabel: 'RESOLVE', requiresComment: false },
  { fromStatus: 'SOFTWARE_PROVISIONED', toStatus: 'PENDING_CEO_APPROVAL_IT', transitionLabel: 'ESCALATE', requiresComment: false },
  // Approval chain shared with IT Procurement
  { fromStatus: 'PENDING_CEO_APPROVAL_IT', toStatus: 'CEO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL_IT', toStatus: 'CEO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CEO_APPROVED_IT', toStatus: 'PENDING_CTO_APPROVAL_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CEO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'CTO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'CTO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'PENDING_CTO_APPROVAL_IT', toStatus: 'PENDING_CFO_APPROVAL_IT', transitionLabel: 'ESCALATE', requiresComment: false },
  { fromStatus: 'CTO_APPROVED_IT', toStatus: 'PENDING_INVOICE_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CTO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_INVOICE_IT', toStatus: 'PENDING_CFO_APPROVAL_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_IT', toStatus: 'CFO_APPROVED_IT', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_IT', toStatus: 'CFO_REJECTED_IT', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CFO_APPROVED_IT', toStatus: 'PAYMENT_PROCESSING_IT', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_REJECTED_IT', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING_IT', toStatus: 'PAYMENT_DONE_IT', transitionLabel: 'ADVANCE', requiresComment: false },
];

// ── Finance Purchase Requisition ──────────────────────────────────────────
const FINANCE: TransitionDef[] = [
  { fromStatus: 'FINANCE_PENDING_ACK', toStatus: 'FINANCE_ACKNOWLEDGED', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'FINANCE_ACKNOWLEDGED', toStatus: 'FINANCE_IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FINANCE_ACKNOWLEDGED', toStatus: 'PENDING_CFO_APPROVAL_FIN', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'FINANCE_IN_PROGRESS', toStatus: 'PENDING_CFO_APPROVAL_FIN', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'FINANCE_IN_PROGRESS', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_APPROVED_FIN', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_REJECTED_FIN', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'PENDING_GROUP_DCEO_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'PAYMENT_PROCESSING_FIN', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'FINANCE_IN_PROGRESS', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'COMPLETED', transitionLabel: 'COMPLETE', requiresComment: false },
  { fromStatus: 'CFO_REJECTED_FIN', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'GROUP_DCEO_REJECTED', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'GROUP_DCEO_APPROVED', toStatus: 'PAYMENT_PROCESSING_FIN', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING_FIN', toStatus: 'AWAITING_PAYMENT_CONFIRMATION', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'AWAITING_PAYMENT_CONFIRMATION', toStatus: 'PAYMENT_CONFIRMED_FIN', transitionLabel: 'CONFIRM', requiresComment: false },
  { fromStatus: 'AWAITING_PAYMENT_CONFIRMATION', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PAYMENT_CONFIRMED_FIN', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── Expense Reimbursement ────────────────────────────────────────────────
const EXPENSE_REIMBURSEMENT: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'PENDING_MANAGER_APPROVAL_FIN', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_APPROVAL_FIN', toStatus: 'MANAGER_APPROVED_FIN', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_APPROVAL_FIN', toStatus: 'MANAGER_REJECTED_FIN', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'MANAGER_APPROVED_FIN', toStatus: 'PENDING_FINANCE_HEAD_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'MANAGER_REJECTED_FIN', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PENDING_FINANCE_HEAD_APPROVAL', toStatus: 'FINANCE_HEAD_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_FINANCE_HEAD_APPROVAL', toStatus: 'FINANCE_HEAD_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'FINANCE_HEAD_APPROVED', toStatus: 'PAYMENT_PROCESSING', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FINANCE_HEAD_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING', toStatus: 'PAYMENT_COMPLETED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PAYMENT_COMPLETED', toStatus: 'REIMBURSEMENT_CLOSED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── Inter-Company Chargeback ──────────────────────────────────────────────
const CHARGEBACK: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'PENDING_FROM_ENTITY_APPROVAL', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'PENDING_FROM_ENTITY_APPROVAL', toStatus: 'FROM_ENTITY_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_FROM_ENTITY_APPROVAL', toStatus: 'FROM_ENTITY_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'PENDING_FROM_ENTITY_APPROVAL', toStatus: 'PENDING_TO_ENTITY_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FROM_ENTITY_APPROVED', toStatus: 'PENDING_TO_ENTITY_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FROM_ENTITY_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PENDING_TO_ENTITY_APPROVAL', toStatus: 'TO_ENTITY_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_TO_ENTITY_APPROVAL', toStatus: 'TO_ENTITY_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'PENDING_TO_ENTITY_APPROVAL', toStatus: 'CHARGEBACK_FINANCE_REVIEW', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'TO_ENTITY_APPROVED', toStatus: 'CHARGEBACK_FINANCE_REVIEW', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'TO_ENTITY_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'CHARGEBACK_FINANCE_REVIEW', toStatus: 'AWAITING_CHARGEBACK_CONFIRMATION', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'AWAITING_CHARGEBACK_CONFIRMATION', toStatus: 'CHARGEBACK_COMPLETED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── Onboarding ────────────────────────────────────────────────────────────
const ONBOARDING: TransitionDef[] = [
  { fromStatus: 'COMPLETED', toStatus: 'ONBOARDING_SUBMITTED', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'ONBOARDING_SUBMITTED', toStatus: 'ONBOARDING_PENDING_HR_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_PENDING_HR_APPROVAL', toStatus: 'ONBOARDING_PRE_ARRIVAL_SETUP', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_PRE_ARRIVAL_SETUP', toStatus: 'ONBOARDING_READY_FOR_DAY_1', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_READY_FOR_DAY_1', toStatus: 'ONBOARDING_DAY_1_ORIENTATION', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_DAY_1_ORIENTATION', toStatus: 'ONBOARDING_WEEK_1_INTEGRATION', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_WEEK_1_INTEGRATION', toStatus: 'ONBOARDING_MONTH_1_MILESTONE', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_MONTH_1_MILESTONE', toStatus: 'ONBOARDING_MONTH_2_MILESTONE', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_MONTH_2_MILESTONE', toStatus: 'ONBOARDING_MONTH_3_MILESTONE', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'ONBOARDING_MONTH_3_MILESTONE', toStatus: 'ONBOARDING_COMPLETED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── Offboarding ────────────────────────────────────────────────────────────
const OFFBOARDING: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'OFFBOARDING_SUBMITTED', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'OFFBOARDING_SUBMITTED', toStatus: 'OFFBOARDING_NOTICE_PERIOD', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'OFFBOARDING_NOTICE_PERIOD', toStatus: 'OFFBOARDING_KNOWLEDGE_TRANSFER', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'OFFBOARDING_KNOWLEDGE_TRANSFER', toStatus: 'OFFBOARDING_FINAL_WEEK', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'OFFBOARDING_FINAL_WEEK', toStatus: 'OFFBOARDING_EXIT_PROCEDURES', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'OFFBOARDING_EXIT_PROCEDURES', toStatus: 'OFFBOARDING_COMPLETED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── HR Screening direct entry ──────────────────────────────────────────────
const HR_SCREENING: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'HR_SCREENING', transitionLabel: 'ADVANCE', requiresComment: false },
];

// ── ESM Travel Request ────────────────────────────────────────────────────
const ESM_TRAVEL: TransitionDef[] = [
  { fromStatus: 'SUBMITTED', toStatus: 'PENDING_CEO_APPROVAL', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL', toStatus: 'CEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CEO_APPROVAL', toStatus: 'CEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CEO_APPROVED', toStatus: 'PENDING_GROUP_DCEO_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CEO_APPROVED', toStatus: 'GROUP_DCEO_APPROVED', transitionLabel: 'SKIP', requiresComment: false },  // Skip when CEO approver holds GROUP_DCEO role
  { fromStatus: 'CEO_REJECTED', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'GROUP_DCEO_APPROVED', toStatus: 'FINANCE_ACKNOWLEDGED', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'GROUP_DCEO_REJECTED', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'FINANCE_ACKNOWLEDGED', toStatus: 'PENDING_CFO_APPROVAL_FIN', transitionLabel: 'ROUTE_TO_CFO', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_APPROVED_FIN', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_REJECTED_FIN', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'COMPLETED', transitionLabel: 'COMPLETE', requiresComment: false },
  { fromStatus: 'CFO_REJECTED_FIN', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'COMPLETED', toStatus: 'RESOLVED', transitionLabel: 'CLOSE', requiresComment: false },
];

// ── All transitions combined (deduped) ─────────────────────────────────────
const ALL_TRANSITIONS: TransitionDef[] = [
  ...IT_SIMPLE,
  ...HR_RECRUITMENT,
  ...IT_PROCUREMENT,
  ...IT_HARDWARE,
  ...FINANCE,
  ...EXPENSE_REIMBURSEMENT,
  ...CHARGEBACK,
  ...ONBOARDING,
  ...OFFBOARDING,
  ...HR_SCREENING,
  ...ESM_TRAVEL,
];

async function main() {
  console.log('🏗️  Seeding ESM workflow transitions...');

  // Deduplicate by (fromStatus, toStatus) pair
  const seen = new Set<string>();
  const unique: TransitionDef[] = [];
  for (const t of ALL_TRANSITIONS) {
    const key = `${t.fromStatus}→${t.toStatus}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const t of unique) {
    const existing = await prisma.workflowTransition.findUnique({
      where: { fromStatus_toStatus: { fromStatus: t.fromStatus, toStatus: t.toStatus } },
    });

    if (existing) {
      // Only refresh label & requiresComment; don't overwrite admin customisations
      if (existing.transitionLabel !== t.transitionLabel || existing.requiresComment !== t.requiresComment) {
        await prisma.workflowTransition.update({
          where: { id: existing.id },
          data: {
            transitionLabel: t.transitionLabel,
            requiresComment: t.requiresComment,
          },
        });
        updated++;
      } else {
        unchanged++;
      }
    } else {
      await prisma.workflowTransition.create({
        data: {
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          transitionLabel: t.transitionLabel,
          requiresComment: t.requiresComment,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`✅ ESM transitions: ${created} created, ${updated} updated, ${unchanged} unchanged (${unique.length} total unique)`);
  console.log('✅ ESM workflow transitions seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });