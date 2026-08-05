import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
    <span className="material-symbols-outlined text-4xl text-text-secondary opacity-20 mb-2">{icon}</span>
    <h3 className="text-sm font-bold text-text-primary mb-1">{title}</h3>
    {description && <p className="text-xs text-text-secondary max-w-xs">{description}</p>}
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
      >
        <span className="material-symbols-outlined text-base">add_circle</span>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;