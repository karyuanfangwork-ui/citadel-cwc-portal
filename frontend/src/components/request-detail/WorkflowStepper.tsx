import React, { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowStepperProps {
  request: {
    id: string;
    status: string;
    slaDueAt?: string | null;
    slaPausedAt?: string | null;
    slaPauseDurationMs?: number | bigint | null;
    createdAt: string;
    resolvedAt?: string | null;
  };
  workflowSteps?: { step: string; label: string; order: number; isFinal?: boolean }[];
  approvals?: {
    id: string;
    approverId: string;
    approverType: string;
    status: string;
    comments: string | null;
    createdAt: string;
    updatedAt: string;
    approver: { id: string; firstName: string; lastName: string; email: string };
    entity: { id: string; name: string; code: string } | null;
  }[];
}

type StepState = 'completed' | 'current' | 'upcoming' | 'rejected';

interface StepItem {
  step: string;
  label: string;
  order: number;
  state: StepState;
  isFinal?: boolean;
}

// ---------------------------------------------------------------------------
// STATUS_TO_STEP mapping – groups statuses into logical workflow steps
// ---------------------------------------------------------------------------

const STATUS_TO_STEP: Record<string, string> = {
  // General
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In Review',
  ACTION_REQUIRED: 'Action Required',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
  COMPLETED: 'Completed',

  // IT Workflow
  ACKNOWLEDGED_IT: 'Acknowledged',
  PENDING_CEO_APPROVAL_IT: 'CEO Approval',
  CEO_APPROVED_IT: 'CEO Approved',
  CEO_REJECTED_IT: 'CEO Rejected',
  PENDING_CTO_APPROVAL_IT: 'CTO Approval',
  CTO_APPROVED_IT: 'CTO Approved',
  CTO_REJECTED_IT: 'CTO Rejected',
  PENDING_CFO_APPROVAL_IT: 'CFO Approval',
  CFO_APPROVED_IT: 'CFO Approved',
  CFO_REJECTED_IT: 'CFO Rejected',
  PROCUREMENT_IN_PROGRESS: 'Procurement',
  HARDWARE_ORDERED: 'Hardware Ordered',
  HARDWARE_RECEIVED: 'Hardware Received',
  SOFTWARE_PROVISIONED: 'Software Provisioned',
  PENDING_INVOICE_IT: 'Pending Invoice',
  PAYMENT_PROCESSING_IT: 'Payment Processing',
  PAYMENT_DONE_IT: 'Payment Done',
  PENDING_DELIVERY_IT: 'Pending Delivery',

  // HR / Hiring
  PENDING_CEO_APPROVAL: 'CEO Approval',
  CEO_APPROVED: 'CEO Approved',
  CEO_REJECTED: 'CEO Rejected',
  PENDING_MANAGER_REVIEW: 'Manager Review',
  MANAGER_APPROVED: 'Manager Approved',
  JOB_POSTED: 'Job Posted',
  HR_SCREENING: 'HR Screening',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_FEEDBACK_PENDING: 'Interview Feedback',
  CANDIDATE_REJECTED_INTERVIEW: 'Candidate Rejected',
  LOA_PENDING_APPROVAL: 'LOA Pending',
  LOA_APPROVED: 'LOA Approved',
  LOA_ISSUED: 'LOA Issued',
  LOA_ACCEPTED: 'LOA Accepted',

  // Onboarding
  ONBOARDING_SUBMITTED: 'Onboarding Submitted',
  ONBOARDING_PENDING_HR_APPROVAL: 'HR Approval',
  ONBOARDING_PRE_ARRIVAL_SETUP: 'Pre-Arrival Setup',
  ONBOARDING_READY_FOR_DAY_1: 'Ready for Day 1',
  ONBOARDING_DAY_1_ORIENTATION: 'Day 1 Orientation',
  ONBOARDING_WEEK_1_INTEGRATION: 'Week 1 Integration',
  ONBOARDING_MONTH_1_MILESTONE: 'Month 1 Milestone',
  ONBOARDING_MONTH_2_MILESTONE: 'Month 2 Milestone',
  ONBOARDING_MONTH_3_MILESTONE: 'Month 3 Milestone',
  ONBOARDING_COMPLETED: 'Onboarding Complete',

  // Offboarding
  OFFBOARDING_SUBMITTED: 'Offboarding Submitted',
  OFFBOARDING_NOTICE_PERIOD: 'Notice Period',
  OFFBOARDING_KNOWLEDGE_TRANSFER: 'Knowledge Transfer',
  OFFBOARDING_FINAL_WEEK: 'Final Week',
  OFFBOARDING_EXIT_PROCEDURES: 'Exit Procedures',
  OFFBOARDING_COMPLETED: 'Offboarding Complete',

  // Finance
  PENDING_FINANCE_HEAD_APPROVAL: 'Finance Head Approval',
  FINANCE_HEAD_APPROVED: 'Finance Head Approved',
  FINANCE_HEAD_REJECTED: 'Finance Head Rejected',
  PENDING_CFO_APPROVAL_FIN: 'CFO Approval',
  CFO_APPROVED_FIN: 'CFO Approved',
  CFO_REJECTED_FIN: 'CFO Rejected',
  PENDING_GROUP_DCEO_APPROVAL: 'Group Deputy CEO Approval',
  GROUP_DCEO_APPROVED: 'Group Deputy CEO Approved',
  GROUP_DCEO_REJECTED: 'Group Deputy CEO Rejected',
  PENDING_MANAGER_APPROVAL_FIN: 'Manager Approval',
  MANAGER_APPROVED_FIN: 'Manager Approved',
  MANAGER_REJECTED_FIN: 'Manager Rejected',
  PAYMENT_PROCESSING: 'Payment Processing',
  PAYMENT_PROCESSING_FIN: 'Payment Processing',
  PAYMENT_COMPLETED: 'Payment Completed',
  REIMBURSEMENT_CLOSED: 'Reimbursement Closed',
  FINANCE_PENDING_ACK: 'Acknowledgement',
  FINANCE_ACKNOWLEDGED: 'Acknowledged',
  FINANCE_IN_PROGRESS: 'Finance Updating',
  AWAITING_PAYMENT_CONFIRMATION: 'Awaiting Payment',
  PAYMENT_CONFIRMED_FIN: 'Payment Confirmed',
  TICKET_CLOSED_FIN: 'Ticket Closed',

  // Inter-Company Chargeback
  PENDING_FROM_ENTITY_APPROVAL: 'From-Entity Approval',
  FROM_ENTITY_APPROVED: 'From-Entity Approved',
  FROM_ENTITY_REJECTED: 'From-Entity Rejected',
  PENDING_TO_ENTITY_APPROVAL: 'To-Entity Approval',
  TO_ENTITY_APPROVED: 'To-Entity Approved',
  TO_ENTITY_REJECTED: 'To-Entity Rejected',
  CHARGEBACK_FINANCE_REVIEW: 'Finance Review',
  AWAITING_CHARGEBACK_CONFIRMATION: 'Awaiting Confirmation',
  CHARGEBACK_COMPLETED: 'Chargeback Completed',
};

// ---------------------------------------------------------------------------
// Helper: SLA remaining time formatting
// ---------------------------------------------------------------------------

const formatRemaining = (ms: number): string => {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// ---------------------------------------------------------------------------
// Terminal statuses — the workflow is done; all steps should show as completed.
// ---------------------------------------------------------------------------
const TERMINAL_STATUSES = new Set([
  'COMPLETED', 'RESOLVED', 'REJECTED',
  'TICKET_CLOSED_FIN', 'REIMBURSEMENT_CLOSED', 'PAYMENT_COMPLETED',
  'CHARGEBACK_COMPLETED', 'ONBOARDING_COMPLETED', 'OFFBOARDING_COMPLETED',
  'CFO_REJECTED_FIN', 'CEO_REJECTED', 'CEO_REJECTED_IT', 'CTO_REJECTED_IT',
  'FINANCE_HEAD_REJECTED', 'MANAGER_REJECTED_FIN', 'GROUP_DCEO_REJECTED',
  'FROM_ENTITY_REJECTED', 'TO_ENTITY_REJECTED', 'CANDIDATE_REJECTED_INTERVIEW',
]);

// Rejected statuses — terminal but ended in rejection (show red "Rejected" badge)
const REJECTED_STATUSES = new Set([
  'REJECTED', 'CFO_REJECTED_FIN', 'CEO_REJECTED', 'CEO_REJECTED_IT', 'CTO_REJECTED_IT',
  'FINANCE_HEAD_REJECTED', 'MANAGER_REJECTED_FIN', 'GROUP_DCEO_REJECTED',
  'FROM_ENTITY_REJECTED', 'TO_ENTITY_REJECTED', 'CANDIDATE_REJECTED_INTERVIEW',
]);

// ---------------------------------------------------------------------------
// Threshold for switching from horizontal to vertical layout
// ---------------------------------------------------------------------------
const MANY_STEPS_THRESHOLD = 7;

// ---------------------------------------------------------------------------
// Helper: build ordered steps from workflowSteps prop or STATUS_TO_STEP fallback
// ---------------------------------------------------------------------------

/**
 * Ordered list of all known statuses used to infer position when the exact
 * status doesn't appear in the workflow steps list.  This allows the
 * stepper to still show progress when a request has transitioned to a
 * status that isn't (yet) defined as a workflow step.
 */
const STATUS_ORDER: string[] = [
  // General / early
  'SUBMITTED', 'IN_REVIEW', 'ACTION_REQUIRED', 'IN_PROGRESS', 'WAITING',
  // IT
  'ACKNOWLEDGED_IT', 'PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT', 'CEO_REJECTED_IT',
  'PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT', 'CTO_REJECTED_IT',
  'PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT', 'CFO_REJECTED_IT',
  'PROCUREMENT_IN_PROGRESS', 'HARDWARE_ORDERED', 'HARDWARE_RECEIVED', 'SOFTWARE_PROVISIONED',
  'PENDING_INVOICE_IT', 'PAYMENT_PROCESSING_IT', 'PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT',
  // HR / Hiring
  'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
  'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED',
  'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
  'HR_SCREENING',
  'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW',
  'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED',
  // Onboarding
  'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL', 'ONBOARDING_PRE_ARRIVAL_SETUP',
  'ONBOARDING_READY_FOR_DAY_1', 'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
  'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE', 'ONBOARDING_MONTH_3_MILESTONE',
  'ONBOARDING_COMPLETED',
  // Offboarding
  'OFFBOARDING_SUBMITTED', 'OFFBOARDING_NOTICE_PERIOD', 'OFFBOARDING_KNOWLEDGE_TRANSFER',
  'OFFBOARDING_FINAL_WEEK', 'OFFBOARDING_EXIT_PROCEDURES', 'OFFBOARDING_COMPLETED',
  // Finance
  'FINANCE_PENDING_ACK', 'FINANCE_ACKNOWLEDGED', 'FINANCE_IN_PROGRESS',
  'PENDING_FINANCE_HEAD_APPROVAL', 'FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED',
  'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN', 'CFO_REJECTED_FIN',
  'PENDING_MANAGER_APPROVAL_FIN', 'MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN',
  'PENDING_GROUP_DCEO_APPROVAL', 'GROUP_DCEO_APPROVED', 'GROUP_DCEO_REJECTED',
  'PAYMENT_PROCESSING', 'PAYMENT_PROCESSING_FIN', 'REIMBURSEMENT_CLOSED',
  'AWAITING_PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMED_FIN', 'PAYMENT_COMPLETED', 'TICKET_CLOSED_FIN',
  // Chargeback
  'PENDING_FROM_ENTITY_APPROVAL', 'FROM_ENTITY_APPROVED', 'FROM_ENTITY_REJECTED',
  'PENDING_TO_ENTITY_APPROVAL', 'TO_ENTITY_APPROVED', 'TO_ENTITY_REJECTED',
  'CHARGEBACK_FINANCE_REVIEW', 'AWAITING_CHARGEBACK_CONFIRMATION', 'CHARGEBACK_COMPLETED',
  // Terminal
  'APPROVED', 'REJECTED', 'RESOLVED', 'COMPLETED',
];

/**
 * Approval-based step statuses: if a step key maps to an approverType,
 * it should only be marked "completed" when an APPROVED approval record exists.
 * Steps without an entry fall back to position-based completion.
 */
const APPROVAL_STEP_TYPES: Record<string, string> = {
  PENDING_CEO_APPROVAL: 'CEO',
  CEO_APPROVED: 'CEO',
  PENDING_GROUP_DCEO_APPROVAL: 'GROUP_DCEO',
  GROUP_DCEO_APPROVED: 'GROUP_DCEO',
  PENDING_CTO_APPROVAL_IT: 'CTO',
  CEO_APPROVED_IT: 'CEO',
  PENDING_CFO_APPROVAL_IT: 'CFO',
  CFO_APPROVED_IT: 'CFO',
  PENDING_CFO_APPROVAL_FIN: 'CFO',
  CFO_APPROVED_FIN: 'CFO',
  PENDING_MANAGER_REVIEW: 'HIRING_MANAGER',
  MANAGER_APPROVED: 'HIRING_MANAGER',
};

function buildSteps(
  status: string,
  workflowSteps?: { step: string; label: string; order: number; isFinal?: boolean }[],
  resolvedAt?: string | null,
  approvals?: { approverType: string; status: string }[],
): StepItem[] {
  const isTerminal = TERMINAL_STATUSES.has(status);
  const isResolved = !!resolvedAt;

  // If custom steps are provided, use them
  if (workflowSteps && workflowSteps.length > 0) {
    const sorted = [...workflowSteps].sort((a, b) => a.order - b.order);
    const currentIdx = sorted.findIndex(s => s.step === status);

    // ── Terminal / resolved: mark steps appropriately ──
    if (isTerminal || (isResolved && currentIdx !== -1 && sorted[currentIdx]?.isFinal)) {
      const isRejected = REJECTED_STATUSES.has(status);
      const rejectionIdx = isRejected && currentIdx !== -1 ? currentIdx : -1;

      return sorted.map((s, i) => ({
        step: s.step,
        label: s.label,
        order: s.order,
        state: rejectionIdx !== -1
          ? i < rejectionIdx ? 'completed' as StepState
            : i === rejectionIdx ? 'rejected' as StepState
            : 'upcoming' as StepState
          : 'completed' as StepState,
      }));
    }

    if (currentIdx !== -1) {
      // Exact match — use approval records to determine which steps are truly completed
      // For approval-based steps (CEO, GROUP_DCEO, etc.), a step is only "completed"
      // if there's an APPROVED approval record for that approver type, OR if a later
      // step in the same approval chain has an APPROVED record (proving the earlier one passed).
      const approvedTypes = new Set<string>();
      if (approvals) {
        for (const a of approvals) {
          if (a.status === 'APPROVED') approvedTypes.add(a.approverType);
        }
      }

      return sorted.map((s, i) => {
        const approvalType = APPROVAL_STEP_TYPES[s.step];
        // If this step is approval-gated and there's no matching approved record,
        // it hasn't been completed yet.
        if (approvalType && !approvedTypes.has(approvalType)) {
          // Is this the current step?
          if (i === currentIdx) return { step: s.step, label: s.label, order: s.order, state: 'current' as StepState };
          // It's a future step (not yet reached)
          return { step: s.step, label: s.label, order: s.order, state: 'upcoming' as StepState };
        }
        // Non-approval step or approval already granted — position-based logic
        if (i < currentIdx) return { step: s.step, label: s.label, order: s.order, state: 'completed' as StepState };
        if (i === currentIdx) return { step: s.step, label: s.label, order: s.order, state: 'current' as StepState };
        return { step: s.step, label: s.label, order: s.order, state: 'upcoming' as StepState };
      });
    }

    // Status not in steps — use STATUS_ORDER to infer which steps are completed.
    const currentGlobalIdx = STATUS_ORDER.indexOf(status);
    const statusLabel = STATUS_TO_STEP[status] ?? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // If terminal and not in steps, mark steps appropriately
    if (isTerminal) {
      const isRejected = REJECTED_STATUSES.has(status);
      // Rejection not found in steps → mark all completed, append red rejection step at end
      if (isRejected) {
        const items: StepItem[] = sorted.map((s) => ({
          step: s.step,
          label: s.label,
          order: s.order,
          state: 'completed' as StepState,
        }));
        items.push({ step: status, label: statusLabel, order: sorted.length, state: 'rejected' });
        return items;
      }
      return sorted.map((s) => ({
        step: s.step,
        label: s.label,
        order: s.order,
        state: 'completed' as StepState,
      }));
    }

    if (currentGlobalIdx === -1) {
      // Unknown status — treat everything up to last step as completed and append current
      const items: StepItem[] = sorted.map((s) => ({
        step: s.step,
        label: s.label,
        order: s.order,
        state: 'completed' as StepState,
      }));
      items.push({ step: status, label: statusLabel, order: sorted.length, state: 'current' });
      return items;
    }

    // For each workflow step, compute its global order and compare to current
    const items: StepItem[] = [];
    let inserted = false;
    for (const s of sorted) {
      const stepGlobalIdx = STATUS_ORDER.indexOf(s.step);
      // If current status comes before this step globally, insert current first
      if (!inserted && (stepGlobalIdx === -1 || currentGlobalIdx < stepGlobalIdx)) {
        items.push({ step: status, label: statusLabel, order: s.order - 0.5, state: 'current' });
        inserted = true;
      }
      items.push({
        step: s.step,
        label: s.label,
        order: s.order,
        state: inserted ? 'upcoming' : 'completed',
      });
    }
    // If current status is after all steps, append it
    if (!inserted) {
      items.push({ step: status, label: statusLabel, order: sorted.length, state: 'current' });
    }
    return items;
  }

  // Fallback: use a single node if we can't map the status
  const label = STATUS_TO_STEP[status] ?? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  if (isTerminal) {
    const state = REJECTED_STATUSES.has(status) ? 'rejected' as StepState : 'completed' as StepState;
    return [{ step: status, label, order: 0, state }];
  }
  return [{ step: status, label, order: 0, state: 'current' as StepState }];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ request, workflowSteps, approvals }) => {
  const [expanded, setExpanded] = useState(false);
  const [popoverStep, setPopoverStep] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(request.status, workflowSteps, request.resolvedAt, approvals), [request.status, workflowSteps, request.resolvedAt, approvals]);

  // Whether the entire workflow is in a terminal state (all steps resolved — completed or rejected)
  const workflowDone = steps.length > 0 && steps.every(s => s.state === 'completed' || s.state === 'rejected');
  const workflowRejected = REJECTED_STATUSES.has(request.status);

  // SLA computation
  const slaDueMs = request.slaDueAt ? new Date(request.slaDueAt).getTime() - Date.now() : null;
  const isBreached = slaDueMs !== null && slaDueMs < 0 && !request.resolvedAt;
  const isPaused = !!request.slaPausedAt && !request.resolvedAt;

  // Approval lookup for popover
  const approvalMap = useMemo(() => {
    const map = new Map<string, typeof approvals extends undefined ? never : NonNullable<typeof approvals>[number]>();
    if (!approvals) return map;
    for (const a of approvals) {
      map.set(a.approverType, a);
    }
    return map;
  }, [approvals]);

  // Layout decision: horizontal for few steps, vertical for many
  const useVerticalLayout = steps.length > MANY_STEPS_THRESHOLD;

  // Collapsible logic: only applies to horizontal layout
  const COLLAPSE_THRESHOLD = 5;
  const shouldCollapse = !useVerticalLayout && steps.length > COLLAPSE_THRESHOLD;
  const visibleSteps = shouldCollapse && !expanded && !workflowDone ? steps.slice(0, 3) : steps;
  const hiddenCount = shouldCollapse && !expanded && !workflowDone ? steps.length - 3 : 0;

  // Vertical smart truncation: last 2 completed + current + next 2 upcoming
  const verticalTruncatedSteps = useMemo(() => {
    if (workflowDone || !useVerticalLayout) return steps;
    const currentIdx = steps.findIndex(s => s.state === 'current');
    if (currentIdx === -1) return steps;
    const start = Math.max(0, currentIdx - 2);
    const end = Math.min(steps.length, currentIdx + 3);
    return steps.slice(start, end);
  }, [steps, workflowDone, useVerticalLayout]);

  const verticalHiddenBefore = useVerticalLayout && !workflowDone && !expanded
    ? Math.max(0, steps.findIndex(s => s.state === 'current') - 2)
    : 0;
  const verticalHiddenAfter = useVerticalLayout && !workflowDone && !expanded
    ? Math.max(0, steps.length - Math.min(steps.length, steps.findIndex(s => s.state === 'current') + 3))
    : 0;
  const verticalIsTruncated = verticalHiddenBefore > 0 || verticalHiddenAfter > 0;

  // Empty state
  if (steps.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">timeline</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Workflow</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <span className="material-symbols-outlined text-2xl text-blue-400 animate-pulse mr-2">pending</span>
          <span className="text-sm text-gray-500">In Progress</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Shared: render an approval inline chip for a step
  // -------------------------------------------------------------------------
  const renderApprovalInline = (stepKey: string) => {
    const approval = approvalMap.get(stepKey);
    if (!approval) return null;
    return (
      <span className="inline-flex items-center gap-1 ml-1.5">
        <span className={`material-symbols-outlined text-xs ${approval.status === 'APPROVED' ? 'text-emerald-500' : approval.status === 'REJECTED' ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true">
          {approval.status === 'APPROVED' ? 'check_circle' : approval.status === 'REJECTED' ? 'cancel' : 'schedule'}
        </span>
        <span className="text-[10px] text-gray-500">
          {approval.approver.firstName} {approval.approver.lastName}
        </span>
      </span>
    );
  };

  // -------------------------------------------------------------------------
  // Shared: SLA timer badge for current step
  // -------------------------------------------------------------------------
  const renderSlaBadge = (compact?: boolean) => {
    if (slaDueMs === null || request.resolvedAt) return null;
    if (compact) {
      return (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          isBreached ? 'bg-red-50 text-red-700' : isPaused ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'
        }`}>
          {isPaused ? 'Paused' : isBreached ? 'Breached' : formatRemaining(slaDueMs)}
        </span>
      );
    }
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        isBreached ? 'bg-red-50 text-red-700' : isPaused ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'
      }`}>
        {isPaused ? 'Paused' : isBreached ? 'Breached' : formatRemaining(slaDueMs)}
      </span>
    );
  };

  // -------------------------------------------------------------------------
  // Shared: header with title + badge
  // -------------------------------------------------------------------------
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">timeline</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Workflow</span>
        {useVerticalLayout && steps.length > 0 && (
          <span className="text-[10px] text-gray-400 font-medium">{steps.filter(s => s.state === 'completed').length}/{steps.length}</span>
        )}
      </div>
      {/* Workflow completed / rejected badge */}
      {workflowDone && workflowRejected ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">cancel</span>
          Rejected
        </div>
      ) : workflowDone ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
          Completed
        </div>
      ) : slaDueMs !== null && !request.resolvedAt ? (
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
          isBreached
            ? 'bg-red-50 text-red-700'
            : isPaused
              ? 'bg-gray-100 text-gray-600'
              : slaDueMs < 3_600_000 * 2
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
        }`}>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            {isPaused ? 'pause_circle' : isBreached ? 'error' : 'schedule'}
          </span>
          {isPaused
            ? `Paused — ${formatRemaining(slaDueMs)} remaining`
            : isBreached
              ? `Breached by ${formatRemaining(slaDueMs)}`
              : `${formatRemaining(slaDueMs)} remaining`
          }
        </div>
      ) : null}
    </div>
  );

  // -------------------------------------------------------------------------
  // Horizontal stepper (≤7 steps on desktop)
  // -------------------------------------------------------------------------
  const renderHorizontalStepper = () => (
    <div className="hidden md:block">
      <div className="flex items-start gap-0 relative">
        {visibleSteps.map((step, idx) => {
          const isPopoverOpen = popoverStep === step.step;

          return (
            <div key={step.step} className="flex-1 relative min-w-0">
              {/* Connector line */}
              {idx > 0 && (
                <div className={`absolute top-2.5 -left-[50%] w-full h-0.5 ${
                  step.state === 'completed' ? 'bg-emerald-400'
                    : step.state === 'rejected' ? 'bg-red-400'
                    : step.state === 'current' ? 'bg-emerald-400'
                    : 'bg-gray-200'
                }`} />
              )}

              {/* Step dot + label */}
              <div className="flex flex-col items-center relative">
                <button
                  type="button"
                  onClick={() => setPopoverStep(isPopoverOpen ? null : step.step)}
                  className="relative z-10 focus:outline-none size-5"
                  aria-label={`Step ${idx + 1}: ${step.label}`}
                >
                  {step.state === 'completed' ? (
                    <div className="size-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xs leading-none" aria-hidden="true">check</span>
                    </div>
                  ) : step.state === 'rejected' ? (
                    <div className="size-5 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xs leading-none" aria-hidden="true">close</span>
                    </div>
                  ) : step.state === 'current' ? (
                    <div className="size-5 rounded-full bg-[#0052cc] flex items-center justify-center animate-pulse">
                      <div className="size-2.5 rounded-full bg-white" />
                    </div>
                  ) : (
                    <div className="size-5 rounded-full border-2 border-gray-300 bg-white" />
                  )}
                </button>

                <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight max-w-full px-0.5 truncate ${
                  step.state === 'current'
                    ? 'text-[#0052cc]'
                    : step.state === 'completed'
                      ? 'text-emerald-700'
                      : step.state === 'rejected'
                        ? 'text-red-600'
                        : 'text-gray-400'
                }`}>
                  {step.label}
                </span>

                {/* Popover */}
                {isPopoverOpen && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left">
                    <div className="text-xs font-bold text-gray-800 mb-1">{step.label}</div>
                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                      step.state === 'completed' ? 'text-emerald-600' : step.state === 'rejected' ? 'text-red-600' : step.state === 'current' ? 'text-[#0052cc]' : 'text-gray-400'
                    }`}>
                      {step.state}
                    </div>
                    {(() => {
                      const approval = approvalMap.get(step.step);
                      if (approval) {
                        return (
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <div className="size-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                                {approval.approver.firstName[0]}{approval.approver.lastName[0]}
                              </div>
                              <span className="font-semibold">{approval.approver.firstName} {approval.approver.lastName}</span>
                            </div>
                            {approval.status !== 'PENDING' && (
                              <div className="flex items-center gap-1">
                                <span className={`material-symbols-outlined text-sm ${
                                  approval.status === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'
                                }`}>
                                  {approval.status === 'APPROVED' ? 'check_circle' : 'cancel'}
                                </span>
                                <span>{approval.status === 'APPROVED' ? 'Approved' : 'Rejected'}</span>
                              </div>
                            )}
                            {approval.status !== 'PENDING' && (
                              <div className="text-[10px] text-gray-400">
                                {new Date(approval.updatedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <div className="text-[10px] text-gray-400 italic">No approval data</div>;
                    })()}
                    {step.state === 'current' && slaDueMs !== null && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                        <span className={`font-semibold ${isBreached ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isPaused ? 'SLA Paused' : isBreached ? 'SLA Breached' : 'SLA Active'}
                        </span>
                        <span className="text-gray-500 ml-1">
                          {formatRemaining(slaDueMs)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Vertical timeline (>7 steps on desktop, always on mobile)
  // Renders a compact, scannable timeline with step labels fully readable.
  // -------------------------------------------------------------------------
  const renderVerticalTimeline = (stepsToRender: StepItem[]) => (
    <div className="space-y-0">
      {stepsToRender.map((step, idx) => {
        const isLast = idx === stepsToRender.length - 1;
        const isPopoverOpen = popoverStep === step.step;

        return (
          <div key={step.step} className="relative flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setPopoverStep(isPopoverOpen ? null : step.step)}
                className="relative z-10 focus:outline-none size-6"
                aria-label={`Step ${idx + 1}: ${step.label}`}
              >
                {step.state === 'completed' ? (
                  <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm leading-none" aria-hidden="true">check</span>
                  </div>
                ) : step.state === 'rejected' ? (
                  <div className="size-6 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm leading-none" aria-hidden="true">close</span>
                  </div>
                ) : step.state === 'current' ? (
                  <div className="size-6 rounded-full bg-[#0052cc] flex items-center justify-center animate-pulse">
                    <div className="size-3 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="size-6 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </button>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${
                  step.state === 'completed' ? 'bg-emerald-400' : step.state === 'rejected' ? 'bg-red-400' : 'bg-gray-200'
                }`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${
                  step.state === 'current' ? 'text-[#0052cc]' : step.state === 'completed' ? 'text-emerald-700' : step.state === 'rejected' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                {step.state === 'current' && !request.resolvedAt && renderSlaBadge()}
                {renderApprovalInline(step.step)}
              </div>

              {/* Popover (mobile uses inline expansion) */}
              {isPopoverOpen && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600">
                  {(() => {
                    const approval = approvalMap.get(step.step);
                    if (approval) {
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="size-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                              {approval.approver.firstName[0]}{approval.approver.lastName[0]}
                            </div>
                            <span className="font-semibold">{approval.approver.firstName} {approval.approver.lastName}</span>
                          </div>
                          {approval.status !== 'PENDING' && (
                            <div className="flex items-center gap-1">
                              <span className={`material-symbols-outlined text-sm ${
                                approval.status === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'
                              }`}>
                                {approval.status === 'APPROVED' ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{approval.status === 'APPROVED' ? 'Approved' : 'Rejected'}</span>
                            </div>
                          )}
                          {approval.status !== 'PENDING' && (
                            <div className="text-[10px] text-gray-400">
                              {new Date(approval.updatedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return <div className="text-[10px] text-gray-400 italic">No approval data</div>;
                  })()}
                  {step.state === 'current' && slaDueMs !== null && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                      <span className={`font-semibold ${isBreached ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isPaused ? 'SLA Paused' : isBreached ? 'SLA Breached' : 'SLA Active'}
                      </span>
                      <span className="text-gray-500 ml-1">{formatRemaining(slaDueMs)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-3">
      {renderHeader()}

      {/* Desktop: horizontal stepper for ≤7 steps, vertical for >7 steps */}
      {useVerticalLayout ? (
        <div className="hidden md:block">
          {verticalHiddenBefore > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mb-2 w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0052cc] transition-colors"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_less</span>
              {verticalHiddenBefore} earlier step{verticalHiddenBefore !== 1 ? 's' : ''}
            </button>
          )}
          {renderVerticalTimeline(expanded ? steps : verticalTruncatedSteps)}
          {verticalHiddenAfter > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0052cc] transition-colors"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_more</span>
              {verticalHiddenAfter} more step{verticalHiddenAfter !== 1 ? 's' : ''}
            </button>
          )}
          {verticalIsTruncated && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-1 w-full flex items-center justify-center gap-1 text-xs font-semibold text-[#0052cc] hover:text-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_less</span>
              Show less
            </button>
          )}
        </div>
      ) : (
        renderHorizontalStepper()
      )}

      {/* Mobile: always vertical timeline with same truncation */}
      <div className="md:hidden">
        {verticalHiddenBefore > 0 && !expanded && useVerticalLayout && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mb-2 w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0052cc] transition-colors"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_less</span>
            {verticalHiddenBefore} earlier step{verticalHiddenBefore !== 1 ? 's' : ''}
          </button>
        )}
        {renderVerticalTimeline(expanded || !useVerticalLayout ? steps : verticalTruncatedSteps)}
        {verticalHiddenAfter > 0 && !expanded && useVerticalLayout && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0052cc] transition-colors"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_more</span>
            {verticalHiddenAfter} more step{verticalHiddenAfter !== 1 ? 's' : ''}
          </button>
        )}
        {verticalIsTruncated && expanded && useVerticalLayout && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-1 w-full flex items-center justify-center gap-1 text-xs font-semibold text-[#0052cc] hover:text-blue-700 transition-colors"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_less</span>
            Show less
          </button>
        )}
      </div>

      {/* Collapse / expand toggle — only for horizontal layout with many steps */}
      {shouldCollapse && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold text-[#0052cc] hover:text-blue-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
          {expanded ? 'Show less' : `+ ${hiddenCount} more step${hiddenCount !== 1 ? 's' : ''}`}
        </button>
      )}

      {/* Click-away to close popover */}
      {popoverStep && (
        <div className="fixed inset-0 z-20" onClick={() => setPopoverStep(null)} />
      )}
    </div>
  );
};

export default WorkflowStepper;