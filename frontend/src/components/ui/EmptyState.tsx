import React from 'react';

export type EmptyStateProps = {
  icon: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {/* Icon circle */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 mb-4">
        <span className="material-symbols-outlined text-3xl text-brand-500">{icon}</span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-tertiary max-w-sm mb-4">{description}</p>
      )}

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-cwc-md hover:bg-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;