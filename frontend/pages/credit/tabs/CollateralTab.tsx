import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collateralApi,
  Collateral,
  Guarantee,
  guaranteeApi,
} from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import { formatCurrency } from '../creditUtils';
import EmptyState from '../../../src/components/EmptyState';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

interface CollateralTabProps {
  // No props needed — fetches its own data based on URL param
}

const CollateralTab: React.FC<CollateralTabProps> = () => {
  const { id } = useParams<{ id: string }>();
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);

  const fetchCollateral = useCallback(async () => {
    if (!id) return;
    try {
      const [cols, guars] = await Promise.all([
        collateralApi.list(id),
        guaranteeApi.list(id),
      ]);
      setCollaterals(cols);
      setGuarantees(guars);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load collateral')); }
  }, [id]);

  useEffect(() => { fetchCollateral(); }, [fetchCollateral]);

  const collateralActions = (
    <Link to={`/credit/collateral?applicationId=${id}`}
      className="flex items-center gap-1.5 text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
      style={{ textDecoration: 'none' }}>
      <span className="material-symbols-outlined text-base">open_in_new</span> Manage Collateral
    </Link>
  );

  return (
    <div className="space-y-6">
      <CaMemoSection title="Collateral" phase="Phase 4" actions={collateralActions}>
        {collaterals.length === 0 ? (
          <EmptyState
            icon="shield"
            title="No Collateral"
            description="Add collateral to secure this credit facility."
            actionLabel="Add Collateral"
            onAction={() => { window.location.href = `/credit/collateral?applicationId=${id}`; }}
          />
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Type', 'Description', 'Registered Owner', 'Ownership Doc'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collaterals.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {c.collateralType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }} className="truncate max-w-[300px]">{c.description}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.registeredOwner || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.ownershipDoc || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CaMemoSection>

      {/* Guarantees Summary */}
      <CaMemoSection title="Guarantees" phase="Phase 4">
        {guarantees.length === 0 ? (
          <EmptyState
            icon="verified_user"
            title="No Guarantees"
            description="Add guarantees to secure this credit facility."
            actionLabel="Add Guarantees"
            onAction={() => { window.location.href = `/credit/collateral?applicationId=${id}`; }}
          />
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Guarantor', 'Type', 'Amount', 'Currency', 'Doc Ref'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guarantees.map(g => (
                  <tr key={g.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500 }}>{g.guarantorName}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">{g.guaranteeType}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{formatCurrency(g.amount, g.currency)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{g.currency}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{g.documentRef || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CaMemoSection>
    </div>
  );
};

export default CollateralTab;