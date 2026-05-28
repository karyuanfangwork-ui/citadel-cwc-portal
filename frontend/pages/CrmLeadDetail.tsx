import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmLead, CrmUser, CrmPipeline, CrmActivity, CrmNote, CrmActivityType } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import StateBadge from '../src/components/ui/StateBadge';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

const CrmLeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConvert, setShowConvert] = useState(false);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [convertForm, setConvertForm] = useState({ pipelineId: '', stageId: '', oppName: '', oppValue: '', expectedCloseDate: '' });
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
  const [showDelete, setShowDelete] = useState(false);

  // ── AI state ─────────────────────────────────────────────────────
  // Note Analyzer (Task 5)
  const [analyzedNotes, setAnalyzedNotes] = useState<Record<string, {
    sentiment: string;
    nextAction: string;
    suggestedStatusChange: string | null;
    keyFacts: string[];
    suggestedFollowUpDays?: number | null;
  } | null>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
   const [noteAnalysisError, setNoteAnalysisError] = useState<string | null>(null);

  // Draft Message (Task 6)
  const [draftModal, setDraftModal] = useState(false);
  const [draftConfig, setDraftConfig] = useState<{ channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }>({ channel: 'whatsapp', tone: 'friendly' });
  const [draftResult, setDraftResult] = useState<{ subject: string | null; body: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
   const [draftError, setDraftError] = useState<string | null>(null);

  // Lead Summary (Task 7)
  const [summary, setSummary] = useState<{ statusSummary: string; keyFacts: string; recommendedNextStep: string } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
   const [summaryError, setSummaryError] = useState<string | null>(null);

  // Lead Score (Task 8)
  const scoreColor = (score: number) =>
    score >= 70 ? 'bg-[var(--color-hr-50)] text-[var(--color-success)]' : score >= 40 ? 'bg-[var(--color-fin-50)] text-[var(--color-warning)]' : 'bg-[rgba(220,38,38,0.06)] text-[var(--color-danger)]';

  // Fetch CRM team users for owner reassignment
  useEffect(() => {
    crmService.listCrmUsers().then(setCrmUsers).catch(() => {});
  }, []);

  // ── AI handlers ─────────────────────────────────────────────────────
  const handleAnalyzeNote = async (activityId: string) => {
    setAnalyzingId(activityId);
    setNoteAnalysisError(null);
    try {
      const result = await crmService.analyzeActivityNote(activityId);
      setAnalyzedNotes((prev) => ({ ...prev, [activityId]: result }));
    } catch (err) {
      setNoteAnalysisError(err instanceof Error ? err.message : 'AI feature unavailable');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDraftMessage = async () => {
    if (!lead) return;
    setDraftLoading(true);
    setDraftResult(null);
    setDraftError(null);
    try {
      const result = await crmService.draftLeadMessage(lead.id, draftConfig);
      setDraftResult(result);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'AI feature unavailable');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleGetSummary = async () => {
    if (!lead) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const result = await crmService.getLeadSummary(lead.id);
      setSummary(result);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'AI feature unavailable');
    } finally {
      setSummaryLoading(false);
    }
  };

  const [scoreData, setScoreData] = useState<{ score: number; reason: string } | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const handleGetScore = async () => {
    if (!lead) return;
    setScoreLoading(true);
    setScoreError(null);
    try {
      const result = await crmService.getLeadScore(lead.id);
      setScoreData(result);
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'AI feature unavailable');
    } finally {
      setScoreLoading(false);
    }
  };

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
        setConvertForm({ pipelineId: defaultPipeline.id, stageId: firstStage?.id ?? '', oppName: lead?.title ?? '', oppValue: String(lead?.estimatedValue ?? ''), expectedCloseDate: '' });
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
        expectedCloseDate: convertForm.expectedCloseDate || undefined,
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
      const activity = await crmService.createActivity({ ...activityForm, leadId: id });
      setShowAddActivity(false);
      setActivityForm({ activityType: 'CALL' });
      reload();
      if (
        ['CALL', 'MEETING', 'WHATSAPP'].includes(activityForm.activityType ?? '') &&
        activityForm.description?.trim()
      ) {
        handleAnalyzeNote(activity.id);
      }
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

  const [showLostModal, setShowLostModal] = useState(false);
  const [lostCategory, setLostCategory] = useState('');
  const [lostNote, setLostNote] = useState('');

  const handleMarkLost = () => {
    setLostCategory('');
    setLostNote('');
    setShowLostModal(true);
  };

  const handleConfirmLost = async () => {
    if (!id || !lostCategory) return;
    const lostReason = lostNote.trim()
      ? `${lostCategory}: ${lostNote.trim()}`
      : lostCategory;
    try {
      await crmService.updateLead(id, { status: 'LOST' as any, lostReason });
      setShowLostModal(false);
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

  const handleDelete = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await crmService.deleteLead(id);
      navigate('/crm/leads');
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
            <StateBadge state={lead.status} size="sm" />
            {/* AI Score Badge (Task 8) */}
            {(scoreData || lead.aiScore != null) ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  scoreColor(scoreData?.score ?? lead.aiScore!)
                }`}
                title={scoreData?.reason ?? lead.aiScoreReason ?? ''}
              >
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                {scoreData?.score ?? lead.aiScore}/100
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={handleGetScore}
                  disabled={scoreLoading}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-text-tertiary hover:bg-brand-100 hover:text-brand-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xs">auto_awesome</span>
                  {scoreLoading ? '…' : 'Score'}
                </button>
                {scoreError && (
                  <span className="text-xs text-danger" title={scoreError}>
                    <span className="material-symbols-outlined text-xs align-middle">error</span>
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm">{lead.companyName || ''}{lead.contactName ? ` · ${lead.contactName}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openEdit}
            className="flex items-center gap-2 border border-brand-200 text-brand-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-50 transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">edit</span> Edit
          </button>
          {hasPermission(user, 'crm:delete') && (
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 text-danger px-3 py-2.5 rounded-lg text-sm font-bold hover:bg-danger/10 transition-colors"
              style={{ background: 'none', border: '1px solid var(--color-danger)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">delete</span> Delete
            </button>
          )}
          {!isConverted && !isLost && (
            <button onClick={openConvert}
              className="flex items-center gap-2 bg-success text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-success/90 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">swap_horiz</span> Convert to Opportunity
            </button>
          )}
          {!isConverted && !isLost && (
            <button onClick={handleMarkLost}
              className="flex items-center gap-2 border border-danger text-danger px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-danger/10 transition-colors"
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
          {/* Draft Message button (Task 6) */}
          {!isConverted && !isLost && (
            <button
              onClick={() => { setDraftModal(true); setDraftResult(null); }}
              className="flex items-center gap-2 border border-brand-300 bg-brand-50 px-4 py-2.5 rounded-lg text-sm font-bold text-brand-700 hover:bg-brand-100 transition-colors"
              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Draft Message
            </button>
          )}
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
              <p className="text-xs font-semibold text-danger mb-1">Lost Reason</p>
              <p className="text-sm text-text-primary">{lead.lostReason}</p>
            </div>
          )}

          {/* AI Summary Panel (Task 7) */}
          <div className="mt-4 pt-4 border-t border-border">
            <AiInsightCard
              title="AI Summary"
              loading={summaryLoading}
              error={summaryError}
              onRefresh={handleGetSummary}
            >
              {!summary ? (
                <button
                  onClick={handleGetSummary}
                  className="text-sm text-brand-600 hover:underline"
                >
                  Generate summary
                </button>
              ) : (
                <ul className="space-y-2 text-sm">
                  <li><span className="font-medium text-text-secondary">Status:</span> {summary.statusSummary}</li>
                  <li><span className="font-medium text-text-secondary">Key facts:</span> {summary.keyFacts}</li>
                  <li><span className="font-medium text-brand-700">Next step:</span> {summary.recommendedNextStep}</li>
                </ul>
              )}
            </AiInsightCard>
          </div>
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
                {/* AI Note Analyzer (Task 5) */}
                {['CALL', 'MEETING', 'WHATSAPP'].includes(a.activityType) && (
                  <div className="mt-2">
                    {!analyzedNotes[a.id] ? (
                      <div>
                        <button
                          onClick={() => handleAnalyzeNote(a.id)}
                          disabled={analyzingId === a.id}
                          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          {analyzingId === a.id ? 'Analyzing…' : 'AI Analyze'}
                        </button>
                        {noteAnalysisError && !analyzedNotes[a.id] && (
                          <p className="text-xs text-danger mt-1">{noteAnalysisError}</p>
                        )}
                      </div>
                    ) : (
                      <AiInsightCard title="Note Analysis" className="mt-1" error={noteAnalysisError} loading={analyzingId === a.id} onRefresh={() => handleAnalyzeNote(a.id)}>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            <span className={`material-symbols-outlined text-sm ${
                              analyzedNotes[a.id]!.sentiment === 'positive' ? 'text-success'
                              : analyzedNotes[a.id]!.sentiment === 'negative' ? 'text-danger'
                              : 'text-text-tertiary'
                            }`}>
                              {analyzedNotes[a.id]!.sentiment === 'positive' ? 'sentiment_satisfied'
                                : analyzedNotes[a.id]!.sentiment === 'negative' ? 'sentiment_dissatisfied'
                                : 'sentiment_neutral'}
                            </span>
                            <span className="capitalize text-text-secondary">{analyzedNotes[a.id]!.sentiment}</span>
                          </div>
                          <p><span className="font-medium">Next action:</span> {analyzedNotes[a.id]!.nextAction}</p>
                          {analyzedNotes[a.id]!.suggestedStatusChange && (
                            <p className="text-brand-700"><span className="font-medium">Suggest status:</span> {analyzedNotes[a.id]!.suggestedStatusChange}</p>
                          )}
                          {analyzedNotes[a.id]!.keyFacts.length > 0 && (
                            <ul className="list-disc pl-4 text-text-secondary">
                              {analyzedNotes[a.id]!.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          )}
                          {analyzedNotes[a.id]!.suggestedFollowUpDays != null && (
                            <button
                              onClick={async () => {
                                const days = analyzedNotes[a.id]!.suggestedFollowUpDays!;
                                const date = new Date(Date.now() + days * 86_400_000)
                                  .toISOString().slice(0, 10);
                                await crmService.updateLead(lead!.id, { followUpDate: date });
                                reload();
                              }}
                              className="mt-2 flex items-center gap-1 text-xs font-bold text-success bg-hr-50 hover:bg-hr-100 px-3 py-1.5 rounded-lg transition-colors"
                              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                            >
                              <span className="material-symbols-outlined text-sm">event_available</span>
                              Set follow-up in {analyzedNotes[a.id]!.suggestedFollowUpDays} day{analyzedNotes[a.id]!.suggestedFollowUpDays === 1 ? '' : 's'}
                            </button>
                          )}
                        </div>
                      </AiInsightCard>
                    )}
                  </div>
                )}
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
            <div key={n.id} className={`bg-bg-surface border rounded-xl p-4 ${n.isPinned ? 'border-warning' : 'border-border'}`}>
              {n.isPinned && <span className="flex items-center gap-1 text-xs text-warning mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
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
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Opportunity Value (MYR)</label>
                <input type="number" min="0" value={convertForm.oppValue} onChange={e => setConvertForm(f => ({ ...f, oppValue: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Expected Close Date</label>
                <input type="date" value={convertForm.expectedCloseDate} onChange={e => setConvertForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Pipeline *</label>
                <select value={convertForm.pipelineId} onChange={e => {
                  const pl = pipelines.find(p => p.id === e.target.value);
                  setConvertForm(f => ({ ...f, pipelineId: e.target.value, stageId: pl?.stages?.[0]?.id ?? '' }));
                }} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Initial Stage *</label>
                <select value={convertForm.stageId} onChange={e => setConvertForm(f => ({ ...f, stageId: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}>
                  {(selectedPipeline?.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-success text-white hover:bg-success/90"
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
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea rows={3} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
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

      {/* Lost Reason modal */}
      {showLostModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowLostModal(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-text-primary">Mark as Lost</h2>
              <button
                onClick={() => setShowLostModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-text-secondary">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Reason *
                </label>
                <select
                  value={lostCategory}
                  onChange={e => setLostCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200"
                  style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}
                >
                  <option value="">Select a reason…</option>
                  {[
                    'Price too high',
                    'Chose competitor',
                    'Not ready / timing',
                    'No budget',
                    'Lost contact',
                    'Product not suitable',
                    'Internal decision not reached',
                    'Other',
                  ].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Additional notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={lostNote}
                  onChange={e => setLostNote(e.target.value)}
                  placeholder="Any additional context…"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-brand-200"
                  style={{ fontFamily: 'var(--font-sans)' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowLostModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLost}
                disabled={!lostCategory}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-danger text-white hover:bg-danger/90 disabled:opacity-50 transition-colors"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Mark as Lost
              </button>
            </div>
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
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} />
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

      {/* Draft Message modal (Task 6) */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Draft Follow-Up Message</h2>
              <button onClick={() => setDraftModal(false)} className="text-text-tertiary hover:text-text-secondary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4 flex gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Channel</label>
                <select
                  value={draftConfig.channel}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, channel: e.target.value as 'whatsapp' | 'email' }))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Tone</label>
                <select
                  value={draftConfig.tone}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, tone: e.target.value as 'formal' | 'friendly' }))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleDraftMessage}
                  disabled={draftLoading}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer' }}
                >
                  {draftLoading ? 'Drafting…' : 'Generate'}
                </button>
              </div>
            </div>

            {draftError && (
              <div className="mb-4 rounded-md bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
                {draftError}
              </div>
            )}

            {draftResult && (
              <div className="space-y-3">
                {draftResult.subject && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-text-secondary">Subject</p>
                    <p className="rounded-md bg-bg-subtle px-3 py-2 text-sm">{draftResult.subject}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Message</p>
                  <textarea
                    className="w-full rounded-md border border-border px-3 py-2 text-sm"
                    rows={8}
                    defaultValue={draftResult.body}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  />
                </div>
                <p className="text-xs text-text-tertiary">Edit as needed before sending. AI-generated — review before use.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Lead modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
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
                <button type="button" onClick={() => setShowEdit(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-subtle" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Log FAB */}
      <button
        onClick={() => { setShowAddActivity(true); setActivityForm({ activityType: 'CALL' }); }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-700 text-white shadow-lg hover:bg-brand-800 active:scale-95 transition-all flex items-center justify-center"
        style={{ border: 'none', cursor: 'pointer' }}
        title="Quick Log Activity"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete "${lead?.title}"? This action cannot be undone.`}
        confirmVariant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
    </>
  );
};

export default CrmLeadDetail;