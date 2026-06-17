import React from 'react';

interface ApplicationManagementHeaderProps {
  total: number;
  visibleActive: number;
  visibleUrgent: number;
  pendingApprovalCount: number;
  canCreate: boolean;
  onCreate: () => void;
}

const metricCardStyle: React.CSSProperties = {
  background: 'var(--cr-surface-container-lowest)',
  border: '1px solid var(--cr-outline-variant)',
  borderRadius: 'var(--cr-radius-lg)',
};

const ApplicationManagementHeader: React.FC<ApplicationManagementHeaderProps> = ({
  total,
  visibleActive,
  visibleUrgent,
  pendingApprovalCount,
  canCreate,
  onCreate,
}) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
          <span className="material-symbols-outlined text-[15px]">description</span>
          Credit Applications
        </div>
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em]" style={{ fontFamily: 'var(--cr-font-display)', color: 'var(--cr-on-surface)' }}>
          Application Management
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
          Review and process ongoing loan applications across the pipeline.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-[112px] px-4 py-2" style={metricCardStyle}>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)' }}>{total.toLocaleString()}</p>
        </div>
        <div className="min-w-[132px] px-4 py-2" style={metricCardStyle}>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Active</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)', color: 'var(--cr-secondary)' }}>{visibleActive.toLocaleString()}</p>
        </div>
        <div className="min-w-[132px] px-4 py-2" style={metricCardStyle}>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Overdue SLA</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)', color: visibleUrgent > 0 ? 'var(--cr-error)' : 'var(--cr-on-surface)' }}>{visibleUrgent.toLocaleString()}</p>
        </div>
        <div className="min-w-[132px] px-4 py-2" style={metricCardStyle}>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Pending Approval</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)' }}>{pendingApprovalCount.toLocaleString()}</p>
        </div>
        {canCreate && (
          <button
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', borderRadius: 'var(--cr-radius-lg)', border: 'none', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Application
          </button>
        )}
      </div>
    </div>
  );
};

export default ApplicationManagementHeader;
