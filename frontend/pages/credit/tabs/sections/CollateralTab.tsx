import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  collateralApi,
  Collateral,
  Guarantee,
  guaranteeApi,
} from '../../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../../src/utils/errorMessages';
import { formatCurrency } from '../../creditUtils';
import EmptyState from '../../../../src/components/EmptyState';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';

interface LinkedCollateralItem {
  collateralId: string;
  collateralType: string;
  description: string;
  marketValue: number | null;
  linkedAt: string;
  sourceApplication: { applicationNo: string; borrowerName: string } | null;
}

interface CollateralTabProps {
  // No props needed — fetches its own data based on URL param
}

const CollateralTab: React.FC<CollateralTabProps> = () => {
  const { id } = useParams<{ id: string }>();
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);
  const [linkedCollateral, setLinkedCollateral] = useState<LinkedCollateralItem[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCollateralId, setLinkCollateralId] = useState('');
  const [linking, setLinking] = useState(false);

  const fetchCollateral = useCallback(async () => {
    if (!id) return;
    try {
      const [cols, guars, linked] = await Promise.all([
        collateralApi.list(id),
        guaranteeApi.list(id),
        collateralApi.getLinkedCollateral(id).catch(() => []),
      ]);
      setCollaterals(cols);
      setGuarantees(guars);
      setLinkedCollateral(linked);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load collateral')); }
  }, [id]);

  useEffect(() => { fetchCollateral(); }, [fetchCollateral]);

  const handleLink = async () => {
    if (!linkCollateralId.trim() || !id) return;
    setLinking(true);
    try {
      await collateralApi.linkToApplication(linkCollateralId.trim(), id);
      toast.success('Collateral linked successfully');
      setShowLinkModal(false);
      setLinkCollateralId('');
      fetchCollateral();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to link collateral'));
    } finally { setLinking(false); }
  };

  const handleUnlink = async (collateralId: string) => {
    if (!id) return;
    try {
      await collateralApi.unlinkFromApplication(collateralId, id);
      toast.success('Collateral unlinked');
      fetchCollateral();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to unlink collateral'));
    }
  };

  const collateralActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowLinkModal(true)}
        className="flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
      >
        <span className="material-symbols-outlined text-base">link</span> Link Existing Collateral
      </button>
      <Link to={`/credit/collateral?applicationId=${id}`}
        className="flex items-center gap-1.5 text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
        style={{ textDecoration: 'none' }}>
        <span className="material-symbols-outlined text-base">open_in_new</span> Manage Collateral
      </Link>
    </div>
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

      {/* §7.1 — Linked Collateral from other applications */}
      <CaMemoSection title="Cross-Linked Collateral" phase="S7.1">
        {linkedCollateral.length === 0 ? (
          <EmptyState
            icon="link"
            title="No Linked Collateral"
            description="Link existing collateral from other applications to share security across facilities."
            actionLabel="Link Collateral"
            onAction={() => setShowLinkModal(true)}
          />
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Source App', 'Borrower', 'Type', 'Description', 'Market Value', 'Linked At', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linkedCollateral.map(lc => (
                  <tr key={lc.collateralId} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      <Link to={`/credit/applications/${lc.sourceApplication?.applicationNo || ''}`}
                        className="text-brand-700 hover:underline font-medium">
                        {lc.sourceApplication?.applicationNo || '—'}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{lc.sourceApplication?.borrowerName || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {lc.collateralType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }} className="truncate max-w-[200px]">{lc.description}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                      {lc.marketValue != null ? formatCurrency(lc.marketValue) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      {new Date(lc.linkedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                      <button
                        onClick={() => handleUnlink(lc.collateralId)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                        title="Unlink this collateral"
                      >
                        <span className="material-symbols-outlined text-sm">link_off</span>
                      </button>
                    </td>
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

      {/* §7.1 — Link Collateral Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Link Existing Collateral</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the Collateral ID from another application to cross-link it as shared security.</p>
            <input
              type="text"
              value={linkCollateralId}
              onChange={e => setLinkCollateralId(e.target.value)}
              placeholder="Collateral ID (UUID)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleLink}
                disabled={linking || !linkCollateralId.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {linking ? 'Linking...' : 'Link Collateral'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollateralTab;