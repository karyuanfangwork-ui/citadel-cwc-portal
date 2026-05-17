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
    <div className={`rounded-lg border border-violet-200 bg-violet-50 p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
          <span className="material-icons text-base">auto_awesome</span>
          {title}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded p-1 text-violet-500 hover:bg-violet-100 disabled:opacity-40"
            title="Refresh"
          >
            <span className="material-icons text-sm">refresh</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-violet-500">
          <span className="material-icons animate-spin text-base">progress_activity</span>
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
