import React, { useEffect, useState, useCallback } from 'react';
import creditService, {
  CreditApplication,
  FinancialStatement,
  FinancialPeriod,
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

type LineItemRow = { lineKey: string; amount: number };
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

  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.lineKey} className="flex items-center gap-2 text-sm">
          <span className="w-56 text-gray-700 shrink-0">{item.lineKey}</span>
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
        .then(items => setLineItems(items.map(i => ({ lineKey: i.lineKey, amount: Number(i.amount) }))))
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
      // Save line items
      if (stmtId && lineItems.length > 0) {
        await financialApi.upsertLineItems(stmtId, lineItems.map((item, idx) => ({
          lineKey: item.lineKey,
          lineLabel: lineItemDefs.find(d => d.key === item.lineKey)?.label || item.lineKey,
          amount: item.amount,
          displayOrder: idx,
        })));
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-500">Total Assets:</span>
                  <span className="ml-2 font-bold">{(lineItems.find(i => i.lineKey === 'total_assets')?.amount || 0).toLocaleString('en-MY')}</span>
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
const FinancialsTab: React.FC<Props> = ({ application }) => {
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStatement, setEditStatement] = useState<FinancialStatement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineItemsMap, setLineItemsMap] = useState<Record<string, FinancialStatement['lineItems']>>({});
  const [ratiosMap, setRatiosMap] = useState<Record<string, FinancialStatement['ratios']>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

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

                          {/* Ratios */}
                          {ratios && ratios.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Computed Ratios</h4>
                              <div className="flex flex-wrap gap-2">
                                {ratios.map((r, rIdx) => (
                                  <span key={r.id || rIdx} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                                    {r.ratioLabel || r.ratioKey}: {r.value != null ? Number(r.value).toFixed(4) : '—'}
                                  </span>
                                ))}
                              </div>
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
                              >
                                Compute Ratios
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const plStmt = statements.find(s => s.statementType === 'PL');
              const bsStmt = statements.find(s => s.statementType === 'BS');
              const bsRatios = ratiosMap[bsStmt?.id || ''] || bsStmt?.ratios || [];
              const plRatios = ratiosMap[plStmt?.id || ''] || plStmt?.ratios || [];
              const allRatios = [...bsRatios, ...plRatios];
              const find = (key: string) => {
                const r = allRatios.find(r => (r.ratioKey || '').toUpperCase().includes(key.toUpperCase()));
                return r?.value ?? null;
              };
              const display = (v: string | number | null) => v != null ? String(v) : '—';
              return [
                { label: 'DSCR', value: display(find('DSCR')), desc: 'Debt Service Coverage Ratio', icon: 'shield' },
                { label: 'Current Ratio', value: display(find('CURRENT_RATIO') || find('CURRENT')), desc: 'Current Assets / Current Liabilities', icon: 'balance' },
                { label: 'Gearing', value: display(find('GEARING') || find('DEBT_EQUITY') || find('D_E')), desc: 'Total Debt / Total Equity', icon: 'trending_up' },
                { label: 'LTV', value: display(find('LTV') || find('LOAN_TO_VALUE')), desc: 'Loan-to-Value', icon: 'percent' },
              ].map(r => (
                <div key={r.label} className="bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-base text-gray-400">{r.icon}</span>
                    <div className="text-xs font-semibold text-gray-500">{r.label}</div>
                  </div>
                  <div className="text-xl font-black text-gray-900">{r.value}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{r.desc}</div>
                </div>
              ));
            })()}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Ratios are auto-calculated from financial statements when line items are complete.
            Click "Compute Ratios" on a Balance Sheet to generate them.
          </p>
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