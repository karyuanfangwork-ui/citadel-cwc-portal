import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import creditService, {
  financialApi, trendApi, FinancialStatement, FinancialLineItem, FinancialStatus,
  FinancialStatementType, FinancialPeriod, CurrencyCode, FinancialRatio, TrendItem,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { useToast } from '../src/context/ToastContext';
import { FinancialRatioRadar, BalanceSheetComposition, RatioSparklines } from '../src/components/credit/FinancialCharts';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);

const formatDate = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_BADGE: Record<FinancialStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  REVIEWED: { bg: '#f59e0b20', text: '#d97706' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
};

const TYPE_LABELS: Record<FinancialStatementType, string> = {
  BS: 'Balance Sheet',
  PL: 'Profit & Loss',
  CF: 'Cash Flow',
};

type StatementTab = 'BS' | 'PL' | 'CF';

// CA Memo Phase 3 — Section 12: Auditor info + narrative commentary panel
const AuditorCommentaryPanel: React.FC<{
  statement: FinancialStatement;
  readOnly: boolean;
  onUpdated: (s: FinancialStatement) => void;
}> = ({ statement, readOnly, onUpdated }) => {
  const [form, setForm] = useState({
    auditorName: statement.auditorName ?? '',
    isQualified: statement.isQualified ?? false,
    qualificationNotes: statement.qualificationNotes ?? '',
    isDraftAccounts: statement.isDraftAccounts ?? false,
    commentarySalesProfitability: statement.commentarySalesProfitability ?? '',
    commentaryAssetMgmt: statement.commentaryAssetMgmt ?? '',
    commentaryDebtMgmt: statement.commentaryDebtMgmt ?? '',
    commentaryCashflow: statement.commentaryCashflow ?? '',
    commentaryConclusion: statement.commentaryConclusion ?? '',
  });
  const [saving, setSaving] = useState(false);
  const dirty = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    setForm({
      auditorName: statement.auditorName ?? '',
      isQualified: statement.isQualified ?? false,
      qualificationNotes: statement.qualificationNotes ?? '',
      isDraftAccounts: statement.isDraftAccounts ?? false,
      commentarySalesProfitability: statement.commentarySalesProfitability ?? '',
      commentaryAssetMgmt: statement.commentaryAssetMgmt ?? '',
      commentaryDebtMgmt: statement.commentaryDebtMgmt ?? '',
      commentaryCashflow: statement.commentaryCashflow ?? '',
      commentaryConclusion: statement.commentaryConclusion ?? '',
    });
  }, [statement.id, statement.updatedAt]);

  const update = (key: string, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    dirty.current.add(key);
  };

  const flush = async () => {
    if (readOnly || dirty.current.size === 0) return;
    setSaving(true);
    const payload: any = {};
    dirty.current.forEach(k => { payload[k] = (form as any)[k] ?? null; });
    try {
      const updated = await financialApi.updateStatement(statement.id, payload);
      onUpdated(updated);
      dirty.current.clear();
    } finally { setSaving(false); }
  };

  const COMMENTARY_FIELDS = [
    { key: 'commentarySalesProfitability', label: 'Sales & Profitability' },
    { key: 'commentaryAssetMgmt',          label: 'Asset Management' },
    { key: 'commentaryDebtMgmt',           label: 'Debt Management' },
    { key: 'commentaryCashflow',           label: 'Cashflow' },
    { key: 'commentaryConclusion',         label: 'Conclusion' },
  ];

  return (
    <div className="border border-border rounded-xl p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Section 12 — Auditor & Commentary</h3>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      {/* Auditor info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Auditor Name</label>
          {readOnly
            ? <span className="text-sm">{form.auditorName || '—'}</span>
            : <input className="border rounded px-2 py-1 text-sm w-full" value={form.auditorName} onChange={e => update('auditorName', e.target.value)} onBlur={flush} placeholder="e.g. Deloitte PLT" />}
        </div>
        <div className="flex gap-6 items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isQualified} disabled={readOnly} onChange={e => { update('isQualified', e.target.checked); flush(); }} />
            Qualified Opinion
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isDraftAccounts} disabled={readOnly} onChange={e => { update('isDraftAccounts', e.target.checked); flush(); }} />
            Draft Accounts
          </label>
        </div>
      </div>
      {(form.isQualified || form.qualificationNotes) && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Qualification Notes</label>
          {readOnly
            ? <p className="text-sm whitespace-pre-wrap">{form.qualificationNotes || '—'}</p>
            : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-16" value={form.qualificationNotes} onChange={e => update('qualificationNotes', e.target.value)} onBlur={flush} />}
        </div>
      )}

      {/* Commentary */}
      <div className="space-y-3">
        {COMMENTARY_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            {readOnly
              ? <p className="text-sm whitespace-pre-wrap text-gray-700">{(form as any)[key] || '—'}</p>
              : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={(form as any)[key]} onChange={e => update(key, e.target.value)} onBlur={flush} placeholder={`${label} commentary…`} />}
          </div>
        ))}
      </div>
    </div>
  );
};

const FinancialSpreading: React.FC = () => {
  const [searchParams] = useSearchParams();
  const borrowerProfileId = searchParams.get('borrowerProfileId') || '';
  const { user } = useAuth();
  const toast = useToast();

  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<FinancialStatement | null>(null);
  const [lineItems, setLineItems] = useState<FinancialLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<StatementTab>('BS');
  const [validation, setValidation] = useState<{ valid: boolean; difference: number; totalAssets: number; totalLiabilitiesEquity: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [ratios, setRatios] = useState<FinancialRatio[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [reviewComment, setReviewComment] = useState('');
  const [computedRatios, setComputedRatios] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<{
    statementType: FinancialStatementType;
    period: FinancialPeriod;
    fiscalYearEnd: string;
    currency: CurrencyCode;
  }>({ statementType: 'BS', period: 'ANNUAL', fiscalYearEnd: '', currency: 'MYR' });
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerType, setBorrowerType] = useState<string | null>(null);

  const canWrite = hasPermission(user, 'credit:write');
  const canReview = hasPermission(user, 'credit:approve');

  const fetchStatements = useCallback(async () => {
    if (!borrowerProfileId) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await financialApi.listStatements(borrowerProfileId);
      setStatements(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [borrowerProfileId]);

  const fetchBorrowerName = useCallback(async () => {
    if (!borrowerProfileId) return;
    try {
      const profile = await creditService.getBorrowerProfile(borrowerProfileId);
      setBorrowerName(profile.account?.name || (profile.contact ? `${profile.contact.firstName} ${profile.contact.lastName}` : 'Unnamed Borrower'));
      setBorrowerType(profile.borrowerType ?? null);
    } catch (e) { console.error(e); }
  }, [borrowerProfileId]);

  const fetchTrends = useCallback(async () => {
    if (!borrowerProfileId) return;
    try {
      const analysis = await trendApi.getTrends(borrowerProfileId);
      setTrends(analysis.trends || []);
    } catch (e) { console.error(e); }
  }, [borrowerProfileId]);

  useEffect(() => { fetchStatements(); fetchBorrowerName(); fetchTrends(); }, [fetchStatements, fetchBorrowerName, fetchTrends]);

  const fetchStatement = useCallback(async () => {
    if (!selectedId) return;
    try {
      const stmt = await financialApi.getStatement(selectedId);
      setSelectedStatement(stmt);
      const items = await financialApi.listLineItems(selectedId);
      setLineItems(items);
      setValidation(null);
      setComputedRatios(false);
      // Load ratios if they exist
      try {
        const r = await financialApi.listRatios(selectedId);
        setRatios(r);
        if (r.length > 0) setComputedRatios(true);
      } catch { setRatios([]); }
    } catch (e) { console.error(e); }
  }, [selectedId]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);

  const filteredStatements = statements.filter(s => s.statementType === activeTab);

  const handleSaveLineItems = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      const items = lineItems.map(li => ({
        lineKey: li.lineKey,
        lineLabel: li.lineLabel,
        amount: Number(li.amount),
        displayOrder: li.displayOrder,
        ...(li.id ? { id: li.id } : {}),
      }));
      await financialApi.upsertLineItems(selectedId, items);
      await fetchStatement();
      toast.success('Saved', 'Line items saved successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Save Failed', 'Could not save line items. Please try again.');
    } finally { setSaving(false); }
  };

  const handleLineItemChange = (idx: number, field: keyof FinancialLineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleAddLineItem = () => {
    if (!selectedStatement) return;
    setLineItems(prev => [
      ...prev,
      {
        financialStatementId: selectedStatement!.id,
        lineKey: '',
        lineLabel: '',
        amount: 0,
        displayOrder: prev.length + 1,
      },
    ]);
  };

  const handleValidateBS = async () => {
    if (!selectedId) return;
    try {
      setValidating(true);
      const result = await financialApi.validateBalanceSheet(selectedId);
      setValidation(result);
      toast.success('Validated', 'Balance sheet validation complete.');
    } catch (e) {
      console.error(e);
      toast.error('Validation Failed', 'Could not validate balance sheet. Please try again.');
    } finally { setValidating(false); }
  };

  const handleSubmitForReview = async () => {
    if (!selectedId) return;
    try {
      setSubmitting(true);
      await financialApi.submitForReview(selectedId);
      await fetchStatement();
      await fetchStatements();
      toast.success('Submitted', 'Statement submitted for review.');
    } catch (e) {
      console.error(e);
      toast.error('Submit Failed', 'Could not submit for review. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleReview = async () => {
    if (!selectedId) return;
    try {
      setSubmitting(true);
      await financialApi.reviewStatement(selectedId, { decision: reviewDecision, comment: reviewComment || undefined });
      setShowReviewDialog(false);
      setReviewComment('');
      await fetchStatement();
      await fetchStatements();
      toast.success('Reviewed', `Statement ${reviewDecision === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (e) {
      console.error(e);
      toast.error('Review Failed', 'Could not complete the review. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleComputeRatios = async () => {
    if (!selectedId) return;
    try {
      setSubmitting(true);
      const result = await financialApi.computeRatios(selectedId);
      setRatios(result);
      setComputedRatios(true);
      // Refresh trends after ratio computation
      fetchTrends();
      toast.success('Ratios Computed', 'Financial ratios have been calculated.');
    } catch (e) {
      console.error(e);
      toast.error('Compute Failed', 'Could not compute ratios. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleCreateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerProfileId) return;
    try {
      setCreating(true);
      await financialApi.createStatement(borrowerProfileId, newForm);
      setShowCreateDialog(false);
      setNewForm({ statementType: 'BS', period: 'ANNUAL', fiscalYearEnd: '', currency: 'MYR' });
      await fetchStatements();
      toast.success('Created', 'Financial statement created.');
    } catch (e) {
      console.error(e);
      toast.error('Create Failed', 'Could not create statement. Please try again.');
    } finally { setCreating(false); }
  };

  const handleDeleteStatement = async (id: string) => {
    if (!confirm('Delete this financial statement?')) return;
    try {
      await financialApi.deleteStatement(id);
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedStatement(null);
        setLineItems([]);
      }
      await fetchStatements();
      toast.success('Deleted', 'Financial statement deleted.');
    } catch (e) {
      console.error(e);
      toast.error('Delete Failed', 'Could not delete statement. Please try again.');
    }
  };

  if (borrowerProfileId && borrowerType === 'INDIVIDUAL') {
    return (
      <>
        <CreditNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '4rem 2rem' }}>
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--color-brand-300)' }}>person_off</span>
            <h2 className="text-xl font-black text-text-primary mb-2">Not Applicable</h2>
            <p className="text-text-secondary mb-6 max-w-sm mx-auto">Financial Spreading is only applicable to corporate borrowers. Individual borrowers do not require formal financial statements.</p>
            <Link to={`/credit/borrowers/${borrowerProfileId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Borrower
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!borrowerProfileId) {
    return (
      <>
        <CreditNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '4rem 2rem' }}>
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl block mb-4" style={{ color: 'var(--color-brand-300)' }}>table_chart</span>
            <h2 className="text-xl font-black text-text-primary mb-2">No Borrower Selected</h2>
            <p className="text-text-secondary mb-6 max-w-sm mx-auto">Financial statements are linked to a borrower profile. Select a borrower to view or enter their financials.</p>
            <Link to="/credit/borrowers"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">person_search</span>
              Go to Borrowers
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '2rem' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <Link to="/credit/borrowers" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Borrowers</Link>
          {borrowerProfileId && (
            <>
              <span>/</span>
              <Link to={`/credit/borrowers/${borrowerProfileId}`} style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">{borrowerName || borrowerProfileId.slice(0, 8)}</Link>
            </>
          )}
          <span>/</span>
          <span className="font-semibold text-text-primary">Financial Spreading</span>
        </div>

        <h1 className="text-2xl font-black text-text-primary mb-4">Financial Spreading</h1>

        {/* Statement type tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['BS', 'PL', 'CF'] as StatementTab[]).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSelectedId(null); setSelectedStatement(null); setLineItems([]); }}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white text-brand-700 border border-b-white border-border -mb-px'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              style={{ background: activeTab === tab ? '#fff' : 'none', border: activeTab === tab ? '1px solid var(--color-border)' : 'none', borderBottom: activeTab === tab ? '1px solid #fff' : 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {TYPE_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Left: Statement List */}
          <div className="w-72 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Statements</h2>
              {canWrite && borrowerProfileId && (
                <button onClick={() => setShowCreateDialog(true)}
                  className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-sm">add</span> New
                </button>
              )}
            </div>
            {filteredStatements.length === 0 ? (
              <div className="bg-bg-surface border border-border rounded-xl p-4 text-center text-text-secondary text-sm">
                <span className="material-symbols-outlined block text-2xl mb-1 opacity-30">description</span>
                No statements yet
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStatements.map(stmt => {
                  const badge = STATUS_BADGE[stmt.status];
                  const isSelected = stmt.id === selectedId;
                  return (
                    <div key={stmt.id}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                        isSelected ? 'border-brand-300 bg-brand-50' : 'border-border bg-bg-surface hover:border-brand-200'
                      }`}
                      onClick={() => { setSelectedId(stmt.id); }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                          {stmt.status}
                        </span>
                        <span className="text-xs text-text-secondary">{TYPE_LABELS[stmt.statementType]}</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary mt-1">
                        {formatDate(stmt.fiscalYearEnd)}
                      </p>
                      <p className="text-xs text-text-secondary">{stmt.period} · {stmt.currency}</p>
                      <div className="flex items-center justify-between mt-1">
                        {stmt.enteredBy && <span className="text-[10px] text-text-secondary">Entered: {stmt.enteredBy.firstName} {stmt.enteredBy.lastName}</span>}
                        {canWrite && stmt.status === 'DRAFT' && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteStatement(stmt.id); }}
                            className="text-red-400 hover:text-red-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Statement Detail */}
          <div className="flex-1 min-w-0">
            {!selectedStatement ? (
              <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">table_chart</span>
                <p className="font-semibold">Select a statement to begin</p>
                <p className="text-sm mt-1">Choose a financial statement from the list or create a new one</p>
              </div>
            ) : (
              <div>
                {/* Header with status & actions */}
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_BADGE[selectedStatement.status].bg, color: STATUS_BADGE[selectedStatement.status].text }}>
                      {selectedStatement.status}
                    </span>
                    <h2 className="text-lg font-bold text-text-primary">
                      {TYPE_LABELS[selectedStatement.statementType]} — {formatDate(selectedStatement.fiscalYearEnd)}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status flow actions */}
                    {selectedStatement.status === 'DRAFT' && canWrite && (
                      <button onClick={handleSubmitForReview} disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <span className="material-symbols-outlined text-base">send</span>
                        {submitting ? 'Submitting...' : 'Submit for Review'}
                      </button>
                    )}
                    {selectedStatement.status === 'REVIEWED' && canReview && (
                      <button onClick={() => setShowReviewDialog(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
                        style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <span className="material-symbols-outlined text-base">approval</span>
                        Review / Approve
                      </button>
                    )}
                    {selectedStatement.status === 'APPROVED' && (
                      <button onClick={handleComputeRatios} disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                        style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <span className="material-symbols-outlined text-base">calculate</span>
                        {submitting ? 'Computing...' : 'Compute Ratios'}
                      </button>
                    )}
                    {computedRatios && (
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">Ratios computed</span>
                    )}
                  </div>
                </div>

                {/* Maker-checker diff: when reviewed */}
                {selectedStatement.status === 'REVIEWED' && selectedStatement.enteredBy && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-amber-600 text-base">info</span>
                      <span className="text-sm font-bold text-amber-800">Pending Review</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      Entered by <span className="font-semibold">{selectedStatement.enteredBy.firstName} {selectedStatement.enteredBy.lastName}</span> ({selectedStatement.enteredBy.email})
                      {selectedStatement.reviewedBy && (
                        <> · Last reviewed by {selectedStatement.reviewedBy.firstName} {selectedStatement.reviewedBy.lastName}</>
                      )}
                    </p>
                  </div>
                )}

                {/* BS-specific: Validate button */}
                {selectedStatement.statementType === 'BS' && (
                  <div className="mb-4">
                    <button onClick={handleValidateBS} disabled={validating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <span className="material-symbols-outlined text-base">verified</span>
                      {validating ? 'Validating...' : 'Validate Balance Sheet'}
                    </button>
                    {validation && (
                      <div className={`mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                        validation.valid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className="material-symbols-outlined text-base">{validation.valid ? 'check_circle' : 'error'}</span>
                        {validation.valid
                          ? 'Balance sheet is balanced'
                          : `Difference: ${formatCurrency(Math.abs(validation.difference))} (Assets: ${formatCurrency(validation.totalAssets)}, L+E: ${formatCurrency(validation.totalLiabilitiesEquity)})`
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* CA Memo Phase 3 — Section 12: Auditor & Commentary */}
                <AuditorCommentaryPanel
                  statement={selectedStatement}
                  readOnly={selectedStatement.status !== 'DRAFT' || !canWrite}
                  onUpdated={(updated) => {
                    setSelectedStatement(updated);
                    setStatements(ss => ss.map(s => s.id === updated.id ? { ...s, ...updated } : s));
                  }}
                />

                {/* Financial Ratio Radar — shown when ratios exist */}
                {ratios.length > 0 && (
                  <div className="mb-4">
                    <FinancialRatioRadar ratios={ratios} />
                  </div>
                )}

                {/* Ratio Trend Sparklines — requires trend data from multiple statements */}
                {trends.length > 0 && (
                  <div className="mb-4">
                    <RatioSparklines trends={trends} />
                  </div>
                )}

                {/* Balance Sheet Composition — shown for BS statements */}
                {selectedStatement.statementType === 'BS' && lineItems.length > 0 && (
                  <div className="mb-4">
                    <BalanceSheetComposition lineItems={lineItems} validation={validation} />
                  </div>
                )}

                {/* Line Items Table */}
                <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Line Items</h3>
                    {canWrite && selectedStatement.status === 'DRAFT' && (
                      <button onClick={handleAddLineItem}
                        className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <span className="material-symbols-outlined text-sm">add</span> Add Row
                      </button>
                    )}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-muted)' }}>
                        {['#', 'Key', 'Label', 'Amount', 'Order'].map(h => (
                          <th key={h} style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-text-secondary text-sm">
                            <span className="material-symbols-outlined text-2xl block mb-1 opacity-30">table_rows</span>
                            No line items yet. Add rows to begin.
                          </td>
                        </tr>
                      ) : (
                        lineItems.map((li, idx) => (
                          <tr key={li.id || idx} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', width: 40 }}>{idx + 1}</td>
                            <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                              <input type="text" value={li.lineKey} disabled={selectedStatement.status !== 'DRAFT' || !canWrite}
                                onChange={e => handleLineItemChange(idx, 'lineKey', e.target.value)}
                                className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-200 disabled:bg-gray-50 disabled:opacity-70"
                                style={{ fontFamily: 'var(--font-sans)' }} />
                            </td>
                            <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                              <input type="text" value={li.lineLabel} disabled={selectedStatement.status !== 'DRAFT' || !canWrite}
                                onChange={e => handleLineItemChange(idx, 'lineLabel', e.target.value)}
                                className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-brand-200 disabled:bg-gray-50 disabled:opacity-70"
                                style={{ fontFamily: 'var(--font-sans)' }} />
                            </td>
                            <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                              <input type="number" value={Number(li.amount)} disabled={selectedStatement.status !== 'DRAFT' || !canWrite}
                                onChange={e => handleLineItemChange(idx, 'amount', Number(e.target.value))}
                                className="w-32 bg-transparent border border-border rounded px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-brand-200 disabled:bg-gray-50 disabled:opacity-70"
                                style={{ fontFamily: 'var(--font-sans)' }} />
                            </td>
                            <td style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                              <input type="number" value={Number(li.displayOrder)} disabled={selectedStatement.status !== 'DRAFT' || !canWrite}
                                onChange={e => handleLineItemChange(idx, 'displayOrder', Number(e.target.value))}
                                className="w-16 bg-transparent border border-border rounded px-2 py-1 text-sm text-center outline-none focus:ring-1 focus:ring-brand-200 disabled:bg-gray-50 disabled:opacity-70"
                                style={{ fontFamily: 'var(--font-sans)' }} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Save button */}
                {canWrite && selectedStatement.status === 'DRAFT' && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleSaveLineItems} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                      style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <span className="material-symbols-outlined text-base">save</span>
                      {saving ? 'Saving...' : 'Save Line Items'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Statement Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreateDialog(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">New Financial Statement</h2>
              <form onSubmit={handleCreateStatement} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Statement Type *</label>
                  <select required value={newForm.statementType} onChange={e => setNewForm(f => ({ ...f, statementType: e.target.value as FinancialStatementType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="BS">Balance Sheet</option>
                    <option value="PL">Profit & Loss</option>
                    <option value="CF">Cash Flow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Period *</label>
                  <select required value={newForm.period} onChange={e => setNewForm(f => ({ ...f, period: e.target.value as FinancialPeriod }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="ANNUAL">Annual</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Period Date *</label>
                  <input required type="date" value={newForm.fiscalYearEnd} onChange={e => setNewForm(f => ({ ...f, fiscalYearEnd: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency</label>
                  <select value={newForm.currency} onChange={e => setNewForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    {['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreateDialog(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={creating}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {creating ? 'Creating...' : 'Create Statement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Review Dialog */}
        {showReviewDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowReviewDialog(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">Review Statement</h2>
              {selectedStatement?.enteredBy && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                  <span className="font-semibold">Entered by:</span> {selectedStatement.enteredBy.firstName} {selectedStatement.enteredBy.lastName} ({selectedStatement.enteredBy.email})
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">Decision *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setReviewDecision('approve')}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        reviewDecision === 'approve' ? 'ring-2 ring-brand-300 bg-green-50 text-green-700 border-green-200' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Approve
                    </button>
                    <button onClick={() => setReviewDecision('reject')}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        reviewDecision === 'reject' ? 'ring-2 ring-brand-300 bg-red-50 text-red-700 border-red-200' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Reject
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Comment</label>
                  <textarea rows={3} value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    placeholder="Add review comments..."
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowReviewDialog(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button onClick={handleReview} disabled={submitting}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FinancialSpreading;