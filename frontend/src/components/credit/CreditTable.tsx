import React from 'react';

/**
 * CreditTable — shared table wrapper with sticky header and zebra striping (§1.9).
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
}

const CreditTable: React.FC<CreditTableProps> = ({
  children,
  className = '',
  maxHeight = 'max-h-[70vh]',
}) => {
  return (
    <div className={`bg-bg-surface border border-border rounded-xl overflow-hidden ${className}`}>
      <div className={`overflow-auto ${maxHeight}`}>
        <table className="w-full text-sm credit-table">
          {children}
        </table>
      </div>
    </div>
  );
};

export default CreditTable;