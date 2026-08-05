import React from 'react';

interface CrmTableSkeletonProps {
  rows?: number;
  cols?: number;
}

const CrmTableSkeleton: React.FC<CrmTableSkeletonProps> = ({ rows = 6, cols = 11 }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-border">
    <table className="w-full">
      <thead>
        <tr className="border-b border-border">
          {Array.from({ length: cols }, (_, i) => (
            <th key={i} className="px-4 py-3">
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r} className="border-b border-border last:border-b-0">
            {Array.from({ length: cols }, (_, c) => (
              <td key={c} className="px-4 py-2.5">
                <div className={`h-3 rounded animate-pulse ${c === 0 ? 'w-4' : c === 1 ? 'w-32' : c === 2 ? 'w-20' : 'w-16'} bg-gray-100`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default CrmTableSkeleton;