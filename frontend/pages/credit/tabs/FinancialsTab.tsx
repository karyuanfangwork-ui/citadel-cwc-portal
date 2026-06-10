import React, { useEffect, useState, useCallback } from 'react';
import creditService, {
  CreditApplication,
  FinancialStatement,
  FinancialPeriod,
  FinancialLineItem,
  FinancialRatio,
  CurrencyCode,
  financialApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import RetailIncomeTab from './RetailIncomeTab';

// S3 · Financials — Financial spreading for corporate borrowers, DSR for retail.
// Provides: statement listing, creation, line-item entry, balance validation,
// ratio display, and visual verification that data was captured correctly.

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

// ── Status badge for statements ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    REVIEWED: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ── Balance validation indicator ──────────────────────────────────────────────
function ValidationIndicator({ statementId }: { statementId: string }) {
  const [result, setResult] = useState<{ valid: boolean; difference: number; totalAssets: number; totalLiabilitiesEquity: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financialApi.validateBalanceSheet(statementId);
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  if (!result && !loading && !error) {
    return (
      <button
        onClick={validate}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        Validate Balance
      </button>
    );
  }

  if (loading) return <span className="text-xs text-gray-400">Validating…</span>;
  if (error) return <span className="text-xs text-red-500">{error}</span>;

  if (!result) return null;

  return (
    <div className="flex items-center gap-2">
      {result.valid ? (
        <span className="flex items-center gap-1 text-xs text-green-700">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          Balanced
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-red-700">
          <span className="material-symbols-outlined text-sm">error</span>
          Off by {result.difference.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
        </span>
      )}
      <button onClick={validate} className="text-xs text-blue-600 hover:text-blue-800 underline">
        Re-validate
      </button>
    </div>
  );
}

// ── Line Item Editor ──────────────────────────────────────────────────────────
const BS_LINE_ITEMS = [
  { key: 'cash_and_equivalents', label: 'Cash & Equivalents', parent: 'current_assets' },
  { key: 'accounts_receivable', label: 'Accounts Receivable', parent: 'current_assets' },
  { key: 'inventory', label: 'Inventory', parent: 'current_assets' },
  { key: 'other_current_assets', label: 'Other Current Assets', parent: 'current_assets' },
  { key: 'total_current_assets', label: 'Total Current Assets', parent: null, computed: true },
  { key: 'fixed_assets', label: 'Fixed Assets', parent: 'non_current_assets' },
  { key: 'intangible_assets', label: 'Intangible Assets', parent: 'non_current_assets' },
  { key: 'other_non_current_assets', label: 'Other Non-Current Assets', parent: null },
  { key: 'total_assets', label: 'Total Assets', parent: null, computed: true },

  { key: 'accounts_payable', label: 'Accounts Payable', parent: 'current_liabilities' },
  { key: 'short_term_debt', label: 'Short-Term Debt', parent: 'current_liabilities' },
  { key: 'other_current_liabilities', label: 'Other Current Liabilities', parent: 'current_liabilities' },
  { key: 'total_current_liabilities', label: 'Total Current Liabilities', parent: null, computed: true },
  { key: 'long_term_debt', label: 'Long-Term Debt', parent: 'non_current_liabilities' },
  { key: 'other_non_current_liabilities', label: 'Other Non-Current Liabilities', parent: null },
  { key: 'total_debt', label: 'Total Debt (ST + LT)', parent: null, computed: true },
  { key: 'total_liabilities', label: 'Total Liabilities', parent: null, computed: true },
  { key: 'total_equity', label: 'Total Equity', parent: null, computed: true },
  { key: 'total_liabilities_equity', label: 'Total Liabilities + Equity', parent: null, computed: true },
];

const PL_LINE_ITEMS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'cogs', label: 'Cost of Goods Sold' },
  { key: 'gross_profit', label: 'Gross Profit', computed: true },
  { key: 'operating_expenses', label: 'Operating Expenses' },
  { key: 'ebit', label: 'EBIT (Operating Income)', computed: true },
  { key: 'interest', label: 'Interest Expense' },
  { key: 'depreciation', label: 'Depreciation & Amortization' },
  { key: 'net_income', label: 'Net Income', computed: true },
];

const CF_LINE_ITEMS = [
  { key: 'operating_cash_flow', label: 'Operating Cash Flow' },
  { key: 'capital_expenditure', label: 'Capital Expenditure' },
  { key: 'free_cash_flow', label: 'Free Cash Flow', computed: true },
  { key: 'principal', label: 'Principal Repayment' },
];

type LineItemRow = { lineKey: string; lineLabel?: string; amount: number };
type StatementFormData = {
  statementType: 'BS' | 'PL' | 'CF';
  period: FinancialPeriod;
  fiscalYearEnd: string;
  currency: CurrencyCode;
};

function LineItemEditor({
  items,
  onChange,
  disabled,
}: {
  items: LineItemRow[];
  onChange: (items: LineItemRow[]) => void;
  disabled?: boolean;
}) {
  const amountForKey = (key: string) => items.find(i => i.lineKey === key)?.amount || 0;
  const updateField = (key: string, amount: number) => {
    const existing = items.find(i => i.lineKey === key);
    if (existing) {
      onChange(items.map(i => i.lineKey === key ? { ...i, amount } : i));
    } else {
      onChange([...items, { lineKey: key, amount }]);
    }
  };

  // F4 — humanize snake_case as fallback when no lineLabel
  const humanize = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const displayLabel = (item: LineItemRow) => item.lineLabel || humanize(item.lineKey);

  // F4 — Add Row control
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddRow = () => {
    const key = newKey.trim() || `custom_${items.length + 1}`;
    const label = newLabel.trim() || humanize(key);
    if (items.some(i => i.lineKey === key)) return; // duplicate key
    onChange([...items, { lineKey: key, lineLabel: label, amount: 0 }]);
    setNewKey('');
    setNewLabel('');
    setAdding(false);
  };

  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.lineKey} className="flex items-center gap-2 text-sm">
          <span className="w-56 text-gray-700 shrink-0">{displayLabel(item)}</span>
          <input
            type="number"
            value={item.amount || ''}
            onChange={e => updateField(item.lineKey, Number(e.target.value) || 0)}
            className="flex-1 border rounded px-2 py-1 text-right disabled:bg-gray-50"
            disabled={disabled}
            min={0}
            step={0.01}
          />
        </div>
      ))}
      {/* F4 — Add Row button */}
      {!disabled && (
        <div className="pt-2">
          {adding ? (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="text"
                placeholder="Key (e.g. custom_item)"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="w-36 border rounded px-2 py-1 text-xs"
              />
              <input
                type="text"
                placeholder="Label (e.g. Custom Item)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-36 border rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={handleAddRow}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewKey(''); setNewLabel(''); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Row
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Statement Create/Edit Modal ───────────────────────────────────────────────
function StatementModal({
  borrowerProfileId,
  existing,
  onClose,
  onSaved,
}: {
  borrowerProfileId: string;
  existing?: FinancialStatement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<StatementFormData>({
    statementType: existing?.statementType || 'BS',
    period: (existing?.period || 'ANNUAL') as FinancialPeriod,
    fiscalYearEnd: existing?.fiscalYearEnd ? new Date(existing.fiscalYearEnd).toISOString().slice(0, 10) : '',
    currency: (existing?.currency || 'MYR') as CurrencyCode,
  });
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = !!existing;

  // Load line items if editing
  useEffect(() => {
    if (existing?.id) {
      setLoading(true);
      financialApi.listLineItems(existing.id)
        .then(items => setLineItems(items.map(i => ({ lineKey: i.lineKey, lineLabel: i.lineLabel, amount: Number(i.amount) }))))
        .catch(() => setLineItems([]))
        .finally(() => setLoading(false));
    }
  }, [existing?.id]);

  const lineItemDefs = form.statementType === 'BS' ? BS_LINE_ITEMS
    : form.statementType === 'PL' ? PL_LINE_ITEMS : CF_LINE_ITEMS;

  const handleSave = async () => {
    setSaving(true);
    try {
      let stmtId = existing?.id;
      if (!isEdit) {
        const stmt = await financialApi.createStatement(borrowerProfileId, {
          statementType: form.statementType,
          period: form.period,
          fiscalYearEnd: form.fiscalYearEnd,
          currency: form.currency,
        });
        stmtId = stmt.id;
      }

      // §1.4 — Derive computed line items before save
      const enrichedItems = lineItems.map((item, idx) => ({
        lineKey: item.lineKey,
        lineLabel: lineItemDefs.find(d => d.key === item.lineKey)?.label || item.lineKey,
        amount: item.amount,
        displayOrder: idx,
      }));

      if (form.statementType === 'BS') {
        // Derive total_debt = short_term_debt + long_term_debt
        const stDebt = Number(lineItems.find(i => i.lineKey === 'short_term_debt')?.amount || 0);
        const ltDebt = Number(lineItems.find(i => i.lineKey === 'long_term_debt')?.amount || 0);
        const totalDebtIdx = enrichedItems.findIndex(i => i.lineKey === 'total_debt');
        if (totalDebtIdx >= 0) {
          enrichedItems[totalDebtIdx].amount = stDebt + ltDebt;
        }
      }

      // Save line items
      if (stmtId && enrichedItems.length > 0) {
        await financialApi.upsertLineItems(stmtId, enrichedItems);
      }
      onSaved();
    } catch (err: any) {
      alert('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Financial Statement' : 'Add Financial Statement'}>
      <div className="bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-2xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit' : 'Add'} Financial Statement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Statement metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statement Type</label>
              <select
                value={form.statementType}
                onChange={e => setForm(f => ({ ...f, statementType: e.target.value as any }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                disabled={isEdit}
              >
                <option value="BS">Balance Sheet</option>
                <option value="PL">Profit & Loss</option>
                <option value="CF">Cash Flow</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
              <select
                value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value as FinancialPeriod }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                disabled={isEdit}
              >
                <option value="ANNUAL">Annual</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fiscal Year End</label>
              <input
                type="date"
                value={form.fiscalYearEnd}
                onChange={e => setForm(f => ({ ...f, fiscalYearEnd: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                disabled={isEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                disabled={isEdit}
              >
                <option value="MYR">MYR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Line Items — {form.statementType === 'BS' ? 'Balance Sheet' : form.statementType === 'PL' ? 'Profit & Loss' : 'Cash Flow'}
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />)}
              </div>
            ) : (
              <div className="border rounded-lg p-3 bg-gray-50 max-h-[40vh] overflow-y-auto">
                <LineItemEditor items={lineItems} onChange={setLineItems} />
              </div>
            )}
          </div>

          {/* Summary totals for BS */}
          {form.statementType === 'BS' && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-gray-500">Total Assets:</span>
                  <span className="ml-2 font-bold">{(lineItems.find(i => i.lineKey === 'total_assets')?.amount || 0).toLocaleString('en-MY')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Debt:</span>
                  <span className="ml-2 font-bold">{(lineItems.find(i => i.lineKey === 'total_debt')?.amount || 0).toLocaleString('en-MY')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Liabilities:</span>
                  <span className="ml-2 font-bold">{(lineItems.find(i => i.lineKey === 'total_liabilities')?.amount || 0).toLocaleString('en-MY')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Equity:</span>
                  <span className="ml-2 font-bold">{(lineItems.find(i => i.lineKey === 'total_equity')?.amount || 0).toLocaleString('en-MY')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-md">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.fiscalYearEnd}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create Statement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main FinancialsTab ────────────────────────────────────────────────────────
// ── §2.2 — Multi-Year Spread View ──────────────────────────────────────────

const SPREAD_LINE_KEYS: Record<string, string[]> = {
  BS: ['totalAssets', 'totalLiabilities', 'totalEquity', 'currentAssets', 'currentLiabilities', 'cashAndCashEquivalents', 'accountsReceivable', 'inventory', 'fixedAssets', 'longTermDebt', 'totalDebt'],
  PL: ['revenue', 'costOfGoodsSold', 'grossProfit', 'ebitda', 'depreciationAndAmortization', 'operatingProfit', 'netProfit', 'interestExpense'],
  CF: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netChangeInCash'],
};

function fmtNum(v: number | string | null | undefined): string {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function yoyChange(curr: number | null, prev: number | null): { text: string; color: string } | null {
  if (curr == null || prev == null || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? '+' : '';
  const arrow = pct >= 0 ? '▲' : '▼';
  if (Math.abs(pct) < 0.5) return { text: '—', color: 'text-gray-400' };
  const color = pct > 0 ? 'text-green-600' : 'text-red-600';
  return { text: `${arrow} ${sign}${pct.toFixed(1)}%`, color };
}

type SpreadProps = {
  statements: FinancialStatement[];
  lineItemsMap: Record<string, FinancialLineItem[] | undefined>;
  ratiosMap: Record<string, FinancialRatio[] | undefined>;
};

const SpreadViewTable: React.FC<SpreadProps> = ({ statements, lineItemsMap, ratiosMap }) => {
  // Group statements by type, sort by fiscalYearEnd
  const byType = React.useMemo(() => {
    const groups: Record<string, FinancialStatement[]> = {};
    for (const s of statements) {
      const key = s.statementType;
      (groups[key] ??= []).push(s);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.fiscalYearEnd.localeCompare(b.fiscalYearEnd));
    }
    return groups;
  }, [statements]);

  const typeLabels: Record<string, string> = { BS: 'Balance Sheet', PL: 'Profit & Loss', CF: 'Cash Flow' };

  const buildRows = (type: string, stmts: FinancialStatement[]) => {
    const years = stmts.map(s => new Date(s.fiscalYearEnd).getFullYear());
    const keySet = new Set<string>();
    // Collect all line keys from all statements of this type
    for (const s of stmts) {
      const items = lineItemsMap[s.id] ?? s.lineItems ?? [];
      for (const item of items) keySet.add(item.lineKey);
    }
    // If no data, fall back to standard keys for this type
    const keys = keySet.size > 0 ? [...keySet] : (SPREAD_LINE_KEYS[type] ?? []);
    const labelMap: Record<string, string> = {};
    for (const s of stmts) {
      const items = lineItemsMap[s.id] ?? s.lineItems ?? [];
      for (const item of items) labelMap[item.lineKey] = item.lineLabel;
    }

    return { keys, labelMap, years, stmts };
  };

  return (
    <div className="space-y-6 mt-4">
      {Object.entries(byType).map(([type, stmts]) => {
        const { keys, labelMap, years } = buildRows(type, stmts);
        return (
          <div key={type}>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">{typeLabels[type] ?? type} — Multi-Year Comparison</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Line Item</th>
                    {years.map(y => (
                      <th key={y} className="text-right px-3 py-2 font-semibold text-gray-600 border-b">FY{y}</th>
                    ))}
                    {years.length > 1 && (
                      <th className="text-right px-3 py-2 font-semibold text-gray-600 border-b">YoY</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {keys.map(lineKey => {
                    // Look up values from each statement's line items
                    const values = stmts.map(s => {
                      const items = lineItemsMap[s.id] ?? s.lineItems ?? [];
                      const item = items.find(i => i.lineKey === lineKey);
                      const raw = item?.amount;
                      return raw != null ? (typeof raw === 'string' ? parseFloat(raw) : raw) : null;
                    });
                    const lastVal = values[values.length - 1];
                    const prevVal = values.length > 1 ? values[values.length - 2] : null;
                    const change = yoyChange(lastVal, prevVal);

                    return (
                      <tr key={lineKey} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-700 font-medium">{labelMap[lineKey] || lineKey}</td>
                        {values.map((v, i) => (
                          <td key={i} className="text-right px-3 py-1.5 text-gray-600 tabular-nums">{fmtNum(v)}</td>
                        ))}
                        {years.length > 1 && (
                          <td className={`text-right px-3 py-1.5 tabular-nums font-medium ${change?.color ?? 'text-gray-400'}`}>
                            {change?.text ?? '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Ratio Comparison ────────────────────── */}
            {(() => {
              const allRatios: Record<string, Record<number, FinancialRatio>> = {};
              const ratioKeys = new Set<string>();
              for (const s of stmts) {
                const rs = ratiosMap[s.id] ?? s.ratios ?? [];
                const yr = new Date(s.fiscalYearEnd).getFullYear();
                for (const r of rs) {
                  if (!allRatios[r.ratioKey]) allRatios[r.ratioKey] = {};
                  allRatios[r.ratioKey][yr] = r;
                  ratioKeys.add(r.ratioKey);
                }
              }
              if (ratioKeys.size === 0) return null;
              return (
                <div className="mt-4">
                  <h5 className="text-xs font-semibold text-gray-600 mb-1">Ratio Comparison</h5>
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-1.5 font-semibold text-gray-600 border-b">Ratio</th>
                        {years.map(y => (
                          <th key={y} className="text-right px-3 py-1.5 font-semibold text-gray-600 border-b">FY{y}</th>
                        ))}
                        <th className="text-center px-3 py-1.5 font-semibold text-gray-600 border-b">Threshold</th>
                        <th className="text-center px-3 py-1.5 font-semibold text-gray-600 border-b">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ratioKeys].map(rk => {
                        const ratiosByYear = allRatios[rk];
                        const latestRatio = ratiosByYear[years[years.length - 1]] ?? Object.values(ratiosByYear)[0];
                        const label = latestRatio?.ratioLabel ?? rk;
                        const threshold = latestRatio?.threshold;
                        const isGood = (val: number | null) => {
                          if (!threshold || val == null) return null;
                          if (threshold.passMin != null && val < threshold.passMin) return false;
                          if (threshold.passMax != null && val > threshold.passMax) return false;
                          if (threshold.warnMin != null && val < threshold.warnMin) return 'warn';
                          if (threshold.warnMax != null && val > threshold.warnMax) return 'warn';
                          return true;
                        };
                        const thresholdStr = threshold
                          ? `${threshold.passMin ?? '—'}${threshold.passMin != null && threshold.passMax != null ? '–' : ''}${threshold.passMax ?? ''}${threshold.unit === 'x' ? 'x' : threshold.unit === '%' ? '%' : ''}`
                          : '—';
                        const latestVal = ratiosByYear[years[years.length - 1]]?.value;
                        const status = isGood(latestVal ?? null);
                        return (
                          <tr key={rk} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-700 font-medium">{label}</td>
                            {years.map(y => {
                              const r = ratiosByYear[y];
                              const v = r?.value;
                              const fmt = v != null ? (threshold?.unit === '%' ? `${(v * 100).toFixed(1)}%` : threshold?.unit === 'x' ? `${v.toFixed(2)}x` : v.toFixed(2)) : '—';
                              const rowStatus = isGood(v ?? null);
                              const cls = rowStatus === true ? 'text-green-700 font-semibold' : rowStatus === false ? 'text-red-600 font-semibold' : 'text-gray-600';
                              return <td key={y} className={`text-right px-3 py-1.5 tabular-nums ${cls}`}>{fmt}</td>;
                            })}
                            <td className="text-center px-3 py-1.5 text-gray-500">{thresholdStr}</td>
                            <td className="text-center px-3 py-1.5">
                              {status === true && <span className="text-green-600">✅</span>}
                              {status === false && <span className="text-red-600">❌</span>}
                              {status === 'warn' && <span className="text-yellow-500">⚠️</span>}
                              {status === null && <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};

const FinancialsTab: React.FC<Props> = ({ application }) => {
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStatement, setEditStatement] = useState<FinancialStatement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineItemsMap, setLineItemsMap] = useState<Record<string, FinancialStatement['lineItems']>>({});
  const [ratiosMap, setRatiosMap] = useState<Record<string, FinancialStatement['ratios']>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [showSpreadView, setShowSpreadView] = useState(false);

  const bpId = application.borrowerProfileId;
  const borrowerType = application.borrowerProfile?.borrowerType;

  const loadStatements = useCallback(() => {
    if (!bpId) { setLoading(false); return; }
    setLoading(true);
    financialApi.listStatements(bpId)
      .then(data => setStatements(data || []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, [bpId]);

  useEffect(() => { loadStatements(); }, [loadStatements]);

  const loadDetail = async (stmtId: string) => {
    if (lineItemsMap[stmtId] && ratiosMap[stmtId]) {
      setExpandedId(expandedId === stmtId ? null : stmtId);
      return;
    }
    setLoadingDetail(stmtId);
    try {
      const [items, ratios] = await Promise.all([
        financialApi.listLineItems(stmtId),
        financialApi.listRatios(stmtId),
      ]);
      setLineItemsMap(prev => ({ ...prev, [stmtId]: items }));
      setRatiosMap(prev => ({ ...prev, [stmtId]: ratios }));
      setExpandedId(stmtId);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  // Retail borrowers use DSR income form instead of financial spreader
  if (borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') {
    return (
      <RetailIncomeTab applicationId={application.id} />
    );
  }

  const fmt = (n: number | string | null) => n != null ? Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const typeLabel = (t: string) => t === 'BS' ? 'Balance Sheet' : t === 'PL' ? 'Profit & Loss' : t === 'CF' ? 'Cash Flow' : t;
  const periodLabel = (p: string) => p === 'ANNUAL' ? 'Annual' : p === 'QUARTERLY' ? 'Quarterly' : p;

  return (
    <div className="space-y-6">
      {/* ── Financial Statements ──────────────── */}
      <CaMemoSection title="Financial Statements" phase="S3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            {statements.length === 0
              ? 'No financial statements recorded. Add a statement to begin.'
              : `${statements.length} statement${statements.length !== 1 ? 's' : ''} on file`}
          </p>
          <button
            onClick={() => { setShowSpreadView(!showSpreadView); }}
            className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 ${showSpreadView ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <span className="material-symbols-outlined text-sm">view_column</span>
            Spread View
          </button>
          <button
            onClick={() => { setEditStatement(null); setShowModal(true); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Statement
          </button>
        </div>

        {statements.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <span className="material-symbols-outlined text-5xl mb-2 block">analytics</span>
            <p className="text-sm font-medium text-gray-500">No financial statements yet</p>
            <p className="text-xs mt-1">Click "Add Statement" to enter financial data for this borrower.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {statements.map((fs, idx) => {
              const isExpanded = expandedId === fs.id;
              const lineItems = lineItemsMap[fs.id];
              const ratios = ratiosMap[fs.id];
              const itemCount = (fs as any)._count?.lineItems ?? lineItems?.length ?? 0;
              const ratioCount = (fs as any)._count?.ratios ?? ratios?.length ?? 0;

              return (
                <div key={fs.id || idx} className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}>
                  {/* ── Statement Header ──────────── */}
                  <button
                    onClick={() => loadDetail(fs.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-gray-400">
                        {fs.statementType === 'BS' ? 'account_balance' : fs.statementType === 'PL' ? 'trending_up' : 'payments'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {typeLabel(fs.statementType)}
                          </span>
                          <span className="text-xs text-gray-500">
                            FY {fs.fiscalYearEnd ? new Date(fs.fiscalYearEnd).toLocaleDateString('en-MY', { year: 'numeric', month: 'short' }) : `#${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {periodLabel(fs.period || 'ANNUAL')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={fs.status || 'DRAFT'} />
                          <span className="text-[10px] text-gray-400">{fs.currency || 'MYR'}</span>
                          {itemCount > 0 && (
                            <span className="text-[10px] text-gray-400">
                              {itemCount} line item{itemCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {ratioCount > 0 && (
                            <span className="text-[10px] text-indigo-500">
                              {ratioCount} ratio{ratioCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`material-symbols-outlined text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {/* ── Expanded Detail ─────────── */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50">
                      {loadingDetail === fs.id ? (
                        <div className="p-4 space-y-2">
                          {[1, 2, 3].map(i => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
                        </div>
                      ) : lineItems && lineItems.length > 0 ? (
                        <div className="p-4 space-y-4">
                          {/* Line items grouped by parent */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Line Items</h4>
                            <div className="bg-white rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b">
                                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Item</th>
                                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Amount ({fs.currency || 'MYR'})</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lineItems.map((li, liIdx) => {
                                    const def = fs.statementType === 'BS'
                                      ? BS_LINE_ITEMS.find(d => d.key === li.lineKey)
                                      : fs.statementType === 'PL'
                                      ? PL_LINE_ITEMS.find(d => d.key === li.lineKey)
                                      : CF_LINE_ITEMS.find(d => d.key === li.lineKey);
                                    const isTotal = li.lineKey.startsWith('total_') || (def as any)?.computed;
                                    return (
                                      <tr key={li.id || liIdx} className={isTotal ? 'bg-blue-50/50 font-semibold' : 'border-b border-gray-100'}>
                                        <td className={`px-3 py-1.5 ${isTotal ? 'text-gray-900' : 'text-gray-600'}`}>
                                          {li.lineLabel || li.lineKey || `Line ${liIdx + 1}`}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right tabular-nums ${isTotal ? 'text-gray-900' : 'text-gray-800'}`}>
                                          {li.amount != null ? fmt(li.amount) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* §1.4 — Computed Ratios Panel (grouped by category with threshold badges) */}
                          {ratios && ratios.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Computed Ratios</h4>
                              {(() => {
                                // Group ratios by category
                                const groups: Record<string, typeof ratios> = {};
                                for (const r of ratios) {
                                  const cat = r.category || 'OTHER';
                                  if (!groups[cat]) groups[cat] = [];
                                  groups[cat].push(r);
                                }
                                const CATEGORY_ORDER = ['LIQUIDITY', 'LEVERAGE', 'COVERAGE', 'PROFITABILITY', 'ACTIVITY'];
                                const CATEGORY_LABELS: Record<string, string> = {
                                  LIQUIDITY: 'Liquidity',
                                  LEVERAGE: 'Leverage',
                                  COVERAGE: 'Coverage',
                                  PROFITABILITY: 'Profitability',
                                  ACTIVITY: 'Activity',
                                };
                                const badgeStyles: Record<string, string> = {
                                  pass: 'bg-green-100 text-green-700',
                                  warn: 'bg-amber-100 text-amber-700',
                                  fail: 'bg-red-100 text-red-700',
                                  neutral: 'bg-gray-100 text-gray-600',
                                };
                                const badgeLabels: Record<string, string> = {
                                  pass: '✓ Pass',
                                  warn: '⚠ Warn',
                                  fail: '✗ Fail',
                                  neutral: '',
                                };
                                const formatRatioValue = (r: any) => {
                                  if (r.value == null) return '—';
                                  const v = Number(r.value);
                                  const unit = r.threshold?.unit;
                                  if (unit === '%' || r.ratioKey === 'gearing_ratio' || r.ratioKey === 'ros' || r.ratioKey === 'gross_margin' || r.ratioKey === 'roe' || r.ratioKey === 'roa') {
                                    return (v * 100).toFixed(2) + '%';
                                  }
                                  if (r.ratioKey === 'receivables_days' || r.ratioKey === 'payables_days' || r.ratioKey === 'inventory_days') {
                                    return v.toFixed(1) + ' days';
                                  }
                                  return v.toFixed(2) + 'x';
                                };
                                return (
                                  <div className="space-y-4">
                                    {CATEGORY_ORDER.filter(c => groups[c]?.length).map(cat => (
                                      <div key={cat}>
                                        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{CATEGORY_LABELS[cat] || cat}</h5>
                                        <div className="bg-white rounded-lg border overflow-hidden">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-gray-50 border-b">
                                                <th className="text-left px-3 py-1.5 font-medium text-gray-500">Ratio</th>
                                                <th className="text-right px-3 py-1.5 font-medium text-gray-500">Value</th>
                                                <th className="text-center px-3 py-1.5 font-medium text-gray-500">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {groups[cat].map((r: any, rIdx: number) => {
                                                const badge = r.badge || 'neutral';
                                                return (
                                                  <tr key={r.id || rIdx} className="border-b border-gray-50 last:border-0">
                                                    <td className="px-3 py-1.5">
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="font-medium text-gray-800">{r.ratioLabel || r.ratioKey}</span>
                                                        {r.threshold?.formatHint && (
                                                          <span className="material-symbols-outlined text-xs text-gray-300 cursor-help" title={r.threshold.formatHint}>info</span>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900">{formatRatioValue(r)}</td>
                                                    <td className="px-3 py-1.5 text-center">
                                                      {badge !== 'neutral' && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeStyles[badge]}`}>
                                                          {badgeLabels[badge]}
                                                        </span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Validation for Balance Sheets */}
                          {fs.statementType === 'BS' && (
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-xs text-gray-500">Balance Sheet Validation</span>
                              <ValidationIndicator statementId={fs.id} />
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t">
                            {fs.status === 'DRAFT' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await financialApi.submitForReview(fs.id);
                                    loadStatements();
                                  } catch (e: any) {
                                    alert(e.response?.data?.message || 'Failed to submit');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                              >
                                Submit for Review
                              </button>
                            )}
                            <button
                              onClick={() => { setEditStatement(fs); setShowModal(true); }}
                              className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                            >
                              Edit Line Items
                            </button>
                            {fs.statementType === 'BS' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await financialApi.computeRatios(fs.id);
                                    loadDetail(fs.id);
                                  } catch (e: any) {
                                    alert(e.response?.data?.message || 'Failed to compute ratios');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-600 rounded hover:bg-indigo-50"
                                title="Ratios auto-compute on save. Use this to force-refresh."
                              >
                                <span className="material-symbols-outlined text-xs align-middle mr-0.5">refresh</span>
                                Refresh Ratios
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-400">
                          <p className="text-sm">No line items entered yet.</p>
                          <button
                            onClick={() => { setEditStatement(fs); setShowModal(true); }}
                            className="mt-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Enter Line Items
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CaMemoSection>

      {/* ── Key Ratios Summary ─────────────────── */}
      {statements.length > 0 && (
        <CaMemoSection title="Key Financial Ratios" phase="S3">
          {(() => {
            // Collect ratios from all statements (latest per ratioKey wins)
            const latestRatios: Record<string, any> = {};
            const ratioByStatement: Record<string, any[]> = {};
            for (const stmt of statements) {
              const stmtRatios = ratiosMap[stmt.id] || (stmt as any).ratios || [];
              if (stmtRatios.length > 0) {
                ratioByStatement[stmt.id] = stmtRatios;
                for (const r of stmtRatios) {
                  latestRatios[r.ratioKey] = r;
                }
              }
            }
            const allRatioKeys = Object.keys(latestRatios);
            if (allRatioKeys.length === 0) {
              return (
                <div className="text-center py-8 text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">calculate</span>
                  <p className="text-sm font-medium text-gray-500">No ratios computed yet</p>
                  <p className="text-xs mt-1">Ratios are auto-computed when you save line items to financial statements.</p>
                </div>
              );
            }
            // Group by category
            const groups: Record<string, any[]> = {};
            for (const key of allRatioKeys) {
              const r = latestRatios[key];
              const cat = r.category || 'OTHER';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(r);
            }
            const CATEGORY_ORDER = ['LIQUIDITY', 'LEVERAGE', 'COVERAGE', 'PROFITABILITY', 'ACTIVITY'];
            const CATEGORY_LABELS: Record<string, string> = {
              LIQUIDITY: 'Liquidity', LEVERAGE: 'Leverage', COVERAGE: 'Coverage',
              PROFITABILITY: 'Profitability', ACTIVITY: 'Activity',
            };
            const badgeStyles: Record<string, string> = {
              pass: 'bg-green-100 text-green-700 border-green-200',
              warn: 'bg-amber-100 text-amber-700 border-amber-200',
              fail: 'bg-red-100 text-red-700 border-red-200',
              neutral: 'bg-gray-100 text-gray-600 border-gray-200',
            };
            const badgeIcons: Record<string, string> = {
              pass: 'check_circle', warn: 'warning', fail: 'cancel', neutral: '',
            };
            const formatRatioValue = (r: any) => {
              if (r.value == null) return '—';
              const v = Number(r.value);
              const unit = r.threshold?.unit;
              if (unit === '%' || ['gearing_ratio', 'ros', 'gross_margin', 'roe', 'roa'].includes(r.ratioKey)) {
                return (v * 100).toFixed(2) + '%';
              }
              if (['receivables_days', 'payables_days', 'inventory_days'].includes(r.ratioKey)) {
                return v.toFixed(1) + ' days';
              }
              return v.toFixed(2) + 'x';
            };
            return (
              <div className="space-y-6">
                {CATEGORY_ORDER.filter(c => groups[c]?.length).map(cat => (
                  <div key={cat}>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{CATEGORY_LABELS[cat]}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {groups[cat].map((r: any) => {
                        const badge = r.badge || 'neutral';
                        const hasThreshold = badge !== 'neutral';
                        return (
                          <div key={r.ratioKey} className={`bg-white border rounded-lg p-3 ${hasThreshold ? 'border-l-4 ' + (badge === 'pass' ? 'border-l-green-400' : badge === 'warn' ? 'border-l-amber-400' : 'border-l-red-400') : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 truncate">{r.ratioLabel || r.ratioKey}</span>
                              {hasThreshold && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badgeStyles[badge]}`}>
                                  {badge === 'pass' ? '✓' : badge === 'warn' ? '⚠' : '✗'}
                                </span>
                              )}
                            </div>
                            <div className="text-lg font-black text-gray-900">{formatRatioValue(r)}</div>
                            {r.threshold?.formatHint && (
                              <div className="text-[10px] text-gray-400 mt-0.5 truncate" title={r.threshold.formatHint}>{r.threshold.formatHint}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Multi-year comparison hint */}
                {statements.length > 1 && (
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">timeline</span>
                    Compare ratios across years — expand individual statements to see detail with trend analysis.
                  </div>
                )}
              </div>
            );
          })()}
        </CaMemoSection>
      )}

      {/* ── §2.2 Spread View ──────────── */}
      {showSpreadView && statements.length > 0 && (
        <CaMemoSection title="Multi-Year Spread View" phase="S3">
          <SpreadViewTable
            statements={statements}
            lineItemsMap={lineItemsMap as Record<string, FinancialLineItem[] | undefined>}
            ratiosMap={ratiosMap as Record<string, FinancialRatio[] | undefined>}
          />
        </CaMemoSection>
      )}

      {/* ── Data Verification Summary ──────────── */}
      {statements.length > 0 && (
        <CaMemoSection title="Data Verification" phase="S3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 mt-0.5">info</span>
              <div>
                <h4 className="text-sm font-semibold text-amber-800">Confirming captured information</h4>
                <p className="text-xs text-amber-700 mt-1">
                  Below is a summary of the financial data captured for this borrower. Verify that all figures match the source documents.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {statements.map((fs, idx) => {
                const stmtLineItems = lineItemsMap[fs.id] || fs.lineItems || [];
                const hasData = stmtLineItems.length > 0 || ((fs as any)._count?.lineItems ?? 0) > 0;
                return (
                  <div key={fs.id || idx} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hasData ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="font-medium">{typeLabel(fs.statementType)}</span>
                      <span className="text-gray-400">— FY {fs.fiscalYearEnd ? new Date(fs.fiscalYearEnd).getFullYear() : `#${idx + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{(fs as any)._count?.lineItems ?? 0} items</span>
                      <StatusBadge status={fs.status || 'DRAFT'} />
                      {!hasData && (
                        <button
                          onClick={() => { setEditStatement(fs); setShowModal(true); }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Enter data
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CaMemoSection>
      )}

      {/* ── Create/Edit Modal ──────────────── */}
      {showModal && (
        <StatementModal
          borrowerProfileId={bpId}
          existing={editStatement}
          onClose={() => { setShowModal(false); setEditStatement(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditStatement(null);
            loadStatements();
          }}
        />
      )}
    </div>
  );
};

export default FinancialsTab;