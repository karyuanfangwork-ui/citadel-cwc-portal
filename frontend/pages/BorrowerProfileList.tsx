import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, { Pagination } from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { useScrollLock } from '../src/hooks/useScrollLock';

type BorrowerType = 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';
type RiskRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NR';
type AmlTier = 'LOW' | 'MEDIUM' | 'HIGH';

interface BorrowerProfileRow {
  id: string;
  borrowerType: BorrowerType;
  creditRiskRating: RiskRating | null;
  amlRiskTier: AmlTier | null;
  exposureLimit: string | number | null;
  totalExposure: string | number | null;
  isActive: boolean;
  createdAt: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
}

const formatCurrency = (val: string | number | null | undefined) => {
  if (val == null) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(num);
};
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const TYPE_BADGE: Record<BorrowerType, { bg: string; text: string }> = {
  CORPORATE: { bg: '#3b82f620', text: '#2563eb' },
  INDIVIDUAL: { bg: '#a855f720', text: '#7e22ce' },
  SOLE_PROPRIETOR: { bg: '#f59e0b20', text: '#d97706' },
};

const RATING_COLOR = (r: RiskRating | null) => {
  if (!r) return 'var(--color-text-tertiary)';
  if (['AAA', 'AA', 'A'].includes(r)) return '#16a34a';
  if (['BBB', 'BB'].includes(r)) return '#2563eb';
  if (['B', 'CCC'].includes(r)) return '#d97706';
  return '#dc2626';
};

const AML_BADGE: Record<AmlTier, { bg: string; text: string }> = {
  LOW: { bg: '#22c55e20', text: '#16a34a' },
  MEDIUM: { bg: '#f59e0b20', text: '#d97706' },
  HIGH: { bg: '#ef444420', text: '#dc2626' },
};

const displayName = (p: BorrowerProfileRow) => {
  if (p.account) return p.account.name;
  if (p.contact) return `${p.contact.firstName} ${p.contact.lastName}`.trim();
  return 'Unnamed Borrower';
};
const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
};

const BorrowerProfileList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountIdFilter = searchParams.get('accountId') || '';
  const [profiles, setProfiles] = useState<BorrowerProfileRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ borrowerType: 'CORPORATE' });
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission(user, 'credit:write');

  const fetchProfiles = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await creditService.listBorrowerProfiles({
        page,
        limit: 20,
        search: search || undefined,
        borrowerType: typeFilter || undefined,
        accountId: accountIdFilter || undefined,
      });
      setProfiles((data.profiles as unknown) as BorrowerProfileRow[]);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, accountIdFilter]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (['exposureLimit', 'annualIncome', 'netWorth'].includes(k)) {
        const n = Number(v);
        if (!isNaN(n)) payload[k] = n;
      } else {
        payload[k] = v;
      }
    }
    try {
      setSaving(true);
      await creditService.createBorrowerProfile(payload as any);
      setShowCreate(false);
      setForm({ borrowerType: 'CORPORATE' });
      fetchProfiles();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Lock body scroll when modal is open
  useScrollLock(showCreate);

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/credit" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span><span className="font-semibold text-text-primary">Borrower Profiles</span>
            </div>
            <h1 className="text-2xl font-black text-text-primary">Borrower Profiles</h1>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">person_add</span> New Borrower
            </button>
          )}
        </div>

        {accountIdFilter && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-lg">filter_alt</span>
            <span className="text-sm text-indigo-800">Filtered by account</span>
            <Link to={`/crm/accounts/${accountIdFilter}`} className="text-sm font-bold text-indigo-700 hover:text-indigo-900 underline" style={{ textDecoration: 'underline' }}>
              View Account
            </Link>
            <Link to="/credit/borrowers" className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800" style={{ textDecoration: 'none' }}>
              Clear filter
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search borrowers..."
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Types</option>
            <option value="CORPORATE">Corporate</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
          </select>
        </div>

        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Borrower', 'Type', 'Risk Rating', 'AML Tier', 'Exposure Limit', 'Total Exposure', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [0,1,2,3,4].map(i => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    {[200,80,80,80,100,100,60,80].map((w,j) => (
                      <td key={j} style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <div style={{ height: 12, width: w, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                )) : profiles.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-text-secondary">
                    <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">person</span>
                    <p className="font-bold">No borrower profiles yet</p>
                    <p className="text-sm mt-1">Create your first borrower profile to start credit processing</p>
                  </td></tr>
                ) : profiles.map(p => {
                  const name = displayName(p);
                  const typeBadge = TYPE_BADGE[p.borrowerType];
                  const amlBadge = p.amlRiskTier ? AML_BADGE[p.amlRiskTier] : null;
                  return (
                    <tr key={p.id} onClick={() => navigate(`/credit/borrowers/${p.id}`)}
                      style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 uppercase">
                            {initials(name)}
                          </div>
                          <div className="text-sm font-bold text-text-primary">{name}</div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: typeBadge.bg, color: typeBadge.text }}>
                          {p.borrowerType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 700, color: RATING_COLOR(p.creditRiskRating) }}>
                        {p.creditRiskRating ?? '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        {amlBadge ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: amlBadge.bg, color: amlBadge.text }}>
                            {p.amlRiskTier}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {formatCurrency(p.exposureLimit)}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {formatCurrency(p.totalExposure)}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.isActive ? '#22c55e20' : '#6b728020', color: p.isActive ? '#16a34a' : '#6b7280' }}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                        {formatDate(p.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-text-secondary">{pagination.total} borrowers total</span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => fetchProfiles(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === pagination.page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-gray-100'}`}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-lg font-extrabold text-text-primary">New Borrower Profile</h2>
                <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-text-primary mb-1">Borrower Type *</label>
                    <select value={form.borrowerType || 'CORPORATE'} onChange={e => setForm(prev => ({ ...prev, borrowerType: e.target.value }))}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200">
                      <option value="CORPORATE">Corporate</option>
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    {[
                      { key: 'accountId', label: 'CRM Account ID (corporate)' },
                      { key: 'contactId', label: 'CRM Contact ID (individual)' },
                      { key: 'creditRiskRating', label: 'Credit Risk Rating' },
                      { key: 'amlRiskTier', label: 'AML Risk Tier' },
                      { key: 'exposureLimit', label: 'Exposure Limit (MYR)', type: 'number' },
                      { key: 'annualIncome', label: 'Annual Income (MYR)', type: 'number' },
                      { key: 'netWorth', label: 'Net Worth (MYR)', type: 'number' },
                      { key: 'occupation', label: 'Occupation' },
                      { key: 'employer', label: 'Employer' },
                      { key: 'sourceOfWealth', label: 'Source of Wealth' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-semibold text-text-primary mb-1">{f.label}</label>
                        <input value={form[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          type={f.type || 'text'}
                          className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-text-primary mb-1">Purpose of Account</label>
                    <input value={form.purposeOfAccount || ''} onChange={e => setForm(prev => ({ ...prev, purposeOfAccount: e.target.value }))}
                      type="text"
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {saving ? 'Creating...' : 'Create Borrower'}
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

export default BorrowerProfileList;
