import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crmService, { CrmAccount, Pagination } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const formatCurrency = (val: number | null) => val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const CrmAccounts = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmAccount>>({});
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await crmService.listAccounts({ page, limit: 20, search: search || undefined, industry: industry || undefined });
      setAccounts(data.accounts); setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, industry]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clean form data: convert types, strip empty strings
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue; // skip empties
      if (k === 'annualRevenue') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
      else payload[k] = v;
    }
    try { setSaving(true); await crmService.createAccount(payload); setShowCreate(false); setForm({}); fetchAccounts(); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Accounts</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">Accounts</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <span className="material-symbols-outlined text-lg">add</span> New Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..."
            className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
        </div>
        <select value={industry} onChange={e => setIndustry(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
          <option value="">All Industries</option>
          {['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Construction', 'Real Estate', 'Legal', 'Other'].map(i => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-muted)' }}>
                {['Company', 'Industry', 'Contacts', 'Deals', 'Revenue', 'Owner', 'Created'].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? [0,1,2,3,4].map(i => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  {[200,100,60,60,100,120,80].map((w,j) => (
                    <td key={j} style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <div style={{ height: 12, width: w, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              )) : accounts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-secondary">
                  <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">business</span>
                  <p className="font-bold">No accounts yet</p>
                  <p className="text-sm mt-1">Create your first account to start tracking customers</p>
                </td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id} onClick={() => navigate(`/crm/accounts/${acc.id}`)}
                  style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-brand-600 text-lg">business</span>
                      </div>
                      <div>
                        <div>
                          <span className="text-sm font-bold text-text-primary">{acc.name}</span>
                        </div>
                        {acc.website && <div className="text-xs text-text-tertiary truncate max-w-[200px]">{acc.website}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{acc.industry || '—'}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{acc._count?.contacts || 0}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{acc._count?.opportunities || 0}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatCurrency(acc.annualRevenue)}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{acc.owner ? `${acc.owner.firstName} ${acc.owner.lastName}` : '—'}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{formatDate(acc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-text-secondary">{pagination.total} accounts total</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => fetchAccounts(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
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
              <h2 className="text-lg font-extrabold text-text-primary">New Account</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {[
                { key: 'name', label: 'Company Name *', required: true },
                { key: 'registrationNumber', label: 'Registration No. (SSM)' },
                { key: 'taxNumber', label: 'Tax No. (GST/SST)' },
                { key: 'industry', label: 'Industry' },
                { key: 'companySize', label: 'Company Size' },
                { key: 'website', label: 'Website' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone' },
                { key: 'annualRevenue', label: 'Annual Revenue (MYR)', type: 'number' },
                { key: 'bankAccount', label: 'Bank Account' },
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
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Account'}
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

export default CrmAccounts;
