import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, ApplicationState, CreditProductType, Pagination,
  BorrowerProfile,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | string | null, currency = 'MYR') =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency as any, maximumFractionDigits: 0 }).format(Number(val)) : '—';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED: { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

const KANBAN_COLUMNS: { key: string; label: string; states: ApplicationState[]; color: string }[] = [
  { key: 'pre-submission', label: 'Pre-Submission', states: ['DRAFT'], color: '#6366f1' },
  { key: 'kyc', label: 'KYC', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED'], color: '#f59e0b' },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT'], color: '#8b5cf6' },
  { key: 'decision', label: 'Decision', states: ['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED'], color: '#f97316' },
  { key: 'post-decision', label: 'Post-Decision', states: ['OFFER', 'ACCEPTED'], color: '#06b6d4' },
  { key: 'active', label: 'Active', states: ['DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN'], color: '#22c55e' },
];

const PRODUCT_TYPES: { value: CreditProductType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' },
  { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
  { value: 'TRADE_FINANCE', label: 'Trade Finance' },
  { value: 'PROJECT_FINANCE', label: 'Project Finance' },
  { value: 'SYNDICATED', label: 'Syndicated' },
  { value: 'BRIDGE_LOAN', label: 'Bridge Loan' },
  { value: 'OVERDRAFT', label: 'Overdraft' },
  { value: 'LETTER_OF_CREDIT', label: 'Letter of Credit' },
  { value: 'BANK_GUARANTEE', label: 'Bank Guarantee' },
];

const PRODUCT_LABELS: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map(p => [p.value, p.label]));

const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

function getSLAInfo(createdAt: string, state: ApplicationState): { text: string; color: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const slaMap: Partial<Record<ApplicationState, number>> = {
    DRAFT: 7, SUBMITTED: 3, KYC_REVIEW: 5, UNDERWRITING: 7, CREDIT_ASSESSMENT: 5,
    COMMITTEE_REVIEW: 3, OFFER: 5, ACCEPTED: 3,
  };
  const limit = slaMap[state];
  if (!limit) return { text: `${days}d`, color: '#6b7280' };
  const remaining = limit - days;
  if (remaining <= 0) return { text: 'Overdue', color: '#dc2626' };
  if (remaining <= 1) return { text: `${remaining}d left`, color: '#ea580c' };
  return { text: `${remaining}d left`, color: '#16a34a' };
}

const CreditApplicationList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const borrowerFilter = searchParams.get('borrowerProfileId') || '';

  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CreditApplication>>({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
  const [saving, setSaving] = useState(false);
  const [borrowerProfiles, setBorrowerProfiles] = useState<BorrowerProfile[]>([]);

  const canWrite = hasPermission(user, 'credit:write');

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await creditService.listApplications({
        page: 1,
        limit: 200,
        search: search || undefined,
        productType: productFilter || undefined,
        state: stateFilter || undefined,
        borrowerProfileId: borrowerFilter || undefined,
      });
      setApplications(data.applications);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, productFilter, stateFilter, borrowerFilter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // Fetch borrower profiles when create modal opens
  useEffect(() => {
    if (showCreate && borrowerProfiles.length === 0) {
      creditService.listBorrowerProfiles({ limit: 200 }).then(res => setBorrowerProfiles(res.profiles)).catch(() => {});
    }
  }, [showCreate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = { ...form };
    if (['requestedAmount', 'requestedTenor'].some(k => k in payload)) {
      for (const k of ['requestedAmount', 'requestedTenor']) {
        if (payload[k] !== undefined && payload[k] !== null && payload[k] !== '') {
          payload[k] = Number(payload[k]);
          if (isNaN(payload[k])) delete payload[k];
        }
      }
    }
    if (borrowerFilter) payload.borrowerProfileId = borrowerFilter;
    try {
      setSaving(true);
      const newApp = await creditService.createApplication(payload);
      setShowCreate(false);
      setForm({ currency: 'MYR' as any, productType: 'TERM_LOAN' });
      // Navigate to the new application's Header tab for CA Memo entry
      navigate(`/credit/applications/${newApp.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Group by kanban column
  const grouped = KANBAN_COLUMNS.map(col => ({
    ...col,
    items: applications.filter(a => col.states.includes((a.state || a.status) as ApplicationState)),
  }));

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/credit" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span><span className="font-semibold text-text-primary">Applications</span>
            </div>
            <h1 className="text-2xl font-black text-text-primary">Credit Applications</h1>
          </div>
          {canWrite && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">add</span> New Application
            </button>
          )}
        </div>

        {/* borrower filter banner */}
        {borrowerFilter && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-lg">filter_alt</span>
            <span className="text-sm text-indigo-800">Filtered by borrower</span>
            <Link to="/credit/applications" className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800" style={{ textDecoration: 'none' }}>Clear filter</Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search applications..."
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Products</option>
            {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All States</option>
            {Object.entries(STATE_COLORS).map(([key]) => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {KANBAN_COLUMNS.map(col => (
              <div key={col.key}>
                <div className="text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider" style={{ color: col.color }}>{col.label}</div>
                {[1, 2].map(i => (
                  <div key={i} className="mb-3 p-4 bg-bg-surface border border-border rounded-xl" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <div style={{ height: 12, width: '70%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 12, width: '50%', background: 'var(--color-border)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" style={{ alignItems: 'flex-start' }}>
            {grouped.map(col => (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-bold text-text-secondary uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-1.5 py-0.5 rounded-full ml-auto">{col.items.length}</span>
                </div>
                <div className="space-y-3">
                  {col.items.length === 0 && (
                    <div className="text-center py-6 text-text-secondary bg-bg-surface border border-border rounded-xl border-dashed">
                      <span className="material-symbols-outlined text-2xl block opacity-20">inbox</span>
                    </div>
                  )}
                  {col.items.map(app => {
                    const state = (app.state || app.status) as ApplicationState;
                    const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
                    const sla = getSLAInfo(app.createdAt, state);
                    return (
                      <div key={app.id} onClick={() => navigate(`/credit/applications/${app.id}`)}
                        className="bg-bg-surface border border-border rounded-xl p-3.5 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
                        style={{ borderLeft: `3px solid ${col.color}` }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                            {state.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-semibold ml-auto" style={{ color: sla.color }}>{sla.text}</span>
                        </div>
                        <p className="text-sm font-bold text-text-primary truncate mb-0.5">
                          {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : PRODUCT_LABELS[app.productType || app.productName || ''] || '—'}
                        </p>
                        <p className="text-xs text-text-secondary truncate">{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName || '—'}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                          <span className="text-sm font-black text-text-primary">{formatCurrency(app.requestedAmount, app.currency)}</span>
                          {app.rm && <span className="text-[10px] text-text-secondary">RM: {app.rm.firstName}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-lg font-extrabold text-text-primary">New Credit Application</h2>
                <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Product Type *</label>
                    <select required value={form.productType || ''} onChange={e => setForm(f => ({ ...f, productType: e.target.value as CreditProductType }))}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                      {PRODUCT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Requested Amount *</label>
                      <input required type="number" min="0" value={form.requestedAmount ?? ''} onChange={e => setForm(f => ({ ...f, requestedAmount: Number(e.target.value) }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Currency *</label>
                      <select required value={form.currency || 'MYR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value as any }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">Tenure (months) *</label>
                      <input required type="number" min="1" value={form.requestedTenor ?? ''} onChange={e => setForm(f => ({ ...f, requestedTenor: Number(e.target.value) }))}
                        className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" />
                    </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Borrower *</label>
                    <select required value={form.borrowerProfileId || borrowerFilter || ''}
                      onChange={e => setForm(f => ({ ...f, borrowerProfileId: e.target.value }))}
                      disabled={!!borrowerFilter}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-text-secondary"
                      style={{ fontFamily: 'var(--font-sans)' }}>
                      <option value="">— Select borrower —</option>
                      {borrowerProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.account?.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : 'Unknown')} {bp.borrowerType === 'INDIVIDUAL' ? '(Individual)' : '(Corporate)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1">Purpose</label>
                    <textarea rows={3} value={form.purpose ?? ''} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none" style={{ fontFamily: 'var(--font-sans)' }} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {saving ? 'Creating...' : 'Create Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CreditApplicationList;