import React, { lazy, Suspense, useState } from 'react';
import { getWorkflowActions, WorkflowActionType } from '../../utils/workflowActions';
import itWorkflowService from '../../services/it-workflow.service';
import { requestService } from '../../services/request.service';
import { RequestStatus } from '../../../types';
import SLAIndicator from './SLAIndicator';

const WorkflowApproveModal = lazy(() => import('./WorkflowApproveModal'));
const WorkflowRejectModal = lazy(() => import('./WorkflowRejectModal'));
const SubmitForApprovalModal = lazy(() => import('./SubmitForApprovalModal'));
const ProcurementModal = lazy(() => import('./ProcurementModal'));
const FulfilmentModal = lazy(() => import('./FulfilmentModal'));
const HardwareOrderedModal = lazy(() => import('./HardwareOrderedModal'));
const HardwareReceivedModal = lazy(() => import('./HardwareReceivedModal'));
const SoftwareProvisionedModal = lazy(() => import('./SoftwareProvisionedModal'));
const AssignAgentModal = lazy(() => import('./AssignAgentModal'));
const VpApprovalModal = lazy(() => import('./VpApprovalModal'));
const ResubmitModal = lazy(() => import('./ResubmitModal'));
const AcknowledgeModal = lazy(() => import('./AcknowledgeModal'));
const CeoDecisionModal = lazy(() => import('./CeoDecisionModal'));
const CtoDecisionModal = lazy(() => import('./CtoDecisionModal'));
const PendingInvoiceModal = lazy(() => import('./PendingInvoiceModal'));
const CfoDecisionModal = lazy(() => import('./CfoDecisionModal'));
const PaymentDoneModal = lazy(() => import('./PaymentDoneModal'));
const ManagerDecisionModal = lazy(() => import('./ManagerDecisionModal'));
const CompleteDeliveryModal = lazy(() => import('./CompleteDeliveryModal'));
const RouteToCEOHRModal = lazy(() => import('./RouteToCEOHRModal'));
const MarkJobPostedModal = lazy(() => import('./MarkJobPostedModal'));
const UploadResumeModal = lazy(() => import('./UploadResumeModal'));
const ScheduleInterviewModal = lazy(() => import('./ScheduleInterviewModal'));
const UpdateScreeningModal = lazy(() => import('./UpdateScreeningModal'));
const UploadLOAModal = lazy(() => import('./UploadLOAModal'));
const UploadSignedLOAModal = lazy(() => import('./UploadSignedLOAModal'));
const FinAcknowledgeModal = lazy(() => import('./FinAcknowledgeModal'));
const RouteToCeoFinModal = lazy(() => import('./RouteToCeoFinModal'));
const FinDecisionModal = lazy(() => import('./FinDecisionModal'));
const MarkPaymentCompleteFinModal = lazy(() => import('./MarkPaymentCompleteFinModal'));
const CloseTicketFinModal = lazy(() => import('./CloseTicketFinModal'));

import WorkflowActionModal from './WorkflowActionModal';
import { WORKFLOW_MODAL_CONFIG, hasWorkflowModalConfig } from '../../utils/workflowModalConfig';

type ModalType = 'APPROVE' | 'REJECT' | 'SUBMIT_FOR_APPROVAL' | 'PROCUREMENT' | 'HARDWARE_ORDERED' | 'HARDWARE_RECEIVED' | 'SOFTWARE_PROVISIONED' | 'FULFILMENT' | 'ASSIGN' | 'VP_DECISION' | 'RESUBMIT_REQUEST' | 'ACKNOWLEDGE_IT' | 'CEO_DECISION' | 'CTO_DECISION' | 'ROUTE_TO_CFO' | 'CFO_DECISION' | 'PAYMENT_DONE' | 'MANAGER_DECISION' | 'COMPLETE_DELIVERY' | 'ROUTE_TO_CEO_HR' | 'MARK_JOB_POSTED' | 'UPLOAD_RESUME' | 'SCHEDULE_INTERVIEW' | 'UPDATE_SCREENING' | 'UPLOAD_LOA' | 'UPLOAD_SIGNED_LOA' | 'FIN_ACKNOWLEDGE' | 'ROUTE_TO_CEO_FIN' | 'CFO_DECISION_FIN' | 'GROUP_CEO_DECISION_FIN' | 'MARK_PAYMENT_COMPLETE_FIN' | 'CLOSE_TICKET_FIN' | 'SET_FINALIZED_AMOUNT' | 'FROM_ENTITY_APPROVE' | 'FROM_ENTITY_REJECT' | 'TO_ENTITY_APPROVE' | 'TO_ENTITY_REJECT' | 'MANAGER_APPROVE_EXPENSE' | 'MANAGER_REJECT_EXPENSE' | 'FINANCE_HEAD_APPROVE_EXPENSE' | 'FINANCE_HEAD_REJECT_EXPENSE' | 'MARK_EXPENSE_PAYMENT_COMPLETE' | null;

interface ActionSidebarProps {
  requestId: string;
  status: string;
  userRoles: string[];
  userId: string;
  userName: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  approvals?: { id: string; approverId: string; approverType: string; status: string }[];
  requestTypeName?: string;
  requestTypeCode?: string;
  referenceNumber: string;
  priority: string;
  serviceDeskName: string;
  requesterName: string;
  createdAt: string;
  slaDueAt?: string | null;
  requesterId?: string;
  serviceDeskCode: string;
  requiresApproval?: boolean;
  attachments?: { id: string; fileName: string; storageUrl: string; mimeType: string; createdAt: string }[];
  hasResumes?: boolean;
  screeningCompleted?: boolean;
  hasLOA?: boolean;
  hasSignedLOA?: boolean;
  selectedCandidateId?: string;
  onActionSuccess: () => void;
  onLOAApproval?: () => void;
  onRouteToManager?: () => void;
  onIssueLOA?: () => void;
  onMarkLOAAccepted?: () => void;
  onAdvanceOnboardingPhase?: () => void;
  onCompleteOnboarding?: () => void;
  onAdvanceOffboardingPhase?: () => void;
  onCompleteOffboarding?: () => void;
  onResolveRequest?: () => void;
}

const PRIORITY_COLOURS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const ActionSidebar: React.FC<ActionSidebarProps> = ({
  requestId,
  status,
  userRoles,
  userId,
  userName,
  assignedTo,
  approvals = [],
  requestTypeName = '',
  requestTypeCode = '',
  referenceNumber,
  priority,
  serviceDeskName,
  requesterName,
  createdAt,
  slaDueAt,
  requesterId,
  serviceDeskCode,
  requiresApproval,
  attachments = [],
  hasResumes = false,
  screeningCompleted = false,
  hasLOA = false,
  hasSignedLOA = false,
  selectedCandidateId,
  onActionSuccess,
  onLOAApproval,
  onRouteToManager,
  onIssueLOA,
  onMarkLOAAccepted,
  onAdvanceOnboardingPhase,
  onCompleteOnboarding,
  onAdvanceOffboardingPhase,
  onCompleteOffboarding,
  onResolveRequest,
}) => {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [directActionLoading, setDirectActionLoading] = useState(false);

  const isAssigned = !!assignedTo;
  const isDesignatedApprover = approvals.some(
    a => a.approverId === userId && a.status === 'PENDING'
  );
  const isRequester = !!(requesterId && userId && requesterId === userId);
  const actions = getWorkflowActions(status, userRoles, isAssigned, isDesignatedApprover, requestTypeName, isRequester, serviceDeskCode, requiresApproval ?? true, requestTypeCode, hasResumes, screeningCompleted, hasLOA, hasSignedLOA);

  const handleSuccess = () => {
    setOpenModal(null);
    onActionSuccess();
  };

  const handleActionClick = (type: WorkflowActionType) => {
    switch (type) {
      case 'APPROVE': setOpenModal('APPROVE'); break;
      case 'REJECT': setOpenModal('REJECT'); break;
      case 'SUBMIT_FOR_APPROVAL': setOpenModal('SUBMIT_FOR_APPROVAL'); break;
      case 'START_PROCUREMENT': setOpenModal('PROCUREMENT'); break;
      case 'MARK_HARDWARE_ORDERED': setOpenModal('HARDWARE_ORDERED'); break;
      case 'MARK_HARDWARE_RECEIVED': setOpenModal('HARDWARE_RECEIVED'); break;
      case 'MARK_SOFTWARE_PROVISIONED': setOpenModal('SOFTWARE_PROVISIONED'); break;
      case 'MARK_FULFILLED': setOpenModal('FULFILMENT'); break;
      case 'ASSIGN': setOpenModal('ASSIGN'); break;
      case 'VP_DECISION': setOpenModal('VP_DECISION'); break;
      case 'RESUBMIT_REQUEST': setOpenModal('RESUBMIT_REQUEST'); break;
      case 'ACKNOWLEDGE_IT': setOpenModal('ACKNOWLEDGE_IT'); break;
      case 'CEO_DECISION': setOpenModal('CEO_DECISION'); break;
      case 'CTO_DECISION': setOpenModal('CTO_DECISION'); break;
      case 'ROUTE_TO_CFO': setOpenModal('ROUTE_TO_CFO'); break;
      case 'CFO_DECISION': setOpenModal('CFO_DECISION'); break;
      case 'PAYMENT_DONE': setOpenModal('PAYMENT_DONE'); break;
      case 'MANAGER_DECISION': setOpenModal('MANAGER_DECISION'); break;
      case 'LOA_APPROVAL': if (onLOAApproval) onLOAApproval(); break;
      case 'ROUTE_TO_CEO_HR': setOpenModal('ROUTE_TO_CEO_HR'); break;
      case 'MARK_JOB_POSTED': setOpenModal('MARK_JOB_POSTED'); break;
      case 'UPLOAD_RESUME': setOpenModal('UPLOAD_RESUME'); break;
      case 'ROUTE_TO_MANAGER': if (onRouteToManager) onRouteToManager(); break;
      case 'SCHEDULE_INTERVIEW': setOpenModal('SCHEDULE_INTERVIEW'); break;
      case 'UPDATE_SCREENING': setOpenModal('UPDATE_SCREENING'); break;
      case 'UPLOAD_LOA': setOpenModal('UPLOAD_LOA'); break;
      case 'ISSUE_LOA': if (onIssueLOA) onIssueLOA(); break;
      case 'UPLOAD_SIGNED_LOA': setOpenModal('UPLOAD_SIGNED_LOA'); break;
      case 'MARK_LOA_ACCEPTED': if (onMarkLOAAccepted) onMarkLOAAccepted(); break;
      case 'COMPLETE_DELIVERY': setOpenModal('COMPLETE_DELIVERY'); break;
      case 'ADVANCE_ONBOARDING_PHASE': if (onAdvanceOnboardingPhase) onAdvanceOnboardingPhase(); break;
      case 'COMPLETE_ONBOARDING': if (onCompleteOnboarding) onCompleteOnboarding(); break;
      case 'ADVANCE_OFFBOARDING_PHASE': if (onAdvanceOffboardingPhase) onAdvanceOffboardingPhase(); break;
      case 'COMPLETE_OFFBOARDING': if (onCompleteOffboarding) onCompleteOffboarding(); break;
      case 'FIN_ACKNOWLEDGE': setOpenModal('FIN_ACKNOWLEDGE'); break;
      case 'SET_FINALIZED_AMOUNT':
      case 'ROUTE_TO_CEO_FIN': setOpenModal('ROUTE_TO_CEO_FIN'); break;
      case 'CFO_DECISION_FIN': setOpenModal('CFO_DECISION_FIN'); break;
      case 'GROUP_CEO_DECISION_FIN': setOpenModal('GROUP_CEO_DECISION_FIN'); break;
      case 'MARK_PAYMENT_COMPLETE_FIN': setOpenModal('MARK_PAYMENT_COMPLETE_FIN'); break;
      case 'CLOSE_TICKET_FIN': setOpenModal('CLOSE_TICKET_FIN'); break;
      case 'CHARGEBACK_SUBMIT':
        setDirectActionLoading(true);
        import('../../services/chargeback-workflow.service').then(m => m.default.submitChargeback(requestId))
          .then(handleSuccess)
          .catch(e => setActionError(e?.response?.data?.error || 'Failed to submit chargeback'))
          .finally(() => setDirectActionLoading(false));
        break;
      case 'FROM_ENTITY_APPROVE': setOpenModal('FROM_ENTITY_APPROVE'); break;
      case 'FROM_ENTITY_REJECT': setOpenModal('FROM_ENTITY_REJECT'); break;
      case 'TO_ENTITY_APPROVE': setOpenModal('TO_ENTITY_APPROVE'); break;
      case 'TO_ENTITY_REJECT': setOpenModal('TO_ENTITY_REJECT'); break;
      case 'MANAGER_APPROVE_EXPENSE': setOpenModal('MANAGER_APPROVE_EXPENSE'); break;
      case 'MANAGER_REJECT_EXPENSE': setOpenModal('MANAGER_REJECT_EXPENSE'); break;
      case 'FINANCE_HEAD_APPROVE_EXPENSE': setOpenModal('FINANCE_HEAD_APPROVE_EXPENSE'); break;
      case 'FINANCE_HEAD_REJECT_EXPENSE': setOpenModal('FINANCE_HEAD_REJECT_EXPENSE'); break;
      case 'MARK_EXPENSE_PAYMENT_COMPLETE': setOpenModal('MARK_EXPENSE_PAYMENT_COMPLETE'); break;
      case 'CHARGEBACK_MARK_CONFIRMED':
        setDirectActionLoading(true);
        import('../../services/chargeback-workflow.service').then(m => m.default.markConfirmed(requestId))
          .then(handleSuccess)
          .catch(e => setActionError(e?.response?.data?.error || 'Failed to mark confirmed'))
          .finally(() => setDirectActionLoading(false));
        break;
      case 'CHARGEBACK_COMPLETE':
        setDirectActionLoading(true);
        import('../../services/chargeback-workflow.service').then(m => m.default.completeChargeback(requestId))
          .then(handleSuccess)
          .catch(e => setActionError(e?.response?.data?.error || 'Failed to complete chargeback'))
          .finally(() => setDirectActionLoading(false));
        break;
      case 'START_IT_REVIEW':
        setDirectActionLoading(true);
        itWorkflowService.submitForApproval(requestId, '')
          .then(handleSuccess)
          .catch(e => setActionError(e?.response?.data?.error || 'Failed to start review'))
          .finally(() => setDirectActionLoading(false));
        break;
      case 'MARK_IN_PROGRESS':
        setDirectActionLoading(true);
        requestService.updateStatus(requestId, RequestStatus.IN_PROGRESS)
          .then(handleSuccess)
          .catch(e => setActionError(e?.response?.data?.error || 'Failed to update status'))
          .finally(() => setDirectActionLoading(false));
        break;
      case 'RESOLVE_IT': if (onResolveRequest) onResolveRequest(); break;
      default:
        console.warn('[ActionSidebar] Unhandled action type:', type);
    }
  };

  const buttonClass = (variant: string) => {
    const base = 'w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-colors';
    if (variant === 'success') return `${base} bg-green-600 text-white hover:bg-green-700`;
    if (variant === 'danger')  return `${base} bg-red-600 text-white hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 text-white hover:bg-amber-700`;
    return `${base} bg-[#0052cc] text-white hover:bg-blue-700`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <aside className="w-full bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">

      {/* Zone 1 — Next Action Panel */}
      {actions.length > 0 && (
        <div className="p-4 border-b-2 border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Next Action Required</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            {actions.map(action => (
              <div key={action.type}>
                <p className="text-xs font-bold text-[#1e40af] mb-0.5">{action.label}</p>
                <p className="text-xs text-blue-600 mb-2 leading-relaxed">{action.description}</p>
                <button
                  onClick={() => handleActionClick(action.type)}
                  disabled={directActionLoading}
                  className={`${buttonClass(action.variant)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {directActionLoading && (action.type === 'START_IT_REVIEW' || action.type === 'MARK_IN_PROGRESS' || action.type === 'CHARGEBACK_SUBMIT' || action.type === 'CHARGEBACK_MARK_CONFIRMED' || action.type === 'CHARGEBACK_COMPLETE') ? 'Processing...' : action.label}
                </button>
              </div>
            ))}
          </div>
          {actionError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{actionError}</p>
          )}
        </div>
      )}

      {/* Zone 2 — Assign block */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold ${assignedTo ? 'bg-[#0052cc] text-white' : 'bg-amber-100 text-amber-700'}`}>
              {assignedTo ? `${assignedTo.firstName[0] ?? '?'}${assignedTo.lastName[0] ?? '?'}` : '!'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Assigned To</p>
              <p className={`text-sm font-bold ${assignedTo ? 'text-gray-900' : 'text-amber-600'}`}>
                {assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : '⚠ Unassigned'}
              </p>
            </div>
          </div>
          {(userRoles.includes('ADMIN') || userRoles.includes('AGENT')) && (
            <button
              onClick={() => setOpenModal('ASSIGN')}
              className="text-xs font-bold text-[#0052cc] px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {assignedTo ? 'Reassign' : 'Assign ›'}
            </button>
          )}
        </div>
      </div>

      {/* SLA */}
      {slaDueAt && (
        <div className="px-4 py-3 border-b border-gray-100">
          <SLAIndicator slaDueAt={slaDueAt} status={status} />
        </div>
      )}

      {/* Metadata */}
      <div className="p-4 space-y-2.5">
        {[
          { label: 'Reference', value: referenceNumber, className: 'text-[#0052cc] font-extrabold' },
          { label: 'Service Desk', value: serviceDeskName },
          { label: 'Requester', value: requesterName },
          { label: 'Created', value: formatDate(createdAt) },
        ].map(({ label, value, className }) => (
          <div key={label} className="flex justify-between items-start gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 shrink-0">{label}</span>
            <span className={`text-xs font-semibold text-gray-900 text-right ${className || ''}`}>{value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Priority</span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[priority] || PRIORITY_COLOURS.MEDIUM}`}>
            {priority}
          </span>
        </div>
      </div>

      {/* Modals — config-driven path (Phase 2) */}
      {openModal && hasWorkflowModalConfig(openModal) && (
        <WorkflowActionModal
          open={!!openModal}
          requestId={requestId}
          config={WORKFLOW_MODAL_CONFIG[openModal]}
          onSuccess={handleSuccess}
          onClose={() => setOpenModal(null)}
        />
      )}

      {/* Modals — legacy path (existing per-action modals) */}
      {openModal === 'APPROVE' && !WORKFLOW_MODAL_CONFIG['APPROVE'] && (
        <Suspense fallback={null}>
          <WorkflowApproveModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'REJECT' && !WORKFLOW_MODAL_CONFIG['REJECT'] && (
        <Suspense fallback={null}>
          <WorkflowRejectModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'SUBMIT_FOR_APPROVAL' && !WORKFLOW_MODAL_CONFIG['SUBMIT_FOR_APPROVAL'] && (
        <Suspense fallback={null}>
          <SubmitForApprovalModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'PROCUREMENT' && !WORKFLOW_MODAL_CONFIG['PROCUREMENT'] && (
        <Suspense fallback={null}>
          <ProcurementModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'HARDWARE_ORDERED' && (
        <Suspense fallback={null}>
          <HardwareOrderedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'HARDWARE_RECEIVED' && (
        <Suspense fallback={null}>
          <HardwareReceivedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'SOFTWARE_PROVISIONED' && (
        <Suspense fallback={null}>
          <SoftwareProvisionedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FULFILMENT' && (
        <Suspense fallback={null}>
          <FulfilmentModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'VP_DECISION' && (
        <Suspense fallback={null}>
          <VpApprovalModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'RESUBMIT_REQUEST' && (
        <Suspense fallback={null}>
          <ResubmitModal requestId={requestId} initialValues={{}} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'ACKNOWLEDGE_IT' && (
        <Suspense fallback={null}>
          <AcknowledgeModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'CEO_DECISION' && (
        <Suspense fallback={null}>
          <CeoDecisionModal requestId={requestId} serviceDeskCode={serviceDeskCode} serviceDeskName={serviceDeskName} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'CTO_DECISION' && (
        <Suspense fallback={null}>
          <CtoDecisionModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'ROUTE_TO_CFO' && (
        <Suspense fallback={null}>
          <PendingInvoiceModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'CFO_DECISION' && (
        <Suspense fallback={null}>
          <CfoDecisionModal requestId={requestId} attachments={attachments} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'PAYMENT_DONE' && (
        <Suspense fallback={null}>
          <PaymentDoneModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'ASSIGN' && (
        <Suspense fallback={null}>
          <AssignAgentModal
            requestId={requestId}
            currentAssigneeId={assignedTo?.id}
            currentUserId={userId}
            currentUserName={userName}
            onSuccess={handleSuccess}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'MANAGER_DECISION' && (
        <Suspense fallback={null}>
          <ManagerDecisionModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'COMPLETE_DELIVERY' && (
        <Suspense fallback={null}>
          <CompleteDeliveryModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'ROUTE_TO_CEO_HR' && (
        <Suspense fallback={null}>
          <RouteToCEOHRModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'MARK_JOB_POSTED' && (
        <Suspense fallback={null}>
          <MarkJobPostedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'UPLOAD_RESUME' && (
        <Suspense fallback={null}>
          <UploadResumeModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'SCHEDULE_INTERVIEW' && (
        <Suspense fallback={null}>
          <ScheduleInterviewModal requestId={requestId} selectedCandidateId={selectedCandidateId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'UPDATE_SCREENING' && (
        <Suspense fallback={null}>
          <UpdateScreeningModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'UPLOAD_LOA' && (
        <Suspense fallback={null}>
          <UploadLOAModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'UPLOAD_SIGNED_LOA' && (
        <Suspense fallback={null}>
          <UploadSignedLOAModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FIN_ACKNOWLEDGE' && (
        <Suspense fallback={null}>
          <FinAcknowledgeModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'ROUTE_TO_CEO_FIN' && (
        <Suspense fallback={null}>
          <RouteToCeoFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'CFO_DECISION_FIN' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="CFO Decision"
            subtitle="Finance Workflow · Purchase Requisition"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.cfoDecision(requestId, decision, comments);
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'GROUP_CEO_DECISION_FIN' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Group CEO Decision"
            subtitle="Finance Workflow · Purchase Requisition"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.groupCeoDecision(requestId, decision, comments);
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'MARK_PAYMENT_COMPLETE_FIN' && (
        <Suspense fallback={null}>
          <MarkPaymentCompleteFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'CLOSE_TICKET_FIN' && (
        <Suspense fallback={null}>
          <CloseTicketFinModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      {openModal === 'FROM_ENTITY_APPROVE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="From Entity Approval"
            subtitle="Inter-Company Chargeback"
            onDecision={async (decision, comments) => {
              const chargebackService = (await import('../../services/chargeback-workflow.service')).default;
              await chargebackService.fromEntityDecision(requestId, decision, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FROM_ENTITY_REJECT' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="From Entity Rejection"
            subtitle="Inter-Company Chargeback"
            onDecision={async (decision, comments) => {
              const chargebackService = (await import('../../services/chargeback-workflow.service')).default;
              await chargebackService.fromEntityDecision(requestId, 'REJECTED', comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'TO_ENTITY_APPROVE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="To Entity Approval"
            subtitle="Inter-Company Chargeback"
            onDecision={async (decision, comments) => {
              const chargebackService = (await import('../../services/chargeback-workflow.service')).default;
              await chargebackService.toEntityDecision(requestId, decision, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'TO_ENTITY_REJECT' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="To Entity Rejection"
            subtitle="Inter-Company Chargeback"
            onDecision={async (decision, comments) => {
              const chargebackService = (await import('../../services/chargeback-workflow.service')).default;
              await chargebackService.toEntityDecision(requestId, 'REJECTED', comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'MANAGER_APPROVE_EXPENSE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Manager Approval"
            subtitle="Expense Reimbursement · Manager Review"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.managerApproveExpense(requestId, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'MANAGER_REJECT_EXPENSE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Manager Rejection"
            subtitle="Expense Reimbursement · Manager Review"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.managerRejectExpense(requestId, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FINANCE_HEAD_APPROVE_EXPENSE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Finance Head Approval"
            subtitle="Expense Reimbursement · Finance Head Review"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.financeHeadApproveExpense(requestId, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'FINANCE_HEAD_REJECT_EXPENSE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Finance Head Rejection"
            subtitle="Expense Reimbursement · Finance Head Review"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.financeHeadRejectExpense(requestId, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
      {openModal === 'MARK_EXPENSE_PAYMENT_COMPLETE' && (
        <Suspense fallback={null}>
          <FinDecisionModal
            title="Mark Payment Complete"
            subtitle="Expense Reimbursement · Payment Processing"
            onDecision={async (decision, comments) => {
              const financeWorkflowService = (await import('../../services/finance-workflow.service')).default;
              await financeWorkflowService.markExpensePaymentComplete(requestId, undefined, comments);
              handleSuccess();
            }}
            onClose={() => setOpenModal(null)}
          />
        </Suspense>
      )}
    </aside>
  );
};

export default ActionSidebar;
