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

interface WorkflowStep {
  id: string;
  label: string;
  status: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
}

interface RequestHeaderProps {
  request: {
    id: string;
    referenceNumber: string;
    summary: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    assignedTo?: { firstName: string; lastName: string } | null;
    requesterId: string;
    serviceDesk?: { code: string };
    requestType?: { 
      code: string; 
      name: string; 
      workflowTypeId?: string;
      workflow?: {
        id: string;
        code: string;
        name: string;
        steps: WorkflowStep[];
      };
    };
    childRequests?: RequestChild[];
  };
  activities: Activity[];
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
  activities,
  user,
  onActionClick,
  onScheduleInterview,
  onInterviewFeedback,
  onLOAApproval,
  onStartHRScreening,
  onMarkLOAIssued,
}) => {
  const getStatusSteps = (currentStatus: string) => {
    // 0. Check if workflow type from database with steps
    const workflowData = request.requestType?.workflow;
    if (workflowData && workflowData.steps && workflowData.steps.length > 0) {
      // Use dynamic workflow steps from database
      const steps = workflowData.steps.sort((a, b) => a.displayOrder - b.displayOrder);
      const statusOrder = steps.map(s => s.status);
      const currentIndex = statusOrder.indexOf(currentStatus);
      return steps.map((step) => ({
        label: step.label,
        status: step.status,
        icon: step.icon,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    // 1. Onboarding Workflow (legacy fallback)
    if (currentStatus.startsWith('ONBOARDING_')) {
      const allSteps = [
        { label: 'Submitted', status: 'ONBOARDING_SUBMITTED', icon: 'check_circle' },
        { label: 'HR Approval', status: 'ONBOARDING_PENDING_HR_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Pre-Arrival', status: 'ONBOARDING_PRE_ARRIVAL_SETUP', icon: 'radio_button_checked' },
        { label: 'Day 1', status: 'ONBOARDING_DAY_1_ORIENTATION', icon: 'radio_button_checked' },
        { label: 'Week 1', status: 'ONBOARDING_WEEK_1_INTEGRATION', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'ONBOARDING_COMPLETED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL', 'ONBOARDING_PRE_ARRIVAL_SETUP',
        'ONBOARDING_READY_FOR_DAY_1', 'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
        'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE', 'ONBOARDING_MONTH_3_MILESTONE', 
        'ONBOARDING_COMPLETED'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    // 2. Offboarding Workflow
    if (currentStatus.startsWith('OFFBOARDING_')) {
      const allSteps = [
        { label: 'Submitted', status: 'OFFBOARDING_SUBMITTED', icon: 'check_circle' },
        { label: 'Notice Period', status: 'OFFBOARDING_NOTICE_PERIOD', icon: 'radio_button_checked' },
        { label: 'KT Phase', status: 'OFFBOARDING_KNOWLEDGE_TRANSFER', icon: 'radio_button_checked' },
        { label: 'Final Week', status: 'OFFBOARDING_FINAL_WEEK', icon: 'radio_button_checked' },
        { label: 'Exit Proc', status: 'OFFBOARDING_EXIT_PROCEDURES', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'OFFBOARDING_COMPLETED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'OFFBOARDING_SUBMITTED', 'OFFBOARDING_NOTICE_PERIOD', 'OFFBOARDING_KNOWLEDGE_TRANSFER',
        'OFFBOARDING_FINAL_WEEK', 'OFFBOARDING_EXIT_PROCEDURES', 'OFFBOARDING_COMPLETED'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    // 3. Workflow by workflow code (takes precedence for legacy fallback)
    const workflowCode = request.requestType?.workflow?.code;
    
    if (workflowCode === 'IT_PROCUREMENT') {
      // IT Procurement Workflow: CEO -> CTO -> CFO approval chain
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked' },
        { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked' },
        { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked' },
        { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked' },
        { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked' },
        { label: 'Delivery', status: 'PENDING_DELIVERY_IT', icon: 'radio_button_checked' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'ACKNOWLEDGED_IT', 'PENDING_CEO_APPROVAL_IT', 'CEO_APPROVED_IT',
        'PENDING_CTO_APPROVAL_IT', 'CTO_APPROVED_IT', 'PENDING_INVOICE_IT',
        'PENDING_CFO_APPROVAL_IT', 'CFO_APPROVED_IT', 'PAYMENT_PROCESSING_IT',
        'PAYMENT_DONE_IT', 'PENDING_DELIVERY_IT', 'RESOLVED'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
    
    if (workflowCode === 'IT_SIMPLE') {
      // Simple IT Workflow: Get IT help, Email management, etc.
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
        { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
    
    if (workflowCode === 'HR_RECRUITMENT') {
      // HR Recruitment Workflow: CEO Approval -> Job Posted -> Manager Review -> Interview -> Screening -> LOA
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
        { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Job Posted', status: 'JOB_POSTED', icon: 'radio_button_checked' },
        { label: 'Manager Review', status: 'PENDING_MANAGER_REVIEW', icon: 'radio_button_checked' },
        { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'radio_button_checked' },
        { label: 'Feedback', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'radio_button_checked' },
        { label: 'Screening', status: 'HR_SCREENING', icon: 'radio_button_checked' },
        { label: 'LOA Pending', status: 'LOA_PENDING_APPROVAL', icon: 'radio_button_checked' },
        { label: 'LOA Approved', status: 'LOA_APPROVED', icon: 'radio_button_checked' },
        { label: 'LOA Issued', status: 'LOA_ISSUED', icon: 'radio_button_checked' },
        { label: 'LOA Accepted', status: 'LOA_ACCEPTED', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'COMPLETED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS',
        'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
        'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
        'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW',
        'HR_SCREENING',
        'LOA_PENDING_APPROVAL', 'LOA_REJECTED', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED',
        'COMPLETED'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
    
    if (workflowCode === 'HR_GENERAL') {
      // General HR Support: simple workflow (HR_QUESTION, etc.)
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
        { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }
    
    if (workflowCode === 'FINANCE') {
      // Finance Purchase Requisition Workflow: CFO -> Group CEO approval chain
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Acknowledged', status: 'FINANCE_ACKNOWLEDGED', icon: 'radio_button_checked' },
        { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked' },
        { label: 'Group CEO', status: 'PENDING_GROUP_CEO_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'TICKET_CLOSED_FIN', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'FINANCE_PENDING_ACK', 'FINANCE_ACKNOWLEDGED', 'FINANCE_IN_PROGRESS',
        'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN', 'CFO_REJECTED_FIN',
        'PENDING_GROUP_CEO_APPROVAL', 'GROUP_CEO_APPROVED', 'GROUP_CEO_REJECTED',
        'PAYMENT_PROCESSING_FIN', 'AWAITING_PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMED_FIN',
        'TICKET_CLOSED_FIN'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    if (workflowCode === 'EXPENSE_REIMBURSEMENT') {
      // Expense Reimbursement Workflow: Manager -> Finance Head -> Payment
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Manager Approval', status: 'PENDING_MANAGER_APPROVAL_FIN', icon: 'radio_button_checked' },
        { label: 'Finance Head', status: 'PENDING_FINANCE_HEAD_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'REIMBURSEMENT_CLOSED', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED',
        'PENDING_MANAGER_APPROVAL_FIN', 'MANAGER_APPROVED_FIN', 'MANAGER_REJECTED_FIN',
        'PENDING_FINANCE_HEAD_APPROVAL', 'FINANCE_HEAD_APPROVED', 'FINANCE_HEAD_REJECTED',
        'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED', 'REIMBURSEMENT_CLOSED',
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    // 4. Fallback: Service Desk based logic (for legacy data without workflowType)
    if (request.serviceDesk?.code === 'HR') {
      // Legacy HR fallback - default to HR_GENERAL
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
        { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    if (request.serviceDesk?.code === 'IT') {
      // Legacy IT fallback - default to IT_SIMPLE
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
        { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
        { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
      ];
      const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    if (request.serviceDesk?.code === 'FINANCE') {
      // Legacy Finance fallback - default to Purchase Requisition workflow
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'Acknowledged', status: 'FINANCE_ACKNOWLEDGED', icon: 'radio_button_checked' },
        { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked' },
        { label: 'Group CEO', status: 'PENDING_GROUP_CEO_APPROVAL', icon: 'radio_button_checked' },
        { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
        { label: 'Completed', status: 'TICKET_CLOSED_FIN', icon: 'check_circle' },
      ];
      const statusOrder = [
        'SUBMITTED', 'FINANCE_PENDING_ACK', 'FINANCE_ACKNOWLEDGED', 'FINANCE_IN_PROGRESS',
        'PENDING_CFO_APPROVAL_FIN', 'CFO_APPROVED_FIN', 'CFO_REJECTED_FIN',
        'PENDING_GROUP_CEO_APPROVAL', 'GROUP_CEO_APPROVED', 'GROUP_CEO_REJECTED',
        'PAYMENT_PROCESSING_FIN', 'AWAITING_PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMED_FIN',
        'TICKET_CLOSED_FIN'
      ];
      const currentIndex = statusOrder.indexOf(currentStatus);
      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    // Final fallback
    const allSteps = [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
    ];
    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'APPROVED', 'REJECTED'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    return allSteps.map((step) => ({
      ...step,
      active: statusOrder.indexOf(step.status) <= currentIndex,
    }));
  };

  const steps = getStatusSteps(request.status);
  const currentRole = detectRequestRole({
    userRoles: user?.roles || [],
    userId: user?.id || '',
    requesterId: request.requesterId,
    requestStatus: request.status,
    serviceDeskCode: request.serviceDesk?.code || '',
  });

  // Build timestamp map from status change activities
  const statusTimestamps: Record<string, string> = {};
  activities
    .filter(a => a.activityType === 'STATUS_CHANGE' || (a.isSystemGenerated && a.message.includes('status')))
    .forEach(a => {
      const match = a.message.match(/status.*?to\s+(\w+)/i) || a.message.match(/(\w+_?\w+)/);
      if (match) {
        statusTimestamps[match[1]] = a.createdAt;
      }
    });
  statusTimestamps['SUBMITTED'] = request.createdAt;

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
      const actionsSection = document.querySelector('[data-actions-sidebar]');
      if (actionsSection) actionsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
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
      </nav>

      {/* Status Progress */}
      <div className="mb-10 bg-white border border-gray-100 p-8 rounded-xl shadow-sm">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => (
            <React.Fragment key={step.label}>
              <div
                className={`flex flex-col items-center gap-2 z-10 ${step.active ? 'text-[#0052cc]' : 'text-[#8993a4]'
                  }`}
              >
                <span
                  className={`material-symbols-outlined !text-2xl ${!step.active ? 'opacity-30' : ''}`}
                >
                  {step.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
                {step.active && statusTimestamps[step.status] && (
                  <span className="text-[9px] text-[#8993a4] font-normal">
                    {new Date(statusTimestamps[step.status]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-grow mx-4 ${steps[idx + 1].active ? 'bg-[#0052cc]' : 'bg-gray-100'
                    }`}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

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
                to={`/#/requests/${child.id}`}
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
