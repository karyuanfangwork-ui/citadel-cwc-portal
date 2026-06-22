import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmOpportunity, CrmActivity, CrmActivityType, CrmStageHistory, CrmPipeline, CrmPipelineStage, CrmAccount, CrmUser } from '../src/services/crm.service';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateOpportunity, ValidationError } from '../src/utils/crmValidation';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';
import InlineEdit from '../src/components/crm/InlineEdit';
import CrmAuditLog from '../src/components/crm/CrmAuditLog';
import { useNextBestAction, useWinProbability, useAnalyzeNote, useWinLossDebrief } from '../src/hooks/useCrmAi';

// ── Kinetic Enterprise Design Tokens ──────────────────────────────────────
const TEAL = '#006a61';
const TEAL_CONTAINER = '#86f2e4';
const TEAL_ON_CONTAINER = '#006f66';
const DARK = '#0b1c30';
const TEXT_SEC = '#45464d';
const TEXT_MUTED = '#76777d';
const SURFACE = '#f8f9ff';
const SURFACE_LOW = '#eff4ff';
const SURFACE_MED = '#e5eeff';
const SURFACE_HIGH = '#dce9ff';
const SURFACE_MAX = '#d3e4fe';
const BORDER = '#e2e8f0';
const ERROR = '#ba1a1a';
const WHITE = '#ffffff';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const relativeTime = (date: string) => {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMins = Math.floor((now - then) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  if (diffHours < 24) return `${diffHours}H AGO`;
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return formatDate(date)!.toUpperCase();
  return formatDate(date)!.toUpperCase();
};

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

// ── Deal Health Computation ──────────────────────────────────────────────
type HealthInsight = { icon: string; text: string; type: 'positive' | 'warning' | 'danger' };

const computeDealHealth = (opp: CrmOpportunity): { status: string; statusColor: string; trendIcon: string; insights: HealthInsight[] } => {
  const insights: HealthInsight[] = [];

  const recentActivity = (opp.activities ?? []).find(a => {
    const d = new Date(a.createdAt);
    return Date.now() - d.getTime() < 7 * 86400000;
  });
  if (recentActivity) {
    insights.push({ icon: 'check_circle', text: 'Engagement activity in the last 7 days.', type: 'positive' });
  }

  if (opp.probability >= 65) {
    insights.push({ icon: 'check_circle', text: `${opp.probability}% win probability — strong deal.`, type: 'positive' });
  }

  if (opp.expectedCloseDate) {
    const daysToClose = Math.ceil((new Date(opp.expectedCloseDate).getTime() - Date.now()) / 86400000);
    if (daysToClose < 7 && daysToClose > 0) {
      insights.push({ icon: 'warning', text: `Close date in ${daysToClose} day${daysToClose !== 1 ? 's' : ''}.`, type: 'danger' });
    } else if (daysToClose < 0) {
      insights.push({ icon: 'warning', text: `Close date passed ${Math.abs(daysToClose)} day${Math.abs(daysToClose) !== 1 ? 's' : ''} ago.`, type: 'danger' });
    }
  }

  if (!recentActivity && (opp.activities ?? []).length > 0) {
    insights.push({ icon: 'warning', text: 'No activity in the past 7 days.', type: 'warning' });
  }

  if ((opp.activities ?? []).length === 0) {
    insights.push({ icon: 'info', text: 'No activities logged yet.', type: 'warning' });
  }

  const hasWarning = insights.some(i => i.type === 'danger');
  const hasCaution = insights.some(i => i.type === 'warning');
  const status = hasWarning ? 'At Risk' : hasCaution ? 'Needs Attention' : 'Stable';
  const statusColor = hasWarning ? 'text-[#ba1a1a]' : hasCaution ? 'text-[#c27803]' : `text-[${TEAL}]`;
  const trendIcon = hasWarning ? 'trending_down' : hasCaution ? 'trending_flat' : 'trending_up';

  return { status, statusColor, trendIcon, insights };
};

const CrmOpportunityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [opp, setOpp] = useState<CrmOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'history' | 'audit'>('overview');
  const [showMoveStage, setShowMoveStage] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [showEditActivity, setShowEditActivity] = useState(false);
  const [editActivityForm, setEditActivityForm] = useState<Partial<CrmActivity>>({});
  const [savingActivityEdit, setSavingActivityEdit] = useState(false);
  const [showDeleteActivity, setShowDeleteActivity] = useState(false);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Edit modal state ─────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editPipelines, setEditPipelines] = useState<CrmPipeline[]>([]);
  const [editStages, setEditStages] = useState<CrmPipelineStage[]>([]);
  const [editAccounts, setEditAccounts] = useState<CrmAccount[]>([]);
  const [loadingEditDeps, setLoadingEditDeps] = useState(false);
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Delete state ─────────────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── AI state ──────────────────────────────────────────────────────────
  const winProb = useWinProbability();
  const noteAnalyzer = useAnalyzeNote();
  const debrief = useWinLossDebrief();
  const nba = useNextBestAction();

  const handleGetDebrief = () => {
    if (!id) return;
    debrief.fetch(id);
  };

  // ── Edit modal handlers ───────────────────────────────────────────────
  const openEdit = async (o: CrmOpportunity) => {
    setEditForm({
      name: o.name ?? '',
      accountId: o.accountId ?? '',
      pipelineId: o.pipelineId ?? '',
      stageId: o.stageId ?? '',
      value: o.value?.toString() ?? '',
      probability: o.probability?.toString() ?? '',
      expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.slice(0, 10) : '',
      description: o.description ?? '',
      ownerId: o.ownerId ?? '',
      forecastCategory: o.forecastCategory ?? 'PIPELINE',
    });
    setFormErrors([]);
    setShowEdit(true);
    setLoadingEditDeps(true);
    try {
      const [pipesRes, accsRes] = await Promise.all([
        crmService.listPipelines(),
        crmService.listAccounts({ limit: 200 }),
      ]);
      setEditPipelines(pipesRes);
      setEditAccounts(accsRes.accounts);
      const currentPipeline = pipesRes.find((p: CrmPipeline) => p.id === o.pipelineId);
      setEditStages(currentPipeline?.stages ?? []);
    } catch (err) {
      console.error('Failed to load edit dependencies', err);
    } finally {
      setLoadingEditDeps(false);
    }
  };

  const handleEditPipelineChange = (pipelineId: string) => {
    setEditForm(f => ({ ...f, pipelineId, stageId: '' }));
    const pipe = editPipelines.find(p => p.id === pipelineId);
    setEditStages(pipe?.stages ?? []);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const errors = validateOpportunity(editForm);
    if (errors.length > 0) { setFormErrors(errors); return; }
    setSavingEdit(true);
    try {
      const payload = cleanFormPayload(editForm, NUMERIC_KEYS.opportunity);
      const updated = await crmService.updateOpportunity(id, payload);
      setOpp(updated);
      setShowEdit(false);
      setFormErrors([]);
    } catch (err) {
      console.error('Failed to update opportunity', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete handler ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await crmService.deleteOpportunity(id);
      navigate('/crm/opportunities');
    } catch (err) {
      console.error('Failed to delete opportunity', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleWinProbability = () => {
    if (!id) return;
    winProb.fetch(id);
  };

  const handleAnalyzeNote = (activityId: string) => {
    noteAnalyzer.analyze(activityId);
  };

  const confidenceColor = (c: string) =>
    c === 'high' ? 'text-emerald-700 bg-emerald-50' : c === 'low' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50';

  const reload = () => {
    if (!id) return;
    setLoading(true);
    crmService.getOpportunity(id).then(setOpp).catch(() => navigate('/crm/opportunities')).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  useEffect(() => {
    if (opp?.id) nba.fetch('opportunity', opp.id);
  }, [opp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);

  const handleMoveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedStageId) return;
    try {
      setSaving(true);
      await crmService.moveStage(id, selectedStageId, lostReason || undefined);
      reload();
      setShowMoveStage(false);
      setLostReason('');
    } catch (e: any) {
      console.error(e);
      const gateMsg = e?.response?.data?.error as string | undefined;
      if (gateMsg) alert(gateMsg);
    } finally { setSaving(false); }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      await crmService.createActivity({ ...activityForm, opportunityId: id });
      reload();
      setShowAddActivity(false);
      setActivityForm({ activityType: 'CALL' });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !noteContent.trim()) return;
    try {
      setSaving(true);
      await crmService.createNote({ content: noteContent, opportunityId: id });
      reload();
      setShowAddNote(false);
      setNoteContent('');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openEditActivity = (a: CrmActivity) => {
    setEditActivityForm({
      id: a.id,
      activityType: a.activityType,
      subject: a.subject ?? '',
      description: a.description ?? '',
      scheduledAt: a.scheduledAt ? a.scheduledAt.slice(0, 16) : '',
    });
    setShowEditActivity(true);
  };

  const handleEditActivitySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editActivityForm.id) return;
    setSavingActivityEdit(true);
    try {
      const { id: _aid, ...payload } = editActivityForm;
      await crmService.updateActivity(editActivityForm.id!, payload);
      reload();
      setShowEditActivity(false);
      setEditActivityForm({});
    } catch (e) { console.error(e); }
    finally { setSavingActivityEdit(false); }
  };

  const handleDeleteActivity = async () => {
    if (!deleteActivityId) return;
    setDeletingActivity(true);
    try {
      await crmService.deleteActivity(deleteActivityId);
      reload();
      setShowDeleteActivity(false);
      setDeleteActivityId(null);
    } catch (e) { console.error(e); }
    finally { setDeletingActivity(false); }
  };

  const handleLoadMoreActivities = async () => {
    if (!opp) return;
    setLoadingMoreActivities(true);
    try {
      const nextPage = activityPage + 1;
      const res = await crmService.listActivities({ opportunityId: opp.id, page: nextPage, limit: 10 });
      setOpp(prev => prev ? { ...prev, activities: [...(prev.activities ?? []), ...res.activities] } : prev);
      setActivityPage(nextPage);
      if (res.activities.length < 10) setHasMoreActivities(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMoreActivities(false);
    }
  };

  const handleSetReminder = async (activityId: string) => {
    try {
      await crmService.sendActivityReminder(activityId);
      setOpp(prev => prev ? {
        ...prev,
        activities: (prev.activities ?? []).map(a =>
          a.id === activityId ? { ...a, reminderSent: true } : a
        ),
      } : prev);
    } catch (e) { console.error(e); }
  };

  // ── Computed values ───────────────────────────────────────────────────
  const dealHealth = useMemo(() => opp ? computeDealHealth(opp) : { status: '', statusColor: '', trendIcon: '', insights: [] as HealthInsight[] }, [opp]);

  const daysInStage = useMemo(() => {
    if (!opp?.stageHistory || opp.stageHistory.length === 0) return null;
    const lastMove = opp.stageHistory[opp.stageHistory.length - 1];
    return Math.floor((Date.now() - new Date(lastMove.movedAt).getTime()) / 86400000);
  }, [opp?.stageHistory]);

  const upcomingMilestone = useMemo(() => {
    if (!opp?.activities) return null;
    return (opp.activities)
      .filter(a => a.scheduledAt && new Date(a.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0] ?? null;
  }, [opp?.activities]);

  const expectedRevenue = useMemo(() => ((opp?.value ?? 0) * (opp?.probability ?? 0)) / 100, [opp?.value, opp?.probability]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen" style={{ background: SURFACE }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border rounded-xl p-5 mb-4 animate-pulse" style={{ borderColor: BORDER }}>
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!opp) return null;

  const stages = opp.pipeline?.stages ?? [];
  const currentStageOrder = opp.stage?.displayOrder ?? 0;
  const isLost = opp.stage?.isLostStage;
  const isWon = opp.stage?.isWonStage;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: SURFACE }}>
      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-sm" style={{ color: TEXT_SEC }}>
          <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:opacity-70">CRM</Link>
          <span style={{ color: TEXT_MUTED }}>/</span>
          <Link to="/crm/opportunities" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:opacity-70">Opportunities</Link>
          <span style={{ color: TEXT_MUTED }}>/</span>
          <span className="font-semibold" style={{ color: DARK }}>{opp.name}</span>
        </div>
      </div>

      {/* ── Header Section ───────────────────────────────────────────── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            {/* Left: Icon + Name + Account */}
            <div className="flex gap-5 items-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm" style={{ background: TEAL_CONTAINER, color: TEAL_ON_CONTAINER }}>
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-semibold" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>{opp.name}</h2>
                  <span className="px-2 py-0.5 rounded uppercase tracking-widest font-bold" style={{ fontSize: 11, background: `${TEAL}10`, color: TEAL, border: `1px solid ${TEAL}20` }}>
                    {opp.stage?.name ?? 'No Stage'}
                  </span>
                  {(isWon || isLost) && (
                    <span className="px-2 py-0.5 rounded uppercase tracking-widest font-bold" style={{
                      fontSize: 11,
                      background: isWon ? '#dcfce7' : '#fee2e2',
                      color: isWon ? '#166534' : ERROR,
                      border: `1px solid ${isWon ? '#bbf7d0' : '#fecaca'}`,
                    }}>
                      {isWon ? 'WON' : 'LOST'}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-2" style={{ fontSize: 14, color: TEXT_SEC }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>business</span>
                  {opp.account ? (
                    <Link to={`/crm/accounts/${opp.account.id}`} className="hover:underline" style={{ textDecoration: 'none', color: TEAL }}>{opp.account.name}</Link>
                  ) : <span style={{ color: TEXT_MUTED }}>No account</span>}
                  {opp.contact && <span style={{ color: TEXT_MUTED }}> · {opp.contact.firstName} {opp.contact.lastName}</span>}
                </p>
              </div>
            </div>

            {/* Right: Value + Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="font-bold uppercase tracking-widest" style={{ fontSize: 11, color: TEXT_SEC }}>DEAL VALUE</p>
                <p className="font-semibold" style={{ fontSize: 24, letterSpacing: '-0.01em', color: TEAL }}>{formatCurrency(opp.value)}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEdit(opp)}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors"
                  style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Edit Opportunity
                </button>
                {hasPermission(user, 'crm:delete') && (
                  <button onClick={() => setShowDelete(true)}
                    className="px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                    style={{ fontSize: 14, border: `1px solid #fecaca`, color: ERROR, background: '#fff5f5', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Delete
                  </button>
                )}
                <button onClick={() => { setSelectedStageId(opp.stageId); setShowMoveStage(true); }}
                  className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
                  style={{ fontSize: 14, background: TEAL, color: WHITE, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Move to Next Stage
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Grid: Sidebar + Central ─────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 grid grid-cols-12 gap-4">
        {/* Left Sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          {/* Deal Attributes */}
          <div className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: BORDER }}>
            <h3 className="font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ fontSize: 11, color: TEXT_SEC }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              DEAL ATTRIBUTES
            </h3>
            <div className="space-y-4">
              <div>
                <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Expected Close</p>
                <p className="font-medium" style={{ fontSize: 14, color: DARK }}>{formatDate(opp.expectedCloseDate)}</p>
              </div>
              <div>
                <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Probability</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: SURFACE_HIGH }}>
                    <div className="h-full rounded-full" style={{ background: TEAL, width: `${opp.probability}%` }} />
                  </div>
                  <span className="font-mono font-medium" style={{ fontSize: 13, color: TEAL }}>{opp.probability}%</span>
                </div>
              </div>
              {opp.description && (
                <div>
                  <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Description</p>
                  <p className="mt-1 leading-relaxed" style={{ fontSize: 13, color: DARK }}>{opp.description}</p>
                </div>
              )}
              <div>
                <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Assigned Owner</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold" style={{ background: TEAL_CONTAINER, color: TEAL_ON_CONTAINER, fontSize: 10 }}>
                    {opp.owner ? `${opp.owner.firstName[0]}${opp.owner.lastName[0]}` : '?'}
                  </div>
                  <p style={{ fontSize: 14, color: DARK }}>{opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : 'Unassigned'}</p>
                </div>
              </div>
              <div>
                <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Pipeline</p>
                <p className="font-medium" style={{ fontSize: 14, color: DARK }}>{opp.pipeline?.name ?? '—'}</p>
              </div>
              {/* AI Win Probability — inline */}
              {!isWon && !isLost && (
                <div>
                  <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>AI Win Probability</p>
                  {winProb.data ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold" style={{ fontSize: 14, color: TEAL }}>{winProb.data.probability}%</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${confidenceColor(winProb.data.confidence)}`}>
                        {winProb.data.confidence}
                      </span>
                    </div>
                  ) : (
                    <button onClick={handleWinProbability} disabled={winProb.loading}
                      className="mt-1 flex items-center gap-1 text-xs font-semibold hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                      {winProb.loading ? 'Analyzing…' : 'Predict'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Deal Health */}
          <div className="bg-white border rounded-xl p-5 shadow-sm overflow-hidden relative" style={{ borderColor: BORDER }}>
            <div className="absolute top-0 right-0 p-3">
              <span className="material-symbols-outlined opacity-20" style={{ fontSize: 40, color: TEAL }}>favorite</span>
            </div>
            <h3 className="font-bold uppercase tracking-widest mb-4" style={{ fontSize: 11, color: TEXT_SEC }}>DEAL HEALTH</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-bold" style={{ fontSize: 28, color: dealHealth.status === 'At Risk' ? ERROR : dealHealth.status === 'Needs Attention' ? '#c27803' : TEAL }}>{dealHealth.status}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: TEAL }}>{dealHealth.trendIcon}</span>
            </div>
            <ul className="space-y-3">
              {dealHealth.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: insight.type === 'positive' ? DARK : insight.type === 'danger' ? `${ERROR}cc` : '#92400e' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, marginTop: 2, color: insight.type === 'positive' ? TEAL : insight.type === 'danger' ? ERROR : '#d97706' }}>{insight.icon}</span>
                  <span>{insight.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Central Area */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* Tabbed Card */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
            {/* Tabs */}
            <div className="flex border-b px-6" style={{ borderColor: BORDER }}>
              {(['overview', 'activities', 'notes', 'history', 'audit'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-6 py-4 font-medium transition-all"
                  style={{
                    fontSize: 14,
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? `2px solid ${TEAL}` : '2px solid transparent',
                    color: activeTab === tab ? TEAL : TEXT_MUTED,
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                  {tab === 'history' ? 'Stage History' : tab === 'audit' ? 'Audit Log' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── Overview Tab ────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <>
                  {/* Pipeline Progress */}
                  {stages.length > 0 && (
                    <div className="mb-10">
                      <h4 className="font-bold uppercase tracking-widest mb-6" style={{ fontSize: 11, color: TEXT_SEC }}>Pipeline Progress</h4>
                      <div className="flex items-center w-full">
                        {stages.map((s, i) => {
                          const isCurrent = s.id === opp.stageId;
                          const isThisLost = isCurrent && isLost;
                          const isThisWon = isCurrent && isWon;
                          // For lost deals, only fill up to (but not including) the lost stage
                          const isPast = isLost
                            ? s.displayOrder < currentStageOrder && !s.isLostStage
                            : s.displayOrder < currentStageOrder;
                          const barColor = isThisLost ? ERROR : (isPast || isCurrent ? TEAL : SURFACE_HIGH);
                          const labelColor = isThisLost ? ERROR : (isPast || isCurrent ? TEAL : TEXT_MUTED);
                          return (
                            <div key={s.id} className="flex-1 group relative">
                              <div className={`h-2 ${i === 0 ? 'rounded-l-full' : ''} ${i === stages.length - 1 ? 'rounded-r-full' : ''}`}
                                style={{ background: barColor }}>
                                {isCurrent && !isLost && !isWon && <div className="absolute inset-0 bg-white/30 animate-pulse" style={{ borderRadius: 'inherit' }} />}
                              </div>
                              <p className="absolute -bottom-6 left-1/2 -translate-x-1/2 font-bold whitespace-nowrap" style={{ fontSize: 10, color: labelColor }}>
                                {s.name.toUpperCase()}
                              </p>
                              {isCurrent && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 rounded-full z-10"
                                style={{ borderColor: isThisLost ? ERROR : TEAL, boxShadow: `0 0 0 4px ${isThisLost ? ERROR : TEAL}20` }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-10" /> {/* spacer for labels below bar */}
                    </div>
                  )}

                  {/* AI Suggested Actions */}
                  {nba.loading && !nba.data && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined animate-pulse" style={{ fontSize: 14, color: TEAL }}>auto_awesome</span>
                      <span className="animate-pulse" style={{ fontSize: 13, color: TEXT_MUTED }}>Loading suggested actions…</span>
                    </div>
                  )}
                  {nba.data && nba.data.actions?.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="font-semibold" style={{ fontSize: 12, color: TEXT_SEC }}>AI Suggested:</span>
                      {nba.data.actions.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium" style={{ fontSize: 12, background: SURFACE_LOW, border: `1px solid ${BORDER}`, color: DARK }} title={a.reason}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                          {a.action}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Two-column: Contacts + Activity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Associated Contacts */}
                    <section>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold uppercase tracking-widest" style={{ fontSize: 11, color: TEXT_SEC }}>Associated Contacts</h4>
                      </div>
                      <div className="space-y-3">
                        {opp.contact ? (
                          <div className="p-3 border rounded-lg flex items-center gap-3 group transition-all hover:border-[#006a61]/30" style={{ background: SURFACE_LOW, borderColor: BORDER }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ background: SURFACE_MAX, color: TEAL, fontSize: 14 }}>
                              {opp.contact.firstName[0]}{opp.contact.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold" style={{ fontSize: 14, color: DARK }}>{opp.contact.firstName} {opp.contact.lastName}</p>
                              {opp.contact.email && <p style={{ fontSize: 11, color: TEXT_MUTED }}>{opp.contact.email}</p>}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {opp.contact.email && (
                                <a href={`mailto:${opp.contact.email}`} className="material-symbols-outlined cursor-pointer p-1 rounded hover:bg-[#006a61]/10" style={{ fontSize: 16, color: TEAL, textDecoration: 'none' }}>mail</a>
                              )}
                              {opp.contact.phone && (
                                <a href={`tel:${opp.contact.phone}`} className="material-symbols-outlined cursor-pointer p-1 rounded hover:bg-[#006a61]/10" style={{ fontSize: 16, color: TEAL, textDecoration: 'none' }}>phone</a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: TEXT_MUTED }}>No contact linked.</p>
                        )}
                      </div>
                    </section>

                    {/* Recent Activity */}
                    <section>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold uppercase tracking-widest" style={{ fontSize: 11, color: TEXT_SEC }}>Recent Activity</h4>
                        <button onClick={() => setActiveTab('activities')} className="font-bold hover:underline" style={{ fontSize: 12, background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>View All</button>
                      </div>
                      <div className="relative space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px" style={{ ...{ '--tw-before-bg': BORDER } } as React.CSSProperties}>
                        {(opp.activities ?? []).slice(0, 3).map((a, i) => (
                          <div key={a.id} className="relative pl-8">
                            <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2`} style={{ background: i === 0 ? TEAL : SURFACE_MAX, borderColor: WHITE }} />
                            <div className="flex justify-between mb-1">
                              <p className="font-bold" style={{ fontSize: 13, color: DARK }}>{a.subject}</p>
                              <span className="font-mono" style={{ fontSize: 10, color: TEXT_MUTED }}>{relativeTime(a.createdAt)}</span>
                            </div>
                            <p className="leading-relaxed" style={{ fontSize: 13, color: TEXT_SEC }}>
                              {a.description || `${a.activityType} activity`}
                            </p>
                          </div>
                        ))}
                        {(opp.activities ?? []).length === 0 && <p style={{ fontSize: 13, color: TEXT_MUTED }}>No activities yet.</p>}
                      </div>
                    </section>
                  </div>

                  {/* Bento Metrics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    {/* Expected Revenue */}
                    <div className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: BORDER }}>
                      <p className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: 10, color: TEXT_MUTED }}>Expected Revenue</p>
                      <p className="font-bold" style={{ fontSize: 24, color: TEAL }}>{formatCurrency(expectedRevenue)}</p>
                      <p className="mt-2 flex items-center gap-1" style={{ fontSize: 10, color: TEAL }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>keyboard_double_arrow_up</span>
                        Weighted by {opp.probability}% probability
                      </p>
                    </div>
                    {/* Days in Stage */}
                    <div className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: BORDER }}>
                      <p className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: 10, color: TEXT_MUTED }}>Days in Stage</p>
                      <p className="font-bold" style={{ fontSize: 24, color: DARK }}>{daysInStage ?? '—'} {daysInStage !== null ? 'Days' : ''}</p>
                      <p className="mt-2" style={{ fontSize: 10, color: TEXT_MUTED }}>Since last stage move</p>
                    </div>
                    {/* Upcoming Milestone */}
                    <div className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: BORDER }}>
                      <p className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: 10, color: TEXT_MUTED }}>Upcoming Milestone</p>
                      <p className="font-semibold" style={{ fontSize: 18, color: DARK }}>{upcomingMilestone?.subject ?? 'None scheduled'}</p>
                      {upcomingMilestone?.scheduledAt && (() => {
                        const daysLeft = Math.ceil((new Date(upcomingMilestone.scheduledAt).getTime() - Date.now()) / 86400000);
                        return (
                          <p className="mt-2 flex items-center gap-1" style={{ fontSize: 10, color: daysLeft <= 3 ? ERROR : TEXT_MUTED }}>
                            {daysLeft <= 3 && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>alarm</span>}
                            Due in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Inline Editable Fields (for power users) */}
                  <div className="mt-8 bg-white border rounded-xl p-5" style={{ borderColor: BORDER }}>
                    <h3 className="font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ fontSize: 11, color: TEXT_SEC }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                      QUICK EDIT
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Deal Value</p>
                        <InlineEdit value={opp.value} type="number" display={formatCurrency(opp.value)}
                          onSave={async (v) => { await crmService.updateOpportunity(id!, { value: Number(v) }); reload(); }} />
                      </div>
                      <div>
                        <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Probability</p>
                        <InlineEdit value={opp.probability} type="number"
                          onSave={async (v) => { await crmService.updateOpportunity(id!, { probability: Number(v) }); reload(); }} />
                      </div>
                      <div>
                        <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Close Date</p>
                        <InlineEdit value={opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : null} type="date" display={formatDate(opp.expectedCloseDate)}
                          onSave={async (v) => { await crmService.updateOpportunity(id!, { expectedCloseDate: v || null }); reload(); }} />
                      </div>
                      <div>
                        <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Owner</p>
                        <InlineEdit value={opp.ownerId} type="select" options={crmUsers.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u.id }))} display={opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : '—'}
                          editable={hasPermission(user, 'crm:admin')}
                          onSave={async (v) => { await crmService.updateOpportunity(id!, { ownerId: v }); reload(); }} />
                      </div>
                      <div>
                        <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Created</p>
                        <p style={{ fontSize: 14, color: DARK }}>{formatDate(opp.createdAt)}</p>
                      </div>
                      {opp.wonAt && (
                        <div>
                          <p className="uppercase font-bold" style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: '-0.02em' }}>Won At</p>
                          <p style={{ fontSize: 14, color: DARK }}>{formatDate(opp.wonAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Win/Loss Debrief — shown only for won/lost deals */}
                  {(isWon || isLost) && (
                    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <AiInsightCard
                        title={`AI ${isWon ? 'Win' : 'Loss'} Debrief`}
                        loading={debrief.loading}
                        error={debrief.error}
                        onRefresh={handleGetDebrief}
                      >
                        {!debrief.data ? (
                          <button onClick={handleGetDebrief} className="text-sm hover:underline" style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            Generate debrief
                          </button>
                        ) : (
                          <div className="space-y-3" style={{ fontSize: 14 }}>
                            <p style={{ color: DARK }}>{debrief.data.summary}</p>
                            <div>
                              <p className="font-bold uppercase mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Key Factors</p>
                              {debrief.data.keyFactors.map((f, i) => <p key={i} style={{ color: DARK }}>• {f}</p>)}
                            </div>
                            <div>
                              <p className="font-bold uppercase mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Lessons Learned</p>
                              {debrief.data.lessonsLearned.map((l, i) => <p key={i} style={{ color: DARK }}>• {l}</p>)}
                            </div>
                            <div>
                              <p className="font-bold uppercase mb-1" style={{ fontSize: 11, color: '#16a34a' }}>Follow-On Actions</p>
                              {debrief.data.followOnActions.map((a, i) => <p key={i} className="font-medium" style={{ color: '#16a34a' }}>• {a}</p>)}
                            </div>
                          </div>
                        )}
                      </AiInsightCard>
                    </div>
                  )}
                </>
              )}

              {/* ── Activities Tab ─────────────────────────────────────── */}
              {activeTab === 'activities' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <button onClick={() => setShowAddActivity(true)}
                      className="flex items-center gap-1 font-semibold hover:opacity-80"
                      style={{ fontSize: 14, background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Log Activity
                    </button>
                  </div>
                  {(opp.activities ?? []).length === 0 && <p style={{ color: TEXT_SEC, fontSize: 14 }}>No activities yet.</p>}
                  {(opp.activities ?? []).map(a => (
                    <div key={a.id} className="flex gap-4 bg-white border rounded-xl p-4" style={{ borderColor: BORDER }}>
                      <span className="material-symbols-outlined mt-0.5" style={{ color: TEAL }}>{ACTIVITY_ICONS[a.activityType]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold" style={{ fontSize: 14, color: DARK }}>{a.subject}</p>
                        {a.description && <p className="mt-0.5 whitespace-pre-wrap" style={{ fontSize: 13, color: TEXT_SEC }}>{a.description}</p>}
                        <p className="mt-1" style={{ fontSize: 12, color: TEXT_MUTED }}>
                          {a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                          {a.scheduledAt && <span className="ml-2" style={{ color: TEAL }}>Scheduled: {formatDate(a.scheduledAt)}</span>}
                          {a.scheduledAt && !a.completedAt && new Date(a.scheduledAt) < new Date() && (
                            <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold" style={{ fontSize: 10, background: '#fef2f2', color: ERROR }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>warning</span> Overdue
                            </span>
                          )}
                          {a.reminderSent && (
                            <span className="ml-2 inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, color: '#16a34a', background: '#dcfce7' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>notifications_active</span> Reminded
                            </span>
                          )}
                          {a.scheduledAt && new Date(a.scheduledAt) > new Date() && !a.reminderSent && (
                            <button onClick={() => handleSetReminder(a.id)}
                              className="ml-2 inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded-full transition-colors hover:opacity-80"
                              style={{ fontSize: 10, color: TEAL, background: 'none', border: 'none', cursor: 'pointer' }}
                              title="Send a reminder for this scheduled activity">
                              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>notifications</span> Set Reminder
                            </button>
                          )}
                        </p>
                        {/* AI Note Analyzer */}
                        {['CALL', 'MEETING', 'WHATSAPP'].includes(a.activityType) && (
                          <div className="mt-2">
                            {!noteAnalyzer.results[a.id] ? (
                              <div>
                                <button onClick={() => handleAnalyzeNote(a.id)} disabled={noteAnalyzer.loadingId === a.id}
                                  className="flex items-center gap-1 hover:opacity-80 disabled:opacity-50"
                                  style={{ fontSize: 12, background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                                  {noteAnalyzer.loadingId === a.id ? 'Analyzing…' : 'AI Analyze'}
                                </button>
                                {noteAnalyzer.error && !noteAnalyzer.results[a.id] && <p className="mt-1" style={{ fontSize: 12, color: ERROR }}>{noteAnalyzer.error}</p>}
                              </div>
                            ) : (
                              <AiInsightCard title="Note Analysis" className="mt-1" error={noteAnalyzer.error} loading={noteAnalyzer.loadingId === a.id} onRefresh={() => handleAnalyzeNote(a.id)}>
                                <div className="space-y-1" style={{ fontSize: 14 }}>
                                  <div className="flex items-center gap-1">
                                    <span className={`material-symbols-outlined ${noteAnalyzer.results[a.id]!.sentiment === 'positive' ? 'text-emerald-600' : noteAnalyzer.results[a.id]!.sentiment === 'negative' ? 'text-red-600' : 'text-gray-400'}`} style={{ fontSize: 14 }}>
                                      {noteAnalyzer.results[a.id]!.sentiment === 'positive' ? 'sentiment_satisfied' : noteAnalyzer.results[a.id]!.sentiment === 'negative' ? 'sentiment_dissatisfied' : 'sentiment_neutral'}
                                    </span>
                                    <span className="capitalize" style={{ color: TEXT_SEC }}>{noteAnalyzer.results[a.id]!.sentiment}</span>
                                  </div>
                                  <p><span className="font-medium">Next action:</span> {noteAnalyzer.results[a.id]!.nextAction}</p>
                                  {noteAnalyzer.results[a.id]!.suggestedStatusChange && (
                                    <p style={{ color: TEAL }}><span className="font-medium">Suggest stage:</span> {noteAnalyzer.results[a.id]!.suggestedStatusChange}</p>
                                  )}
                                  {noteAnalyzer.results[a.id]!.keyFacts.length > 0 && (
                                    <ul className="list-disc pl-4" style={{ color: TEXT_SEC }}>
                                      {noteAnalyzer.results[a.id]!.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
                                    </ul>
                                  )}
                                </div>
                              </AiInsightCard>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Activity Card Actions */}
                      <div className="flex flex-col items-end gap-2 ml-2 shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold" style={{ fontSize: 10, background: '#e0f2f1', color: TEAL, border: `1px solid ${TEAL}30` }}>{a.activityType}</span>
                        <div className="flex items-center gap-1">
                          {hasPermission(user, 'crm:edit') && (
                            <button onClick={() => openEditActivity(a)} title="Edit activity"
                              className="p-1 rounded hover:opacity-70 transition-colors"
                              style={{ fontSize: 12, color: TEXT_SEC, background: 'none', border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                          )}
                          {hasPermission(user, 'crm:delete') && (
                            <button onClick={() => { setDeleteActivityId(a.id); setShowDeleteActivity(true); }} title="Delete activity"
                              className="p-1 rounded hover:opacity-70 transition-colors"
                              style={{ fontSize: 12, color: ERROR, background: 'none', border: 'none', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasMoreActivities && (opp.activities ?? []).length >= 10 && (
                    <div className="flex justify-center pt-2">
                      <button onClick={handleLoadMoreActivities} disabled={loadingMoreActivities}
                        className="flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors disabled:opacity-50"
                        style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEAL, background: 'none', cursor: loadingMoreActivities ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        {loadingMoreActivities ? (
                          <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>Loading…</>
                        ) : (
                          <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>Load More</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Notes Tab ──────────────────────────────────────────── */}
              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <button onClick={() => setShowAddNote(true)}
                      className="flex items-center gap-1 font-semibold hover:underline"
                      style={{ fontSize: 14, background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Add Note
                    </button>
                  </div>
                  {(opp.notes ?? []).length === 0 && <p style={{ color: TEXT_SEC, fontSize: 14 }}>No notes yet.</p>}
                  {(opp.notes ?? []).map(n => (
                    <div key={n.id} className={`border rounded-xl p-4 ${n.isPinned ? 'border-amber-400' : ''}`} style={{ background: WHITE, borderColor: n.isPinned ? '#fbbf24' : BORDER }}>
                      {n.isPinned && <span className="flex items-center gap-1 mb-2" style={{ fontSize: 12, color: '#d97706' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>push_pin</span>Pinned</span>}
                      <p className="leading-relaxed whitespace-pre-wrap" style={{ fontSize: 14, color: DARK }}>{n.content}</p>
                      <p className="mt-2" style={{ fontSize: 12, color: TEXT_MUTED }}>{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Stage History Tab ──────────────────────────────────── */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {(opp.stageHistory ?? []).length === 0 && <p style={{ color: TEXT_SEC, fontSize: 14 }}>No stage history yet.</p>}
                  {(opp.stageHistory ?? []).map((h: CrmStageHistory, i: number) => (
                    <div key={h.id} className="flex gap-4 bg-white border rounded-xl p-4" style={{ borderColor: BORDER }}>
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                          style={{ background: i === (opp.stageHistory?.length ?? 0) - 1 ? '#16a34a' : SURFACE_LOW, color: i === (opp.stageHistory?.length ?? 0) - 1 ? WHITE : TEXT_SEC, fontSize: 12 }}>
                          {i + 1}
                        </div>
                        {i < (opp.stageHistory?.length ?? 0) - 1 && <div className="w-0.5 flex-1 mt-1" style={{ background: BORDER }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold" style={{ fontSize: 14, color: DARK }}>
                          {h.fromStageName ? <>{h.fromStageName} <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle' }}>arrow_forward</span> {h.toStageName}</> : <>Moved to <strong>{h.toStageName}</strong></>}
                        </p>
                        <p className="mt-1" style={{ fontSize: 12, color: TEXT_MUTED }}>{formatDate(h.movedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Audit Log Tab ──────────────────────────────────────── */}
              {activeTab === 'audit' && opp && (
                <CrmAuditLog entityType="opportunity" entityId={opp.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-4 px-6 mt-auto" style={{ background: SURFACE_LOW, borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto flex justify-between items-center font-mono" style={{ fontSize: 11, color: TEXT_MUTED }}>
          <div className="flex gap-4 flex-wrap">
            <span>RECORD ID: {opp.id.slice(0, 8).toUpperCase()}</span>
            <span>CREATED BY: {opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : 'System'}</span>
            <span>LAST SYNC: {relativeTime(opp.updatedAt)}</span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: TEAL }} /> Live
            </span>
          </div>
        </div>
      </footer>

      {/* ── Move Stage Modal ──────────────────────────────────────────── */}
      {showMoveStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowMoveStage(false)}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(33,49,69,0.4)' }} />
          <div className="relative rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" style={{ background: WHITE, border: `1px solid ${BORDER}30` }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>Move Stage</h2>
            <form onSubmit={handleMoveStage} className="space-y-4">
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Select Stage</label>
                <select value={selectedStageId} onChange={e => setSelectedStageId(e.target.value)}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>)}
                </select>
              </div>
              {stages.find(s => s.id === selectedStageId)?.isLostStage && (
                <div>
                  <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Lost Reason</label>
                  <input value={lostReason} onChange={e => setLostReason(e.target.value)}
                    className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMoveStage(false)}
                  className="px-4 py-2 rounded-lg font-semibold hover:bg-[#dce9ff] transition-colors"
                  style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 shadow-sm transition-all"
                  style={{ fontSize: 14, background: TEAL, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {saving ? 'Moving…' : 'Move'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Activity Modal ────────────────────────────────────────── */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(33,49,69,0.4)' }} />
          <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: WHITE, border: `1px solid ${BORDER}30` }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Type</label>
                <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Description</label>
                <textarea rows={5} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all resize-vertical" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}
                  className="px-4 py-2 rounded-lg font-semibold hover:bg-[#dce9ff] transition-colors"
                  style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 shadow-sm transition-all"
                  style={{ fontSize: 14, background: TEAL, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {saving ? 'Saving…' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Note Modal ────────────────────────────────────────────── */}
      {showAddNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddNote(false); setNoteContent(''); }}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(33,49,69,0.4)' }} />
          <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: WHITE, border: `1px solid ${BORDER}30` }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>Add Note</h2>
            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea required rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)}
                className="w-full rounded-lg p-2.5 outline-none transition-all resize-none" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddNote(false); setNoteContent(''); }}
                  className="px-4 py-2 rounded-lg font-semibold hover:bg-[#dce9ff] transition-colors"
                  style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 shadow-sm transition-all"
                  style={{ fontSize: 14, background: TEAL, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {saving ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Opportunity Modal ─────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setFormErrors([]); }}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(33,49,69,0.4)' }} />
          <div className="relative rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" style={{ background: WHITE, border: `1px solid ${BORDER}30` }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between" style={{ background: WHITE, borderColor: BORDER }}>
              <div>
                <h2 className="font-semibold" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>Edit Opportunity</h2>
                <p style={{ fontSize: 13, color: TEXT_SEC, marginTop: 4 }}>Update deal details and pipeline information.</p>
              </div>
              <button onClick={() => { setShowEdit(false); setFormErrors([]); }} className="p-2 rounded-full transition-colors hover:bg-[#dce9ff]" style={{ border: 'none', background: 'none', cursor: 'pointer', color: TEXT_SEC }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-6">
              {formErrors.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: '#fef2f2', border: `1px solid #fecaca` }}>
                  {formErrors.map((e, i) => <p key={i} style={{ fontSize: 13, color: ERROR }}>{e.message}</p>)}
                </div>
              )}

              {/* Section 1: Deal Information */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: SURFACE_MAX, color: TEAL }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>handshake</span>
                  </div>
                  <h3 className="font-semibold" style={{ fontSize: 18, color: DARK }}>Deal Information</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Opportunity Name *</label>
                    <input required value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className={`w-full rounded-lg p-2.5 outline-none transition-all ${formErrors.some(e => e.field === 'name') ? '!border-red-500' : ''}`}
                      style={{ border: `1px solid ${formErrors.some(e => e.field === 'name') ? '#f87171' : BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Account</label>
                      <select value={editForm.accountId ?? ''} onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
                        className="w-full rounded-lg p-2.5 outline-none transition-all" disabled={loadingEditDeps}
                        style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                        <option value="">— None —</option>
                        {editAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Owner</label>
                      <select value={editForm.ownerId ?? ''} onChange={e => setEditForm(f => ({ ...f, ownerId: e.target.value }))}
                        className="w-full rounded-lg p-2.5 outline-none transition-all"
                        style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                        <option value="">— Unassigned —</option>
                        {crmUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Pipeline & Value */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: SURFACE_MAX, color: TEAL }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>trending_up</span>
                  </div>
                  <h3 className="font-semibold" style={{ fontSize: 18, color: DARK }}>Pipeline & Value</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Pipeline</label>
                      <select value={editForm.pipelineId ?? ''} onChange={e => handleEditPipelineChange(e.target.value)}
                        className="w-full rounded-lg p-2.5 outline-none transition-all" disabled={loadingEditDeps}
                        style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                        <option value="">— Select —</option>
                        {editPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Stage</label>
                      <select value={editForm.stageId ?? ''} onChange={e => setEditForm(f => ({ ...f, stageId: e.target.value }))}
                        className="w-full rounded-lg p-2.5 outline-none transition-all" disabled={loadingEditDeps || !editForm.pipelineId}
                        style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                        <option value="">— Select —</option>
                        {editStages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Estimated Value (RM)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center font-bold" style={{ fontSize: 14, color: DARK }}>RM</span>
                        <input type="number" step="0.01" value={editForm.value ?? ''} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                          className="w-full rounded-lg p-2.5 outline-none transition-all pl-10"
                          style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Probability (%)</label>
                      <div className="relative">
                        <input type="number" min="0" max="100" value={editForm.probability ?? ''} onChange={e => setEditForm(f => ({ ...f, probability: e.target.value }))}
                          className="w-full rounded-lg p-2.5 outline-none transition-all pr-8"
                          style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                        <span className="absolute inset-y-0 right-3 flex items-center" style={{ fontSize: 14, color: TEXT_MUTED }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Expected Close Date</label>
                    <input type="date" value={editForm.expectedCloseDate ?? ''} onChange={e => setEditForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                      className="w-full rounded-lg p-2.5 outline-none transition-all"
                      style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                  </div>
                </div>
              </div>

              {/* Section 3: Additional Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: SURFACE_MAX, color: TEAL }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notes</span>
                  </div>
                  <h3 className="font-semibold" style={{ fontSize: 18, color: DARK }}>Additional Details</h3>
                </div>
                <div>
                  <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Description</label>
                  <textarea rows={4} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg p-2.5 outline-none transition-all resize-none"
                    style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 py-4 flex justify-between items-center" style={{ background: SURFACE_LOW, borderTop: `1px solid ${BORDER}`, margin: '0 -24px -24px', padding: '16px 24px' }}>
                <p className="flex items-center gap-1" style={{ fontSize: 12, color: TEXT_MUTED }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  Mandatory fields are marked with an asterisk (*)
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowEdit(false); setFormErrors([]); }}
                    className="px-4 py-2 rounded-lg font-semibold hover:bg-[#dce9ff] transition-colors"
                    style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                  <button type="submit" disabled={savingEdit}
                    className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 shadow-sm transition-all"
                    style={{ fontSize: 14, background: TEAL, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    {savingEdit ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Activity Modal ───────────────────────────────────────── */}
      {showEditActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEditActivity(false); setEditActivityForm({}); }}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(33,49,69,0.4)' }} />
          <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: WHITE, border: `1px solid ${BORDER}30` }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4" style={{ fontSize: 24, letterSpacing: '-0.01em', color: DARK }}>Edit Activity</h2>
            <form onSubmit={handleEditActivitySave} className="space-y-4">
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Type</label>
                <select value={editActivityForm.activityType ?? 'CALL'} onChange={e => setEditActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Subject *</label>
                <input required value={editActivityForm.subject ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Description</label>
                <textarea rows={5} value={editActivityForm.description ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all resize-vertical" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-widest mb-1" style={{ fontSize: 11, color: TEXT_SEC }}>Scheduled At</label>
                <input type="datetime-local" value={editActivityForm.scheduledAt ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full rounded-lg p-2.5 outline-none transition-all" style={{ border: `1px solid ${BORDER}`, fontSize: 14, background: SURFACE_LOW, fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditActivity(false); setEditActivityForm({}); }}
                  className="px-4 py-2 rounded-lg font-semibold hover:bg-[#dce9ff] transition-colors"
                  style={{ fontSize: 14, border: `1px solid ${BORDER}`, color: TEXT_SEC, background: WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button type="submit" disabled={savingActivityEdit}
                  className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 shadow-sm transition-all"
                  style={{ fontSize: 14, background: TEAL, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {savingActivityEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Opportunity ────────────────────────────────── */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${opp?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        loading={deleting}
      />

      {/* ── Confirm Delete Activity ───────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteActivity}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteActivity}
        onCancel={() => { setShowDeleteActivity(false); setDeleteActivityId(null); }}
        loading={deletingActivity}
      />
    </div>
  );
};

export default CrmOpportunityDetail;