import React from 'react';
import type { BorrowerLifecycleStatus } from '@/src/types/credit-ui.types';

const PRESENTATION: Record<NonNullable<BorrowerLifecycleStatus>, { label: string; icon: string; color: string; background: string }> = {
  ACTIVE: { label: 'Active', icon: 'check_circle', color: '#166534', background: '#dcfce7' },
  INACTIVE: { label: 'Inactive', icon: 'pause_circle', color: '#475569', background: '#e2e8f0' },
  ARCHIVED: { label: 'Archived', icon: 'inventory_2', color: '#7c2d12', background: '#ffedd5' },
};

export interface BorrowerStatusBadgeProps {
  status: BorrowerLifecycleStatus | null;
}

const BorrowerStatusBadge: React.FC<BorrowerStatusBadgeProps> = ({ status }) => {
  const presentation = status ? PRESENTATION[status] : { label: 'Needs backfill', icon: 'sync_problem', color: '#92400e', background: '#fef3c7' };
  return (
    <span
      aria-label={`Borrower status: ${presentation.label}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 9999, backgroundColor: presentation.background, color: presentation.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
    >
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>{presentation.icon}</span>
      {presentation.label}
    </span>
  );
};

export default BorrowerStatusBadge;
