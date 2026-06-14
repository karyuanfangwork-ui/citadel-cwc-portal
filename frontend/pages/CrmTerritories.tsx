import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import CrmTableSkeleton from '../src/components/crm/CrmTableSkeleton';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const CrmTerritories = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [territories, setTerritories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Create Modal ──────
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStates, setNewStates] = useState('');
  const [newCountries, setNewCountries] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // ── Edit Modal ──────
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStates, setEditStates] = useState('');
  const [editCountries, setEditCountries] = useState('');

  // ── Delete Dialog ──────
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Toast ──────
  const [toast, setToast] = useState<string | null>(null);

  const fetchTerritories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await crmService.listTerritories(page, 20);
      setTerritories(result.territories);
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load territories');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchTerritories(); }, [fetchTerritories]);

  // ── Create ──────
  const openCreate = () => {
    setFormErrors([]);
    setNewName('');
    setNewDesc('');
    setNewStates('');
    setNewCountries('');
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!newName.trim()) errors.push('Name is required');
    if (errors.length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      const regions: any = {};
      if (newStates.trim()) regions.states = newStates.split(',').map(s => s.trim()).filter(Boolean);
      if (newCountries.trim()) regions.countries = newCountries.split(',').map(c => c.trim()).filter(Boolean);
      await crmService.createTerritory({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        regions: Object.keys(regions).length > 0 ? regions : undefined,
      });
      setShowCreate(false);
      setToast('Territory created successfully');
      fetchTerritories();
    } catch (err: any) {
      setFormErrors([err?.response?.data?.message || 'Failed to create territory']);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──────
  const openEdit = (t: any) => {
    setEditingItem(t);
    setEditName(t.name || '');
    setEditDesc(t.description || '');
    const regions = t.regions as { states?: string[]; countries?: string[] } | null;
    setEditStates(regions?.states?.join(', ') || '');
    setEditCountries(regions?.countries?.join(', ') || '');
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setSaving(true);
      const regions: any = {};
      if (editStates.trim()) regions.states = editStates.split(',').map(s => s.trim()).filter(Boolean);
      if (editCountries.trim()) regions.countries = editCountries.split(',').map(c => c.trim()).filter(Boolean);
      await crmService.updateTerritory(editingItem.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        regions: Object.keys(regions).length > 0 ? regions : undefined,
      });
      setShowEdit(false);
      setEditingItem(null);
      setToast('Territory updated');
      fetchTerritories();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update territory');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────
  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteTerritory(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      setToast('Territory deactivated');
      fetchTerritories();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to deactivate territory');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTerritories = territories.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    (t.regions?.states || []).some((s: string) => s.toLowerCase().includes(search.toLowerCase())) ||
    (t.regions?.countries || []).some((c: string) => c.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
          <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">Territories</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-black text-text-primary">Territories</h1>
          {hasPermission(user, 'crm:admin') && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-lg">add</span> New Territory
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search territories..."
              className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <span className="text-sm text-text-secondary">{total} territor{total === 1 ? 'y' : 'ies'} total</span>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['TERRITORY', 'REGIONS', 'MEMBERS', 'LEADS', 'CREATED', 'ACTIONS'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><CrmTableSkeleton rows={5} cols={6} /></td></tr>
                ) : filteredTerritories.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState
                      icon="map"
                      title={search ? 'No matching territories' : 'No territories yet'}
                      description={search ? 'Try adjusting your search terms' : 'Create your first territory to organize regions and assign team members.'}
                      action={search ? undefined : { label: 'New Territory', onClick: openCreate }}
                    />
                  </td></tr>
                ) : filteredTerritories.map((t: any) => {
                  const regions = t.regions as { states?: string[]; countries?: string[] } | null;
                  const regionParts: string[] = [];
                  if (regions?.states?.length) regionParts.push(`${regions.states.length} state${regions.states.length > 1 ? 's' : ''}`);
                  if (regions?.countries?.length) regionParts.push(`${regions.countries.length} countr${regions.countries.length > 1 ? 'ies' : 'y'}`);
                  return (
                    <tr key={t.id}
                      className="group cursor-pointer hover:bg-surface-subtle transition-colors"
                      onClick={() => navigate(`/crm/territories/${t.id}`)}>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-brand-600 text-lg">map</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text-primary hover:text-brand-700 transition-colors">{t.name}</div>
                            {t.description && <div className="text-xs text-text-tertiary truncate max-w-[200px]">{t.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {regionParts.length > 0 ? regionParts.join(' · ') : '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {t.members?.length || 0}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {t._count?.leads || 0}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                        {t.createdAt ? formatDate(t.createdAt) : '—'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="text-xs text-brand-700 hover:text-brand-900 font-semibold transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                          >
                            Edit
                          </button>
                          {hasPermission(user, 'crm:delete') && (
                            <button
                              onClick={() => { setDeleteItem(t); setShowDelete(true); }}
                              className="text-xs text-danger hover:text-red-700 font-semibold transition-colors"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                            >
                              <span className="material-symbols-outlined text-sm align-middle">delete</span>
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-sm text-text-secondary">{total} territor{total === 1 ? 'y' : 'ies'} total</span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button key={p} onClick={() => setPage(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-gray-100'}`}>{p}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setFormErrors([]); setShowCreate(false); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">New Territory</h2>
              <button onClick={() => { setFormErrors([]); setShowCreate(false); }} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
                  {formErrors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Central Region"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">States <span className="text-text-tertiary font-normal">(comma-separated)</span></label>
                <input value={newStates} onChange={e => setNewStates(e.target.value)} placeholder="Selangor, Kuala Lumpur, Johor"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Countries <span className="text-text-tertiary font-normal">(comma-separated)</span></label>
                <input value={newCountries} onChange={e => setNewCountries(e.target.value)} placeholder="MY, SG"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setFormErrors([]); setShowCreate(false); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Territory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────── */}
      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setEditingItem(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Territory</h2>
              <button onClick={() => { setShowEdit(false); setEditingItem(null); }} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">States <span className="text-text-tertiary font-normal">(comma-separated)</span></label>
                <input value={editStates} onChange={e => setEditStates(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Countries <span className="text-text-tertiary font-normal">(comma-separated)</span></label>
                <input value={editCountries} onChange={e => setEditCountries(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEdit(false); setEditingItem(null); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Dialog ────── */}
      <ConfirmDialog
        open={showDelete}
        title="Deactivate Territory"
        message={`Are you sure you want to deactivate "${deleteItem?.name}"? This action cannot be undone.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />

      {/* ── Toast ────── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-success/10 border border-success text-success text-sm font-semibold flex items-center gap-2 shadow-lg">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {toast}
        </div>
      )}
    </>
  );
};

export default CrmTerritories;