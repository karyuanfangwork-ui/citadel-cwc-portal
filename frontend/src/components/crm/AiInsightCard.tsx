import React from 'react';

interface AiInsightCardProps {
  title?: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  onRefresh?: () => void;
  className?: string;
}

export default function AiInsightCard({
  title = 'AI Insight',
  loading,
  error,
  children,
  onRefresh,
  className = '',
}: AiInsightCardProps) {
  return (
    <div className={`rounded-lg border border-brand-200 bg-brand-50 p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          {title}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded p-1 text-brand-500 hover:bg-brand-100 disabled:opacity-40"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-brand-500">
          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
          Analyzing…
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && children}
    </div>
  );
}