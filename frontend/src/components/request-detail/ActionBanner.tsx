import React from 'react';

type RequestRole = 'agent' | 'hiring_manager' | 'ceo' | 'staff';

interface ActionBannerProps {
  role: RequestRole;
  status: string;
  assignedToName?: string;
  onActionClick?: () => void;
}

interface BannerConfig {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  bgClass: string;
  borderClass: string;
  iconBgClass: string;
  iconColor: string;
}

function getBannerConfig(role: RequestRole, status: string, assignedToName?: string): BannerConfig | null {
  if (role === 'staff') {
    if (status === 'SUBMITTED') return assignedToName ? {
      icon: 'visibility', title: 'Under Review',
      description: `${assignedToName} is reviewing your request.`,
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    } : {
      icon: 'hourglass_top', title: 'Request Submitted',
      description: 'Your request has been received and is waiting to be picked up by our team.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'IN_REVIEW') return {
      icon: 'visibility', title: 'Under Review',
      description: assignedToName ? `${assignedToName} is reviewing your request.` : 'Your request is being reviewed.',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'IN_PROGRESS') return {
      icon: 'engineering', title: 'In Progress',
      description: assignedToName ? `${assignedToName} is working on your request.` : 'Your request is being worked on.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'ACTION_REQUIRED') return {
      icon: 'warning', title: 'Action Required From You',
      description: 'The team needs more information. Please check the comments below.',
      actionLabel: 'View Comments',
      bgClass: 'bg-orange-50', borderClass: 'border-orange-300', iconBgClass: 'bg-orange-500', iconColor: 'text-white'
    };
    if (status === 'RESOLVED' || status === 'COMPLETED') return {
      icon: 'check_circle', title: 'Resolved',
      description: 'Your request has been completed.',
      bgClass: 'bg-green-50', borderClass: 'border-green-200', iconBgClass: 'bg-green-600', iconColor: 'text-white'
    };
    return null;
  }

  if (role === 'ceo') {
    if (status === 'PENDING_CEO_APPROVAL') return {
      icon: 'approval', title: 'Your Approval Required',
      description: 'This hiring request needs your approval to proceed. Review the details and make a decision.',
      actionLabel: 'Review Request',
      bgClass: 'bg-purple-50', borderClass: 'border-purple-300', iconBgClass: 'bg-purple-600', iconColor: 'text-white'
    };
    if (status === 'PENDING_MANAGER_APPROVAL_IT') return {
      icon: 'approval', title: 'Your Approval Required',
      description: 'This IT request has been routed to you for sign-off. Review the details and approve or reject.',
      actionLabel: 'Review & Decide',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-300', iconBgClass: 'bg-[#0052cc]', iconColor: 'text-white'
    };
    return null;
  }

  if (role === 'hiring_manager') {
    if (status === 'PENDING_MANAGER_REVIEW') return {
      icon: 'rate_review', title: 'Your Action: Review Candidates',
      description: 'Candidate resumes are ready for your review. Select a candidate to proceed.',
      actionLabel: 'Review Candidates',
      bgClass: 'bg-orange-50', borderClass: 'border-orange-300', iconBgClass: 'bg-orange-500', iconColor: 'text-white'
    };
    if (status === 'INTERVIEW_SCHEDULED') return {
      icon: 'feedback', title: 'Your Action: Submit Interview Feedback',
      description: 'The interview has been completed. Please submit your feedback and decision.',
      actionLabel: 'Submit Feedback',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-300', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'PENDING_CEO_APPROVAL') return {
      icon: 'hourglass_top', title: 'Waiting: CEO Approval',
      description: 'Your hiring request is pending CEO approval. You will be notified when a decision is made.',
      bgClass: 'bg-purple-50', borderClass: 'border-purple-200', iconBgClass: 'bg-purple-500', iconColor: 'text-white'
    };
    if (status === 'HR_SCREENING') return {
      icon: 'fact_check', title: 'In Progress: HR Screening',
      description: 'Background and reference checks are being conducted by HR.',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-200', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'LOA_PENDING_APPROVAL') return {
      icon: 'approval', title: 'Your Action: Approve / Reject LOA',
      description: 'Review the Letter of Acceptance and make an approval decision.',
      actionLabel: 'Approve / Reject LOA',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-300', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    return null;
  }

  if (role === 'agent') {
    if (status === 'SUBMITTED' && !assignedToName) return {
      icon: 'inbox', title: 'New Request — Needs Assignment',
      description: 'This request has not been assigned yet. Assign it to yourself or another agent.',
      actionLabel: 'Assign',
      bgClass: 'bg-yellow-50', borderClass: 'border-yellow-300', iconBgClass: 'bg-yellow-500', iconColor: 'text-white'
    };
    if (status === 'CEO_APPROVED') return {
      icon: 'work', title: 'Next Step: Post the Job',
      description: 'CEO has approved. Mark the job as posted to proceed.',
      actionLabel: 'Mark Job Posted',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-300', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    if (status === 'MANAGER_APPROVED') return {
      icon: 'calendar_month', title: 'Next Step: Schedule Interview',
      description: 'Hiring manager selected a candidate. Schedule the interview.',
      actionLabel: 'Schedule Interview',
      bgClass: 'bg-indigo-50', borderClass: 'border-indigo-300', iconBgClass: 'bg-indigo-600', iconColor: 'text-white'
    };
    if (status === 'INTERVIEW_FEEDBACK_PENDING') return {
      icon: 'play_arrow', title: 'Next Step: Start HR Screening',
      description: 'Interview feedback received. Begin background and reference checks.',
      actionLabel: 'Start Screening',
      bgClass: 'bg-blue-50', borderClass: 'border-blue-300', iconBgClass: 'bg-blue-600', iconColor: 'text-white'
    };
    return null;
  }

  return null;
}

const ActionBanner: React.FC<ActionBannerProps> = ({ role, status, assignedToName, onActionClick }) => {
  const config = getBannerConfig(role, status, assignedToName);
  if (!config) return null;

  return (
    <div className={`mb-8 ${config.bgClass} border-2 ${config.borderClass} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`size-11 rounded-full ${config.iconBgClass} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-xl ${config.iconColor}`}>{config.icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
        </div>
        {config.actionLabel && onActionClick && (
          <button
            onClick={onActionClick}
            className="px-5 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            {config.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionBanner;
