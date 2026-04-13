import React, { useState } from 'react';
import { getWorkflowActions, WorkflowActionType } from '../../utils/workflowActions';
import WorkflowApproveModal from './WorkflowApproveModal';
import WorkflowRejectModal from './WorkflowRejectModal';
import SubmitForApprovalModal from './SubmitForApprovalModal';
import ProcurementModal from './ProcurementModal';
import FulfilmentModal from './FulfilmentModal';
import HardwareOrderedModal from './HardwareOrderedModal';
import HardwareReceivedModal from './HardwareReceivedModal';
import SoftwareProvisionedModal from './SoftwareProvisionedModal';
import AssignAgentModal from './AssignAgentModal';
import SLAIndicator from './SLAIndicator';

type ModalType = 'APPROVE' | 'REJECT' | 'SUBMIT_FOR_APPROVAL' | 'PROCUREMENT' | 'HARDWARE_ORDERED' | 'HARDWARE_RECEIVED' | 'SOFTWARE_PROVISIONED' | 'FULFILMENT' | 'ASSIGN' | null;

interface ActionSidebarProps {
  requestId: string;
  status: string;
  userRoles: string[];
  userId: string;
  userName: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  approvals?: { id: string; approverId: string; approverType: string; status: string }[];
  requestTypeName?: string;
  referenceNumber: string;
  priority: string;
  serviceDeskName: string;
  requesterName: string;
  createdAt: string;
  slaDueAt?: string | null;
  onActionSuccess: () => void;
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
  referenceNumber,
  priority,
  serviceDeskName,
  requesterName,
  createdAt,
  slaDueAt,
  onActionSuccess,
}) => {
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const isAssigned = !!assignedTo;
  const isDesignatedApprover = approvals.some(
    a => a.approverId === userId && a.status === 'PENDING'
  );
  const actions = getWorkflowActions(status, userRoles, isAssigned, isDesignatedApprover, requestTypeName);

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
    <aside className="w-80 shrink-0 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm self-start sticky top-6">

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
                  className={buttonClass(action.variant)}
                >
                  {action.label}
                </button>
              </div>
            ))}
          </div>
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

      {/* Modals */}
      {openModal === 'APPROVE'            && <WorkflowApproveModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'REJECT'             && <WorkflowRejectModal  requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'SUBMIT_FOR_APPROVAL'&& <SubmitForApprovalModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'PROCUREMENT'        && <ProcurementModal     requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'HARDWARE_ORDERED'   && <HardwareOrderedModal    requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'HARDWARE_RECEIVED'  && <HardwareReceivedModal   requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'SOFTWARE_PROVISIONED' && <SoftwareProvisionedModal requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'FULFILMENT'         && <FulfilmentModal      requestId={requestId} onSuccess={handleSuccess} onClose={() => setOpenModal(null)} />}
      {openModal === 'ASSIGN'             && (
        <AssignAgentModal
          requestId={requestId}
          currentAssigneeId={assignedTo?.id}
          currentUserId={userId}
          currentUserName={userName}
          onSuccess={handleSuccess}
          onClose={() => setOpenModal(null)}
        />
      )}
    </aside>
  );
};

export default ActionSidebar;
