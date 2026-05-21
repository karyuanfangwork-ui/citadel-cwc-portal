import React, { useEffect, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  AccountProfitability,
  ProfitabilityLine,
  WalletShare,
  profitabilityApi,
  walletShareApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

const PRODUCT_CATEGORIES = [
  { key: 'FINANCINGS',         label: 'Financings' },
  { key: 'TRADES_FUNDED',      label: 'Trade (Funded)' },
  { key: 'TRADES_NON_FUNDED',  label: 'Trade (Non-Funded)' },
  { key: 'FOREX',              label: 'Forex' },
  { key: 'DEPOSITS',           label: 'Deposits' },
  { key: 'REMITTANCE',         label: 'Remittance' },
  { key: 'FEES_OTHERS',        label: 'Fees & Others' },
];

const ACCOUNT_STRATEGIES = ['GROW', 'MAINTAIN', 'EXIT'] as const;

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

// ─── Profitability Section ────────────────────────────────────────────────────

type LineMap = Record<string, Partial<ProfitabilityLine>>;

const ProfitabilitySection: React.FC<{
  appId: string;
  readOnly: boolean;
  setSaving: (v: boolean) => void;
  setSavedAt: (d: Date) => void;
}> = ({ appId, readOnly, setSaving, setSavedAt }) => {
  const [profitability, setProfitability] = useState<AccountProfitability | null>(null);
  const [lines, setLines] = useState<LineMap>({});
  const [notes, setNotes] = useState('');
  const [period, setPeriod] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    profitabilityApi.get(appId).then(p => {
      if (p) {
        setProfitability(p);
        setNotes(p.notes ?? '');
        setPeriod(p.reportingPeriod ?? '');
        const map: LineMap = {};
        p.lines.forEach(l => { map[l.productCategory] = l; });
        setLines(map);
      }
    });
  }, [appId]);

  const update = (cat: string, key: keyof ProfitabilityLine, value: string) => {
    setLines(l => ({ ...l, [cat]: { ...l[cat], productCategory: cat, [key]: value } }));
    dirty.current = true;
  };

  const flush = async () => {
    if (!dirty.current) return;
    setSaving(true);
    try {
      const saved = await profitabilityApi.upsert(appId, {
        reportingPeriod: period || null,
        notes: notes || null,
        lines: PRODUCT_CATEGORIES.map((c, i) => ({
          productCategory: c.key,
          displayOrder: i,
          netProfitYtd: (lines[c.key]?.netProfitYtd as any) ?? null,
          netProfitProjected: (lines[c.key]?.netProfitProjected as any) ?? null,
          feeIncomeYtd: (lines[c.key]?.feeIncomeYtd as any) ?? null,
          feeIncomeProjected: (lines[c.key]?.feeIncomeProjected as any) ?? null,
        })),
      });
      setProfitability(saved);
      dirty.current = false;
      setSavedAt(new Date());
    } finally { setSaving(false); }
  };

  const cellInput = (cat: string, key: keyof ProfitabilityLine) => (
    <input
      type="number"
      className="border rounded px-1 py-0.5 text-sm w-28 text-right"
      value={(lines[cat]?.[key] as any) ?? ''}
      onChange={e => update(cat, key, e.target.value)}
      onBlur={flush}
      placeholder="0"
    />
  );

  return (
    <section>
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Reporting Period</label>
        {readOnly
          ? <span className="text-sm">{period || '—'}</span>
          : <input className="border rounded px-2 py-1 text-xs w-32" placeholder="Period (e.g. YTD 2026)" value={period} onChange={e => { setPeriod(e.target.value); dirty.current = true; }} onBlur={flush} />}
      </div>
      <div className="border rounded-lg overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2 text-left w-36">Product</th>
              <th className="p-2 text-right">Net Profit YTD</th>
              <th className="p-2 text-right">Net Profit Projected</th>
              <th className="p-2 text-right">Fee Income YTD</th>
              <th className="p-2 text-right">Fee Income Projected</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_CATEGORIES.map(c => (
              <tr key={c.key} className="border-t hover:bg-gray-50">
                <td className="p-2 text-sm font-medium">{c.label}</td>
                {readOnly
                  ? <>
                      <td className="p-2 text-right">{fmt(lines[c.key]?.netProfitYtd as any)}</td>
                      <td className="p-2 text-right">{fmt(lines[c.key]?.netProfitProjected as any)}</td>
                      <td className="p-2 text-right">{fmt(lines[c.key]?.feeIncomeYtd as any)}</td>
                      <td className="p-2 text-right">{fmt(lines[c.key]?.feeIncomeProjected as any)}</td>
                    </>
                  : <>
                      <td className="p-1 text-right">{cellInput(c.key, 'netProfitYtd')}</td>
                      <td className="p-1 text-right">{cellInput(c.key, 'netProfitProjected')}</td>
                      <td className="p-1 text-right">{cellInput(c.key, 'feeIncomeYtd')}</td>
                      <td className="p-1 text-right">{cellInput(c.key, 'feeIncomeProjected')}</td>
                    </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{notes || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-16" value={notes} onChange={e => { setNotes(e.target.value); dirty.current = true; }} onBlur={flush} placeholder="Notes on profitability…" />}
      </div>
    </section>
  );
};

// ─── Wallet Share Section ─────────────────────────────────────────────────────

type WalletRow = Partial<WalletShare> & { facilityType: string };

const WalletShareSection: React.FC<{
  appId: string;
  readOnly: boolean;
  setSaving: (v: boolean) => void;
  setSavedAt: (d: Date) => void;
}> = ({ appId, readOnly, setSaving, setSavedAt }) => {
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [newType, setNewType] = useState('');

  useEffect(() => {
    walletShareApi.list(appId).then(setRows);
  }, [appId]);

  const update = (idx: number, key: keyof WalletShare, value: string) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [key]: value } : row));
  };

  const flush = async (idx: number) => {
    const row = rows[idx];
    setSaving(true);
    try {
      await walletShareApi.bulkUpsert(appId, [row]);
      const updated = await walletShareApi.list(appId);
      setRows(updated);
      setSavedAt(new Date());
    } finally { setSaving(false); }
  };

  const addRow = () => {
    if (!newType.trim()) return;
    setRows(r => [...r, { facilityType: newType.trim() }]);
    setNewType('');
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id) await walletShareApi.remove(appId, row.id);
    setRows(r => r.filter((_, i) => i !== idx));
  };

  return (
    <section>
      <div className="border rounded-lg overflow-x-auto mb-3">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2 text-left">Facility Type</th>
              <th className="p-2 text-right">Our Limit</th>
              <th className="p-2 text-right">Market Total</th>
              <th className="p-2 text-right">Our Share %</th>
              <th className="p-2 text-right">YoY Δ%</th>
              {!readOnly && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-t hover:bg-gray-50">
                <td className="p-2 font-medium">{row.facilityType}</td>
                {readOnly
                  ? <>
                      <td className="p-2 text-right">{fmt(row.ourLimitAmount as any)}</td>
                      <td className="p-2 text-right">{fmt(row.totalMarketAmount as any)}</td>
                      <td className="p-2 text-right">{row.ourSharePct != null ? `${row.ourSharePct}%` : '—'}</td>
                      <td className="p-2 text-right">{row.yoyChangePct != null ? `${row.yoyChangePct}%` : '—'}</td>
                    </>
                  : <>
                      {(['ourLimitAmount', 'totalMarketAmount', 'ourSharePct', 'yoyChangePct'] as (keyof WalletShare)[]).map(k => (
                        <td key={k} className="p-1 text-right">
                          <input type="number" className="border rounded px-1 py-0.5 text-sm w-24 text-right" value={(row[k] as any) ?? ''} onChange={e => update(idx, k, e.target.value)} onBlur={() => flush(idx)} placeholder="0" />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Facility type (e.g. TERM_LOAN)" value={newType} onChange={e => setNewType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRow()} />
          <button onClick={addRow} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
        </div>
      )}
    </section>
  );
};

// ─── Account Strategy Section ─────────────────────────────────────────────────

const StrategySection: React.FC<{
  application: CreditApplication;
  readOnly: boolean;
  onUpdated: (a: CreditApplication) => void;
  setSaving: (v: boolean) => void;
  setSavedAt: (d: Date) => void;
}> = ({ application, readOnly, onUpdated, setSaving, setSavedAt }) => {
  const [strategy, setStrategy] = useState(application.accountStrategy ?? '');
  const [cross, setCross] = useState(application.crossSellingInitiatives ?? '');
  const dirty = useRef<Set<string>>(new Set());

  const flush = async () => {
    if (dirty.current.size === 0) return;
    setSaving(true);
    try {
      const payload: any = {};
      dirty.current.forEach(k => { payload[k] = k === 'accountStrategy' ? strategy || null : cross || null; });
      const updated = await creditService.updateApplication(application.id, payload);
      onUpdated(updated);
      dirty.current.clear();
      setSavedAt(new Date());
    } finally { setSaving(false); }
  };

  return (
    <section>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account Strategy</label>
          {readOnly
            ? <span className="text-sm">{application.accountStrategy || '—'}</span>
            : <select className="border rounded px-2 py-1 text-sm" value={strategy} onChange={e => { setStrategy(e.target.value); dirty.current.add('accountStrategy'); }} onBlur={flush}>
                <option value="">— Select —</option>
                {ACCOUNT_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cross-Selling Initiatives</label>
          {readOnly
            ? <p className="text-sm whitespace-pre-wrap">{application.crossSellingInitiatives || '—'}</p>
            : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-24" value={cross} onChange={e => { setCross(e.target.value); dirty.current.add('crossSellingInitiatives'); }} onBlur={flush} placeholder="Describe cross-selling opportunities…" />}
        </div>
      </div>
    </section>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const ProfitabilityWalletTab: React.FC<Props> = ({ application, onUpdated }) => {
  const readOnly = application.state !== 'DRAFT';
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  return (
    <CaMemoSection title="Profitability & Wallet — Section 9" phase="Phase 4" readOnly={readOnly} saving={saving} savedAt={savedAt}>
      <div className="space-y-8">
        <ProfitabilitySection appId={application.id} readOnly={readOnly} setSaving={setSaving} setSavedAt={setSavedAt} />
        <WalletShareSection appId={application.id} readOnly={readOnly} setSaving={setSaving} setSavedAt={setSavedAt} />
        <StrategySection application={application} readOnly={readOnly} onUpdated={onUpdated} setSaving={setSaving} setSavedAt={setSavedAt} />
      </div>
    </CaMemoSection>
  );
};

export default ProfitabilityWalletTab;