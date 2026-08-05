import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  Collateral,
  Guarantee,
  SecurityCategory,
  collateralApi,
  guaranteeApi,
} from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—';

const CATEGORY_LABELS: Record<SecurityCategory, string> = {
  TANGIBLE: 'Tangible',
  SUPPORTING: 'Supporting',
};

// ─── Collateral Section ───────────────────────────────────────────────────────

const CollateralSection: React.FC<{ appId: string; readOnly: boolean }> = ({ appId, readOnly }) => {
  const [items, setItems] = useState<Collateral[]>([]);

  useEffect(() => {
    collateralApi.list(appId).then(setItems).catch(() => {});
  }, [appId]);

  if (items.length === 0) return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Security / Collateral</h3>
      <p className="text-sm text-gray-400 italic">No collateral records. Add via the Facilities tab.</p>
    </section>
  );

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Security / Collateral</h3>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Sub-type</th>
              <th className="p-2 text-center">Existing</th>
              <th className="p-2 text-center">New</th>
              <th className="p-2 text-right">PMMD OMV</th>
              <th className="p-2 text-right">PMMD FSV</th>
              <th className="p-2 text-right">Panel Valuer OMV</th>
              <th className="p-2 text-right">Panel Valuer FSV</th>
              <th className="p-2 text-right">Coverage %</th>
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-2">{c.description || '—'}</td>
                <td className="p-2">{c.securityCategory ? CATEGORY_LABELS[c.securityCategory] : '—'}</td>
                <td className="p-2">{c.securitySubType || '—'}</td>
                <td className="p-2 text-center">{c.isExisting ? '✓' : ''}</td>
                <td className="p-2 text-center">{c.isNewToBeObtained ? '✓' : ''}</td>
                <td className="p-2 text-right">{fmt(c.pmmdMarketValue)}</td>
                <td className="p-2 text-right">{fmt(c.pmmdForcedSaleValue)}</td>
                <td className="p-2 text-right">{fmt(c.valuations?.[0]?.valuedAmount ?? null)}</td>
                <td className="p-2 text-right">{c.panelValuerName || '—'}</td>
                <td className="p-2 text-right">{c.securityCoverageRatio != null ? `${Number(c.securityCoverageRatio).toFixed(2)}x` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ─── Guarantee Section ────────────────────────────────────────────────────────

const GuaranteeSection: React.FC<{ appId: string; readOnly: boolean }> = ({ appId, readOnly }) => {
  const [items, setItems] = useState<Guarantee[]>([]);

  useEffect(() => {
    guaranteeApi.list(appId).then(setItems).catch(() => {});
  }, [appId]);

  if (items.length === 0) return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Corporate / Personal Guarantees</h3>
      <p className="text-sm text-gray-400 italic">No guarantee records.</p>
    </section>
  );

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Corporate / Personal Guarantees</h3>
      <div className="space-y-3">
        {items.map(g => (
          <div key={g.id} className="border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-500">Guarantor</p>
                <p className="text-sm font-medium">{g.guarantorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="text-sm">{g.guaranteeType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="text-sm">{fmt(g.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CRR Snapshot</p>
                <p className="text-sm">{g.guarantorRiskRatingSnapshot || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Contingent Liabilities</p>
                <p className="text-sm">{fmt(g.contingentLiabilities)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Est. Net Worth</p>
                <p className="text-sm">{fmt(g.estimatedNetWorth)}</p>
              </div>
            </div>
            {g.remarks && (
              <div>
                <p className="text-xs text-gray-500">Remarks</p>
                <p className="text-sm whitespace-pre-wrap">{g.remarks}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const SecurityGuaranteesTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  return (
    <div className="space-y-6">
      <CaMemoSection title="Security / Collateral" phase="Phase 4" readOnly>
        <CollateralSection appId={application.id} readOnly={readOnly} />
      </CaMemoSection>
      <CaMemoSection title="Corporate / Personal Guarantees" phase="Phase 4" readOnly>
        <GuaranteeSection appId={application.id} readOnly={readOnly} />
      </CaMemoSection>
    </div>
  );
};

export default SecurityGuaranteesTab;
