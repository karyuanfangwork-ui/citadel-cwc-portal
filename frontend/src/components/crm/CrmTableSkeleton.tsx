import React from 'react';

interface CrmTableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const CrmTableSkeleton: React.FC<CrmTableSkeletonProps> = ({ rows = 5, cols = 5 }) => (
  <div className="bg-bg-surface border border-border rounded-xl overflow-hidden animate-pulse">
    <div className="flex gap-4 px-5 py-3 border-b border-border bg-bg-subtle">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-200 rounded flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 px-5 py-4 border-b border-border last:border-0">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-3 bg-gray-200 rounded flex-1" style={{ width: `${30 + Math.random() * 50}%` }} />
        ))}
      </div>
    ))}
  </div>
);

export default CrmTableSkeleton;