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
  workflowSteps?: { step: string; label: string; order: number }[];
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

type StepState = 'completed' | 'current' | 'upcoming';

interface StepItem {
  step: string;
  label: string;
  order: number;
  state: StepState;
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
  PENDING_GROUP_CEO_APPROVAL: 'Group CEO Approval',
  GROUP_CEO_APPROVED: 'Group CEO Approved',
  GROUP_CEO_REJECTED: 'Group CEO Rejected',
  PENDING_MANAGER_APPROVAL_FIN: 'Manager Approval',
  MANAGER_APPROVED_FIN: 'Manager Approved',
  MANAGER_REJECTED_FIN: 'Manager Rejected',
  PAYMENT_PROCESSING: 'Payment Processing',
  PAYMENT_COMPLETED: 'Payment Completed',
  REIMBURSEMENT_CLOSED: 'Reimbursement Closed',
  FINANCE_PENDING_ACK: 'Acknowledgement',
  FINANCE_ACKNOWLEDGED: 'Acknowledged',
  FINANCE_IN_PROGRESS: 'In Progress',
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
// Helper: build ordered steps from workflowSteps prop or STATUS_TO_STEP fallback
// ---------------------------------------------------------------------------

function buildSteps(
  status: string,
  workflowSteps?: { step: string; label: string; order: number }[],
): StepItem[] {
  // If custom steps are provided, use them
  if (workflowSteps && workflowSteps.length > 0) {
    const sorted = [...workflowSteps].sort((a, b) => a.order - b.order);
    const currentIdx = sorted.findIndex(s => s.step === status);
    return sorted.map((s, i) => ({
      step: s.step,
      label: s.label,
      order: s.order,
      state: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'upcoming',
    }));
  }

  // Fallback: use a single "In Progress" node if we can't map the status
  const label = STATUS_TO_STEP[status] ?? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return [{ step: status, label, order: 0, state: 'current' as StepState }];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ request, workflowSteps, approvals }) => {
  const [expanded, setExpanded] = useState(false);
  const [popoverStep, setPopoverStep] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(request.status, workflowSteps), [request.status, workflowSteps]);

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

  // Collapsible logic: show first 3 + "... + N more" if > 5 steps
  const COLLAPSE_THRESHOLD = 5;
  const shouldCollapse = steps.length > COLLAPSE_THRESHOLD;
  const visibleSteps = shouldCollapse && !expanded ? steps.slice(0, 3) : steps;
  const hiddenCount = shouldCollapse && !expanded ? steps.length - 3 : 0;

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

  const currentStepIndex = steps.findIndex(s => s.state === 'current');

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">timeline</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Workflow</span>
        </div>
        {/* SLA badge on current step */}
        {slaDueMs !== null && !request.resolvedAt && (
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
        )}
      </div>

      {/* Desktop: Horizontal stepper */}
      <div className="hidden md:block">
        <div className="flex items-start gap-0 relative">
          {visibleSteps.map((step, idx) => {
            const isLast = idx === visibleSteps.length - 1;
            const isPopoverOpen = popoverStep === step.step;

            return (
              <div key={step.step} className="flex-1 relative min-w-0">
                {/* Connector line */}
                {idx > 0 && (
                  <div className={`absolute top-2.5 -left-[50%] w-full h-0.5 ${
                    step.state === 'completed' || step.state === 'current'
                      ? 'bg-emerald-400'
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
                        : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>

                  {/* Popover */}
                  {isPopoverOpen && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left">
                      <div className="text-xs font-bold text-gray-800 mb-1">{step.label}</div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                        step.state === 'completed' ? 'text-emerald-600' : step.state === 'current' ? 'text-[#0052cc]' : 'text-gray-400'
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

      {/* Mobile: Vertical stepper */}
      <div className="md:hidden space-y-0">
        {visibleSteps.map((step, idx) => {
          const isLast = idx === visibleSteps.length - 1;
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
                    step.state === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 ${isLast ? '' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${
                    step.state === 'current' ? 'text-[#0052cc]' : step.state === 'completed' ? 'text-emerald-700' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {step.state === 'current' && slaDueMs !== null && !request.resolvedAt && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isBreached ? 'bg-red-50 text-red-700' : isPaused ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isPaused ? 'Paused' : isBreached ? 'Breached' : formatRemaining(slaDueMs)}
                    </span>
                  )}
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

      {/* Collapse / expand toggle */}
      {shouldCollapse && (
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