import React from 'react';
import { CrmActivity, CrmActivityType } from '../../services/crm.service';

const T = {
  teal: '#006a61',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  border: '#e2e8f0',
  success: '#22c55e',
  blue: '#3b82f6',
  warning: '#f59e0b',
  slate: '#94a3b8',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const ACTIVITY_COLORS: Record<string, { ring: string; bg: string; text: string }> = {
  CALL: { ring: T.blue, bg: '#dbeafe', text: '#1d4ed8' },
  EMAIL: { ring: T.blue, bg: '#dbeafe', text: '#1d4ed8' },
  WHATSAPP: { ring: T.success, bg: '#dcfce7', text: '#15803d' },
  MEETING: { ring: T.teal, bg: '#ccfbf1', text: T.teal },
  SITE_VISIT: { ring: T.teal, bg: '#ccfbf1', text: T.teal },
  NOTE: { ring: T.slate, bg: '#f1f5f9', text: '#475569' },
  TASK: { ring: T.warning, bg: '#fef3c7', text: '#92400e' },
  FOLLOW_UP: { ring: T.warning, bg: '#fef3c7', text: '#92400e' },
};

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2',
  TASK: 'task_alt', FOLLOW_UP: 'notifications', WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

interface Props {
  activities: CrmActivity[];
}

const Customer360ActivityTimeline: React.FC<Props> = ({ activities }) => {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const display = sorted.slice(0, 5);

  if (display.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: T.border }}>
        <h3 className="text-[16px] font-semibold mb-4" style={{ color: T.textPrimary }}>
          Recent Activity
        </h3>
        <div className="flex flex-col items-center py-6">
          <span className="material-symbols-outlined text-[40px] mb-2" style={{ color: T.textMuted }}>
            timeline
          </span>
          <p className="text-[13px]" style={{ color: T.textMuted }}>No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: T.border }}>
      <h3 className="text-[16px] font-semibold mb-4" style={{ color: T.textPrimary }}>
        Recent Activity
      </h3>
      <div className="relative pl-8">
        {/* Vertical line */}
        <div
          className="absolute left-[11px] top-2 bottom-2 w-[2px]"
          style={{ background: '#e2e8f0' }}
        />
        {display.map(a => {
          const colors = ACTIVITY_COLORS[a.activityType] ?? ACTIVITY_COLORS.NOTE;
          const icon = ACTIVITY_ICONS[a.activityType] ?? 'circle';
          return (
            <div key={a.id} className="relative pb-4 last:pb-0">
              {/* Node */}
              <div
                className="absolute -left-8 top-0 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10"
                style={{ background: colors.bg }}
              >
                <span className="material-symbols-outlined text-[14px]" style={{ color: colors.text }}>
                  {icon}
                </span>
              </div>
              {/* Content */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: T.textPrimary }}>
                    {a.subject}
                  </p>
                  {a.description && (
                    <p className="text-[12px] truncate" style={{ color: T.textMuted }}>
                      {a.description}
                    </p>
                  )}
                </div>
                <span className="text-[12px] italic whitespace-nowrap shrink-0" style={{ color: T.textMuted }}>
                  {formatDate(a.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Customer360ActivityTimeline;