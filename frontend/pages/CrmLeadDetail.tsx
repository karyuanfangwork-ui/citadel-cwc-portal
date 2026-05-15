import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmLead, CrmUser, CrmPipeline, CrmActivity, CrmNote, CrmActivityType } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#eff6ff', text: '#2563eb' },
  CONTACTED: { bg: '#fefce8', text: '#ca8a04' },
  QUALIFIED: { bg: '#f0fdf4', text: '#16a34a' },
  UNQUALIFIED: { bg: '#f5f5f5', text: '#737373' },
  CONVERTED: { bg: '#faf5ff', text: '#7c3aed' },
  LOST: { bg: '#fef2f2', text: '#dc2626' },
};

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

const CrmLeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConvert, setShowConvert] = useState(false);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [convertForm, setConvertForm] = useState({ pipelineId: '', stageId: '', oppName: '', oppValue: '' });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes'>('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [noteContent, setNoteContent] = useState('');
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [editingOwner, setEditingOwner] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // Fetch CRM team users for owner reassignment
  useEffect(() => {
    crmService.listCrmUsers().then(setCrmUsers).catch(() => {});
  }, []);

  const reload = () => {
    if (!id) return;
    crmService.getLead(id)
      .then(setLead)
      .catch(() => navigate('/crm/leads'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); reload(); }, [id]);

  const openConvert = async () => {
    try {
      const pl = await crmService.listPipelines();
      setPipelines(pl);
      if (pl.length > 0) {
        const defaultPipeline = pl.find(p => p.isDefault) ?? pl[0];
        const firstStage = defaultPipeline.stages?.[0];
        setConvertForm({ pipelineId: defaultPipeline.id, stageId: firstStage?.id ?? '', oppName: lead?.title ?? '', oppValue: String(lead?.estimatedValue ?? '') });
      }
    } catch (e) { console.error(e); }
    setShowConvert(true);
  };

  const selectedPipeline = pipelines.find(p => p.id === convertForm.pipelineId);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      const opp = await crmService.convertLead(id, {
        pipelineId: convertForm.pipelineId,
        stageId: convertForm.stageId,
        opportunityName: convertForm.oppName,
        value: convertForm.oppValue ? Number(convertForm.oppValue) : undefined,
      });
      navigate(`/crm/opportunities/${opp.id}`);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      await crmService.createActivity({ ...activityForm, leadId: id });
      setShowAddActivity(false);
      setActivityForm({ activityType: 'CALL' });
      reload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !noteContent.trim()) return;
    try {
      setSaving(true);
      await crmService.createNote({ content: noteContent, leadId: id });
      setShowAddNote(false);
      setNoteContent('');
      reload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleMarkLost = async () => {
    if (!id) return;
    const reason = prompt('Enter lost reason (optional):');
    if (reason === null) return; // cancelled
    try {
      await crmService.updateLead(id, { status: 'LOST' as any, lostReason: reason || undefined });
      reload();
    } catch (e) { console.error(e); }
  };

  const handleChangeOwner = async (newOwnerId: string) => {
    if (!id || !newOwnerId) return;
    try {
      setSavingOwner(true);
      await crmService.updateLead(id, { ownerId: newOwnerId });
      setEditingOwner(false);
      reload();
    } catch (e) { console.error(e); }
    finally { setSavingOwner(false); }
  };

  const openEdit = () => {
    if (!lead) return;
    setEditForm({
      title: lead.title ?? '',
      contactName: lead.contactName ?? '',
      contactEmail: lead.contactEmail ?? '',
      contactPhone: lead.contactPhone ?? '',
      companyName: lead.companyName ?? '',
      source: lead.source ?? 'OTHER',
      estimatedValue: lead.estimatedValue ?? '',
      description: lead.description ?? '',
      followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
      followUpNote: lead.followUpNote ?? '',
    });
    setShowEdit(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(editForm)) {
        if (v === '' || v === undefined || v === null) continue;
        if (k === 'estimatedValue') { payload[k] = Number(v); if (isNaN(payload[k])) delete payload[k]; }
        else payload[k] = v;
      }
      // Clear fields intentionally set to empty
      for (const k of ['contactName', 'contactEmail', 'contactPhone', 'companyName', 'description', 'followUpNote']) {
        if (editForm[k] === '' && (lead as any)[k] != null) payload[k] = null;
      }
      if (editForm.followUpDate === '' && lead!.followUpDate) payload.followUpDate = null;
      await crmService.updateLead(id, payload);
      setShowEdit(false);
      reload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // Type guard for activities/notes - backend returns them when included
  const activities = (lead as any)?.activities ?? [];
  const notes = (lead as any)?.notes ?? [];

  if (loading) return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 18, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  if (!lead) return null;

  const statusStyle = STATUS_COLORS[lead.status] ?? { bg: '#f5f5f5', text: '#737373' };
  const isConverted = lead.status === 'CONVERTED';
  const isLost = lead.status === 'LOST';

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">CRM</Link>
        <span>/</span>
        <Link to="/crm/leads" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Leads</Link>
        <span>/</span>
        <span className="font-semibold text-text-primary">{lead.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-text-primary">{lead.title}</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.text }}>{lead.status}</span>
          </div>
          <p className="text-text-secondary text-sm">{lead.companyName || ''}{lead.contactName ? ` · ${lead.contactName}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openEdit}
            className="flex items-center gap-2 border border-brand-200 text-brand-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-50 transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">edit</span> Edit
          </button>
          {!isConverted && !isLost && (
            <button onClick={openConvert}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">swap_horiz</span> Convert to Opportunity
            </button>
          )}
          {!isConverted && !isLost && (
            <button onClick={handleMarkLost}
              className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
              style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">cancel</span> Mark Lost
            </button>
          )}
          {isConverted && lead.convertedToOppId && (
            <Link to={`/crm/opportunities/${lead.convertedToOppId}`}
              className="flex items-center gap-2 text-sm font-semibold text-brand-700 border border-brand-200 px-4 py-2 rounded-lg hover:bg-brand-50"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">open_in_new</span> View Opportunity
            </Link>
          )}
          <button onClick={() => setShowAddActivity(true)}
            className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">add</span> Log Activity
          </button>
          <button onClick={() => setShowAddNote(true)}
            className="flex items-center gap-2 border border-border px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">sticky_note_2</span> Add Note
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {(['overview', 'activities', 'notes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Lead Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {[
              { label: 'Status', value: lead.status, icon: 'flag', highlight: true },
              { label: 'Source', value: lead.source ?? '—', icon: 'source' },
              { label: 'Company', value: lead.companyName ?? '—', icon: 'business', link: lead.account ? { to: `/crm/accounts/${lead.account.id}`, text: lead.account.name } : null },
              { label: 'Account', value: lead.account ? lead.account.name : '—', icon: 'apartment', link: lead.account ? { to: `/crm/accounts/${lead.account.id}`, text: lead.account.name } : null },
              { label: 'Contact', value: lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : (lead.contactName ?? '—'), icon: 'person', link: lead.contact ? { to: `/crm/contacts/${lead.contact.id}`, text: `${lead.contact.firstName} ${lead.contact.lastName}` } : null },
              { label: 'Email', value: lead.contactEmail ?? (lead.contact?.email ?? '—'), icon: 'mail' },
              { label: 'Phone', value: lead.contactPhone ?? (lead.contact?.phone ?? '—'), icon: 'call' },
              { label: 'Estimated Value', value: formatCurrency(lead.estimatedValue), icon: 'payments' },
              { label: 'Owner', value: lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}` : '—', icon: 'manage_accounts', editable: true },
              { label: 'Follow-up Date', value: lead.followUpDate ? formatDate(lead.followUpDate) : '—', icon: 'event' },
              { label: 'Created', value: formatDate(lead.createdAt), icon: 'calendar_today' },
              { label: 'Converted At', value: lead.convertedAt ? formatDate(lead.convertedAt) : '—', icon: 'check_circle' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
                {(f as any).editable && editingOwner ? (
                  <select
                    value={lead.owner?.id || ''}
                    onChange={e => handleChangeOwner(e.target.value)}
                    disabled={savingOwner}
                    className="flex-1 px-3 py-1 border border-brand-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-200 outline-none"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {crmUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                ) : (f as any).link ? (
                  <Link to={(f as any).link.to} className="text-sm text-brand-700 hover:text-brand-800 font-semibold transition-colors">
                    {(f as any).link.text}
                  </Link>
                ) : (
                  <span className={`text-sm${(f as any).highlight ? ' font-bold' : ''} ${f.value === '—' ? 'text-text-secondary' : 'text-text-primary'}${(f as any).editable ? ' cursor-pointer hover:text-brand-700 transition-colors' : ''}`}
                    {...((f as any).editable ? { onClick: () => setEditingOwner(true) } : {})}
                  >
                    {f.value}
                    {(f as any).editable && (
                      <span className="material-symbols-outlined text-sm ml-1 align-text-bottom text-text-secondary">edit</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
          {lead.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-text-secondary mb-1">Description</p>
              <p className="text-sm text-text-primary leading-relaxed">{lead.description}</p>
            </div>
          )}
          {lead.followUpNote && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-text-secondary mb-1">Follow-up Note</p>
              <p className="text-sm text-text-primary leading-relaxed">{lead.followUpNote}</p>
            </div>
          )}
          {lead.lostReason && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-red-500 mb-1">Lost Reason</p>
              <p className="text-sm text-text-primary">{lead.lostReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Activities tab */}
      {activeTab === 'activities' && (
        <div className="space-y-3">
          {activities.length === 0 && <p className="text-text-secondary text-sm">No activities yet. Click "Log Activity" to add one.</p>}
          {activities.map((a: CrmActivity) => (
            <div key={a.id} className="flex gap-4 bg-bg-surface border border-border rounded-xl p-4">
              <span className="material-symbols-outlined text-brand-700 mt-0.5">{ACTIVITY_ICONS[a.activityType] || 'event'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{a.subject}</p>
                {a.description && <p className="text-xs text-text-secondary mt-0.5">{a.description}</p>}
                <p className="text-xs text-text-secondary mt-1">
                  {a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                  {a.scheduledAt && <span className="ml-2 text-brand-600">Scheduled: {formatDate(a.scheduledAt)}</span>}
                </p>
              </div>
              <span className="text-xs text-text-secondary shrink-0">{a.activityType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {notes.length === 0 && <p className="text-text-secondary text-sm">No notes yet. Click "Add Note" to add one.</p>}
          {notes.map((n: CrmNote) => (
            <div key={n.id} className={`bg-bg-surface border rounded-xl p-4 ${n.isPinned ? 'border-yellow-300' : 'border-border'}`}>
              {n.isPinned && <span className="flex items-center gap-1 text-xs text-yellow-600 mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-text-secondary mt-2">{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Convert modal */}
      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowConvert(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-1">Convert Lead to Opportunity</h2>
            <p className="text-sm text-text-secondary mb-4">This will create a new opportunity from this lead.</p>
            <form onSubmit={handleConvert} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Opportunity Name *</label>
                <input required value={convertForm.oppName} onChange={e => setConvertForm(f => ({ ...f, oppName: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Opportunity Value (MYR)</label>
                <input type="number" min="0" value={convertForm.oppValue} onChange={e => setConvertForm(f => ({ ...f, oppValue: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Pipeline *</label>
                <select value={convertForm.pipelineId} onChange={e => {
                  const pl = pipelines.find(p => p.id === e.target.value);
                  setConvertForm(f => ({ ...f, pipelineId: e.target.value, stageId: pl?.stages?.[0]?.id ?? '' }));
                }} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Initial Stage *</label>
                <select value={convertForm.stageId} onChange={e => setConvertForm(f => ({ ...f, stageId: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {(selectedPipeline?.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-green-600 text-white hover:bg-green-700"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Converting…' : 'Convert to Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity modal */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
                <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea rows={3} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note modal */}
      {showAddNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddNote(false); setNoteContent(''); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Note</h2>
            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Note *</label>
                <textarea required rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddNote(false); setNoteContent(''); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Lead</h2>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Title *</label>
                <input required value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Contact Name</label>
                  <input value={editForm.contactName ?? ''} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Company</label>
                  <input value={editForm.companyName ?? ''} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Email</label>
                  <input type="email" value={editForm.contactEmail ?? ''} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Phone</label>
                  <input value={editForm.contactPhone ?? ''} onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Source</label>
                  <select value={editForm.source ?? 'OTHER'} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Estimated Value (MYR)</label>
                  <input type="number" min="0" value={editForm.estimatedValue ?? ''} onChange={e => setEditForm(f => ({ ...f, estimatedValue: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Follow-up Date</label>
                  <input type="date" value={editForm.followUpDate ?? ''} onChange={e => setEditForm(f => ({ ...f, followUpDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Owner</label>
                  <select value={lead!.owner?.id ?? ''} onChange={e => setEditForm(f => ({ ...f, ownerId: e.target.value || undefined }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    {crmUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Follow-up Note</label>
                <input value={editForm.followUpNote ?? ''} onChange={e => setEditForm(f => ({ ...f, followUpNote: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea rows={3} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-gray-100" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
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

export default CrmLeadDetail;