import React from 'react';

interface SLAIndicatorProps {
  slaDueAt: string | null | undefined;
  status: string;
  slaPaused?: boolean;
  slaPausedAt?: string | null;
  slaPauseDurationMs?: number | bigint | null;
}

const TERMINAL_STATUSES = ['RESOLVED', 'COMPLETED', 'REJECTED', 'CEO_REJECTED',
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
  slaPaused = false,
  slaPausedAt,
  slaPauseDurationMs,
}) => {
  if (!slaDueAt || TERMINAL_STATUSES.includes(status)) return null;

  const now = new Date();
  const due = new Date(slaDueAt);

  // Compute effective due date accounting for pause time
  const pauseDuration = Number(slaPauseDurationMs ?? 0) || 0;
  const effectiveDue = new Date(due.getTime() + pauseDuration);

  // If currently paused, the "remaining time" is frozen at the moment of pause
  if (slaPaused && slaPausedAt) {
    const pausedAt = new Date(slaPausedAt);
    // Time remaining when paused = effectiveDue - pausedAt (not current time)
    const pausedRemainingMs = effectiveDue.getTime() - pausedAt.getTime();

    // Format cumulative pause info
    const cumulativePauseMs = pauseDuration + (now.getTime() - pausedAt.getTime());
    const pauseLabel = formatDuration(cumulativePauseMs);

    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="material-symbols-outlined text-sm">pause_circle</span>
        <span>SLA: Paused (approval pending)</span>
        <span className="text-[10px] font-normal opacity-70">
          — paused for {pauseLabel}
        </span>
      </div>
    );
  }

  const diffMs = effectiveDue.getTime() - now.getTime();
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