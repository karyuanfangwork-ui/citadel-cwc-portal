import React, { useCallback, useEffect, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  AccountProfitability,
  ProfitabilityLine,
  WalletShare,
  profitabilityApi,
  walletShareApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import { ProfitabilityBarChart, WalletShareChart } from '../../../src/components/credit/FinancialCharts';
import useAutosave from '../../../src/hooks/useAutosave';

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
  onDirtyChange?: (dirty: boolean) => void;
};

// ─── Profitability Section ────────────────────────────────────────────────────

type LineMap = Record<string, Partial<ProfitabilityLine>>;

const ProfitabilitySection: React.FC<{
  appId: string;
  readOnly: boolean;
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: () => void;
  syncRef: React.MutableRefObject<{ period: string; notes: string; lines: LineMap }>;
}> = ({ appId, readOnly, autosave, onMarkDirty, syncRef }) => {
  const [profitability, setProfitability] = useState<AccountProfitability | null>(null);
  const [lines, setLines] = useState<LineMap>({});
  const [notes, setNotes] = useState('');
  const [period, setPeriod] = useState('');

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
    setLines(l => {
      const next = { ...l, [cat]: { ...l[cat], productCategory: cat, [key]: value } };
      syncRef.current.lines = next;
      return next;
    });
    onMarkDirty();
  };

  const cellInput = (cat: string, key: keyof ProfitabilityLine) => (
    <input
      type="number"
      className="border rounded px-1 py-0.5 text-sm w-28 text-right"
      value={(lines[cat]?.[key] as any) ?? ''}
      onChange={e => update(cat, key, e.target.value)}
      onBlur={() => autosave.save()}
      placeholder="0"
    />
  );

  // Chart data derived from lines
  const chartLines = PRODUCT_CATEGORIES.map(c => ({
    productCategory: c.key,
    netProfitYtd: lines[c.key]?.netProfitYtd ?? null,
    netProfitProjected: lines[c.key]?.netProfitProjected ?? null,
  })).filter(l => Number(l.netProfitYtd) || Number(l.netProfitProjected));

  return (
    <section>
      <ProfitabilityBarChart lines={chartLines} />
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Reporting Period</label>
        {readOnly
          ? <span className="text-sm">{period || '—'}</span>
          : <input className="border rounded px-2 py-1 text-xs w-32" placeholder="Period (e.g. YTD 2026)" value={period} onChange={e => { setPeriod(e.target.value); syncRef.current.period = e.target.value; onMarkDirty(); }} onBlur={() => autosave.save()} />}
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
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-16" value={notes} onChange={e => { setNotes(e.target.value); syncRef.current.notes = e.target.value; onMarkDirty(); }} onBlur={() => autosave.save()} placeholder="Notes on profitability…" />}
      </div>
    </section>
  );
};

// ─── Wallet Share Section ─────────────────────────────────────────────────────

type WalletRow = Partial<WalletShare> & { facilityType: string };

const WalletShareSection: React.FC<{
  appId: string;
  readOnly: boolean;
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: () => void;
  syncRef: React.MutableRefObject<WalletRow[]>;
  setRows: React.Dispatch<React.SetStateAction<WalletRow[]>>;
}> = ({ appId, readOnly, autosave, onMarkDirty, syncRef, setRows }) => {
  const [rows, localSetRows] = useState<WalletRow[]>([]);
  const [newType, setNewType] = useState('');

  useEffect(() => {
    walletShareApi.list(appId).then(items => {
      localSetRows(items);
      setRows(items);
      syncRef.current = items;
    });
  }, [appId]);

  // Wrap setRows to also sync the ref
  const updateRows = (updater: WalletRow[] | ((prev: WalletRow[]) => WalletRow[])) => {
    localSetRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncRef.current = next;
      setRows(next);
      return next;
    });
  };

  const update = (idx: number, key: keyof WalletShare, value: string) => {
    updateRows(r => r.map((row, i) => i === idx ? { ...row, [key]: value } : row));
    onMarkDirty();
  };

  const addRow = () => {
    if (!newType.trim()) return;
    updateRows(r => [...r, { facilityType: newType.trim() }]);
    setNewType('');
    onMarkDirty();
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id) await walletShareApi.remove(appId, row.id);
    updateRows(r => r.filter((_, i) => i !== idx));
  };

  return (
    <section>
      <WalletShareChart rows={rows} />
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
                          <input type="number" className="border rounded px-1 py-0.5 text-sm w-24 text-right" value={(row[k] as any) ?? ''} onChange={e => update(idx, k, e.target.value)} onBlur={() => autosave.save()} placeholder="0" />
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
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: (key: string) => void;
  syncRef: React.MutableRefObject<{ accountStrategy: string; crossSellingInitiatives: string; dirtyKeys: Set<string> }>;
}> = ({ application, readOnly, onUpdated, autosave, onMarkDirty, syncRef }) => {
  const [strategy, setStrategy] = useState(application.accountStrategy ?? '');
  const [cross, setCross] = useState(application.crossSellingInitiatives ?? '');

  return (
    <section>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account Strategy</label>
          {readOnly
            ? <span className="text-sm">{application.accountStrategy || '—'}</span>
            : <select className="border rounded px-2 py-1 text-sm" value={strategy} onChange={e => { setStrategy(e.target.value); syncRef.current.accountStrategy = e.target.value; onMarkDirty('accountStrategy'); }} onBlur={() => autosave.save()}>
                <option value="">— Select —</option>
                {ACCOUNT_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cross-Selling Initiatives</label>
          {readOnly
            ? <p className="text-sm whitespace-pre-wrap">{application.crossSellingInitiatives || '—'}</p>
            : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-24" value={cross} onChange={e => { setCross(e.target.value); syncRef.current.crossSellingInitiatives = e.target.value; onMarkDirty('crossSellingInitiatives'); }} onBlur={() => autosave.save()} placeholder="Describe cross-selling opportunities…" />}
        </div>
      </div>
    </section>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

type DirtySection = 'profitability' | 'walletShare' | 'strategy';

const ProfitabilityWalletTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const dirtyKeys = useRef<Set<DirtySection>>(new Set());

  // Refs for sub-section state that the saveFn needs to read
  const profitabilityRef = useRef<{ period: string; notes: string; lines: LineMap }>({ period: '', notes: '', lines: {} });
  const walletRowsRef = useRef<WalletRow[]>([]);
  const [, setWalletRowsState] = useState<WalletRow[]>([]); // trigger re-render after save
  const strategyRef = useRef<{ accountStrategy: string; crossSellingInitiatives: string; dirtyKeys: Set<string> }>({
    accountStrategy: '',
    crossSellingInitiatives: '',
    dirtyKeys: new Set(),
  });

  const onMarkDirtyProfitability = useCallback(() => {
    dirtyKeys.current.add('profitability');
    autosave.markDirty();
  }, []);

  const onMarkDirtyWallet = useCallback(() => {
    dirtyKeys.current.add('walletShare');
    autosave.markDirty();
  }, []);

  const onMarkDirtyStrategy = useCallback((key: string) => {
    dirtyKeys.current.add('strategy');
    strategyRef.current.dirtyKeys.add(key);
    autosave.markDirty();
  }, []);

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosave = useAutosave<void>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return;
      const dirty = new Set(dirtyKeys.current);
      dirtyKeys.current.clear();

      if (dirty.has('profitability')) {
        const { period, notes, lines } = profitabilityRef.current;
        await profitabilityApi.upsert(application.id, {
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
      }

      if (dirty.has('walletShare')) {
        const rows = walletRowsRef.current;
        if (rows.length > 0) {
          await walletShareApi.bulkUpsert(application.id, rows);
          const updated = await walletShareApi.list(application.id);
          walletRowsRef.current = updated;
          setWalletRowsState(updated);
        }
      }

      if (dirty.has('strategy')) {
        const payload: any = {};
        strategyRef.current.dirtyKeys.forEach(k => {
          payload[k] = k === 'accountStrategy'
            ? strategyRef.current.accountStrategy || null
            : strategyRef.current.crossSellingInitiatives || null;
        });
        strategyRef.current.dirtyKeys.clear();
        const updated = await creditService.updateApplication(application.id, payload);
        onUpdated(updated);
      }
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  return (
    <CaMemoSection
      title="Profitability & Wallet — Section 9"
      phase="Phase 4"
      readOnly={readOnly}
      saving={autosave.saving}
      savedAt={autosave.savedAt}
      error={autosave.error}
    >
      <div className="space-y-8">
        <ProfitabilitySection appId={application.id} readOnly={readOnly} autosave={autosave} onMarkDirty={onMarkDirtyProfitability} syncRef={profitabilityRef} />
        <WalletShareSection appId={application.id} readOnly={readOnly} autosave={autosave} onMarkDirty={onMarkDirtyWallet} syncRef={walletRowsRef} setRows={setWalletRowsState} />

        <StrategySection application={application} readOnly={readOnly} onUpdated={onUpdated} autosave={autosave} onMarkDirty={onMarkDirtyStrategy} syncRef={strategyRef} />
      </div>
    </CaMemoSection>
  );
};

export default ProfitabilityWalletTab;