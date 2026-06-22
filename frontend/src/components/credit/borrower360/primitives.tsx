import React from 'react';

type Tone = 'pos' | 'warn' | 'neg' | 'info' | 'neutral' | 'default';
type MiniBarTone = 'pos' | 'warn' | 'neg' | 'default';

const TONE_TEXT_CLASS: Record<Tone, string> = {
  pos: 'text-fc-pos',
  warn: 'text-fc-warn',
  neg: 'text-fc-neg',
  info: 'text-fc-secondary',
  neutral: 'text-fc-on-variant',
  default: 'text-fc-primary',
};

const TONE_BG_CLASS: Record<Exclude<Tone, 'default'>, string> = {
  pos: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  neg: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

const MINI_BAR_FILL_CLASS: Record<MiniBarTone, string> = {
  pos: 'bg-emerald-500',
  warn: 'bg-amber-500',
  neg: 'bg-red-500',
  default: 'bg-fc-secondary',
};

export type KpiCellProps = {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: string;
};

export const KpiCell: React.FC<KpiCellProps> = ({ label, value, tone = 'default', sub }) => (
  <div className="rounded-fc border border-fc-outline bg-fc-surface p-3">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-fc-on-variant">{label}</p>
    <p className={`font-display text-headline-md tabular-nums ${TONE_TEXT_CLASS[tone]}`}>
      {value}
      {sub ? <span className="ml-1 text-[11px] font-normal text-fc-on-variant">{sub}</span> : null}
    </p>
  </div>
);

export type OutlinedCardProps = React.PropsWithChildren<{
  title?: string;
  action?: React.ReactNode;
}>;

export const OutlinedCard: React.FC<OutlinedCardProps> = ({ title, action, children }) => (
  <div className="overflow-hidden rounded-fc border border-fc-outline bg-fc-surface">
    {title ? (
      <div className="flex items-center justify-between border-b border-fc-outline px-4 py-3">
        <h4 className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">{title}</h4>
        {action}
      </div>
    ) : null}
    <div className="p-4">{children}</div>
  </div>
);

export type StatusPillProps = {
  label: string;
  tone: Exclude<Tone, 'default'>;
};

export const StatusPill: React.FC<StatusPillProps> = ({ label, tone }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_BG_CLASS[tone]}`}>
    {label}
  </span>
);

export type AlertCardProps = {
  tone: 'warn' | 'neg';
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const AlertCard: React.FC<AlertCardProps> = ({ tone, icon, title, body, actionLabel, onAction }) => {
  const palette =
    tone === 'neg'
      ? {
          container: 'border-red-100 bg-red-50',
          icon: 'bg-red-100 text-red-600',
          title: 'text-red-900',
          body: 'text-red-700',
          action: 'text-red-900',
        }
      : {
          container: 'border-amber-100 bg-amber-50',
          icon: 'bg-amber-100 text-amber-600',
          title: 'text-amber-900',
          body: 'text-amber-700',
          action: 'text-amber-900',
        };

  return (
    <div className={`flex items-start gap-4 rounded-fc border p-4 ${palette.container}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${palette.icon}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex-1">
        <h5 className={`text-sm font-bold ${palette.title}`}>{title}</h5>
        <p className={`text-[12px] leading-snug ${palette.body}`}>{body}</p>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className={`mt-2 cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold uppercase tracking-tight underline ${palette.action}`}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export type MiniBarProps = {
  label: string;
  value: number;
  max: number;
  display: string;
  tone?: MiniBarTone;
};

export const MiniBar: React.FC<MiniBarProps> = ({ label, value, max, display, tone = 'default' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className="text-[12px] text-fc-on-variant">{label}</span>
        <span className="tabular-nums text-sm font-bold text-fc-primary">{display}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${MINI_BAR_FILL_CLASS[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export type ActivityEvent = {
  icon: string;
  tone: Tone;
  title: string;
  detail: string;
  at: string;
};

export type ActivityTimelineProps = {
  events: ActivityEvent[];
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => (
  <div className="relative">
    <div className="absolute bottom-0 left-3 top-0 w-px bg-fc-outline" />
    <div className="relative space-y-6">
      {events.map((event, index) => (
        <div key={`${event.title}-${index}`} className="flex items-start gap-6">
          <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-fc-surface-low">
            <span className={`material-symbols-outlined text-[14px] ${TONE_TEXT_CLASS[event.tone] ?? TONE_TEXT_CLASS.neutral}`}>
              {event.icon}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-bold text-fc-primary">{event.title}</p>
              <span className="shrink-0 text-[11px] text-fc-on-variant">{event.at}</span>
            </div>
            <p className="text-[12px] text-fc-on-variant">{event.detail}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export type {
  Tone,
  MiniBarTone,
};
