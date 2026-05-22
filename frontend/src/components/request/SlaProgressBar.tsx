import React from 'react';

type Props = {
  createdAt: string;
  slaDueAt?: string | null;
  slaPausedAt?: string | null;
  resolvedAt?: string | null;
};

const formatRemaining = (ms: number): string => {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const SlaProgressBar: React.FC<Props> = ({ createdAt, slaDueAt, slaPausedAt, resolvedAt }) => {
  if (!slaDueAt) return null;

  const start = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const now = Date.now();
  const total = Math.max(1, due - start);
  const elapsed = Math.max(0, Math.min(now, due) - start);
  const pct = Math.min(100, Math.round((elapsed / total) * 100));

  const isPaused = !!slaPausedAt && !resolvedAt;
  const isResolved = !!resolvedAt;
  const isBreached = !isResolved && now > due;
  const remainingMs = due - now;

  let barColor = 'bg-emerald-500';
  let label = `Due in ${formatRemaining(remainingMs)}`;
  let textColor = 'text-emerald-700';

  if (isResolved) {
    barColor = 'bg-gray-400';
    label = 'Resolved';
    textColor = 'text-gray-600';
  } else if (isPaused) {
    barColor = 'bg-gray-400';
    label = `Paused — ${formatRemaining(remainingMs)} remaining`;
    textColor = 'text-gray-600';
  } else if (isBreached) {
    barColor = 'bg-red-500';
    label = `Breached by ${formatRemaining(remainingMs)}`;
    textColor = 'text-red-700';
  } else if (pct >= 90) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (pct >= 60) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-700';
  }

  const ariaLabel = `SLA ${pct}% elapsed. ${label}.`;

  return (
    <div
      className="mb-6 bg-white border border-gray-100 rounded-xl px-5 py-3 shadow-sm"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">
            {isPaused ? 'pause_circle' : isBreached ? 'error' : 'schedule'}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">SLA</span>
        </div>
        <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
      </div>
      <div
        className="h-2 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        title={`Due ${new Date(due).toLocaleString()}`}
      >
        <div
          className={`h-full ${barColor} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default SlaProgressBar;
