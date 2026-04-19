import React from 'react';

interface SkeletonRowProps {
  cols: number;
  /** Width pattern per column — Tailwind width class e.g. 'w-20', 'w-48', 'w-full'. Repeats if shorter than cols. */
  widths?: string[];
}

const SkeletonRow: React.FC<SkeletonRowProps> = ({ cols, widths = [] }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className={`h-4 bg-gray-200 rounded ${widths[i % widths.length] ?? 'w-full'}`} />
      </td>
    ))}
  </tr>
);

export default SkeletonRow;
