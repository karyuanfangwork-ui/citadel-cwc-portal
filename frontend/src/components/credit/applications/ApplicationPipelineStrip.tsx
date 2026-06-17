import React from 'react';

export interface ApplicationPipelineStage {
  key: string;
  label: string;
  icon: string;
  count: number;
  color: string;
  active?: boolean;
  alert?: boolean;
  onClick: () => void;
}

interface ApplicationPipelineStripProps {
  stages: ApplicationPipelineStage[];
}

const ApplicationPipelineStrip: React.FC<ApplicationPipelineStripProps> = ({ stages }) => {
  return (
    <div className="relative overflow-hidden">
      <div className="cr-scroll overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {stages.map(stage => (
            <button
              key={stage.key}
              onClick={stage.onClick}
              className="flex w-40 flex-col p-3 text-left transition-all hover:border-[var(--cr-secondary)]"
              style={{
                background: stage.active ? 'var(--cr-secondary-fixed)' : 'var(--cr-surface-container-lowest)',
                border: `${stage.active ? 2 : 1}px solid ${stage.active ? 'var(--cr-secondary)' : 'var(--cr-outline-variant)'}`,
                borderRadius: 'var(--cr-radius-lg)',
                cursor: 'pointer',
              }}
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="material-symbols-outlined text-[20px]" style={{ color: stage.alert ? 'var(--cr-error)' : stage.active ? 'var(--cr-secondary)' : stage.color }}>
                  {stage.icon}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    background: stage.alert ? 'var(--cr-error-container)' : stage.active ? 'var(--cr-secondary)' : 'var(--cr-surface-container)',
                    color: stage.alert ? 'var(--cr-on-error-container)' : stage.active ? 'var(--cr-on-secondary)' : 'var(--cr-on-surface-variant)',
                  }}
                >
                  {stage.count.toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.05em]" style={{ fontFamily: 'var(--cr-font-display)', color: stage.active ? 'var(--cr-on-secondary-fixed-variant)' : 'var(--cr-on-surface)' }}>
                {stage.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApplicationPipelineStrip;
