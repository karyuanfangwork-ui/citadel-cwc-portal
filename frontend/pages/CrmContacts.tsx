import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmContact, CrmUser, Pagination } from '../src/services/crm.service';
import BulkActionBar, { BulkAction } from '../src/components/crm/BulkActionBar';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateContact, ValidationError } from '../src/utils/crmValidation';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const isTodayDate = (d: string) => new Date(d).toDateString() === new Date().toDateString();
const isOverdueDate = (d: string) => new Date(d) < new Date(new Date().toDateString());

type ContactUrgencyBadge = { label: string; bg: string; text: string; icon: string } | null;

const getContactUrgencyBadge = (c: CrmContact): ContactUrgencyBadge => {
  if (!c.followUpDate) return null;
  if (isOverdueDate(c.followUpDate) && !isTodayDate(c.followUpDate))
    return { label: 'Overdue', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'error' };
  if (isTodayDate(c.followUpDate))
    return { label: 'Due Today', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'schedule' };
  return null;
};

const CrmContacts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmContact>>({});
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<CrmContact | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CrmContact | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Bulk Selection ──────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [showBulkOwnerSelect, setShowBulkOwnerSelect] = useState(false);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(contacts.map(c => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssignOwner = async (newOwnerId: string) => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.updateContact(id, { ownerId: newOwnerId } as unknown as Partial<CrmContact>); count++; } catch {}
    }
    setSelectedIds(new Set());
    setShowBulkOwnerSelect(false);
    setBulkProcessing(false);
    setBulkToast(`Assigned ${count} contact${count > 1 ? 's' : ''} to new owner`);
    fetchContacts();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedIds) {
      try { await crmService.deleteContact(id); count++; } catch {}
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkToast(`Deleted ${count} contact${count > 1 ? 's' : ''}`);
    fetchContacts();
    setTimeout(() => setBulkToast(null), 3000);
  };

  const bulkActions: BulkAction[] = hasPermission(user, 'crm:admin') ? [
    { label: 'Assign Owner', icon: 'person_add', onClick: async () => { setShowBulkOwnerSelect(true); } },
    { label: 'Delete', icon: 'delete', variant: 'danger', onClick: handleBulkDelete },
  ] : [];

  const checkDuplicateContact = async (field: 'email' | 'phone', value: string) => {
    if (!value.trim()) { setDuplicateWarning(null); return; }
    try {
      const data = await crmService.listContacts({ search: value.trim(), limit: 5 });
      const matches = data.contacts.filter(c =>
        field === 'email'
          ? c.email?.toLowerCase() === value.trim().toLowerCase()
          : c.phone?.replace(/\s/g, '') === value.trim().replace(/\s/g, '')
      );
      if (matches.length > 0) {
        setDuplicateWarning(
          `Possible duplicate: "${matches[0].firstName} ${matches[0].lastName}" already has this ${field}.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch { setDuplicateWarning(null); }
  };

  const fetchContacts = useCallback(async (page = 1) => {
    try { setLoading(true);
      const data = await crmService.listContacts({ page, limit: 20, search: search || undefined });
      setContacts(data.contacts); setPagination(data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search]);

  const openCreate = async () => {
    setFormErrors([]);
    try {
      const data = await crmService.listAccounts({ limit: 9999 });
      setAccounts(data.accounts.map(a => ({ id: a.id, name: a.name })));
    } catch (e) { console.error(e); }
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateContact(form);
    if (errors.length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === '' || v === undefined || v === null) continue;
        payload[k] = v;
      }
      await crmService.createContact(payload);
      setShowCreate(false); setForm({}); setDuplicateWarning(null);
      fetchContacts();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };
 
   const openEdit = async (c: CrmContact) => {
     setFormErrors([]);
     try {
       const data = await crmService.listAccounts({ limit: 9999 });
       setAccounts(data.accounts.map(a => ({ id: a.id, name: a.name })));
     } catch (e) { console.error(e); }
     setEditingItem(c);
     setForm({
       firstName: c.firstName ?? '',
       lastName: c.lastName ?? '',
       email: c.email ?? '',
       phone: c.phone ?? '',
       mobile: c.mobile ?? '',
       jobTitle: c.jobTitle ?? '',
       department: c.department ?? '',
       accountId: c.accountId ?? '',
       isPrimary: c.isPrimary ?? false,
     });
     setShowEdit(true);
   };
 
   const handleEdit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!editingItem) return;
     const errors = validateContact(form);
     if (errors.length > 0) { setFormErrors(errors); return; }
     try {
       setSaving(true);
       const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.contact);
       await crmService.updateContact(editingItem.id, payload);
       setShowEdit(false); setEditingItem(null); setForm({});
       fetchContacts();
     } catch (e) { console.error(e); }
     finally { setSaving(false); }
   };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteContact(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      fetchContacts();
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: selectedIds.size > 0 ? '80px' : 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700 transition-colors">CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Contacts</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">Contacts</h1>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
          style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <span className="material-symbols-outlined text-lg">add</span> New Contact
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
            className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-muted)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === contacts.length}
                    onChange={() => selectedIds.size === contacts.length ? clearSelection() : selectAll()}
                    className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                {['Name', 'Email', 'Phone', 'Job Title', 'Company', 'Primary', ''].map(h => (
                  <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><CrmTableSkeleton rows={5} cols={8} /></td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon="person" title="No contacts yet" description="Create your first contact to start building your client network." action={{ label: 'New Contact', onClick: () => openCreate() }} />
                </td></tr>
              ) : contacts.map(c => (
                <tr key={c.id}
                  className={selectedIds.has(c.id) ? 'bg-brand-50/50' : ''}
                  style={{ borderTop: '1px solid var(--color-border-subtle)', transition: 'background 0.12s' }}>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-brand-600">{c.firstName?.[0]}{c.lastName?.[0]}</span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-text-primary cursor-pointer hover:text-brand-700" onClick={() => navigate(`/crm/contacts/${c.id}`)}>{c.firstName} {c.lastName}</span>
                        {(() => {
                          const badge = getContactUrgencyBadge(c);
                          return badge ? (
                            <span
                              className="ml-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              <span className="material-symbols-outlined text-xs">{badge.icon}</span>
                              {badge.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{c.email || '\u2014'}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{c.phone || '\u2014'}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{c.jobTitle || '\u2014'}</td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    {c.account ? <span className="text-sm font-medium text-brand-700">{c.account.name}</span> : <span className="text-sm text-text-tertiary">\u2014</span>}
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    {c.isPrimary && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold"><span className="material-symbols-outlined text-xs">star</span>Primary</span>}
                  </td>
                  <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        Edit
                      </button>
                      {hasPermission(user, 'crm:delete') && (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteItem(c); setShowDelete(true); }}
                          className="text-xs font-semibold text-danger hover:text-red-700 transition-colors"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                          <span className="material-symbols-outlined text-sm align-middle">delete</span>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-text-secondary">{pagination.total} contacts</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => fetchContacts(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === pagination.page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-surface-muted'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => { setFormErrors([]); setShowCreate(false); setForm({}); setDuplicateWarning(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-black text-text-primary">New Contact</h2>
              <button onClick={() => { setFormErrors([]); setShowCreate(false); setForm({}); setDuplicateWarning(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-muted transition-colors"
                style={{ border: 'none', cursor: 'pointer', background: 'none' }}>
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 pt-4 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
                  <input required value={form.firstName ?? ''} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'firstName') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'firstName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'firstName')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label>
                  <input required value={form.lastName ?? ''} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'lastName') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'lastName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'lastName')?.message}</p>)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onBlur={e => checkDuplicateContact('email', e.target.value)}
                  className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'email') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                {formErrors.some(e => e.field === 'email') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'email')?.message}</p>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    onBlur={e => checkDuplicateContact('phone', e.target.value)}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'phone') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'phone') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'phone')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Mobile</label>
                  <input value={form.mobile ?? ''} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Job Title</label>
                  <input value={form.jobTitle ?? ''} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Department</label>
                  <input value={form.department ?? ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Account</label>
                <select value={form.accountId ?? ''} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPrimary" checked={form.isPrimary ?? false}
                  onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="w-4 h-4 rounded border-border accent-brand-700" />
                <label htmlFor="isPrimary" className="text-sm text-text-primary">Primary contact</label>
              </div>
              {duplicateWarning && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning rounded-lg text-sm text-warning">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                  <div className="flex-1">{duplicateWarning}</div>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    className="text-warning hover:text-warning shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowCreate(false); setForm({}); setDuplicateWarning(null); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-surface-muted transition-colors"
                  style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-black text-text-primary">Edit Contact</h2>
              <button onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-muted transition-colors"
                style={{ border: 'none', cursor: 'pointer', background: 'none' }}>
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 pt-4 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
                  <input required value={form.firstName ?? ''} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'firstName') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'firstName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'firstName')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label>
                  <input required value={form.lastName ?? ''} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'lastName') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'lastName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'lastName')?.message}</p>)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'email') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                {formErrors.some(e => e.field === 'email') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'email')?.message}</p>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={`w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400${formErrors.some(e => e.field === 'phone') ? ' !border-red-500 focus:!ring-red-200' : ''}`} style={{ fontFamily: 'var(--font-sans)' }} />
                  {formErrors.some(e => e.field === 'phone') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'phone')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Mobile</label>
                  <input value={form.mobile ?? ''} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Job Title</label>
                  <input value={form.jobTitle ?? ''} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Department</label>
                  <input value={form.department ?? ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Account</label>
                <select value={form.accountId ?? ''} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editIsPrimary" checked={form.isPrimary ?? false}
                  onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="w-4 h-4 rounded border-border accent-brand-700" />
                <label htmlFor="editIsPrimary" className="text-sm text-text-primary">Primary contact</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowEdit(false); setEditingItem(null); setForm({}); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-surface-muted transition-colors"
                  style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteItem ? `${deleteItem.firstName} ${deleteItem.lastName}` : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={contacts.length}
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

export default CrmContacts;