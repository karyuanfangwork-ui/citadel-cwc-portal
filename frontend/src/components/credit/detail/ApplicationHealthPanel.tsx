/**
 * ApplicationHealthPanel — Right sidebar health progress bars.
 *
 * Shows: Completion %, Document Readiness %, Workflow Velocity %.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';

interface ApplicationHealthPanelProps {
  progressPct: number;
  progressColor: string;
  documentReadinessPct: number;
  workflowVelocityPct: number;
}

const ProgressBar: React.FC<{
  label: string;
  pct: number;
  color: string;
  sublabel?: string;
}> = ({ label, pct, color, sublabel }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-baseline">
      <span
        className="font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
      >
        {label}
      </span>
      <span className="font-bold" style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-body-sm)', color }}>
        {Math.round(pct)}%
      </span>
    </div>
    {sublabel && (
      <span style={{ fontSize: 11, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>{sublabel}</span>
    )}
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ backgroundColor: 'var(--cr-surface-container-highest)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const ApplicationHealthPanel: React.FC<ApplicationHealthPanelProps> = ({
  progressPct,
  progressColor,
  documentReadinessPct,
  workflowVelocityPct,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3
        className="font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
      >
        Application Health
      </h3>
      <div className="flex flex-col gap-4">
        <ProgressBar
          label="Completion"
          pct={progressPct}
          color={progressColor}
          sublabel={`${Math.round(progressPct)} of phases complete`}
        />
        <ProgressBar
          label="Doc Readiness"
          pct={documentReadinessPct}
          color={documentReadinessPct >= 80 ? '#16a34a' : documentReadinessPct >= 50 ? '#d97706' : '#dc2626'}
          sublabel={documentReadinessPct >= 80 ? 'Most documents uploaded' : 'Documents required'}
        />
        <ProgressBar
          label="Velocity"
          pct={workflowVelocityPct}
          color={workflowVelocityPct >= 60 ? '#16a34a' : workflowVelocityPct >= 30 ? '#d97706' : '#dc2626'}
          sublabel={workflowVelocityPct >= 60 ? 'On track' : 'At risk of delay'}
        />
      </div>
    </div>
  );
};

export default ApplicationHealthPanel;