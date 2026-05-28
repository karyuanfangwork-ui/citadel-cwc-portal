import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import ConfirmDialog from '../src/components/ConfirmDialog';
import EmptyState from '../src/components/ui/EmptyState';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const CrmTerritoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [territory, setTerritory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Add Member Modal ──────
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [savingMember, setSavingMember] = useState(false);

  // ── Remove Member Dialog ──────
  const [removeMember, setRemoveMember] = useState<any>(null);
  const [showRemoveMember, setShowRemoveMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  // ── Add Quota Modal ──────
  const [showAddQuota, setShowAddQuota] = useState(false);
  const [quotaPeriod, setQuotaPeriod] = useState('');
  const [quotaType, setQuotaType] = useState('MONTHLY');
  const [quotaAmount, setQuotaAmount] = useState('');
  const [savingQuota, setSavingQuota] = useState(false);

  // ── Edit Territory Modal ──────
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStates, setEditStates] = useState('');
  const [editCountries, setEditCountries] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Toast ──────
  const [toast, setToast] = useState<string | null>(null);

  const fetchTerritory = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await crmService.getTerritory(id);
      setTerritory(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load territory');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTerritory(); }, [fetchTerritory]);

  // ── Edit Territory ──────
  const openEdit = () => {
    if (!territory) return;
    setEditName(territory.name || '');
    setEditDesc(territory.description || '');
    const regions = territory.regions as { states?: string[]; countries?: string[] } | null;
    setEditStates(regions?.states?.join(', ') || '');
    setEditCountries(regions?.countries?.join(', ') || '');
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      const regions: any = {};
      if (editStates.trim()) regions.states = editStates.split(',').map(s => s.trim()).filter(Boolean);
      if (editCountries.trim()) regions.countries = editCountries.split(',').map(c => c.trim()).filter(Boolean);
      await crmService.updateTerritory(id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        regions: Object.keys(regions).length > 0 ? regions : undefined,
      });
      setShowEdit(false);
      setToast('Territory updated');
      fetchTerritory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update territory');
    } finally {
      setSaving(false);
    }
  };

  // ── Add Member ──────
  const handleAddMember = async () => {
    if (!id || !memberUserId.trim()) return;
    try {
      setSavingMember(true);
      await crmService.addTerritoryMember(id, memberUserId.trim(), memberRole);
      setShowAddMember(false);
      setMemberUserId('');
      setMemberRole('MEMBER');
      setToast('Member added');
      fetchTerritory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add member');
    } finally {
      setSavingMember(false);
    }
  };

  // ── Remove Member ──────
  const handleRemoveMember = async () => {
    if (!id || !removeMember) return;
    try {
      setRemovingMember(true);
      await crmService.removeTerritoryMember(id, removeMember.userId);
      setShowRemoveMember(false);
      setRemoveMember(null);
      setToast('Member removed');
      fetchTerritory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  // ── Add Quota ──────
  const handleCreateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !quotaPeriod.trim() || !quotaAmount) return;
    try {
      setSavingQuota(true);
      await crmService.createQuota({
        territoryId: id,
        period: quotaPeriod,
        periodType: quotaType,
        targetAmount: Number(quotaAmount),
      });
      setShowAddQuota(false);
      setQuotaPeriod('');
      setQuotaAmount('');
      setToast('Quota created');
      fetchTerritory();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create quota');
    } finally {
      setSavingQuota(false);
    }
  };

  if (loading) return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto' }} className="px-4 sm:px-8 py-4 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </>
  );

  if (!territory) return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto' }} className="px-4 sm:px-8 py-4 sm:py-8">
        <EmptyState icon="error_outline" title="Territory not found" description="This territory may have been deactivated or doesn't exist." action={{ label: 'Back to Territories', onClick: () => navigate('/crm/territories') }} />
      </div>
    </>
  );

  const regions = territory.regions as { states?: string[]; countries?: string[] } | null;

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
          <Link to="/crm" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>CRM</Link>
          <span>/</span>
          <Link to="/crm/territories" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Territories</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary truncate max-w-[200px]">{territory.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-brand-600 text-xl">map</span>
              </div>
              <h1 className="text-2xl font-black text-text-primary">{territory.name}</h1>
            </div>
            {territory.description && <p className="text-sm text-text-secondary mt-1">{territory.description}</p>}
          </div>
          <button onClick={openEdit} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-text-secondary hover:bg-gray-100 rounded-lg transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-lg">edit</span> Edit
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {/* ── Regions Card ────── */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border bg-surface-muted">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-text-secondary text-lg">public</span>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Regions</h3>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-1">States</p>
                {regions?.states?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {regions.states.map(s => (
                      <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{s}</span>
                    ))}
                  </div>
                ) : <p className="text-sm text-text-tertiary">—</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-1">Countries</p>
                {regions?.countries?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {regions.countries.map(c => (
                      <span key={c} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">{c}</span>
                    ))}
                  </div>
                ) : <p className="text-sm text-text-tertiary">—</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-1">Leads</p>
                <p className="text-2xl font-black text-text-primary">{territory._count?.leads || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Members Card ────── */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border bg-surface-muted flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-text-secondary text-lg">group</span>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Members</h3>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-text-secondary">{territory.members?.length || 0}</span>
            </div>
            {hasPermission(user, 'crm:admin') && (
              <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <span className="material-symbols-outlined text-lg">person_add</span> Add
              </button>
            )}
          </div>
          {territory.members?.length > 0 ? (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                    {['NAME', 'EMAIL', 'ROLE', 'ACTIONS'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {territory.members.map((m: any) => (
                    <tr key={m.id} className="hover:bg-surface-subtle transition-colors">
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-brand-600 text-sm">person</span>
                          </div>
                          <span className="text-sm font-semibold text-text-primary">{m.user?.firstName} {m.user?.lastName}</span>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{m.user?.email || '—'}</td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.role === 'MANAGER' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-text-secondary'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        {hasPermission(user, 'crm:admin') && (
                          <button onClick={() => { setRemoveMember(m); setShowRemoveMember(true); }}
                            className="text-xs text-danger hover:text-red-700 font-semibold transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8">
              <EmptyState icon="group_off" title="No members yet" description="Add team members to this territory." action={hasPermission(user, 'crm:admin') ? { label: 'Add Member', onClick: () => setShowAddMember(true) } : undefined} />
            </div>
          )}
        </div>

        {/* ── Quotas Card ────── */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border bg-surface-muted flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-text-secondary text-lg">target</span>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Quotas</h3>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-text-secondary">{territory.quotas?.length || 0}</span>
            </div>
            {hasPermission(user, 'crm:admin') && (
              <button onClick={() => setShowAddQuota(true)} className="flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <span className="material-symbols-outlined text-lg">add</span> Add Quota
              </button>
            )}
          </div>
          {territory.quotas?.length > 0 ? (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                    {['PERIOD', 'TYPE', 'TARGET', 'CREATED'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {territory.quotas.map((q: any) => (
                    <tr key={q.id} className="hover:bg-surface-subtle transition-colors">
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{q.period}</td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${q.periodType === 'MONTHLY' ? 'bg-brand-50 text-brand-700' : q.periodType === 'QUARTERLY' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                          {q.periodType}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>RM {Number(q.targetAmount).toLocaleString()}</td>
                      <td style={{ padding: 'var(--space-4) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{formatDate(q.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8">
              <EmptyState icon="flag" title="No quotas set" description="Define sales targets for this territory." action={hasPermission(user, 'crm:admin') ? { label: 'Add Quota', onClick: () => setShowAddQuota(true) } : undefined} />
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Territory Modal ────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Territory</h2>
              <button onClick={() => setShowEdit(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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
                <button type="button" onClick={() => setShowEdit(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Member Modal ────── */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddMember(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Add Member</h2>
              <button onClick={() => setShowAddMember(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">User ID *</label>
                <input value={memberUserId} onChange={e => setMemberUserId(e.target.value)} placeholder="Enter user ID"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Role</label>
                <select value={memberRole} onChange={e => setMemberRole(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all cursor-pointer">
                  <option value="MEMBER">Member</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddMember(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={handleAddMember} disabled={savingMember || !memberUserId.trim()} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Member Dialog ────── */}
      <ConfirmDialog
        open={showRemoveMember}
        title="Remove Member"
        message={`Are you sure you want to remove ${removeMember?.user?.firstName} ${removeMember?.user?.lastName} from this territory?`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleRemoveMember}
        onCancel={() => { setShowRemoveMember(false); setRemoveMember(null); }}
        loading={removingMember}
      />

      {/* ── Add Quota Modal ────── */}
      {showAddQuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddQuota(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Add Quota</h2>
              <button onClick={() => setShowAddQuota(false)} className="text-text-secondary hover:text-text-primary transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateQuota} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Period *</label>
                <input value={quotaPeriod} onChange={e => setQuotaPeriod(e.target.value)} placeholder="e.g. 2026-Q1 or 2026-06"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Type</label>
                <select value={quotaType} onChange={e => setQuotaType(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all cursor-pointer">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Target Amount (MYR) *</label>
                <input type="number" value={quotaAmount} onChange={e => setQuotaAmount(e.target.value)} placeholder="e.g. 50000"
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddQuota(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100 transition-colors" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingQuota || !quotaPeriod.trim() || !quotaAmount} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingQuota ? 'Creating...' : 'Create Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default CrmTerritoryDetail;