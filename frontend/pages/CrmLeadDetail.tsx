import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import crmService, { CrmLead, CrmUser, CrmPipeline, CrmActivity, CrmNote, CrmActivityType, LeadStatus, LeadSource } from '../src/services/crm.service';
import InlineEdit from '../src/components/crm/InlineEdit';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import StateBadge from '../src/components/ui/StateBadge';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { validateLead, ValidationError } from '../src/utils/crmValidation';
import EmptyState from '../src/components/ui/EmptyState';
import CrmAuditLog from '../src/components/crm/CrmAuditLog';
import { useAnalyzeNote, useDraftMessage, useLeadSummary, useLeadScore, useNextBestAction } from '../src/hooks/useCrmAi';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'audit'>('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [noteContent, setNoteContent] = useState('');
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState<Partial<CrmActivity>>({});
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [editingOwner, setEditingOwner] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [showDelete, setShowDelete] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Activity pagination state ─────────────────────────────────────
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);

  // ── AI state — using hooks ─────────────────────────────────────────────
  const noteAnalyzer = useAnalyzeNote();
  const draftMsg = useDraftMessage();
  const leadSummary = useLeadSummary();
  const leadScore = useLeadScore();

  // Draft Message UI state (keeps modal visibility and config — NOT AI state)
  const [draftModal, setDraftModal] = useState(false);
  const [draftConfig, setDraftConfig] = useState<{ channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }>({ channel: 'whatsapp', tone: 'friendly' });

  // Lead Score color helper
  const scoreColor = (score: number) =>
    score >= 70 ? 'bg-[var(--color-hr-50)] text-[var(--color-success)]' : score >= 40 ? 'bg-[var(--color-fin-50)] text-[var(--color-warning)]' : 'bg-[rgba(220,38,38,0.06)] text-[var(--color-danger)]';

  // ── Next Best Action (Task 11) ─────────────────────────────────────
  const nba = useNextBestAction();

  // Fetch CRM team users for owner reassignment
  useEffect(() => {
    crmService.listCrmUsers().then(setCrmUsers).catch(() => {});
  }, []);

  // ── AI wrapper handlers (delegate to hooks) ─────────────────────────
  const handleAnalyzeNote = (activityId: string) => noteAnalyzer.analyze(activityId);

  const handleDraftMessage = () => {
    if (!lead) return;
    draftMsg.draftForLead(lead.id, draftConfig);
  };

  const handleGetSummary = () => {
    if (!lead) return;
    leadSummary.fetch(lead.id);
  };

  const reload = () => {
    if (!id) return;
    crmService.getLead(id)
      .then(setLead)
      .catch(() => navigate('/crm/leads'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); reload(); }, [id]);

  // Auto-fetch Next Best Action when lead loads
  useEffect(() => {
    if (lead?.id) nba.fetch('lead', lead.id);
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize hasMoreActivities based on initial activity count
  useEffect(() => {
    if (lead && lead.activities) {
      setHasMoreActivities(lead.activities.length >= 10);
      setActivityPage(1);
    }
  }, [lead?.id]);

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

  const openEditActivity = (a: CrmActivity) => {
    setEditingActivity(a);
    setEditActivityForm({
      activityType: a.activityType,
      subject: a.subject,
      description: a.description ?? '',
      scheduledAt: a.scheduledAt ? a.scheduledAt.slice(0, 16) : '',
    });
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    try {
      setSaving(true);
      await crmService.updateActivity(editingActivity.id, editActivityForm);
      setEditingActivity(null);
      reload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivityId) return;
    try {
      setSaving(true);
      await crmService.deleteActivity(deletingActivityId);
      setDeletingActivityId(null);
      reload();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleLoadMoreActivities = async () => {
    if (!id || loadingMoreActivities) return;
    setLoadingMoreActivities(true);
    try {
      const nextPage = activityPage + 1;
      const result = await crmService.listActivities({ leadId: id, page: nextPage, limit: 10 });
      const newActivities = result.activities ?? [];
      setLead(prev => prev ? { ...prev, activities: [...(prev.activities ?? []), ...newActivities] } : prev);
      setActivityPage(nextPage);
      setHasMoreActivities(newActivities.length >= 10);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMoreActivities(false);
    }
  };

  const handleSetReminder = async (activityId: string) => {
    try {
      await crmService.sendActivityReminder(activityId);
      setLead(prev => prev ? {
        ...prev,
        activities: (prev.activities ?? []).map(a =>
          a.id === activityId ? { ...a, reminderSent: true } : a
        ),
      } : prev);
    } catch (e) { console.error(e); }
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
      await crmService.updateLead(id, { status: 'LOST', lostReason });
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
      setOwnerSearchQuery('');
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
    setFormErrors([]);
    setShowEdit(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const errors = validateLead(editForm);
    if (errors.length > 0) { setFormErrors(errors); return; }
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
        if (editForm[k] === '' && lead![k as keyof CrmLead] != null) payload[k] = null;
      }
      if (editForm.followUpDate === '' && lead!.followUpDate) payload.followUpDate = null;
      await crmService.updateLead(id, payload);
      setShowEdit(false);
      setFormErrors([]);
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
  const activities = lead?.activities ?? [];
  const notes = lead?.notes ?? [];

  if (loading) return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  if (!lead) return null;


  const isConverted = lead.status === 'CONVERTED';
  const isLost = lead.status === 'LOST';
  const ownerFullName = lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}`.trim() : null;
  const leadSourceLabel = lead.source ? lead.source.replace(/_/g, ' ') : null;
  const railPrimaryLabel = lead.companyName || lead.account?.name || lead.contactName || 'Lead details';
  const railSecondaryLabel = [
    railPrimaryLabel !== lead.contactName ? lead.contactName : null,
    leadSourceLabel,
  ].filter(Boolean).join(' · ') || lead.status.replace(/_/g, ' ');
  const railInitial = railPrimaryLabel.trim()[0]?.toUpperCase() ?? 'L';
  const relatedOpportunity = (lead as any).opportunities?.[0];
  const convertedOpportunityId = lead.convertedToOppId ?? relatedOpportunity?.id ?? null;
  const convertedSuggestionActions = [
    convertedOpportunityId
      ? {
          action: 'View converted opportunity',
          priority: 'high',
          reason: 'This lead is already converted. Continue active deal work from the opportunity.',
          to: `/crm/opportunities/${convertedOpportunityId}`,
        }
      : {
          action: 'Review converted record',
          priority: 'high',
          reason: 'This lead is already converted. Review related CRM records before taking lead-nurturing action.',
        },
    {
      action: 'Log relationship activity',
      priority: 'medium',
      reason: 'Use activities to record post-conversion relationship updates.',
    },
    {
      action: 'Review onboarding documents',
      priority: 'low',
      reason: 'Converted leads should move into account, opportunity, or onboarding follow-through.',
    },
  ];
  const suggestionActions = isConverted ? convertedSuggestionActions : (nba.data?.actions ?? []);
  const priorityLabel = (priority?: string) => {
    if (priority === 'high') return 'High priority';
    if (priority === 'medium') return 'Recommended';
    return 'Optional';
  };
  const priorityDotClass = (priority?: string) =>
    priority === 'high' ? 'bg-[#ba1a1a]' : priority === 'medium' ? 'bg-amber-500' : 'bg-[#45464d]';
  const financialMetrics = [
    {
      label: 'CTOS Availability',
      status: 'Verified',
      confidence: 84,
      description: 'Demo financial signal: CTOS availability has been verified with high confidence.',
    },
    {
      label: 'Cash Flow Growth',
      status: 'Positive',
      confidence: 70,
      description: 'Demo financial signal: cash flow trend is positive based on available CRM context.',
    },
  ];
  const scoreRationale = leadScore.scoreData?.reason ?? lead.aiScoreReason ?? null;

  return (
    <>
      <div className="min-h-full bg-[#f8f9ff] flex flex-col lg:flex-row">
        <aside className="w-full lg:w-72 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#e2e8f0] flex flex-col overflow-y-auto">
          <div className="p-5 flex flex-col gap-5 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                style={{ background: '#006a61' }}
              >
                {railInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#0b1c30] truncate">{railPrimaryLabel}</p>
                <p className="text-[11px] text-[#45464d] opacity-70 truncate">{railSecondaryLabel}</p>
              </div>
            </div>

            <div className="border-t border-[#e2e8f0]" />

            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-3">Contact Details</p>
              <div className="space-y-3">
                {lead.contactEmail && (
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-50 mt-0.5 flex-shrink-0">mail</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#45464d] opacity-60 uppercase tracking-wide mb-0.5">Email Address</p>
                      <a
                        href={`mailto:${lead.contactEmail}`}
                        title={lead.contactEmail}
                        aria-label={`Email ${lead.contactName ?? 'lead contact'} at ${lead.contactEmail}`}
                        className="text-[13px] text-[#006a61] font-medium break-all block hover:underline"
                        style={{ textDecoration: 'none' }}
                      >
                        {lead.contactEmail}
                      </a>
                    </div>
                  </div>
                )}
                {lead.contactPhone && (
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-50 mt-0.5 flex-shrink-0">phone</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#45464d] opacity-60 uppercase tracking-wide mb-0.5">Mobile Number</p>
                      <p className="text-[13px] text-[#0b1c30] font-medium">{lead.contactPhone}</p>
                    </div>
                  </div>
                )}
                {lead.contactName && (
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-50 mt-0.5 flex-shrink-0">badge</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#45464d] opacity-60 uppercase tracking-wide mb-0.5">Contact Person</p>
                      <p className="text-[13px] text-[#0b1c30] font-medium">{lead.contactName}</p>
                    </div>
                  </div>
                )}
                {lead.source && (
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-50 mt-0.5 flex-shrink-0">link</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#45464d] opacity-60 uppercase tracking-wide mb-0.5">Lead Source</p>
                      <p className="text-[13px] text-[#0b1c30] font-medium">{lead.source.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#e2e8f0]" />

            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-3">Lead Owner</p>
              {lead.owner ? (
                <div className="flex items-start gap-3">
                  {lead.owner.avatarUrl ? (
                    <img src={lead.owner.avatarUrl} alt={`${lead.owner.firstName} ${lead.owner.lastName}`} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#006a61' }}>
                      {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#0b1c30] leading-snug break-words">{lead.owner.firstName} {lead.owner.lastName}</p>
                    <p className="text-[12px] text-[#45464d] opacity-70 leading-snug mt-0.5 break-words">
                      {[lead.owner.jobTitle, lead.owner.department].filter(Boolean).join(' · ') || 'Team Member'}
                    </p>
                    {lead.owner.email && (
                      <a
                        href={`mailto:${lead.owner.email}`}
                        title={lead.owner.email}
                        aria-label={`Email lead owner ${ownerFullName ?? ''} at ${lead.owner.email}`}
                        className="text-[12px] text-[#006a61] font-medium break-all block mt-1 hover:underline"
                        style={{ textDecoration: 'none' }}
                      >
                        {lead.owner.email}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border border-dashed border-[#e2e8f0] flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-40">person</span>
                  </div>
                  <p className="text-[13px] text-[#45464d] opacity-50">No owner assigned</p>
                </div>
              )}
              {hasPermission(user, 'crm:admin') && !editingOwner && (
                <button
                  onClick={() => { setEditingOwner(true); setOwnerSearchQuery(''); }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#006a61] border border-[#006a61]/20 hover:bg-[#006a61]/5 transition-colors"
                  style={{ background: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                  {lead.owner ? 'Reassign Owner' : 'Assign Owner'}
                </button>
              )}
              {editingOwner && (
                <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                  <div className="relative">
                    <span className="material-symbols-outlined text-[16px] text-[#45464d] opacity-50 absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
                    <input
                      type="text"
                      placeholder="Search by name or email…"
                      value={ownerSearchQuery}
                      onChange={e => setOwnerSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] text-[#0b1c30] outline-none focus:border-[#006a61] focus:ring-1 focus:ring-[#006a61]/20 transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-[#e2e8f0]">
                    {crmUsers
                      .filter(u => {
                        if (!ownerSearchQuery.trim()) return true;
                        const q = ownerSearchQuery.toLowerCase();
                        return (
                          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
                          u.email?.toLowerCase().includes(q) ||
                          u.jobTitle?.toLowerCase().includes(q) ||
                          u.department?.toLowerCase().includes(q)
                        );
                      })
                      .map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleChangeOwner(u.id)}
                        disabled={savingOwner || u.id === lead.ownerId}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#f8f9ff] transition-colors text-left disabled:opacity-40"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: '#006a61' }}>
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#0b1c30] truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-[11px] text-[#45464d] opacity-60 truncate">{[u.jobTitle, u.department].filter(Boolean).join(' · ') || u.email}</p>
                        </div>
                        {u.id === lead.ownerId && (
                          <span className="material-symbols-outlined text-[14px] text-[#006a61] flex-shrink-0">check_circle</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#e2e8f0]">
                    {savingOwner && <p className="text-[11px] text-[#006a61]">Saving…</p>}
                    {!savingOwner && <span />}
                    <button
                      onClick={() => { setEditingOwner(false); setOwnerSearchQuery(''); }}
                      className="text-[11px] text-[#45464d] opacity-60 hover:opacity-100 transition-opacity"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col overflow-auto">
          <div className="flex items-center gap-1.5 text-[12px] text-[#45464d] opacity-70 px-6 pt-5 mb-1">
            <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:opacity-100">CRM</Link>
            <span>/</span>
            <Link to="/crm/leads" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:opacity-100">Leads</Link>
            <span>/</span>
            <span className="text-[#0b1c30] opacity-100 font-semibold truncate max-w-[240px]">{lead.title}</span>
          </div>

          <div className="flex items-start justify-between gap-6 px-6 py-6 border-b border-[#e2e8f0] bg-white flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-20 rounded-2xl bg-[#86f2e4]/25 text-[#006a61] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[40px]">apartment</span>
              </div>
              <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[26px] lg:text-[34px] font-bold text-[#0b1c30] tracking-tight leading-tight">{lead.title}</h1>
                <StateBadge state={lead.status} size="sm" />
                {(leadScore.scoreData || lead.aiScore != null) ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColor(leadScore.scoreData?.score ?? lead.aiScore!)}`}
                    title={leadScore.scoreData?.reason ?? lead.aiScoreReason ?? ''}
                  >
                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                    {leadScore.scoreData?.score ?? lead.aiScore}/100
                  </span>
                ) : (
                  <button
                    onClick={() => leadScore.fetch(lead.id)}
                    disabled={leadScore.loading}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border border-[#e2e8f0] text-[#45464d] hover:border-[#006a61] hover:text-[#006a61] disabled:opacity-50 transition-colors"
                    style={{ background: 'white', cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                    {leadScore.loading ? 'Scoring…' : 'Score Lead'}
                  </button>
                )}
              </div>
              <p className="text-[13px] text-[#45464d] opacity-70 mt-1">
                {[
                  // Avoid repeating companyName if already embedded in title
                  // e.g. title "Probate Admin — Azman & Lee" + companyName "Azman & Lee Advocates"
                  (() => {
                    if (!lead.companyName) return null;
                    // Direct substring match either way
                    if (lead.title.includes(lead.companyName) || lead.companyName.includes(lead.title.split(' — ').pop() || '')) return null;
                    return lead.companyName;
                  })(),
                  ownerFullName ? `Owner: ${ownerFullName}` : null,
                  lead.contactName,
                ].filter(Boolean).join(' · ')}
                {lead.updatedAt && ` · Updated ${new Date(lead.updatedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap">
              {isConverted && convertedOpportunityId ? (
                <Link
                  to={`/crm/opportunities/${convertedOpportunityId}`}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-xl border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff] transition-all"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span> View Opportunity
                </Link>
              ) : !isConverted && !isLost ? (
                <button
                  onClick={openConvert}
                  className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span> Convert to Opportunity
                </button>
              ) : null}
              <button
                onClick={() => setShowAddActivity(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-sm font-semibold rounded-xl hover:bg-[#f8f9ff] transition-all"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[16px]">add_task</span> Log Activity
              </button>
              <button
                onClick={() => setShowAddNote(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-sm font-semibold rounded-xl hover:bg-[#f8f9ff] transition-all"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[16px]">sticky_note_2</span> Add Note
              </button>
              {!isConverted && !isLost ? (
                <button
                  onClick={() => setDraftModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-sm font-semibold rounded-xl hover:bg-[#f8f9ff] transition-all"
                  style={{ cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span> Draft Message
                </button>
              ) : null}
              <button
                onClick={openEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#e2e8f0] text-[#0b1c30] text-sm font-semibold rounded-xl hover:bg-[#f8f9ff] transition-all shadow-sm"
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span> Edit Lead
              </button>
              {!isConverted && !isLost ? (
                <button
                  onClick={handleMarkLost}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#e2e8f0] text-sm font-semibold rounded-xl hover:bg-[#fff5f5] transition-all"
                  style={{ cursor: 'pointer', color: '#ba1a1a' }}
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span> Mark as Lost
                </button>
              ) : null}
              {hasPermission(user, 'crm:delete') ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreActions(v => !v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowMoreActions(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={showMoreActions}
                    aria-controls="lead-more-actions-menu"
                    aria-label="More lead actions"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#e2e8f0] text-[#45464d] text-sm font-semibold rounded-xl hover:bg-[#f8f9ff] transition-all"
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">more_horiz</span> More
                  </button>
                  {showMoreActions && (
                    <div
                      id="lead-more-actions-menu"
                      role="menu"
                      aria-label="More lead actions"
                      className="absolute right-0 top-full mt-2 z-30 w-48 rounded-xl border border-[#e2e8f0] bg-white p-1 shadow-xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        aria-label="Delete Lead destructive action"
                        onClick={() => {
                          setShowMoreActions(false);
                          setShowDelete(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[#fff5f5] transition-colors"
                        style={{ color: '#ba1a1a', background: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                        Delete Lead
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

      <div className="flex border-b border-[#e2e8f0] bg-white px-6 overflow-x-auto flex-shrink-0">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'activities', label: 'Activities' },
          { key: 'notes', label: 'Notes & Documents' },
          { key: 'audit', label: 'Audit Trail' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 h-11 text-[13px] font-semibold border-b-2 transition-colors flex-shrink-0 ${
              activeTab === key
                ? 'border-[#006a61] text-[#006a61]'
                : 'border-transparent text-[#45464d] hover:text-[#0b1c30] hover:border-[#e2e8f0]'
            }`}
            style={{ background: 'none', cursor: 'pointer' }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5 max-w-5xl">
          {isConverted ? (
            <div className="bg-[#e9fbf7] border border-[#86f2e4]/60 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#006a61] mt-0.5">task_alt</span>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1c30]">Lead converted</h3>
                  <p className="text-[13px] text-[#45464d] mt-0.5">
                    This lead has been converted. Continue active deal work from the related opportunity/account; keep this lead for historical context and notes.
                  </p>
                  {relatedOpportunity ? (
                    <p className="text-[12px] text-[#45464d] mt-1">
                      Related opportunity: <span className="font-semibold text-[#0b1c30]">{relatedOpportunity.name}</span>
                      {relatedOpportunity.stage?.name ? ` · ${relatedOpportunity.stage.name}` : ''}
                      {relatedOpportunity.value != null ? ` · ${formatCurrency(relatedOpportunity.value)}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              {convertedOpportunityId ? (
                <Link
                  to={`/crm/opportunities/${convertedOpportunityId}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
                  style={{ background: '#006a61', textDecoration: 'none' }}
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  View Opportunity
                </Link>
              ) : null}
            </div>
          ) : null}

          {suggestionActions.length ? (
            <div className="flex items-center gap-2 flex-wrap p-3 bg-white border border-[#e2e8f0] rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#45464d] opacity-60">AI Suggested</span>
              {suggestionActions.map((a, i) => {
                const label = priorityLabel(a.priority);
                const title = `${label}: ${a.action}. ${a.reason ? `Reason: ${a.reason}` : ''}`;
                return 'to' in a && a.to ? (
                  <Link
                    key={i}
                    to={a.to}
                    aria-label={title}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#f8f9ff] border border-[#e2e8f0] hover:border-[#006a61]"
                    title={title}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDotClass(a.priority)}`} />
                    <span className="font-semibold text-[#45464d]">{label}:</span>
                    {a.action}
                  </Link>
                ) : (
                  <span
                    key={i}
                    aria-label={title}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#f8f9ff] border border-[#e2e8f0]"
                    title={title}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDotClass(a.priority)}`} />
                    <span className="font-semibold text-[#45464d]">{label}:</span>
                    {a.action}
                  </span>
                );
              })}
            </div>
          ) : null}

          {leadSummary.loading || leadSummary.error || leadSummary.summary ? (
            <AiInsightCard
              title="AI Lead Summary"
              loading={leadSummary.loading}
              error={leadSummary.error}
              onRefresh={handleGetSummary}
            >
              {!leadSummary.summary ? (
                <button onClick={handleGetSummary} className="text-sm text-[#006a61] hover:underline">
                  Generate summary
                </button>
              ) : (
                <ul className="space-y-2 text-sm text-[#45464d]">
                  <li><span className="font-medium text-[#0b1c30]">Status:</span> {leadSummary.summary.statusSummary}</li>
                  <li><span className="font-medium text-[#0b1c30]">Key facts:</span> {leadSummary.summary.keyFacts}</li>
                  <li><span className="font-medium text-[#006a61]">Next step:</span> {leadSummary.summary.recommendedNextStep}</li>
                </ul>
              )}
            </AiInsightCard>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white border border-[#e2e8f0] rounded-xl p-5">
              <h3 className="text-[13px] font-bold text-[#0b1c30] mb-4 flex items-center gap-2">
                Lead Information
                <span className="w-1.5 h-1.5 rounded-full bg-[#006a61]" />
              </h3>
              {lead.description ? (
                <div className="mb-5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-4">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Qualification Notes</p>
                  <div className="text-[13px] leading-relaxed text-[#45464d] [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:font-semibold [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[#006a61]/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:opacity-70">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                      }}
                    >{lead.description}</ReactMarkdown>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Industry</p>
                  <p className="text-[15px] font-semibold text-[#0b1c30]">{(lead.account as any)?.industry || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Lead Source</p>
                  <p className="text-[15px] font-semibold text-[#0b1c30]">{lead.source ? lead.source.replace(/_/g, ' ') : 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Estimated Value</p>
                  <p className="text-[15px] font-semibold text-[#0b1c30]">{formatCurrency(lead.estimatedValue)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Status</p>
                  <div><StateBadge state={lead.status} size="sm" /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Company</p>
                  <p className="text-[15px] font-semibold text-[#0b1c30]">{lead.companyName || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Follow-Up Date</p>
                  <p className="text-[15px] font-semibold text-[#0b1c30]">{lead.followUpDate ? formatDate(lead.followUpDate) : 'No follow-up scheduled'}</p>
                </div>
              </div>
              {lead.followUpNote ? (
                <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60 mb-1">Follow-Up Note</p>
                  <p className="text-[13px] leading-relaxed text-[#45464d]">{lead.followUpNote}</p>
                </div>
              ) : null}
              {lead.lostReason ? (
                <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#ba1a1a] mb-1">Lost Reason</p>
                  <p className="text-[13px] text-[#45464d]">{lead.lostReason}</p>
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
              <h3 className="text-[13px] font-bold text-[#0b1c30] mb-5 uppercase tracking-wide">Financial Health</h3>
              <div className="space-y-6">
                {financialMetrics.map(metric => (
                  <div key={metric.label} title={metric.description}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[12px] font-semibold text-[#45464d]">{metric.label}</p>
                      <span className="text-[12px] font-bold text-[#006a61]">
                        {metric.status} · {metric.confidence}% confidence
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${metric.label}: ${metric.status}, ${metric.confidence}% confidence`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={metric.confidence}
                      className="h-2 rounded-full bg-[#e2e8f0] overflow-hidden"
                    >
                      <div className="h-full rounded-full bg-[#006a61]" style={{ width: `${metric.confidence}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-[#45464d] opacity-70">{metric.description}</p>
                  </div>
                ))}
                {scoreRationale ? (
                  <div className="pt-4 border-t border-[#e2e8f0]">
                    <p className="text-[12px] font-semibold text-[#45464d] mb-1">Score Rationale</p>
                    <p className="text-[12px] leading-relaxed text-[#45464d]">{scoreRationale}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-[13px] font-bold text-[#0b1c30]">Related Opportunities</h3>
            </div>
            {lead.opportunities?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#f8f9ff]">
                      <th className="px-5 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60">Opportunity Name</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60">Stage</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60">Amount</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60">Prob.</th>
                      <th className="px-5 py-3 text-right text-[10px] font-bold tracking-widest uppercase text-[#45464d] opacity-60">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.opportunities.map((opp: any) => (
                      <tr key={opp.id} className="border-t border-[#e2e8f0] hover:bg-[#f8f9ff] transition-colors">
                        <td className="px-5 py-4">
                          <Link to={`/crm/opportunities/${opp.id}`} className="font-semibold text-[#006a61] hover:underline" style={{ textDecoration: 'none' }}>
                            {opp.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-[#45464d]">{opp.stage?.name || '—'}</td>
                        <td className="px-4 py-4 text-right font-medium text-[#0b1c30]">{formatCurrency(opp.value ?? null)}</td>
                        <td className="px-4 py-4 text-right text-[#45464d]">{opp.probability != null ? `${opp.probability}%` : '—'}</td>
                        <td className="px-5 py-4 text-right text-[#45464d]">{opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-8">
                <EmptyState
                  icon="rocket_launch"
                  title="No related opportunities"
                  description="Convert this lead or link an existing opportunity to populate this section."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activities tab */}
      {activeTab === 'activities' && (
        <div className="space-y-3">
          {activities.length === 0 && <p className="text-[#45464d] text-sm">No activities yet. Click "Log Activity" to add one.</p>}
          {activities.map((a: CrmActivity) => (
            <div key={a.id} className="flex gap-4 bg-white border border-[#e2e8f0] rounded-xl p-4">
              <span className="material-symbols-outlined text-[#006a61] mt-0.5">{ACTIVITY_ICONS[a.activityType] || 'event'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0b1c30] text-sm">{a.subject}</p>
                {a.description && <p className="text-xs text-[#45464d] mt-0.5">{a.description}</p>}
                <p className="text-xs text-[#45464d] mt-1">
                  {a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                  {a.scheduledAt && <span className="ml-2 text-[#006a61]">Scheduled: {formatDate(a.scheduledAt)}</span>}
                  {a.scheduledAt && !a.completedAt && new Date(a.scheduledAt) < new Date() && (
                    <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                      <span className="material-symbols-outlined" style={{fontSize:11}}>warning</span>
                      Overdue
                    </span>
                  )}
                  {a.reminderSent && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[10px]">notifications_active</span>
                      Reminded
                    </span>
                  )}
                  {a.scheduledAt && new Date(a.scheduledAt) > new Date() && !a.reminderSent && (
                    <button
                      onClick={() => handleSetReminder(a.id)}
                      className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#006a61] hover:text-[#006a61] px-1.5 py-0.5 rounded-full hover:bg-[#f8f9ff] transition-colors"
                      style={{ border: 'none', cursor: 'pointer', background: 'none' }}
                      title="Send a reminder for this scheduled activity"
                    >
                      <span className="material-symbols-outlined text-[10px]">notifications</span>
                      Set Reminder
                    </button>
                  )}
                </p>
                {/* AI Note Analyzer (Task 5) */}
                {['CALL', 'MEETING', 'WHATSAPP'].includes(a.activityType) && (
                  <div className="mt-2">
                    {!noteAnalyzer.results[a.id] ? (
                      <div>
                        <button
                          onClick={() => handleAnalyzeNote(a.id)}
                          disabled={noteAnalyzer.loadingId === a.id}
                          className="flex items-center gap-1 text-xs text-[#006a61] hover:text-[#006a61] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          {noteAnalyzer.loadingId === a.id ? 'Analyzing…' : 'AI Analyze'}
                        </button>
                        {noteAnalyzer.error && !noteAnalyzer.results[a.id] && (
                          <p className="text-xs text-[#ba1a1a] mt-1">{noteAnalyzer.error}</p>
                        )}
                      </div>
                    ) : (
                      <AiInsightCard title="Note Analysis" className="mt-1" error={noteAnalyzer.error} loading={noteAnalyzer.loadingId === a.id} onRefresh={() => handleAnalyzeNote(a.id)}>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            <span className={`material-symbols-outlined text-sm ${
                              noteAnalyzer.results[a.id]!.sentiment === 'positive' ? 'text-[#006a61]'
                              : noteAnalyzer.results[a.id]!.sentiment === 'negative' ? 'text-[#ba1a1a]'
                              : 'text-[#45464d] opacity-60'
                            }`}>
                              {noteAnalyzer.results[a.id]!.sentiment === 'positive' ? 'sentiment_satisfied'
                                : noteAnalyzer.results[a.id]!.sentiment === 'negative' ? 'sentiment_dissatisfied'
                                : 'sentiment_neutral'}
                            </span>
                            <span className="capitalize text-[#45464d]">{noteAnalyzer.results[a.id]!.sentiment}</span>
                          </div>
                          <p><span className="font-medium">Next action:</span> {noteAnalyzer.results[a.id]!.nextAction}</p>
                          {noteAnalyzer.results[a.id]!.suggestedStatusChange && (
                            <p className="text-[#006a61]"><span className="font-medium">Suggest status:</span> {noteAnalyzer.results[a.id]!.suggestedStatusChange}</p>
                          )}
                          {noteAnalyzer.results[a.id]!.keyFacts.length > 0 && (
                            <ul className="list-disc pl-4 text-[#45464d]">
                              {noteAnalyzer.results[a.id]!.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          )}
                          {noteAnalyzer.results[a.id]!.suggestedFollowUpDays != null && (
                            <button
                              onClick={async () => {
                                const days = noteAnalyzer.results[a.id]!.suggestedFollowUpDays!;
                                const date = new Date(Date.now() + days * 86_400_000)
                                  .toISOString().slice(0, 10);
                                await crmService.updateLead(lead!.id, { followUpDate: date });
                                reload();
                              }}
                              className="mt-2 flex items-center gap-1 text-xs font-bold text-[#006a61] bg-[#86f2e4]/20 hover:bg-[#86f2e4]/30 px-3 py-1.5 rounded-lg transition-colors"
                              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                            >
                              <span className="material-symbols-outlined text-sm">event_available</span>
                              Set follow-up in {noteAnalyzer.results[a.id]!.suggestedFollowUpDays} day{noteAnalyzer.results[a.id]!.suggestedFollowUpDays === 1 ? '' : 's'}
                            </button>
                          )}
                        </div>
                      </AiInsightCard>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0 ml-auto">
                {hasPermission(user, 'crm:edit') && (
                  <button
                    onClick={() => openEditActivity(a)}
                    className="text-[#45464d] opacity-60 hover:text-[#006a61] transition-colors"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    title="Edit activity"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                )}
                {hasPermission(user, 'crm:delete') && (
                  <button
                    onClick={() => setDeletingActivityId(a.id)}
                    className="text-[#45464d] opacity-60 hover:text-[#ba1a1a] transition-colors"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    title="Delete activity"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                )}
                <span className="text-xs text-[#45464d]">{a.activityType}</span>
              </div>
            </div>
          ))}
          {activities.length > 0 && hasMoreActivities && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMoreActivities}
                disabled={loadingMoreActivities}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#006a61] border border-[#e2e8f0] hover:bg-[#f8f9ff] transition-colors disabled:opacity-50"
                style={{ background: 'white', cursor: loadingMoreActivities ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {loadingMoreActivities ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Loading…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">expand_more</span>
                    Load More
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {notes.length === 0 && <p className="text-[#45464d] text-sm">No notes yet. Click "Add Note" to add one.</p>}
          {notes.map((n: CrmNote) => (
            <div key={n.id} className={`bg-white border rounded-xl p-4 ${n.isPinned ? 'border-amber-300' : 'border-[#e2e8f0]'}`}>
              {n.isPinned && <span className="flex items-center gap-1 text-xs text-warning mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
              <p className="text-sm text-[#0b1c30] leading-relaxed whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-[#45464d] mt-2">{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log tab */}
      {activeTab === 'audit' && lead && (
        <CrmAuditLog entityType="lead" entityId={lead.id} />
      )}

      {/* Convert modal */}
      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowConvert(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-[#0b1c30] mb-1">Convert Lead to Opportunity</h2>
            <p className="text-sm text-[#45464d] mb-4">This will create a new opportunity from this lead.</p>
            <form onSubmit={handleConvert} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Opportunity Name *</label>
                <input required value={convertForm.oppName} onChange={e => setConvertForm(f => ({ ...f, oppName: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Opportunity Value (MYR)</label>
                <input type="number" min="0" value={convertForm.oppValue} onChange={e => setConvertForm(f => ({ ...f, oppValue: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Expected Close Date</label>
                <input type="date" value={convertForm.expectedCloseDate} onChange={e => setConvertForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Pipeline *</label>
                <select value={convertForm.pipelineId} onChange={e => {
                  const pl = pipelines.find(p => p.id === e.target.value);
                  setConvertForm(f => ({ ...f, pipelineId: e.target.value, stageId: pl?.stages?.[0]?.id ?? '' }));
                }} className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Initial Stage *</label>
                <select value={convertForm.stageId} onChange={e => setConvertForm(f => ({ ...f, stageId: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }}>
                  {(selectedPipeline?.stages ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)}
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff]"
                  style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
            <h2 className="text-lg font-black text-[#0b1c30] mb-4">Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Type</label>
                <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Description</label>
                <textarea rows={3} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff] transition-colors"
                  style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
              <h2 className="text-lg font-black text-[#0b1c30]">Mark as Lost</h2>
              <button
                onClick={() => setShowLostModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined text-[#45464d]">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0b1c30] mb-1">
                  Reason *
                </label>
                <select
                  value={lostCategory}
                  onChange={e => setLostCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20"
                  style={{ fontFamily: 'var(--font-sans)', background: 'white' }}
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
                <label className="block text-sm font-semibold text-[#0b1c30] mb-1">
                  Additional notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={lostNote}
                  onChange={e => setLostNote(e.target.value)}
                  placeholder="Any additional context…"
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-[#006a61]/20"
                  style={{ fontFamily: 'var(--font-sans)' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowLostModal(false)}
                className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff] transition-colors"
                style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLost}
                disabled={!lostCategory}
                className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                style={{ background: '#ba1a1a', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
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
            <h2 className="text-lg font-black text-[#0b1c30] mb-4">Add Note</h2>
            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Note *</label>
                <textarea required rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddNote(false); setNoteContent(''); }}
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff] transition-colors"
                  style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
              <button onClick={() => setDraftModal(false)} className="text-[#45464d] opacity-60 hover:opacity-100" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4 flex gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#45464d]">Channel</label>
                <select
                  value={draftConfig.channel}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, channel: e.target.value as 'whatsapp' | 'email' }))}
                  className="rounded-xl border border-[#e2e8f0] px-3 py-1.5 text-sm"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#45464d]">Tone</label>
                <select
                  value={draftConfig.tone}
                  onChange={(e) => setDraftConfig((p) => ({ ...p, tone: e.target.value as 'formal' | 'friendly' }))}
                  className="rounded-xl border border-[#e2e8f0] px-3 py-1.5 text-sm"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleDraftMessage}
                  disabled={draftMsg.loading}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}
                >
                  {draftMsg.loading ? 'Drafting…' : 'Generate'}
                </button>
              </div>
            </div>

            {draftMsg.error && (
              <div className="mb-4 rounded-md bg-[#fff5f5] border border-[#f3c7c7] px-3 py-2 text-sm text-[#ba1a1a]">
                {draftMsg.error}
              </div>
            )}

            {draftMsg.result && (
              <div className="space-y-3">
                {draftMsg.result.subject && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#45464d]">Subject</p>
                    <p className="rounded-md bg-[#f8f9ff] px-3 py-2 text-sm">{draftMsg.result.subject}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-medium text-[#45464d]">Message</p>
                  <textarea
                    className="w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm"
                    rows={8}
                    defaultValue={draftMsg.result.body}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  />
                </div>
                <p className="text-xs text-[#45464d] opacity-60">Edit as needed before sending. AI-generated — review before use.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Lead modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setFormErrors([]); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0]">
              <h2 className="text-lg font-extrabold text-[#0b1c30]">Edit Lead</h2>
              <button onClick={() => { setShowEdit(false); setFormErrors([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-[#45464d]">close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Title *</label>
                <input required value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 transition-all ${formErrors.some(e => e.field === 'title') ? '!border-red-500 focus:ring-red-200' : 'border-[#e2e8f0] focus:ring-[#006a61]/20'}`} />
                {formErrors.some(e => e.field === 'title') && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'title')?.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Contact Name</label>
                  <input value={editForm.contactName ?? ''} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Company</label>
                  <input value={editForm.companyName ?? ''} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Email</label>
                  <input type="email" value={editForm.contactEmail ?? ''} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
                    className={`w-full px-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 transition-all ${formErrors.some(e => e.field === 'contactEmail') ? '!border-red-500 focus:ring-red-200' : 'border-[#e2e8f0] focus:ring-[#006a61]/20'}`} />
                  {formErrors.some(e => e.field === 'contactEmail') && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'contactEmail')?.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Phone</label>
                  <input value={editForm.contactPhone ?? ''} onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Source</label>
                  <select value={editForm.source ?? 'OTHER'} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    {['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','WHATSAPP','OTHER'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Estimated Value (MYR)</label>
                  <input type="number" min="0" value={editForm.estimatedValue ?? ''} onChange={e => setEditForm(f => ({ ...f, estimatedValue: e.target.value }))}
                    className={`w-full px-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 transition-all ${formErrors.some(e => e.field === 'estimatedValue') ? '!border-red-500 focus:ring-red-200' : 'border-[#e2e8f0] focus:ring-[#006a61]/20'}`} />
                  {formErrors.some(e => e.field === 'estimatedValue') && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'estimatedValue')?.message}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Follow-up Date</label>
                  <input type="date" value={editForm.followUpDate ?? ''} onChange={e => setEditForm(f => ({ ...f, followUpDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Owner</label>
                  <select value={lead!.owner?.id ?? ''} onChange={e => setEditForm(f => ({ ...f, ownerId: e.target.value || undefined }))}
                    className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none" style={{ fontFamily: 'var(--font-sans)' }}>
                    {crmUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Follow-up Note</label>
                <input value={editForm.followUpNote ?? ''} onChange={e => setEditForm(f => ({ ...f, followUpNote: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#0b1c30] mb-1">Qualification Notes</label>
                <p className="text-[11px] text-[#45464d] opacity-60 mb-1.5">Supports markdown — use **bold**, - bullets, 1. numbering, or line breaks for formatting.</p>
                <textarea rows={5} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#e2e8f0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#006a61]/20 transition-all resize-vertical" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEdit(false); setFormErrors([]); }} className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff]" style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50" style={{ background: '#006a61', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full text-white shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
        style={{ background: '#006a61', border: 'none', cursor: 'pointer' }}
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

      {/* Edit Activity modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingActivity(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-[#0b1c30] mb-4">Edit Activity</h2>
            <form onSubmit={handleEditActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Type</label>
                <select value={editActivityForm.activityType} onChange={e => setEditActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Subject *</label>
                <input required value={editActivityForm.subject ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Description</label>
                <textarea rows={3} value={editActivityForm.description ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#45464d] mb-1">Scheduled At</label>
                <input type="datetime-local" value={editActivityForm.scheduledAt ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-xl px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'white' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingActivity(null)}
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-[#e2e8f0] text-[#45464d] hover:bg-[#f8f9ff] transition-colors"
                  style={{ background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                  style={{ background: '#006a61', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Activity confirmation dialog */}
      <ConfirmDialog
        open={!!deletingActivityId}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmVariant="danger"
        loading={saving}
        onConfirm={handleDeleteActivity}
        onCancel={() => setDeletingActivityId(null)}
      />
      </div>
        </div>
      </div>
    </>
  );
};

export default CrmLeadDetail;
