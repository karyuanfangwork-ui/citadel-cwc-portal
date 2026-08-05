import React, { useState, useEffect, useCallback } from 'react';
import creditService from '../../../../src/services/credit.service';

const BASE_RATE_TYPES = [
  { value: 'BLR', label: 'BLR (Base Lending Rate)' },
  { value: 'OPR', label: 'OPR (Overnight Policy Rate)' },
  { value: 'FIXED', label: 'Fixed' },
  { value: 'SORA', label: 'SORA (Swap Offer Rate)' },
  { value: 'KLIBOR', label: 'KLIBOR (Kuala Lumpur Interbank Offered Rate)' },
];

interface Props {
  facilityId: string;
  tenorMonths?: number;
  readOnly?: boolean;
  onRateSync?: (effectiveRate: number) => void;
}

const PricingWorksheetPanel: React.FC<Props> = ({ facilityId, tenorMonths, readOnly = false, onRateSync }) => {
  const [worksheet, setWorksheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{ effectiveRatePct: number; effectiveYieldPct: number | null } | null>(null);

  const [form, setForm] = useState({
    baseRateType: 'FIXED' as string,
    baseRatePct: '',
    creditSpreadPct: '',
    riskPremiumPct: '',
    administrationFeePct: '',
    processingFeeFlat: '',
    pricingJustification: '',
  });

  const loadWorksheet = useCallback(async () => {
    try {
      setLoading(true);
      const ws = await creditService.getPricingWorksheet(facilityId);
      setWorksheet(ws);
      setForm({
        baseRateType: ws.baseRateType ?? 'FIXED',
        baseRatePct: ws.baseRatePct ?? '',
        creditSpreadPct: ws.creditSpreadPct ?? '',
        riskPremiumPct: ws.riskPremiumPct ?? '',
        administrationFeePct: ws.administrationFeePct ?? '',
        processingFeeFlat: ws.processingFeeFlat ?? '',
        pricingJustification: ws.pricingJustification ?? '',
      });
      setPreview({ effectiveRatePct: Number(ws.effectiveRatePct), effectiveYieldPct: ws.effectiveYieldPct != null ? Number(ws.effectiveYieldPct) : null });
    } catch {
      // No worksheet yet — leave form empty
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { loadWorksheet(); }, [loadWorksheet]);

  const computePreview = useCallback(() => {
    const base = Number(form.baseRatePct) || 0;
    const spread = Number(form.creditSpreadPct) || 0;
    const risk = Number(form.riskPremiumPct) || 0;
    const admin = Number(form.administrationFeePct) || 0;
    const effectiveRatePct = base + spread + risk;
    const effectiveYieldPct = admin > 0 ? effectiveRatePct + admin : null;
    setPreview({ effectiveRatePct, effectiveYieldPct });
  }, [form.baseRatePct, form.creditSpreadPct, form.riskPremiumPct, form.administrationFeePct]);

  useEffect(() => { computePreview(); }, [computePreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        baseRateType: form.baseRateType,
        baseRatePct: Number(form.baseRatePct) || 0,
        creditSpreadPct: Number(form.creditSpreadPct) || 0,
        riskPremiumPct: Number(form.riskPremiumPct) || 0,
        administrationFeePct: form.administrationFeePct ? Number(form.administrationFeePct) : undefined,
        processingFeeFlat: form.processingFeeFlat ? Number(form.processingFeeFlat) : undefined,
        pricingJustification: form.pricingJustification || undefined,
      };
      const saved = await creditService.upsertPricingWorksheet(facilityId, data);
      setWorksheet(saved);
      setEditing(false);
      if (onRateSync) onRateSync(Number(saved.effectiveRatePct));
    } catch (err) {
      console.error('Failed to save pricing worksheet', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-gray-400 px-3 py-2">Loading pricing…</div>;

  // Display mode (no worksheet yet and not editing)
  if (!worksheet && !editing) {
    if (readOnly) return null;
    return (
      <div className="px-3 py-2 border-t bg-gray-50">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
          + Add Pricing Worksheet
        </button>
      </div>
    );
  }

  // Read-only display of existing worksheet
  if (!editing && worksheet) {
    return (
      <div className="px-3 py-2 border-t bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-600">Pricing Worksheet</span>
          {!readOnly && (
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <div>Base Rate: <span className="font-medium">{BASE_RATE_TYPES.find(t => t.value === worksheet.baseRateType)?.label ?? worksheet.baseRateType} {worksheet.baseRatePct}%</span></div>
          <div>Credit Spread: <span className="font-medium">{worksheet.creditSpreadPct}%</span></div>
          <div>Risk Premium: <span className="font-medium">{worksheet.riskPremiumPct}%</span></div>
          {worksheet.administrationFeePct != null && <div>Admin Fee: <span className="font-medium">{worksheet.administrationFeePct}%</span></div>}
          {worksheet.processingFeeFlat != null && <div>Processing Fee: <span className="font-medium">MYR {worksheet.processingFeeFlat}</span></div>}
        </div>
        <div className="mt-1 flex items-center gap-4 text-xs">
          <span className="text-green-700 font-semibold">Effective Rate: {worksheet.effectiveRatePct}%</span>
          {worksheet.effectiveYieldPct != null && (
            <span className="text-blue-700 font-semibold">Effective Yield: {worksheet.effectiveYieldPct}%</span>
          )}
          {worksheet.preparedBy && (
            <span className="text-gray-400">Prepared by {worksheet.preparedBy.firstName} {worksheet.preparedBy.lastName}</span>
          )}
        </div>
        {worksheet.pricingJustification && (
          <p className="text-xs text-gray-500 mt-1 italic">"{worksheet.pricingJustification}"</p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="px-3 py-2 border-t bg-blue-50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Pricing Worksheet</span>
        <div className="space-x-1">
          <button onClick={handleSave} disabled={saving} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); loadWorksheet(); }} className="text-xs text-gray-500 px-2 py-1 border rounded">Cancel</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
        {/* Base Rate Type */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Base Rate Type</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={form.baseRateType}
            onChange={e => setForm(f => ({ ...f, baseRateType: e.target.value }))}>
            {BASE_RATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {/* Base Rate % */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Base Rate %</label>
          <input type="number" step="0.0001" className="border rounded px-2 py-1 text-sm w-full" value={form.baseRatePct}
            onChange={e => setForm(f => ({ ...f, baseRatePct: e.target.value }))} placeholder="0.0000" />
        </div>
        {/* Credit Spread % */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Credit Spread %</label>
          <input type="number" step="0.0001" className="border rounded px-2 py-1 text-sm w-full" value={form.creditSpreadPct}
            onChange={e => setForm(f => ({ ...f, creditSpreadPct: e.target.value }))} placeholder="0.0000" />
        </div>
        {/* Risk Premium % */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Risk Premium %</label>
          <input type="number" step="0.0001" className="border rounded px-2 py-1 text-sm w-full" value={form.riskPremiumPct}
            onChange={e => setForm(f => ({ ...f, riskPremiumPct: e.target.value }))} placeholder="0.0000" />
        </div>
        {/* Admin Fee % */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Admin Fee % <span className="text-gray-300">(optional)</span></label>
          <input type="number" step="0.0001" className="border rounded px-2 py-1 text-sm w-full" value={form.administrationFeePct}
            onChange={e => setForm(f => ({ ...f, administrationFeePct: e.target.value }))} placeholder="0.0000" />
        </div>
        {/* Processing Fee */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Processing Fee (MYR) <span className="text-gray-300">(optional)</span></label>
          <input type="number" step="0.01" className="border rounded px-2 py-1 text-sm w-full" value={form.processingFeeFlat}
            onChange={e => setForm(f => ({ ...f, processingFeeFlat: e.target.value }))} placeholder="0.00" />
        </div>
      </div>

      {/* Auto-computed rates */}
      {preview && (
        <div className="flex items-center gap-4 text-xs bg-white rounded px-3 py-2 border">
          <span className="text-green-700 font-semibold">Effective Rate: {preview.effectiveRatePct.toFixed(4)}%</span>
          {preview.effectiveYieldPct != null && (
            <span className="text-blue-700 font-semibold">Effective Yield: {preview.effectiveYieldPct.toFixed(4)}%</span>
          )}
          <span className="text-gray-400">(auto-computed)</span>
        </div>
      )}

      {/* Justification */}
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Pricing Justification</label>
        <textarea className="border rounded px-2 py-1 text-sm w-full" rows={2} value={form.pricingJustification}
          onChange={e => setForm(f => ({ ...f, pricingJustification: e.target.value }))} placeholder="Reason for rate components…" />
      </div>
    </div>
  );
};

export default PricingWorksheetPanel;