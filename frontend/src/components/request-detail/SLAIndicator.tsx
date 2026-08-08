import React from 'react';
import { getSlaDisplayDueMs } from './slaDisplay';

interface SLAIndicatorProps {
  slaDueAt: string | null | undefined;
  status: string;
  slaPausedAt?: string | null;
  slaPauseDurationMs?: number | bigint | null;
}

const TERMINAL_STATUSES = ['RESOLVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'CEO_REJECTED',
  'CANDIDATE_REJECTED_INTERVIEW', 'MANAGER_REJECTED_FIN',
  'FINANCE_HEAD_REJECTED', 'REIMBURSEMENT_CLOSED', 'ONBOARDING_COMPLETED', 'OFFBOARDING_COMPLETED'];

/**
 * Format milliseconds into a human-readable duration string (e.g., "12h 30m", "2d 5h").
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

const SLAIndicator: React.FC<SLAIndicatorProps> = ({
  slaDueAt,
  status,
  slaPausedAt,
  slaPauseDurationMs,
}) => {
  if (!slaDueAt || TERMINAL_STATUSES.includes(status)) return null;

  const now = new Date();
  const pauseDuration = Number(slaPauseDurationMs ?? 0) || 0;

  // slaPausedAt is the authoritative signal that the clock is currently paused.
  if (slaPausedAt) {
    const pausedAt = new Date(slaPausedAt);
    // Format cumulative pause info
    const cumulativePauseMs = pauseDuration + (now.getTime() - pausedAt.getTime());
    const pauseLabel = formatDuration(cumulativePauseMs);

    return (
      <div
        role="status"
        aria-label="SLA paused. Timer stopped for the current workflow status."
        className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 rounded-lg text-xs bg-blue-50 text-blue-800 border border-blue-200"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">pause_circle</span>
        <span className="font-bold tracking-wide">SLA PAUSED</span>
        <span className="font-normal">Timer stopped for the current workflow status.</span>
        <span className="w-full pl-6 text-[10px] font-normal text-blue-700">
          Paused for {pauseLabel}. The deadline resumes when the request leaves this status.
        </span>
      </div>
    );
  }

  const displayDueMs = getSlaDisplayDueMs(slaDueAt, null, now.getTime());
  if (displayDueMs === null) return null;

  const effectiveDue = new Date(displayDueMs);
  const diffMs = displayDueMs - now.getTime();
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

  // Show cumulative pause info if the ticket has been paused before
  const pauseInfo = pauseDuration > 0 ? (
    <span className="text-[10px] font-normal opacity-70">
      (paused {formatDuration(pauseDuration)} during approvals)
    </span>
  ) : null;

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
      {pauseInfo}
      <span className="text-[10px] font-normal opacity-75">
        (Due: {effectiveDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
      </span>
    </div>
  );
};

export default SLAIndicator;