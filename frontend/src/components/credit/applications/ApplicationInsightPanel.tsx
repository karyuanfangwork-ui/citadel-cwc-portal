import React from 'react';

export interface InsightTaskItem {
  id: string;
  applicationNo: string;
  borrowerName: string;
  meta: string;
  urgent?: boolean;
  onClick: () => void;
}

interface ApplicationInsightPanelProps {
  visibleExposure: string;
  exposurePct?: number;
  pendingApprovalCount: number;
  visibleDisbursedCount: number;
  urgentTasks: InsightTaskItem[];
}

const cardStyle: React.CSSProperties = {
  background: 'var(--cr-surface-container-lowest)',
  border: '1px solid var(--cr-outline-variant)',
  borderRadius: 'var(--cr-radius-lg)',
};

const ApplicationInsightPanel: React.FC<ApplicationInsightPanelProps> = ({
  visibleExposure,
  exposurePct,
  pendingApprovalCount,
  visibleDisbursedCount,
  urgentTasks,
}) => {
  return (
    <aside className="space-y-4">
      <div className="p-5" style={cardStyle}>
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
          Portfolio Insights
        </h2>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span style={{ color: 'var(--cr-on-surface-variant)' }}>Total Exposure</span>
              <span className="font-bold tabular-nums" style={{ color: 'var(--cr-on-surface)' }}>{visibleExposure}</span>
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--cr-surface-container)' }}>
              <div className="h-full rounded-full" style={{ width: `${exposurePct ?? 64}%`, background: 'var(--cr-primary)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3" style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Pending Approvals</p>
              <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)' }}>{pendingApprovalCount}</p>
            </div>
            <div className="p-3" style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Disbursed</p>
              <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)' }}>{visibleDisbursedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5" style={cardStyle}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
            Urgent Tasks
          </h2>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: urgentTasks.length > 0 ? 'var(--cr-error)' : 'var(--cr-surface-container)', color: urgentTasks.length > 0 ? 'var(--cr-on-error)' : 'var(--cr-on-surface-variant)' }}>
            {urgentTasks.length.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="space-y-3">
          {urgentTasks.length === 0 && (
            <div className="rounded border border-dashed p-3 text-sm" style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface-variant)' }}>
              No urgent items.
            </div>
          )}
          {urgentTasks.slice(0, 4).map(task => (
            <button
              key={task.id}
              onClick={task.onClick}
              className="block w-full border-l-4 p-3 text-left transition-colors hover:bg-[var(--cr-surface-container-low)]"
              style={{
                background: task.urgent ? 'rgba(255, 218, 214, 0.35)' : 'var(--cr-surface-container-low)',
                borderLeftColor: task.urgent ? 'var(--cr-error)' : 'var(--cr-outline)',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderRadius: 'var(--cr-radius)',
                cursor: 'pointer',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{task.borrowerName}</p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--cr-on-surface-variant)' }}>{task.applicationNo} • {task.meta}</p>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ApplicationInsightPanel;
