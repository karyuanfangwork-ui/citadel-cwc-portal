import React from 'react';

interface ApplicationRiskMeterProps {
  rating?: string | null;
}

function normalizeRisk(rating?: string | null) {
  const value = (rating || '').toUpperCase();
  if (!value) return { label: 'Unrated', color: 'var(--cr-on-surface-variant)', bg: 'var(--cr-surface-container)', width: 20 };
  if (['AAA', 'AA', 'A', 'BBB', 'LOW'].some(r => value.startsWith(r))) {
    return { label: value === 'LOW' ? 'Low' : value, color: 'var(--cr-secondary)', bg: 'var(--cr-secondary)', width: 78 };
  }
  if (['BB', 'B', 'MEDIUM'].some(r => value.startsWith(r))) {
    return { label: value === 'MEDIUM' ? 'Medium' : value, color: '#b45309', bg: '#f59e0b', width: 52 };
  }
  return { label: value === 'HIGH' ? 'High' : value, color: 'var(--cr-error)', bg: 'var(--cr-error)', width: 30 };
}

const ApplicationRiskMeter: React.FC<ApplicationRiskMeterProps> = ({ rating }) => {
  const risk = normalizeRisk(rating);

  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: 'var(--cr-surface-container)' }}>
        <div className="h-full rounded-full" style={{ width: `${risk.width}%`, background: risk.bg }} />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.02em]" style={{ color: risk.color }}>
        {risk.label}
      </span>
    </div>
  );
};

export default ApplicationRiskMeter;
