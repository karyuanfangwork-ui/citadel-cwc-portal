import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  Guarantee,
  guaranteeApi,
} from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../../src/hooks/useAutosave';

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—';

const RISK_RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'] as const;

const RISK_RATING_COLORS: Record<string, string> = {
  AAA: 'bg-emerald-100 text-emerald-800',
  AA: 'bg-emerald-50 text-emerald-700',
  A: 'bg-green-50 text-green-700',
  BBB: 'bg-blue-50 text-blue-700',
  BB: 'bg-yellow-50 text-yellow-800',
  B: 'bg-amber-50 text-amber-800',
  CCC: 'bg-orange-50 text-orange-800',
  CC: 'bg-red-50 text-red-800',
  C: 'bg-red-100 text-red-900',
  D: 'bg-red-200 text-red-900',
};

// ── Assessment Card (one per guarantee) ─────────────────────────────

interface AssessmentData {
  contingentLiabilities: string;
  estimatedNetWorth: string;
  guarantorRiskRatingSnapshot: string;
  remarks: string;
}

const defaultAssessment = (): AssessmentData => ({
  contingentLiabilities: '',
  estimatedNetWorth: '',
  guarantorRiskRatingSnapshot: '',
  remarks: '',
});

const fromGuarantee = (g: Guarantee): AssessmentData => ({
  contingentLiabilities: g.contingentLiabilities != null ? String(g.contingentLiabilities) : '',
  estimatedNetWorth: g.estimatedNetWorth != null ? String(g.estimatedNetWorth) : '',
  guarantorRiskRatingSnapshot: g.guarantorRiskRatingSnapshot ?? '',
  remarks: g.remarks ?? '',
});

type AutosaveLike = {
  save: () => Promise<unknown>;
  saving: boolean;
  savedAt: Date | null;
  dirty: boolean;
  error: string | null;
  markDirty: () => void;
  clearDirty: () => void;
  clearError: () => void;
};

const GuarantorAssessmentCard: React.FC<{
  guarantee: Guarantee;
  readOnly: boolean;
  autosave: AutosaveLike;
  dataRef: React.MutableRefObject<AssessmentData>;
  onUpdate: (updated: Guarantee) => void;
}> = ({ guarantee, readOnly, autosave, dataRef, onUpdate }) => {
  const [data, setData] = useState<AssessmentData>(fromGuarantee(guarantee));

  // Keep ref in sync
  useEffect(() => {
    dataRef.current = data;
  }, [data, dataRef]);

  const handleChange = (key: keyof AssessmentData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
    autosave.markDirty();
  };

  const handleBlur = () => {
    autosave.save();
  };

  // Net worth adequacy indicator
  const netWorthNum = data.estimatedNetWorth !== '' ? Number(data.estimatedNetWorth) : null;
  const contingentNum = data.contingentLiabilities !== '' ? Number(data.contingentLiabilities) : null;
  const adequacyRatio = (netWorthNum != null && netWorthNum > 0 && contingentNum != null && contingentNum > 0)
    ? netWorthNum / contingentNum
    : null;
  const adequacyLabel = adequacyRatio != null
    ? adequacyRatio >= 2 ? 'Strong' : adequacyRatio >= 1 ? 'Adequate' : 'Weak'
    : null;
  const adequacyColor = adequacyLabel === 'Strong'
    ? 'text-emerald-700 bg-emerald-50'
    : adequacyLabel === 'Adequate'
    ? 'text-blue-700 bg-blue-50'
    : adequacyLabel === 'Weak'
    ? 'text-red-700 bg-red-50'
    : '';

  const ratingColor = RISK_RATING_COLORS[data.guarantorRiskRatingSnapshot] ?? 'bg-gray-50 text-gray-700';

  const guarantorDisplayName = guarantee.guarantorName || 'Unknown Guarantor';

  return (
    <div className="border rounded-lg p-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-brand-700">person</span>
          <span className="text-sm font-semibold text-gray-900">{guarantorDisplayName}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
            {guarantee.guaranteeType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.guarantorRiskRatingSnapshot && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ratingColor}`}>
              CRR {data.guarantorRiskRatingSnapshot}
            </span>
          )}
          {adequacyLabel && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${adequacyColor}`}>
              {adequacyLabel}
            </span>
          )}
        </div>
      </div>

      {/* Guarantee Amount */}
      <div className="mb-4 px-3 py-2 bg-gray-50 rounded">
        <p className="text-xs text-gray-500">Guarantee Amount</p>
        <p className="text-sm font-semibold">{fmt(guarantee.amount)}</p>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Contingent Liabilities */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Contingent Liabilities</label>
          {readOnly ? (
            <p className="text-sm font-medium">{fmt(data.contingentLiabilities ? Number(data.contingentLiabilities) : null)}</p>
          ) : (
            <input
              type="number"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={data.contingentLiabilities}
              onChange={e => handleChange('contingentLiabilities', e.target.value)}
              onBlur={handleBlur}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          )}
        </div>

        {/* Estimated Net Worth */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Estimated Net Worth</label>
          {readOnly ? (
            <p className="text-sm font-medium">{fmt(data.estimatedNetWorth ? Number(data.estimatedNetWorth) : null)}</p>
          ) : (
            <input
              type="number"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={data.estimatedNetWorth}
              onChange={e => handleChange('estimatedNetWorth', e.target.value)}
              onBlur={handleBlur}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          )}
        </div>

        {/* Guarantor Risk Rating */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Risk Rating Snapshot</label>
          {readOnly ? (
            <div className="flex items-center gap-2">
              {data.guarantorRiskRatingSnapshot ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ratingColor}`}>
                  {data.guarantorRiskRatingSnapshot}
                </span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          ) : (
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={data.guarantorRiskRatingSnapshot}
              onChange={e => handleChange('guarantorRiskRatingSnapshot', e.target.value)}
              onBlur={handleBlur}
            >
              <option value="">Not rated</option>
              {RISK_RATINGS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        {/* Adequacy Ratio (computed) */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Net Worth / Contingent</label>
          <p className="text-sm font-medium">
            {adequacyRatio != null ? `${adequacyRatio.toFixed(2)}x` : '—'}
          </p>
        </div>
      </div>

      {/* Remarks */}
      <div className="mt-4">
        <label className="block text-xs text-gray-500 mb-1">Remarks</label>
        {readOnly ? (
          <p className="text-sm whitespace-pre-wrap">{data.remarks || '—'}</p>
        ) : (
          <textarea
            className="w-full border rounded px-2 py-1.5 text-sm resize-none h-20"
            value={data.remarks}
            onChange={e => handleChange('remarks', e.target.value)}
            onBlur={handleBlur}
            placeholder="Optional assessment notes..."
            maxLength={2000}
          />
        )}
      </div>
    </div>
  );
};

// ── Main Tab ─────────────────────────────────────────────────────────

const GuarantorFinancialAssessmentTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = !['DRAFT', 'CREDIT_ASSESSMENT', 'UNDERWRITING'].includes(
    (application.state || application.status) as string,
  );
  const appId = application.id;
  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);

  // Refs for autosave
  const assessmentsRef = useRef<Record<string, AssessmentData>>({});

  const fetchGuarantees = useCallback(async () => {
    try {
      const items = await guaranteeApi.list(appId);
      setGuarantees(items);
      // Initialize assessment refs
      const initial: Record<string, AssessmentData> = {};
      items.forEach(g => { initial[g.id] = fromGuarantee(g); });
      assessmentsRef.current = initial;
    } catch { /* ignore */ }
  }, [appId]);

  useEffect(() => { fetchGuarantees(); }, [fetchGuarantees]);

  // ── Autosave ──────────────────────────────────────────────────────
  const autosave = useAutosave<Guarantee | null>({
    saveFn: async () => {
      if (readOnly) return null;
      // Flush all dirty guarantees
      let lastResult: Guarantee | null = null;
      for (const g of guarantees) {
        const data = assessmentsRef.current[g.id];
        if (!data) continue;
        const payload: Record<string, unknown> = {};
        // Only send fields that changed from the original
        const orig = fromGuarantee(g);
        if (data.contingentLiabilities !== orig.contingentLiabilities) {
          payload.contingentLiabilities = data.contingentLiabilities === '' ? null : data.contingentLiabilities;
        }
        if (data.estimatedNetWorth !== orig.estimatedNetWorth) {
          payload.estimatedNetWorth = data.estimatedNetWorth === '' ? null : data.estimatedNetWorth;
        }
        if (data.guarantorRiskRatingSnapshot !== orig.guarantorRiskRatingSnapshot) {
          payload.guarantorRiskRatingSnapshot = data.guarantorRiskRatingSnapshot === '' ? null : data.guarantorRiskRatingSnapshot;
        }
        if (data.remarks !== orig.remarks) {
          payload.remarks = data.remarks === '' ? null : data.remarks;
        }
        if (Object.keys(payload).length > 0) {
          lastResult = await guaranteeApi.updateFinancialAssessment(g.id, payload as Parameters<typeof guaranteeApi.updateFinancialAssessment>[1]);
        }
      }
      return lastResult;
    },
    readOnly,
    debounceMs: 2000,
  });

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  const handleUpdate = (updated: Guarantee) => {
    setGuarantees(prev => prev.map(g => g.id === updated.id ? updated : g));
    onUpdated?.(application);
  };

  return (
    <div className="space-y-6">
      <CaMemoSection
        title="Guarantor Financial Assessment"
        phase="S7.3"
        readOnly={readOnly}
        saving={autosave.saving}
        savedAt={autosave.savedAt}
        error={autosave.error}
      >
        {guarantees.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">verified_user</span>
            <p className="text-sm text-gray-400">No guarantors on this application.</p>
            <p className="text-xs text-gray-400 mt-1">Add guarantees in S6 (Security & Guarantees) first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {guarantees.map(g => (
              <GuarantorAssessmentCard
                key={g.id}
                guarantee={g}
                readOnly={readOnly}
                autosave={autosave}
                dataRef={{
                  get current() { return assessmentsRef.current[g.id] ?? defaultAssessment(); },
                  set current(v: AssessmentData) { assessmentsRef.current[g.id] = v; },
                } as React.MutableRefObject<AssessmentData>}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </CaMemoSection>

      {/* Summary section — aggregate view */}
      {guarantees.length > 0 && (
        <CaMemoSection
          title="Assessment Summary"
          phase="S7.3"
          readOnly
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="p-2 text-left">Guarantor</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-right">Contingent</th>
                  <th className="p-2 text-right">Net Worth</th>
                  <th className="p-2 text-center">CRR</th>
                  <th className="p-2 text-right">Adequacy</th>
                </tr>
              </thead>
              <tbody>
                {guarantees.map(g => {
                  const nw = g.estimatedNetWorth != null ? Number(g.estimatedNetWorth) : null;
                  const cl = g.contingentLiabilities != null ? Number(g.contingentLiabilities) : null;
                  const ratio = (nw != null && nw > 0 && cl != null && cl > 0)
                    ? nw / cl : null;
                  const ratingColor = RISK_RATING_COLORS[g.guarantorRiskRatingSnapshot ?? ''] ?? '';
                  return (
                    <tr key={g.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-medium">{g.guarantorName}</td>
                      <td className="p-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                          {g.guaranteeType}
                        </span>
                      </td>
                      <td className="p-2 text-right">{fmt(g.amount)}</td>
                      <td className="p-2 text-right">{fmt(cl)}</td>
                      <td className="p-2 text-right">{fmt(nw)}</td>
                      <td className="p-2 text-center">
                        {g.guarantorRiskRatingSnapshot ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ratingColor}`}>
                            {g.guarantorRiskRatingSnapshot}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {ratio != null ? `${ratio.toFixed(2)}x` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CaMemoSection>
      )}
    </div>
  );
};

export default GuarantorFinancialAssessmentTab;