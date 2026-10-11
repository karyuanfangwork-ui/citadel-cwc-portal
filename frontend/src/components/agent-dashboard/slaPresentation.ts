import { DashboardSlaState } from '../../services/agent-dashboard.service';

export function slaPresentation(state: DashboardSlaState, remainingMs: number | null) {
  const positive = remainingMs === null ? null : Math.abs(remainingMs);
  const hours = positive === null ? 0 : Math.floor(positive / 3_600_000);
  const days = Math.floor(hours / 24);
  const mins = Math.floor((positive ?? 0) / 60_000) % 60;
  const duration = days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const labels: Record<DashboardSlaState, string> = {
    BREACHED: `Breached ${duration} ago`, DUE_SOON: `${duration} left`, ON_TRACK: `${duration} left`,
    PAUSED: `Paused · ${duration} remaining`, NO_SLA: 'No SLA', MET: 'Met SLA', MISSED: 'Missed SLA at resolution',
    NOT_APPLICABLE: 'Not applicable', UNKNOWN: 'SLA outcome unavailable',
  };
  const classes: Record<DashboardSlaState, string> = {
    BREACHED: 'text-red-700 bg-red-50', DUE_SOON: 'text-amber-800 bg-amber-50', ON_TRACK: 'text-emerald-700 bg-emerald-50',
    PAUSED: 'text-slate-700 bg-slate-100', NO_SLA: 'text-slate-600 bg-slate-100', MET: 'text-emerald-700 bg-emerald-50',
    MISSED: 'text-amber-800 bg-amber-50', NOT_APPLICABLE: 'text-slate-600 bg-slate-100', UNKNOWN: 'text-slate-700 bg-slate-100',
  };
  return { label: labels[state], className: classes[state] };
}
