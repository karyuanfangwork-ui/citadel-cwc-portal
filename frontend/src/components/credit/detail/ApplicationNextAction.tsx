/**
 * ApplicationNextAction — Right sidebar priority next action card.
 *
 * Replaces the floating FAB "Next Incomplete Section". Shows the
 * next actionable step, assignee, due date, and a "Go to Section" button.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';
import { DetailTab } from '../../../../pages/credit/creditUtils';

interface ApplicationNextActionProps {
  nextTab: DetailTab | null;
  nextGroupLabel: string;
  nextTabLabel: string;
  assigneeName?: string;
  dueDate?: string;
  urgency: 'urgent' | 'warning' | 'normal';
  onNavigate: (tab: DetailTab) => void;
}

const urgencyConfig: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: '#dc2626', bg: '#fef2f2', label: 'Urgent' },
  warning: { color: '#d97706', bg: '#fffbeb', label: 'Due Soon' },
  normal: { color: '#16a34a', bg: '#f0fdf4', label: 'On Track' },
};

const ApplicationNextAction: React.FC<ApplicationNextActionProps> = ({
  nextTab,
  nextGroupLabel,
  nextTabLabel,
  assigneeName,
  dueDate,
  urgency,
  onNavigate,
}) => {
  if (!nextTab) return null;

  const config = urgencyConfig[urgency] || urgencyConfig.normal;

  return (
    <div className="px-4 pb-4">
      <h3
        className="font-bold uppercase tracking-wider mb-3"
        style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
      >
        Priority Next Action
      </h3>
      <div
        className="flex flex-col gap-2.5 p-4"
        style={{
          backgroundColor: config.bg,
          border: `1px solid ${config.color}30`,
          borderRadius: 'var(--cr-radius-lg)',
          boxShadow: `0 0 0 1px ${config.color}10`,
        }}
      >
        {/* Section + Tab label */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: config.color }}>
            arrow_forward
          </span>
          <div className="flex flex-col">
            <span
              className="font-bold"
              style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-body-sm)', color: 'var(--cr-on-surface)' }}
            >
              {nextTabLabel}
            </span>
            <span style={{ fontSize: 11, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
              {nextGroupLabel}
            </span>
          </div>
        </div>

        {/* Assignee + Due */}
        {(assigneeName || dueDate) && (
          <div className="flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
            {assigneeName && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                {assigneeName}
              </div>
            )}
            {dueDate && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                <span style={{ color: config.color, fontWeight: 600 }}>{dueDate}</span>
                <span
                  className="px-1.5 py-0.5 rounded font-bold uppercase"
                  style={{ fontSize: 10, backgroundColor: config.color, color: '#fff', fontFamily: 'var(--cr-font-display)' }}
                >
                  {config.label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => onNavigate(nextTab)}
          className="mt-1 w-full flex items-center justify-center gap-1.5 py-2 font-bold transition-colors"
          style={{
            backgroundColor: config.color,
            color: '#fff',
            borderRadius: 'var(--cr-radius)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--cr-text-body-sm)',
            fontFamily: 'var(--cr-font-display)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>north_east</span>
          Go to Section
        </button>
      </div>
    </div>
  );
};

export default ApplicationNextAction;