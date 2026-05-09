import React from 'react';

interface InterviewFeedback {
  decision: string;
}

interface ApprovalActionsProps {
  request: {
    status: string;
    id: string;
    serviceDesk?: { code: string };
  };
  hasLOA?: boolean;
  interviewDetails: {
    schedule: any;
    feedback: InterviewFeedback | null;
  } | null;
  user: { roles?: string[] } | null;
  processingAction: boolean;
  onStartHRScreening: () => void;
  onRouteLOAForApproval: () => void;
  onReviseAndResubmit: () => void;
  onReopenForNewCandidates: () => void;
}

type ApprovalRequestStatus = 'INTERVIEW_FEEDBACK_PENDING' | 'HR_SCREENING' | 'LOA_PENDING_APPROVAL' | 'LOA_APPROVED' | 'CEO_REJECTED' | 'CANDIDATE_REJECTED_INTERVIEW' | 'CLOSED' | 'RESOLVED';

const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  request,
  interviewDetails,
  user,
  processingAction,
  hasLOA,
  onStartHRScreening,
  onRouteLOAForApproval,
  onReviseAndResubmit,
  onReopenForNewCandidates,
}) => {
  const isHRAgent = user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN');
  const { status } = request;
  const statusString: string = status;
  const isHR = request.serviceDesk?.code === 'HR';

  const showStartScreening = isHR && isHRAgent && status === 'INTERVIEW_FEEDBACK_PENDING' && interviewDetails?.feedback?.decision === 'PROCEED';
  const showRouteLOA = isHR && isHRAgent && (status === 'HR_SCREENING' || status === 'LOA_PENDING_APPROVAL') && hasLOA;
  const showRevise = isHR && isHRAgent && status === 'CEO_REJECTED';
  const showReopen = isHR && isHRAgent && (status === 'CLOSED' || status === 'RESOLVED');

  if (!showStartScreening && !showRouteLOA && !showRevise && !showReopen) return null;

  return (
    <div className="w-full bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm p-4 space-y-3">

      {showStartScreening && (
        <button
          onClick={onStartHRScreening}
          disabled={processingAction}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-lg">play_arrow</span>
          {processingAction ? 'Processing...' : 'Start HR Screening'}
        </button>
      )}

      {showRouteLOA && (
        <button
          onClick={onRouteLOAForApproval}
          disabled={processingAction}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-lg">send</span>
          {processingAction ? 'Routing...' : 'Route LOA for Approval'}
        </button>
      )}

      {showRevise && (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 font-semibold">CEO has rejected this request.</p>
          </div>
          <button
            onClick={onReviseAndResubmit}
            disabled={processingAction}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">replay</span>
            {processingAction ? 'Processing...' : 'Revise & Resubmit'}
          </button>
        </div>
      )}

      {(statusString === 'CANDIDATE_REJECTED_INTERVIEW' && isHR && isHRAgent) && (
        <button
          onClick={onReopenForNewCandidates}
          disabled={processingAction}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">replay</span>
          {processingAction ? 'Processing...' : 'Re-open for New Candidates'}
        </button>
      )}
    </div>
  );
};

export default ApprovalActions;
