import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import crmService, { CrmOpportunity, Pagination } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import StateBadge from '../src/components/ui/StateBadge';
import { STATUS_COLORS } from '../src/components/ui/StateBadge';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';

const formatCurrency = (val: number | null) => val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const winProbStyle = (prob: number) =>
  prob >= 70
    ? { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'trending_up' }
    : prob >= 40
    ? { bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'trending_flat' }
    : { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'trending_down' };

const CrmOpportunities = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter') || '';
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<CrmOpportunity>>({});
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string; stages?: { id: string; name: string; probability: number }[] }[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<CrmOpportunity | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CrmOpportunity | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchOpportunities = useCallback(async (page = 1) => {
    try { setLoading(true);
      const overdue = filterParam === 'overdue';
      const data = await crmService.listOpportunities({ page, limit: 20, search: search || undefined, pipelineId: (overdue ? '' : pipelineFilter) || undefined, stageId: (overdue ? '' : stageFilter) || undefined, overdue: overdue || undefined });
      setOpportunities(data.opportunities); setPagination(data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, pipelineFilter, stageFilter, filterParam]);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await crmService.listAccounts({ limit: 100 });
      setAccounts(data.accounts);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await crmService.listPipelines();
      setPipelines(data);
      if (data.length > 0 && !form.pipelineId) {
        setForm(prev => ({ ...prev, pipelineId: data[0].id, stageId: data[0].stages[0]?.id, probability: data[0].stages[0]?.probability ?? 0 }));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchOpportunities(); fetchAccounts(); fetchPipelines(); }, [fetchOpportunities, fetchAccounts, fetchPipelines]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === undefined || v === null) continue;
      if (k === 'value' || k === 'probability') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
      else payload[k] = v;
    }
    try { setSaving(true); await crmService.createOpportunity(payload); setShowCreate(false); setForm({}); fetchOpportunities(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const openEdit = async (opp: CrmOpportunity) => {
    setEditingItem(opp);
    setForm({
      name: opp.name ?? '',
      accountId: opp.accountId ?? '',
      pipelineId: opp.pipelineId ?? '',
      stageId: opp.stageId ?? '',
      value: opp.value ?? 0,
      probability: opp.probability ?? 0,
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.split('T')[0] : '',
      description: opp.description ?? '',
    });
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setSaving(true);
      const payload = cleanFormPayload(form as Record<string, any>, NUMERIC_KEYS.opportunity);
      await crmService.updateOpportunity(editingItem.id, payload);
      setShowEdit(false); setEditingItem(null); setForm({});
      fetchOpportunities();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await crmService.deleteOpportunity(deleteItem.id);
      setShowDelete(false);
      setDeleteItem(null);
      fetchOpportunities();
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700 transition-colors">CRM</Link>
            <span>/</span><span className="font-semibold text-text-primary">Opportunities</span>
          </div>
          <h1 className="text-2xl font-black text-text-primary">Opportunities</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <span className="material-symbols-outlined text-lg">add</span> New Opportunity
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities..."
            className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
        </div>
        {pipelines.length > 1 && (
          <select value={pipelineFilter} onChange={e => { setPipelineFilter(e.target.value); setStageFilter(''); }}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Pipelines</option>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
          <option value="">All Stages</option>
          {(pipelineFilter ? pipelines.filter(p => p.id === pipelineFilter) : pipelines).flatMap(p =>
            (p.stages || []).map(s => ({ id: s.id, name: s.name, pipelineName: p.name }))
          ).map(s => (
            <option key={s.id} value={s.id}>{pipelines.length > 1 && !pipelineFilter ? s.pipelineName + ' \u2013 ' + s.name : s.name}</option>
          ))}
        </select>
      </div>

      {/* Overdue filter badge */}
      {filterParam && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold" style={{
            background: filterParam === 'overdue' ? 'rgba(220,38,38,0.06)' : 'var(--color-surface-muted)',
            color: filterParam === 'overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
          }}>
            <span className="material-symbols-outlined text-sm">{filterParam === 'overdue' ? 'notifications_active' : 'filter_list'}</span>
            {filterParam === 'overdue' ? 'Overdue Deals (past expected close date)' : `Filtered: ${filterParam}`}
          </span>
          <button onClick={() => { searchParams.delete('filter'); setSearchParams(searchParams); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} className="text-sm hover:text-text-primary">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Opportunities Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-muted border-b border-border">
            <tr>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Opportunity</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Account</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Stage</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Value</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Probability</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Close Date</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3">Owner</th>
              <th className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? [0,1,2,3,4].map(i => (
              <tr key={i}><td colSpan={8} className="px-5 py-8"><div style={{ height: 14, width: '80%', background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td></tr>
            )) : opportunities.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-text-secondary">
                <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">folder_open</span>
                <p className="font-bold">No opportunities found</p>
                <p className="text-sm mt-1">{filterParam === 'overdue' ? 'No overdue deals — great work!' : 'Create your first opportunity to start tracking deals'}</p>
              </td></tr>
            ) : opportunities.map(opp => (
              <tr key={opp.id} onClick={() => navigate(`/crm/opportunities/${opp.id}`)} className="hover:bg-surface-hover cursor-pointer transition-colors">
                <td className="px-5 py-4">
                  <div className="text-sm font-bold text-text-primary">{opp.name}</div>
                  <div className="text-xs text-text-tertiary mt-0.5">{opp.contact?.firstName ? `${opp.contact.firstName} ${opp.contact.lastName}` : '—'}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="text-sm text-text-secondary">{opp.account?.name || '—'}</div>
                </td>
                <td className="px-5 py-4">
                  <StateBadge state={opp.stage?.name || '—'} size="sm" />
                </td>
                <td className="px-5 py-4">
                  <div className="text-sm font-bold text-brand-600">{formatCurrency(opp.value)}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden" style={{ minWidth: 60 }}>
                      <div className="h-full rounded-full" style={{ width: `${opp.probability}%`, background: STATUS_COLORS[opp.stage?.name?.toUpperCase()]?.text || 'var(--color-it-500)' }} />
                    </div>
                    <span className="text-xs font-bold text-text-secondary">{opp.probability}%</span>
                    {opp.aiWinProbability != null && (() => {
                      const ws = winProbStyle(opp.aiWinProbability);
                      return (
                        <span
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ml-2"
                          style={{ background: ws.bg, color: ws.text }}
                          title={`AI Win Probability: ${opp.aiWinProbability}%${opp.aiWinReason ? ' — ' + opp.aiWinReason : ''}`}
                        >
                          <span className="material-symbols-outlined text-sm">{ws.icon}</span>
                          AI {opp.aiWinProbability}%
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="text-sm text-text-secondary">{formatDate(opp.expectedCloseDate)}</div>
                </td>
                <td className="px-5 py-4">
                  {opp.owner ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-brand-600">{opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}</span>
                      </div>
                      <span className="text-sm text-text-secondary">{opp.owner.firstName}</span>
                    </div>
                  ) : '—'}
                </td>
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(opp); }}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Edit
                    </button>
                    {hasPermission(user, 'crm:delete') && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteItem(opp); setShowDelete(true); }}
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-1">
          {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchOpportunities(p)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === pagination.page ? 'bg-brand-700 text-white' : 'bg-transparent text-text-secondary hover:bg-surface-muted'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-extrabold text-text-primary">New Opportunity</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Opportunity Name *</label>
                <input value={(form as any).name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Account *</label>
                <select value={(form as any).accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Pipeline *</label>
                  <select value={(form as any).pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Pipeline</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Stage *</label>
                  <select value={(form as any).stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Stage</option>
                    {pipelines.find(p => p.id === form.pipelineId)?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Value (MYR)</label>
                  <input type="number" value={(form as any).value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Probability (%)</label>
                  <input type="number" min={0} max={100} value={(form as any).probability || 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Expected Close Date</label>
                <input type="date" value={(form as any).expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={(form as any).description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-surface-muted" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Creating...' : 'Create Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setEditingItem(null); setForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Opportunity</h2>
              <button onClick={() => { setShowEdit(false); setEditingItem(null); setForm({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Opportunity Name *</label>
                <input value={(form as any).name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Account *</label>
                <select value={(form as any).accountId || ''} onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))} required
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Pipeline *</label>
                  <select value={(form as any).pipelineId || ''} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); const firstStage = p?.stages?.[0]; setForm(prev => ({ ...prev, pipelineId: e.target.value, stageId: firstStage?.id, probability: firstStage?.probability ?? 0 })); }} required
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Pipeline</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Stage *</label>
                  <select value={(form as any).stageId || ''} onChange={e => { const selP = pipelines.find(p => p.id === form.pipelineId); const selS = selP?.stages?.find(s => s.id === e.target.value); setForm(prev => ({ ...prev, stageId: e.target.value, probability: selS?.probability ?? prev.probability ?? 0 })); }} required
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select Stage</option>
                    {pipelines.find(p => p.id === form.pipelineId)?.stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Value (MYR)</label>
                  <input type="number" value={(form as any).value || ''} onChange={e => setForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Probability (%)</label>
                  <input type="number" min={0} max={100} value={(form as any).probability ?? 0} onChange={e => setForm(prev => ({ ...prev, probability: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Expected Close Date</label>
                <input type="date" value={(form as any).expectedCloseDate || ''} onChange={e => setForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea value={(form as any).description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEdit(false); setEditingItem(null); setForm({}); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-surface-muted" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(false); setDeleteItem(null); }}
        loading={deleting}
      />
    </>
  );
};

export default CrmOpportunities;
