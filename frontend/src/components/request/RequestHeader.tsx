import React from 'react';
import { Link } from 'react-router-dom';
import ActionBanner from '@/src/components/request-detail/ActionBanner';
import { detectRequestRole } from '@/src/utils/roleDetection';

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
}

interface RequestChild {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
}

interface RequestHeaderProps {
  request: {
    id: string;
    referenceNumber: string;
    summary: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    isConfidential?: boolean;
    assignedTo?: { firstName: string; lastName: string } | null;
    requesterId: string;
    serviceDesk?: { code: string };
    requestType?: { 
      code: string; 
      name: string; 
    };
    childRequests?: RequestChild[];
    completedAt?: string;
    slaDueAt?: string | null;
    slaPausedAt?: string | null;
    resolvedAt?: string | null;
  };
  activities?: Activity[];
  user: { id: string; roles?: string[]; firstName: string; lastName: string } | null;
  onActionClick: () => void;
  onScheduleInterview: () => void;
  onInterviewFeedback: () => void;
  onLOAApproval: () => void;
  onStartHRScreening: () => void;
  onMarkLOAIssued: () => void;
  onAdvanceOnboardingPhase?: () => void;
  onCompleteOnboarding?: () => void;
  onAdvanceOffboardingPhase?: () => void;
  onCompleteOffboarding?: () => void;
}

const RequestHeader: React.FC<RequestHeaderProps> = ({
  request,
  user,
  onActionClick,
  onScheduleInterview,
  onInterviewFeedback,
  onLOAApproval,
  onStartHRScreening,
  onMarkLOAIssued,
}) => {
  const currentRole = detectRequestRole({
    userRoles: user?.roles || [],
    userId: user?.id || '',
    requesterId: request.requesterId,
    requestStatus: request.status,
    serviceDeskCode: request.serviceDesk?.code || '',
  });

  const handleActionClick = () => {
    if (currentRole === 'agent' && request.status === 'MANAGER_APPROVED') {
      onScheduleInterview();
    } else if (currentRole === 'hiring_manager' && request.status === 'INTERVIEW_SCHEDULED') {
      onInterviewFeedback();
    } else if (currentRole === 'agent' && request.status === 'INTERVIEW_FEEDBACK_PENDING') {
      onStartHRScreening();
    } else if (currentRole === 'hiring_manager' && request.status === 'LOA_PENDING_APPROVAL') {
      onLOAApproval();
    } else if (currentRole === 'agent' && request.status === 'LOA_APPROVED') {
      onMarkLOAIssued();
    } else {
      const actionsSection = document.querySelector('[data-cockpit-actions]');
      if (actionsSection) actionsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 text-sm font-medium text-[#44546f]">
        <Link to="/" className="hover:text-[#0052cc]">
          CWC
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link 
          to={currentRole === 'agent' && user?.id !== request.requesterId ? "/agent" : "/my-requests"} 
          className="hover:text-[#0052cc]"
        >
          {currentRole === 'agent' && user?.id !== request.requesterId ? "Agent Dashboard" : "My Requests"}
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-[#101418] font-bold">{request.referenceNumber}</span>
        {request.isConfidential && (
          <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold uppercase tracking-widest rounded">
            <span className="material-symbols-outlined text-[12px]">lock</span>
            Confidential
          </span>
        )}
      </nav>

      <ActionBanner
        role={currentRole}
        status={request.status}
        assignedToName={request.assignedTo ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}` : undefined}
        onActionClick={handleActionClick}
      />

      {/* Child Requests Banner (Onboarding Tickets Created) */}
      {request.childRequests && request.childRequests.length > 0 && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span className="font-medium">Onboarding ticket created:</span>
          {request.childRequests.map((child, idx) => (
            <span key={child.id}>
              {idx > 0 && ', '}
              <Link
                to={`/request/${child.id}`}
                className="font-semibold underline hover:text-green-900"
              >
                {child.referenceNumber}
              </Link>
            </span>
          ))}
        </div>
      )}

      {/* Closed banner for terminal workflow statuses */}
      {['OFFBOARDING_COMPLETED', 'ONBOARDING_COMPLETED', 'REIMBURSEMENT_CLOSED'].includes(request.status) && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="size-12 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-white">task_alt</span>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-green-900">Ticket Closed</h3>
              <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                {request.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-green-700">This request has been completed and closed.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default RequestHeader;