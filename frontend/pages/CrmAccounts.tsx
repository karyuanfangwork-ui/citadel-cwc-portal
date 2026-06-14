import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmAccount, CrmUser, Pagination } from '../src/services/crm.service';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateAccount, ValidationError } from '../src/utils/crmValidation';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const formatCurrency = (val: number | null) => val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Helper: safely read a form field as string for input value
const formVal = (form: Partial<CrmAccount>, key: string): string => {
  const v = form[key as keyof CrmAccount];
  return v == null ? '' : String(v);
};

const CrmAccounts = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmAccount>>({});
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<CrmAccount | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CrmAccount | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Bulk Selection ──────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [showBulkOwnerSelect, setShowBulkOwnerSelect] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);

  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(accounts.map(a => a.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssignOwner = async (newOwnerId: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.updateAccount(id, { ownerId: newOwnerId }); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkOwnerSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Assigned ${count} account${count > 1 ? 's' : ''} to new owner`);
    fetchAccounts();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.deleteAccount(id); count++; } catch {}
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkToast(`Deleted ${count} account${count > 1 ? 's' : ''}`);
    fetchAccounts();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const bulkActions: BulkAction[] = ([
    { label: 'Assign Owner', icon: 'person_add', onClick: async () => { setShowBulkOwnerSelect(true); }, permission: 'crm:admin' },
    { label: 'Delete', icon: 'delete', variant: 'danger' as const, onClick: handleBulkDelete, permission: 'crm:delete' },
  ] as Array<BulkAction & { permission: string }>).filter(a => hasPermission(user, a.permission));

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
    const errors = validateAccount(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
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

  const openEdit = (acc: CrmAccount) => {
    setFormErrors([]);
    setEditingItem(acc);
    setForm({
      name: acc.name,
      registrationNumber: acc.registrationNumber || '',
      taxNumber: acc.taxNumber || '',
      industry: acc.industry || '',
      companySize: acc.companySize || '',
      website: acc.website || '',
      email: acc.email || '',
      phone: acc.phone || '',
      annualRevenue: acc.annualRevenue ?? undefined,
      bankAccount: acc.bankAccount || '',
      address: acc.address || '',
      city: acc.city || '',
      state: acc.state || '',
      postalCode: acc.postalCode || '',
      country: acc.country || '',
      description: acc.description || '',
    });
    setShowEdit(true);
  };

  const closeEdit = () => {
    setFormErrors([]);
    setShowEdit(false);
    setEditingItem(null);
    setForm({});
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const errors = validateAccount(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.account);
    try {
      setSaving(true);
      await crmService.updateAccount(editingItem.id, payload);
      closeEdit();
      fetchAccounts();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteAccount(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      fetchAccounts();
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: selectedIds.size > 0 ? '80px' : 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Accounts</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">Accounts</h1>
        </div>
        <button onClick={() => { setFormErrors([]); setShowCreate(true); }} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
                <th style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === accounts.length}
                    onChange={() => selectedIds.size === accounts.length ? clearSelection() : selectAll()}
                    className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                {['Company', 'Industry', 'Contacts', 'Deals', 'Revenue', 'Owner', 'Created'].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><CrmTableSkeleton rows={5} cols={8} /></td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon="business" title="No accounts yet" description="Create your first account to start managing client organizations." action={{ label: 'New Account', onClick: () => setShowCreate(true) }} />
                </td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id}
                  style={{ borderTop: '1px solid var(--color-border-subtle)', transition: 'background 0.12s', background: selectedIds.has(acc.id) ? 'var(--color-brand-50, rgba(234,88,12,0.05))' : 'transparent' }}
                  onMouseEnter={e => { if (!selectedIds.has(acc.id)) e.currentTarget.style.background = 'var(--color-surface-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedIds.has(acc.id) ? 'var(--color-brand-50, rgba(234,88,12,0.05))' : 'transparent'; }}>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(acc.id)}
                      onChange={() => toggleSelect(acc.id)}
                      className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-brand-600 text-lg">business</span>
                      </div>
                      <div>
                        <div>
                          <span className="text-sm font-bold text-text-primary cursor-pointer hover:text-brand-700" onClick={() => navigate(`/crm/accounts/${acc.id}`)}>{acc.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(acc); }}
                            className="ml-2 text-xs text-brand-700 hover:text-brand-900 font-semibold transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                          >
                            Edit
                          </button>
                          {hasPermission(user, 'crm:delete') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteItem(acc); setShowDelete(true); }}
                              className="ml-2 text-xs text-danger hover:text-red-700 font-semibold transition-colors"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                            >
                              <span className="material-symbols-outlined text-sm align-middle">delete</span>
                              Delete
                            </button>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowCreate(false); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">New Account</h2>
              <button onClick={() => { setFormErrors([]); setShowCreate(false); }} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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
                  <input value={formVal(form, f.key)} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    required={f.required} type={f.type || 'text'}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === f.key) ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === f.key) && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === f.key)?.message}</p>)}
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowCreate(false); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeEdit}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Account</h2>
              <button onClick={closeEdit} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
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
                  <input value={formVal(form, f.key)} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    required={f.required} type={f.type || 'text'}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === f.key) ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === f.key) && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === f.key)?.message}</p>)}
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeEdit} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={accounts.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        actions={bulkActions}
        loading={bulkProcessing}
      />

      {/* Bulk owner select dropdown */}
      {showBulkOwnerSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowBulkOwnerSelect(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Assign Owner</h3>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkAssignOwner(e.target.value); }}
            >
              <option value="" disabled>Select new owner</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <button onClick={() => setShowBulkOwnerSelect(false)} className="mt-4 w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk toast */}
      {bulkToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-success/10 border border-success text-success text-sm font-semibold flex items-center gap-2 shadow-lg">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {bulkToast}
        </div>
      )}
    </>
  );
};

export default CrmAccounts;
