import React from 'react';

interface SLAIndicatorProps {
  slaDueAt: string | null | undefined;
  status: string;
}

const TERMINAL_STATUSES = ['RESOLVED', 'COMPLETED', 'REJECTED', 'CEO_REJECTED',
  'CANDIDATE_REJECTED_INTERVIEW', 'MANAGER_REJECTED_IT', 'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED', 'REIMBURSEMENT_CLOSED', 'ONBOARDING_COMPLETED'];

const SLAIndicator: React.FC<SLAIndicatorProps> = ({ slaDueAt, status }) => {
  if (!slaDueAt || TERMINAL_STATUSES.includes(status)) return null;

  const now = new Date();
  const due = new Date(slaDueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = Math.abs(diffHours) % 24;

  const isBreached = diffMs < 0;
  const isWarning = !isBreached && diffHours < 24;

  let label: string;
  if (isBreached) {
    const overHours = Math.abs(diffHours);
    const overDays = Math.floor(overHours / 24);
    label = overDays > 0 ? `${overDays}d ${overHours % 24}h overdue` : `${Math.abs(diffHours)}h overdue`;
  } else if (diffDays > 0) {
    label = `${diffDays}d ${remainingHours}h remaining`;
  } else {
    label = `${diffHours}h remaining`;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
      isBreached ? 'bg-red-100 text-red-700 border border-red-200' :
      isWarning ? 'bg-amber-100 text-amber-700 border border-amber-200' :
      'bg-green-100 text-green-700 border border-green-200'
    }`}>
      <span className="material-symbols-outlined text-sm">
        {isBreached ? 'error' : isWarning ? 'warning' : 'timer'}
      </span>
      <span>SLA: {label}</span>
      <span className="text-[10px] font-normal opacity-75">
        (Due: {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
      </span>
    </div>
  );
};

export default SLAIndicator;
