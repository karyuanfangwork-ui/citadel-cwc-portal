import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, { BorrowerProfile, BorrowerProfileStatus, Pagination } from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_BADGE: Record<BorrowerProfileStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  PENDING_REVIEW: { bg: '#f59e0b20', text: '#d97706' },
  UNDER_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  SUSPENDED: { bg: '#6b728020', text: '#6b7280' },
};

const BorrowerProfileList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountIdFilter = searchParams.get('accountId') || '';
  const [profiles, setProfiles] = useState<BorrowerProfile[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<BorrowerProfile>>({});
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission(user, 'credit:write');

  const fetchProfiles = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await creditService.listBorrowerProfiles({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        accountId: accountIdFilter || undefined,
      });
      setProfiles(data.profiles);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, accountIdFilter]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (['monthlyIncome', 'totalAssets', 'totalLiabilities'].includes(k)) {
        payload[k] = Number(v);
        if (isNaN(payload[k])) delete payload[k];
      } else {
        payload[k] = v;
      }
    }
    try {
      setSaving(true);
      await creditService.createBorrowerProfile(payload);
      setShowCreate(false);
      setForm({});
      fetchProfiles();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
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

        {/* Account filter banner (deep-link from CrmAccount) */}
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

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search borrowers..."
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_BADGE).map(([key]) => (
              <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Borrower', 'Account', 'Status', 'Income', 'Credit Score', 'Documents', 'Applications', 'Created'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [0,1,2,3,4].map(i => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    {[200,120,80,80,80,60,80,80].map((w,j) => (
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
                  const badge = STATUS_BADGE[p.status];
                  return (
                    <tr key={p.id} onClick={() => navigate(`/credit/borrowers/${p.id}`)}
                      style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                            {p.firstName[0]}{p.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text-primary">{p.firstName} {p.lastName}</div>
                            {p.email && <div className="text-xs text-text-tertiary truncate max-w-[180px]">{p.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {p.account ? p.account.name : '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {formatCurrency(p.monthlyIncome)}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: p.creditScore && p.creditScore >= 700 ? '#16a34a' : p.creditScore && p.creditScore < 500 ? '#dc2626' : 'var(--color-text-primary)' }}>
                        {p.creditScore ?? '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {p._count?.documents ?? 0}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {p._count?.applications ?? 0}
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
          {/* Pagination */}
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

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-extrabold text-text-primary">New Borrower Profile</h2>
                <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {[
                  { key: 'firstName', label: 'First Name *', required: true },
                  { key: 'lastName', label: 'Last Name *', required: true },
                  { key: 'nricPassport', label: 'NRIC / Passport No.' },
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'accountId', label: 'Account ID' },
                  { key: 'occupation', label: 'Occupation' },
                  { key: 'employerName', label: 'Employer Name' },
                  { key: 'monthlyIncome', label: 'Monthly Income (MYR)', type: 'number' },
                  { key: 'totalAssets', label: 'Total Assets (MYR)', type: 'number' },
                  { key: 'totalLiabilities', label: 'Total Liabilities (MYR)', type: 'number' },
                  { key: 'nationality', label: 'Nationality' },
                  { key: 'address', label: 'Address' },
                  { key: 'city', label: 'City' },
                  { key: 'state', label: 'State' },
                  { key: 'postalCode', label: 'Postcode' },
                  { key: 'country', label: 'Country' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-semibold text-text-primary mb-1">{f.label}</label>
                    <input value={(form as any)[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      required={f.required} type={f.type || 'text'}
                      className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Notes</label>
                  <textarea value={form.notes || ''} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
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