import React from 'react';

/**
 * CreditTable — shared table wrapper with sticky header and zebra striping (§1.9).
 * Includes ARIA grid roles for accessibility (§3.7).
 *
 * Usage:
 *   <CreditTable>
 *     <thead>...</thead>
 *     <tbody>...</tbody>
 *   </CreditTable>
 */
interface CreditTableProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string; // e.g. 'max-h-[600px]' — defaults to max-h-[70vh]
  /** Accessible label describing the table's purpose */
  label?: string;
}

const CreditTable: React.FC<CreditTableProps> = ({
  children,
  className = '',
  maxHeight = 'max-h-[70vh]',
  label,
}) => {
  return (
    <div className={`bg-bg-surface border border-border rounded-xl overflow-hidden ${className}`} role="region" aria-label={label || 'Data table'} tabIndex={0}>
      <div className={`overflow-auto ${maxHeight}`}>
        <table className="w-full text-sm credit-table" role="grid" aria-label={label}>
          {children}
        </table>
      </div>
    </div>
  );
};

export default CreditTable;