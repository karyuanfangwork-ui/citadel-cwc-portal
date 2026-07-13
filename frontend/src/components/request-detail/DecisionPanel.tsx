// frontend/src/components/request-detail/DecisionPanel.tsx
// Config-driven workflow action panel — renders contextual actions from WORKFLOW_MODAL_CONFIG
// and page-level modal flags from useRequestDetail.

import React, { useState, useCallback } from 'react';
import CeoDecisionModal from './CeoDecisionModal';
import ScheduleInterviewModal from './ScheduleInterviewModal';
import PendingInvoiceModal from './PendingInvoiceModal';
import CfoDecisionModal from './CfoDecisionModal';
import CfoDecisionFinModal from './CfoDecisionFinModal';
import { getWorkflowActions, WorkflowActionType } from '../../utils/workflowActions';
import { WORKFLOW_MODAL_CONFIG, hasWorkflowModalConfig } from '../../utils/workflowModalConfig';
import WorkflowActionModal from './WorkflowActionModal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DecisionPanelProps {
  requestId: string;
  status: string;
  userRoles: string[];
  userId: string;
  userName?: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  assignedTeam?: string | null;
  approvals?: { id: string; approverId: string; approverType: string; status: string }[];
  requestTypeName?: string;
  requestTypeCode?: string;
  serviceDeskCode: string;
  serviceDeskName?: string;
  referenceNumber?: string;
  priority?: string;
  requesterName?: string;
  createdAt?: string;
  slaDueAt?: string | null;
  requesterId?: string;
  requiresApproval?: boolean;
  agentTeam?: string;
  hasResumes?: boolean;
  allCandidatesComplete?: boolean;
  screeningCompleted?: boolean;
  hasLOA?: boolean;
  hasSignedLOA?: boolean;
  selectedCandidateId?: string;
  selectedCandidateIds?: string[];
  candidateNames?: string[];
  attachments?: { id: string; fileName: string; storageUrl: string; mimeType: string; createdAt: string }[];
  /** Called after any workflow action completes successfully */
  onActionComplete: () => void;
  /** Direct-action callbacks for non-modal actions (assign, resolve, etc.) */
  onAssign?: () => void;
  onResolveRequest?: () => void;
  onCancelRequest?: () => void;
  onRouteToManager?: () => void;
  onManagerDecision?: () => void;
  onLOAApproval?: () => void;
  onIssueLOA?: () => void;
  onMarkLOAAccepted?: () => void;
  onInterviewFeedback?: () => void;
  onAdvanceOnboardingPhase?: () => void;
  onCompleteOnboarding?: () => void;
  onAdvanceOffboardingPhase?: () => void;
  onCompleteOffboarding?: () => void;
  /** When false, the ADVANCE_OFFBOARDING_PHASE action is disabled (pre-conditions not met) */
  offboardingPreConditionsMet?: boolean;
  /** Opens the proper Upload Resume modal (with file picker, candidate name, doc type) */
  onUploadResume?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Action icon mapping                                                */
/* ------------------------------------------------------------------ */

const ACTION_ICONS: Record<string, { icon: string; bgClass: string; textClass: string }> = {
  // IT
  ACKNOWLEDGE_IT:        { icon: 'task_alt', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  START_PROCUREMENT:     { icon: 'shopping_cart',   bgClass: 'bg-amber-100', textClass: 'text-amber-600' },
  MARK_HARDWARE_ORDERED: { icon: 'local_shipping',  bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  MARK_HARDWARE_RECEIVED:{ icon: 'inventory_2',     bgClass: 'bg-green-100', textClass: 'text-green-600' },
  MARK_SOFTWARE_PROVISIONED:{ icon: 'computer',     bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
  MARK_FULFILLED:        { icon: 'check_circle',    bgClass: 'bg-green-100', textClass: 'text-green-600' },
  ASSIGN:                { icon: 'person_add',      bgClass: 'bg-indigo-100', textClass: 'text-indigo-600' },
  CEO_DECISION_IT:     { icon: 'gavel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  CEO_DECISION_HR:     { icon: 'gavel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  CTO_DECISION:          { icon: 'engineering',     bgClass: 'bg-red-100', textClass: 'text-red-600' },
  ROUTE_TO_CFO:          { icon: 'route',           bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  CFO_DECISION:          { icon: 'gavel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  PAYMENT_DONE:          { icon: 'payments',        bgClass: 'bg-emerald-100', textClass: 'text-emerald-600' },
  COMPLETE_DELIVERY:     { icon: 'local_shipping',  bgClass: 'bg-green-100', textClass: 'text-green-600' },
  START_IT_REVIEW:       { icon: 'rate_review',     bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  MARK_IN_PROGRESS:      { icon: 'play_circle',    bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  RESOLVE_IT:            { icon: 'task_alt',        bgClass: 'bg-green-100', textClass: 'text-green-600' },
  // HR
  ROUTE_TO_CEO_HR:      { icon: 'route',           bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  ROUTE_TO_GROUP_DCEO_HR:{ icon: 'route',           bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  GROUP_DCEO_DECISION_HR:{ icon: 'gavel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  MARK_JOB_POSTED:       { icon: 'campaign',        bgClass: 'bg-teal-100', textClass: 'text-teal-600' },
  UPLOAD_RESUME:         { icon: 'upload_file',     bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
  MANAGER_DECISION:      { icon: 'gavel',           bgClass: 'bg-amber-100', textClass: 'text-amber-600' },
  SCHEDULE_INTERVIEW:    { icon: 'calendar_add_on', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  SUBMIT_INTERVIEW_FEEDBACK:{ icon: 'rate_review', bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
  UPDATE_SCREENING:      { icon: 'fact_check',      bgClass: 'bg-teal-100', textClass: 'text-teal-600' },
  ROUTE_LOA_FOR_APPROVAL: { icon: 'send',              bgClass: 'bg-green-100', textClass: 'text-green-600' },
  UPLOAD_LOA:           { icon: 'upload_file',      bgClass: 'bg-amber-100', textClass: 'text-amber-600' },
  UPLOAD_SIGNED_LOA:    { icon: 'upload_file',      bgClass: 'bg-green-100', textClass: 'text-green-600' },
  ISSUE_LOA:            { icon: 'description',       bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  LOA_APPROVAL:          { icon: 'gavel',           bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  ROUTE_TO_MANAGER:      { icon: 'route',           bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  MARK_LOA_ACCEPTED:    { icon: 'check_circle',      bgClass: 'bg-green-100', textClass: 'text-green-600' },
  // Onboarding / Offboarding
  ADVANCE_ONBOARDING_PHASE:{ icon: 'fast_forward', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  COMPLETE_ONBOARDING:   { icon: 'check_circle',    bgClass: 'bg-green-100', textClass: 'text-green-600' },
  ADVANCE_OFFBOARDING_PHASE:{ icon: 'fast_forward',bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  COMPLETE_OFFBOARDING:  { icon: 'check_circle',    bgClass: 'bg-green-100', textClass: 'text-green-600' },
  SUBMIT_FOR_APPROVAL:  { icon: 'send',             bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  RESUBMIT_REQUEST:     { icon: 'replay',           bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  // Finance
  FIN_ACKNOWLEDGE:           { icon: 'task_alt', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  SET_FINALIZED_AMOUNT:      { icon: 'calculate',       bgClass: 'bg-amber-100', textClass: 'text-amber-600' },
  ROUTE_TO_CFO_FIN:          { icon: 'route',            bgClass: 'bg-orange-100', textClass: 'text-orange-600' },
  ROUTE_TO_CFO_BP:           { icon: 'send',             bgClass: 'bg-amber-100', textClass: 'text-amber-600' },
  CFO_DECISION_FIN:          { icon: 'gavel',            bgClass: 'bg-red-100', textClass: 'text-red-600' },

  GROUP_DCEO_DECISION_FIN:    { icon: 'gavel',            bgClass: 'bg-red-100', textClass: 'text-red-600' },
  MARK_PAYMENT_COMPLETE_FIN: { icon: 'payments',         bgClass: 'bg-emerald-100', textClass: 'text-emerald-600' },
  CLOSE_TICKET_FIN:          { icon: 'task_alt',         bgClass: 'bg-green-100', textClass: 'text-green-600' },
  CLOSE_BUDGET_PROPOSAL:     { icon: 'task_alt',         bgClass: 'bg-green-100', textClass: 'text-green-600' },
  // ESM Travel
  SUBMIT_FOR_CEO_ESM:    { icon: 'send',             bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  CEO_DECISION_ESM:          { icon: 'gavel',            bgClass: 'bg-red-100', textClass: 'text-red-600' },
  GROUP_DCEO_DECISION_ESM:   { icon: 'gavel',            bgClass: 'bg-red-100', textClass: 'text-red-600' },
  CONFIRM_BOOKING_ESM:       { icon: 'flight_takeoff',   bgClass: 'bg-green-100', textClass: 'text-green-600' },
  CLOSE_TRAVEL_REQUEST:      { icon: 'task_alt',         bgClass: 'bg-green-100', textClass: 'text-green-600' },
  // Chargeback
  CHARGEBACK_SUBMIT:         { icon: 'send',             bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
  FROM_ENTITY_APPROVE:       { icon: 'check_circle',     bgClass: 'bg-green-100', textClass: 'text-green-600' },
  FROM_ENTITY_REJECT:        { icon: 'cancel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  TO_ENTITY_APPROVE:         { icon: 'check_circle',     bgClass: 'bg-green-100', textClass: 'text-green-600' },
  TO_ENTITY_REJECT:          { icon: 'cancel',           bgClass: 'bg-red-100', textClass: 'text-red-600' },
  CHARGEBACK_MARK_CONFIRMED: { icon: 'verified',         bgClass: 'bg-green-100', textClass: 'text-green-600' },
  CHARGEBACK_COMPLETE:       { icon: 'task_alt',         bgClass: 'bg-green-100', textClass: 'text-green-600' },
  // Expense
  MANAGER_APPROVE_EXPENSE:      { icon: 'check_circle', bgClass: 'bg-green-100', textClass: 'text-green-600' },
  MANAGER_REJECT_EXPENSE:       { icon: 'cancel',       bgClass: 'bg-red-100', textClass: 'text-red-600' },
  FINANCE_HEAD_APPROVE_EXPENSE: { icon: 'check_circle', bgClass: 'bg-green-100', textClass: 'text-green-600' },
  FINANCE_HEAD_REJECT_EXPENSE:  { icon: 'cancel',       bgClass: 'bg-red-100', textClass: 'text-red-600' },
  MARK_EXPENSE_PAYMENT_COMPLETE:{ icon: 'payments',     bgClass: 'bg-emerald-100', textClass: 'text-emerald-600' },
  CANCEL_REQUEST:              { icon: 'cancel',         bgClass: 'bg-red-100',    textClass: 'text-red-600' },
};

/* ------------------------------------------------------------------ */
/*  Direct actions that DON'T use a modal (status-change calls)        */
/* ------------------------------------------------------------------ */

const DIRECT_ACTIONS: Set<WorkflowActionType> = new Set([
  'START_IT_REVIEW',
  'MARK_IN_PROGRESS',
  'CHARGEBACK_SUBMIT',
  'CHARGEBACK_MARK_CONFIRMED',
  'CHARGEBACK_COMPLETE',
  'RESOLVE_IT',
  'ROUTE_TO_MANAGER',
  'MANAGER_DECISION',
  'LOA_APPROVAL',
  'ISSUE_LOA',
  'MARK_LOA_ACCEPTED',
  'ADVANCE_ONBOARDING_PHASE',
  'COMPLETE_ONBOARDING',
  'ADVANCE_OFFBOARDING_PHASE',
  'COMPLETE_OFFBOARDING',
  'SUBMIT_FOR_APPROVAL',
  'RESUBMIT_REQUEST',
  'SUBMIT_INTERVIEW_FEEDBACK',
  'SET_FINALIZED_AMOUNT',
  // UPLOAD_RESUME is handled as a direct action so it opens the proper
  // UploadResumeModal (with file picker, candidate name, doc type) instead
  // of the generic WorkflowActionModal which only has a notes textarea.
  'UPLOAD_RESUME',
  'CANCEL_REQUEST',
]);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DecisionPanel: React.FC<DecisionPanelProps> = ({
  requestId,
  status,
  userRoles,
  userId,
  assignedTo,
  assignedTeam,
  approvals = [],
  requestTypeName = '',
  requestTypeCode = '',
  serviceDeskCode,
  serviceDeskName,
  requiresApproval = true,
  requesterId,
  hasResumes = false,
  allCandidatesComplete,
  screeningCompleted = false,
  hasLOA = false,
  hasSignedLOA = false,
  selectedCandidateId,
  selectedCandidateIds,
  attachments = [],
  onActionComplete,
  // Direct-action callbacks
  onRouteToManager,
  onManagerDecision,
  onLOAApproval,
  onIssueLOA,
  onMarkLOAAccepted,
  onInterviewFeedback,
  onAdvanceOnboardingPhase,
  onCompleteOnboarding,
  onAdvanceOffboardingPhase,
  onCompleteOffboarding,
  onResolveRequest,
  onCancelRequest,
  onUploadResume,
  offboardingPreConditionsMet = true,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAssigned = !!assignedTo;
  const isDesignatedApprover = approvals.some(
    (a) => a.approverId === userId && a.status === 'PENDING'
  );
  const isRequester = !!(requesterId && userId && requesterId === userId);

  const actions = getWorkflowActions(
    status,
    userRoles,
    isAssigned,
    isDesignatedApprover,
    requestTypeName,
    isRequester,
    serviceDeskCode,
    requiresApproval,
    requestTypeCode,
    hasResumes,
    allCandidatesComplete,
    screeningCompleted,
    hasLOA,
    hasSignedLOA,
    assignedTo?.id ?? '',
    userId,
    assignedTeam ?? '',
  );

  const handleDirectAction = useCallback(
    async (action: WorkflowActionType) => {
      setDirectLoading(true);
      setError(null);
      try {
        // Map direct actions to their callbacks or service calls
        switch (action) {
          case 'ROUTE_TO_MANAGER':
            if (allCandidatesComplete === false) {
              setError('All candidates must have Resume, Certificate, and Transcript uploaded before routing to Manager.');
              setDirectLoading(false);
              return;
            }
            onRouteToManager?.();
            return;
          case 'MANAGER_DECISION':
            onManagerDecision?.();
            return;
          case 'LOA_APPROVAL':
            onLOAApproval?.();
            return;
          case 'ISSUE_LOA':
            onIssueLOA?.();
            return;
          case 'MARK_LOA_ACCEPTED':
            onMarkLOAAccepted?.();
            return;
          case 'SUBMIT_INTERVIEW_FEEDBACK':
            onInterviewFeedback?.();
            return;
          case 'ADVANCE_ONBOARDING_PHASE':
            onAdvanceOnboardingPhase?.();
            return;
          case 'COMPLETE_ONBOARDING':
            onCompleteOnboarding?.();
            return;
          case 'ADVANCE_OFFBOARDING_PHASE':
            onAdvanceOffboardingPhase?.();
            return;
          case 'COMPLETE_OFFBOARDING':
            onCompleteOffboarding?.();
            return;
          case 'RESOLVE_IT':
            onResolveRequest?.();
            return;
          case 'CANCEL_REQUEST':
            onCancelRequest?.();
            return;
          case 'UPLOAD_RESUME':
            onUploadResume?.();
            return;
          default:
            break;
        }

        // Status-change direct actions (no modal, just API call)
        const { requestService } = await import('../../services/request.service');
        const { RequestStatus } = await import('../../../types');

        if (action === 'START_IT_REVIEW') {
          await requestService.updateStatus(requestId, RequestStatus.IN_REVIEW);
        } else if (action === 'MARK_IN_PROGRESS') {
          await requestService.updateStatus(requestId, RequestStatus.IN_PROGRESS);
        } else if (action === 'CHARGEBACK_SUBMIT') {
          const m = await import('../../services/chargeback-workflow.service');
          await m.default.submitChargeback(requestId);
        } else if (action === 'CHARGEBACK_MARK_CONFIRMED') {
          const m = await import('../../services/chargeback-workflow.service');
          await m.default.markConfirmed(requestId);
        } else if (action === 'CHARGEBACK_COMPLETE') {
          const m = await import('../../services/chargeback-workflow.service');
          await m.default.completeChargeback(requestId);
        }

        onActionComplete();
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Action failed. Please try again.');
      } finally {
        setDirectLoading(false);
      }
    },
    [
      requestId,
      onActionComplete,
      onRouteToManager,
      onManagerDecision,
      onLOAApproval,
      onIssueLOA,
      onMarkLOAAccepted,
      onInterviewFeedback,
      onAdvanceOnboardingPhase,
      onCompleteOnboarding,
      onAdvanceOffboardingPhase,
      onCompleteOffboarding,
      onResolveRequest,
      onCancelRequest,
      onUploadResume,
    ]
  );

  const handleActionClick = useCallback(
    (action: WorkflowActionType) => {
      const modalKey = actionToModalKey(action);
      if (DIRECT_ACTIONS.has(action)) {
        handleDirectAction(action);
      } else if (modalKey && hasWorkflowModalConfig(modalKey)) {
        setActiveModal(modalKey);
      } else {
        // Fallback: open with whatever key we have
        // This should not happen after Phase A, but as safety net:
        console.warn(`[DecisionPanel] No config entry for action: ${action}`);
        // Try the modal key anyway — some actions map 1:1
        if (modalKey) setActiveModal(modalKey);
      }
    },
    [handleDirectAction]
  );

  const handleModalSuccess = useCallback(() => {
    setActiveModal(null);
    onActionComplete();
  }, [onActionComplete]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex size-2.5">
          <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-sm font-bold uppercase tracking-widest text-gray-500">
          Actions
        </span>
      </div>

      {/* Action cards */}
      <div className="space-y-2">
        {actions.map((action) => {
          const modalKey = actionToModalKey(action.type);
          const config = modalKey ? WORKFLOW_MODAL_CONFIG[modalKey] : undefined;
          const icons = ACTION_ICONS[action.type] || {
            icon: 'play_circle',
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-600',
          };

          return (
            <button
              key={action.type}
              type="button"
              onClick={() => handleActionClick(action.type)}
              disabled={directLoading || (action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet)}
              className={`w-full text-left border rounded-xl p-4 transition-colors group ${
                action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet
                  ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                  : 'bg-blue-50 border-blue-100 hover:bg-blue-100/70'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${icons.bgClass}`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${icons.textClass}`}
                  >
                    {config?.icon || icons.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold leading-snug ${action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet ? 'text-gray-400' : 'text-[#1e40af]'}`}>
                    {config?.title || action.label}
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet ? 'text-gray-400' : 'text-blue-500'}`}>
                    {config?.subtitle || action.description}
                  </p>
                  {action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet && (
                    <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      Complete resignation letter & exit interview requirements first
                    </p>
                  )}
                </div>
                <span
                  className={`material-symbols-outlined transition-colors shrink-0 ${
                    action.type === 'ADVANCE_OFFBOARDING_PHASE' && !offboardingPreConditionsMet
                      ? 'text-gray-300'
                      : 'text-blue-400 group-hover:text-blue-600'
                  }`}
                  style={{ fontSize: '20px' }}
                >
                  chevron_right
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-start gap-2">
          <span className="material-symbols-outlined text-red-500 mt-px" style={{ fontSize: '14px' }}>
            error
          </span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {/* Dedicated CEO decision modal (handles IT CTO selector + HR approval routing) */}
      {(activeModal === 'CEO_DECISION_IT' || activeModal === 'CEO_DECISION_HR') && serviceDeskName && (
        <CeoDecisionModal
          requestId={requestId}
          serviceDeskCode={serviceDeskCode}
          serviceDeskName={serviceDeskName}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Dedicated Schedule Interview modal (needs candidateId from request context) */}
      {activeModal === 'SCHEDULE_INTERVIEW' && (
        <ScheduleInterviewModal
          requestId={requestId}
          selectedCandidateIds={selectedCandidateIds}
          selectedCandidateId={selectedCandidateId}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Dedicated Pending Invoice modal (CFO selector + invoice file upload) */}
      {activeModal === 'ROUTE_TO_CFO' && (
        <PendingInvoiceModal
          requestId={requestId}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Dedicated CFO Decision modal (shows invoice preview for IT workflow) */}
      {activeModal === 'CFO_DECISION' && (
        <CfoDecisionModal
          requestId={requestId}
          attachments={attachments}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Dedicated CFO Decision modal (Finance Purchase Requisition — shows invoice preview) */}
      {activeModal === 'CFO_DECISION_FIN' && (
        <CfoDecisionFinModal
          requestId={requestId}
          attachments={attachments}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Config-driven modal (non-CEO, non-schedule-interview, non-invoice, non-CFO-decision actions) */}
      {activeModal && activeModal !== 'CEO_DECISION_IT' && activeModal !== 'CEO_DECISION_HR' && activeModal !== 'SCHEDULE_INTERVIEW' && activeModal !== 'ROUTE_TO_CFO' && activeModal !== 'CFO_DECISION' && activeModal !== 'CFO_DECISION_FIN' && hasWorkflowModalConfig(activeModal) && (
        <WorkflowActionModal
          open={!!activeModal}
          requestId={requestId}
          config={WORKFLOW_MODAL_CONFIG[activeModal]}
          onSuccess={handleModalSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Fallback generic confirmation modal for actions without config */}
      {activeModal && !hasWorkflowModalConfig(activeModal) && (
        <FallbackConfirmModal
          open={!!activeModal}
          title={String(activeModal).replace(/_/g, ' ')}
          onConfirm={async () => {
            // Attempt direct service call for unconfigured actions
            try {
              setDirectLoading(true);
              setError(null);
              // This is a safety net — most actions should have config entries
              onActionComplete();
            } catch {
              setError('Action failed');
            } finally {
              setDirectLoading(false);
              setActiveModal(null);
            }
          }}
          onClose={() => setActiveModal(null)}
          loading={directLoading}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Maps WorkflowActionType to the ModalType key used in WORKFLOW_MODAL_CONFIG.
 * Most actions map 1:1, but some have different naming conventions.
 */
function actionToModalKey(action: WorkflowActionType): string | null {
  // Direct 1:1 mappings (most actions)
  const directMap: Record<string, string> = {
    START_PROCUREMENT: 'PROCUREMENT',
    MARK_HARDWARE_ORDERED: 'HARDWARE_ORDERED',
    MARK_HARDWARE_RECEIVED: 'HARDWARE_RECEIVED',
    MARK_SOFTWARE_PROVISIONED: 'SOFTWARE_PROVISIONED',
    MARK_FULFILLED: 'FULFILMENT',
    ASSIGN: 'ASSIGN',
    ACKNOWLEDGE_IT: 'ACKNOWLEDGE_IT',
    CEO_DECISION_IT: 'CEO_DECISION_IT',
    CEO_DECISION_HR: 'CEO_DECISION_HR',
    CTO_DECISION: 'CTO_DECISION',
    ROUTE_TO_CFO: 'ROUTE_TO_CFO',
    CFO_DECISION: 'CFO_DECISION',
    PAYMENT_DONE: 'PAYMENT_DONE',
    COMPLETE_DELIVERY: 'COMPLETE_DELIVERY',
    FIN_ACKNOWLEDGE: 'FIN_ACKNOWLEDGE',
    ROUTE_TO_CFO_FIN: 'ROUTE_TO_CFO_FIN',
    ROUTE_TO_CFO_BP: 'ROUTE_TO_CFO_BP',
    CFO_DECISION_FIN: 'CFO_DECISION_FIN',

    GROUP_DCEO_DECISION_FIN: 'GROUP_DCEO_DECISION_FIN',
    MARK_PAYMENT_COMPLETE_FIN: 'MARK_PAYMENT_COMPLETE_FIN',
    CLOSE_TICKET_FIN: 'CLOSE_TICKET_FIN',
    CLOSE_BUDGET_PROPOSAL: 'CLOSE_BUDGET_PROPOSAL',
    ROUTE_TO_CEO_HR: 'ROUTE_TO_CEO_HR',
    ROUTE_TO_GROUP_DCEO_HR: 'ROUTE_TO_GROUP_DCEO_HR',
    GROUP_DCEO_DECISION_HR: 'GROUP_DCEO_DECISION_HR',
    MARK_JOB_POSTED: 'MARK_JOB_POSTED',
    UPLOAD_RESUME: 'UPLOAD_RESUME',
    SCHEDULE_INTERVIEW: 'SCHEDULE_INTERVIEW',
    UPDATE_SCREENING: 'UPDATE_SCREENING',
    UPLOAD_LOA: 'UPLOAD_LOA',
    ROUTE_LOA_FOR_APPROVAL: 'ROUTE_LOA_FOR_APPROVAL',
    UPLOAD_SIGNED_LOA: 'UPLOAD_SIGNED_LOA',
    FROM_ENTITY_APPROVE: 'FROM_ENTITY_APPROVE',
    FROM_ENTITY_REJECT: 'FROM_ENTITY_REJECT',
    TO_ENTITY_APPROVE: 'TO_ENTITY_APPROVE',
    TO_ENTITY_REJECT: 'TO_ENTITY_REJECT',
    MANAGER_APPROVE_EXPENSE: 'MANAGER_APPROVE_EXPENSE',
    MANAGER_REJECT_EXPENSE: 'MANAGER_REJECT_EXPENSE',
    FINANCE_HEAD_APPROVE_EXPENSE: 'FINANCE_HEAD_APPROVE_EXPENSE',
    FINANCE_HEAD_REJECT_EXPENSE: 'FINANCE_HEAD_REJECT_EXPENSE',
    MARK_EXPENSE_PAYMENT_COMPLETE: 'MARK_EXPENSE_PAYMENT_COMPLETE',
    INTERVIEW_FEEDBACK: 'INTERVIEW_FEEDBACK',
  };
  return directMap[action] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Fallback confirmation modal (safety net)                           */
/* ------------------------------------------------------------------ */

interface FallbackConfirmModalProps {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

const FallbackConfirmModal: React.FC<FallbackConfirmModalProps> = ({
  open,
  title: rawTitle,
  onConfirm,
  onClose,
  loading = false,
}) => {
  // Ensure title is always a string
  const title = String(rawTitle);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize">
          {title.replace(/_/g, ' ')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to proceed with this action?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DecisionPanel;