import React from 'react';
import type { BorrowerDataQuality, BorrowerMissingField } from '@/src/types/credit-ui.types';

interface BorrowerDataQualityBadgeProps {
  dataQuality: BorrowerDataQuality;
  missingFields: BorrowerMissingField[];
}

const FIELD_LABELS: Record<BorrowerMissingField, string> = {
  name: 'name',
  identifier: 'identifier',
  contact: 'contact',
  segment: 'segment',
  owner: 'relationship owner',
};

const BorrowerDataQualityBadge: React.FC<BorrowerDataQualityBadgeProps> = ({ dataQuality, missingFields }) => {
  if (dataQuality === 'COMPLETE' || !missingFields) return null;

  const missingLabel = missingFields.map((f) => FIELD_LABELS[f]).join(', ');

  return (
    <span
      role="status"
      aria-label={`Data incomplete; missing ${missingLabel}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 9999,
        backgroundColor: '#fef3c7',
        color: '#92400e',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>warning</span>
      Data incomplete
      {missingFields.length > 0 && (
        <span style={{ fontWeight: 400, fontSize: 10 }}>: {missingLabel}</span>
      )}
    </span>
  );
};

export default BorrowerDataQualityBadge;