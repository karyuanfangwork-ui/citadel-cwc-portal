import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmAccount, CrmActivity, CrmNote, CrmActivityType, CrmUser } from '../src/services/crm.service';

import ConfirmDialog from '../src/components/ConfirmDialog';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateAccount, ValidationError } from '../src/utils/crmValidation';
import EmptyState from '../src/components/ui/EmptyState';
import CrmAuditLog from '../src/components/crm/CrmAuditLog';
import { useNextBestAction } from '../src/hooks/useCrmAi';
import ReactMarkdown from 'react-markdown';
import creditService from '../src/services/credit.service';

// ── Client 360 sub-components ────────────────────────────────────
import Customer360Profile from '../src/components/crm/Customer360Profile';
import Customer360Insights from '../src/components/crm/Customer360Insights';
import Customer360KpiCard from '../src/components/crm/Customer360KpiCard';
import Customer360OpportunitiesTable from '../src/components/crm/Customer360OpportunitiesTable';
import Customer360ActivityTimeline from '../src/components/crm/Customer360ActivityTimeline';

// ── Design tokens (Kinetic Enterprise) ─────────────────────────────
const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surface: '#f8f9ff',
  surfaceLow: '#eff4ff',
  white: '#ffffff',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  success: '#22c55e',
  blue: '#3b82f6',
  error: '#ba1a1a',
  warning: '#f59e0b',
  shadow: '0px 4px 12px rgba(15, 23, 42, 0.08)',
} as const;

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

const SkeletonLine = ({ mb = 12 }: { mb?: number }) => (
  <div style={{ height: 18, marginBottom: mb, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
);

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

// ── Tab set ────────────────────────────────────────────────────────
type TabKey = 'overview' | 'activities' | 'opportunities' | 'documents' | 'timeline';
const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Overview',
  activities: 'Activities',
  opportunities: 'Opportunities',
  documents: 'Documents',
  timeline: 'Timeline',
};
const TABS: TabKey[] = ['overview', 'activities', 'opportunities', 'documents', 'timeline'];

// ── Helper: compute health score ───────────────────────────────────
function computeHealthScore(account: CrmAccount): number {
  const activities = account.activities ?? [];
  const lastDate = activities.length > 0
    ? new Date(Math.max(...activities.map(a => new Date(a.createdAt).getTime())))
    : new Date(account.updatedAt);
  const daysSince = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / 86400000));
  const activeOpps = (account.opportunities ?? []).filter(
    o => o.stage && !o.stage.isWonStage && !o.stage.isLostStage
  ).length;
  return Math.max(0, Math.min(100, 100 - Math.min(daysSince * 2, 60) + Math.min(activeOpps * 5, 40)));
}

function computeTenure(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (365.25 * 86400000));
}

// ── Component ─────────────────────────────────────────────────────
const CrmAccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [account, setAccount] = useState<CrmAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [showEditActivity, setShowEditActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState<Partial<CrmActivity>>({});
  const [showDeleteActivity, setShowDeleteActivity] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<CrmActivity | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<CrmNote | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [deletingNote, setDeletingNote] = useState<CrmNote | null>(null);
  const [showDeleteNote, setShowDeleteNote] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [showDelete, setShowDelete] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);
  const showToast = (msg: string) => setToast(msg);

  // Activity pagination
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [activitySort, setActivitySort] = useState<'newest' | 'oldest'>('newest');

  // Validation error states
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);

  // ── Next Best Action ─────────────────────────────────────────────
  const nba = useNextBestAction();

  // CRM Users for owner select
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  // Accounts for parent picker
  const [allAccounts, setAllAccounts] = useState<{ id: string; name: string }[]>([]);

  // Credit tab borrower summary
  const [creditSummary, setCreditSummary] = useState<{ borrowerCount: number; loading: boolean }>({ borrowerCount: 0, loading: true });
  useEffect(() => {
    if (!id) return;
    setCreditSummary(prev => ({ ...prev, loading: true }));
    creditService.listBorrowerProfiles({ accountId: id, limit: 1 })
      .then(res => setCreditSummary({ borrowerCount: res.pagination?.total ?? res.profiles?.length ?? 0, loading: false }))
      .catch(() => setCreditSummary(prev => ({ ...prev, loading: false })));
  }, [id]);
  useEffect(() => { crmService.listCrmUsers().then(setCrmUsers).catch(() => {}); }, []);
  useEffect(() => { crmService.listAccounts({ limit: 500 }).then(res => setAllAccounts(res.accounts.map((a: any) => ({ id: a.id, name: a.name })))).catch(() => {}); }, []);

  const loadNotes = () => {
    if (!id) return;
    setNotesLoading(true);
    crmService.listNotes({ accountId: id })
      .then(res => setNotes(res.notes))
      .catch(() => {})
      .finally(() => setNotesLoading(false));
  };

  useEffect(() => { loadNotes(); }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    crmService.getAccount(id)
      .then(setAccount)
      .catch(() => navigate('/crm/accounts'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Auto-fetch Next Best Action when account loads
  useEffect(() => {
    if (account?.id) nba.fetch('account', account.id);
  }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close more menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Handlers (all preserved from original) ───────────────────────
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      await crmService.createActivity({ ...activityForm, accountId: id });
      const updated = await crmService.getAccount(id);
      setAccount(updated);
      setShowAddActivity(false);
      setActivityForm({ activityType: 'CALL' });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSetReminder = async (activityId: string) => {
    try {
      await crmService.sendActivityReminder(activityId);
      setAccount(prev => prev ? {
        ...prev,
        activities: (prev.activities ?? []).map(a =>
          a.id === activityId ? { ...a, reminderSent: true } : a
        ),
      } : prev);
    } catch (e) { console.error(e); }
  };

  const openEditActivity = (a: CrmActivity) => {
    setEditingActivity(a);
    setEditActivityForm({
      activityType: a.activityType,
      subject: a.subject,
      description: a.description ?? '',
      scheduledAt: a.scheduledAt ?? '',
      completedAt: a.completedAt ?? '',
      durationMinutes: a.durationMinutes,
    });
    setShowEditActivity(true);
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !id) return;
    try {
      setSaving(true);
      await crmService.updateActivity(editingActivity.id, editActivityForm);
      const updated = await crmService.getAccount(id);
      setAccount(updated);
      setShowEditActivity(false);
      setEditingActivity(null);
      setEditActivityForm({});
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivity || !id) return;
    try {
      setSaving(true);
      await crmService.deleteActivity(deletingActivity.id);
      setShowDeleteActivity(false);
      setDeletingActivity(null);
      const updated = await crmService.getAccount(id);
      setAccount(updated);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const loadMoreActivities = async () => {
    if (!id || loadingMoreActivities) return;
    const nextPage = activityPage + 1;
    setLoadingMoreActivities(true);
    try {
      const res = await crmService.listActivities({ accountId: id, page: nextPage, limit: 10 });
      setAccount(prev => prev ? { ...prev, activities: [...(prev.activities ?? []), ...res.activities] } : prev);
      setActivityPage(nextPage);
      setHasMoreActivities(res.activities.length >= 10);
    } catch (e) { console.error(e); }
    finally { setLoadingMoreActivities(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !noteContent.trim()) return;
    try {
      setSaving(true);
      await crmService.createNote({ content: noteContent, accountId: id });
      loadNotes();
      setShowAddNote(false);
      setNoteContent('');
      showToast('Note added');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editNoteContent.trim()) return;
    try {
      setSaving(true);
      await crmService.updateNote(editingNote.id, { content: editNoteContent });
      setEditingNote(null);
      setEditNoteContent('');
      loadNotes();
      showToast('Note updated');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteNote = async () => {
    if (!deletingNote) return;
    try {
      setSaving(true);
      await crmService.deleteNote(deletingNote.id);
      setShowDeleteNote(false);
      setDeletingNote(null);
      loadNotes();
      showToast('Note deleted');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleTogglePinNote = async (note: CrmNote) => {
    try {
      await crmService.updateNote(note.id, { isPinned: !note.isPinned });
      loadNotes();
      showToast(note.isPinned ? 'Note unpinned' : 'Note pinned');
    } catch (e) { console.error(e); }
  };

  const openEdit = () => {
    if (!account) return;
    setFormErrors([]);
    setEditForm({
      name: account.name ?? '',
      registrationNumber: account.registrationNumber ?? '',
      taxNumber: account.taxNumber ?? '',
      industry: account.industry ?? '',
      companySize: account.companySize ?? '',
      website: account.website ?? '',
      email: account.email ?? '',
      phone: account.phone ?? '',
      annualRevenue: account.annualRevenue ?? '',
      bankAccount: account.bankAccount ?? '',
      address: account.address ?? '',
      city: account.city ?? '',
      state: account.state ?? '',
      postalCode: account.postalCode ?? '',
      country: account.country ?? '',
      description: account.description ?? '',
      parentAccountId: account.parentAccountId ?? '',
    });
    setShowEdit(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const errors = validateAccount(editForm);
    if (errors.length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      const payload = cleanFormPayload(editForm, NUMERIC_KEYS.account);
      await crmService.updateAccount(id, payload);
      setShowEdit(false);
      const updated = await crmService.getAccount(id);
      setAccount(updated);
      showToast('Account updated successfully');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await crmService.deleteAccount(id);
      navigate('/crm/accounts');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ── Loading / null guards ─────────────────────────────────────────
  if (loading) return (
    <div className="px-4 sm:px-8 py-4 sm:py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
        <div className="col-span-6 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
        <div className="col-span-3 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
      </div>
    </div>
  );

  if (!account) return null;

  const stageColors: Record<string, string> = { PROSPECTING: '#6366f1', QUALIFICATION: '#f59e0b', PROPOSAL: '#3b82f6', NEGOTIATION: '#8b5cf6', CLOSED_WON: '#22c55e', CLOSED_LOST: '#ef4444' };

  const healthScore = computeHealthScore(account);
  const tenure = computeTenure(account.createdAt);
  const activeFacilities = (account.opportunities ?? []).filter(
    o => o.stage && !o.stage.isWonStage && !o.stage.isLostStage
  ).length;

  // Action toolbar definitions
  const ACTION_BUTTONS = [
    { icon: 'history_edu', label: 'Log Call', onClick: () => { setActivityForm({ activityType: 'CALL' }); setShowAddActivity(true); } },
    { icon: 'chat', label: 'WhatsApp', onClick: () => { setActivityForm({ activityType: 'WHATSAPP' }); setShowAddActivity(true); } },
    { icon: 'send', label: 'Send Email', onClick: () => { setActivityForm({ activityType: 'EMAIL' }); setShowAddActivity(true); } },
    { icon: 'upload_file', label: 'Upload Document', onClick: () => { setShowAddNote(true); } },
    { icon: 'event', label: 'Schedule Meeting', onClick: () => { setActivityForm({ activityType: 'MEETING' }); setShowAddActivity(true); } },
  ];

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="flex min-h-[calc(100vh-48px)]" style={{ maxWidth: 1680, margin: '0 auto' }}>

        {/* ── LEFT PANEL: Client Profile ────────────────────────── */}
        <section className="hidden lg:flex lg:w-80 shrink-0 flex-col border-r overflow-y-auto p-4 custom-scrollbar"
          style={{ borderColor: T.border, background: T.white, position: 'sticky', top: 0, height: 'calc(100vh - 48px)' }}
        >
          <Customer360Profile account={account} onEdit={openEdit} />
        </section>

        {/* ── CENTER PANEL: Workspace ─────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0" style={{ background: T.surface }}>

          {/* Glass header */}
          <div
            className="shrink-0 sticky top-0 z-30 border-b px-6 py-4"
            style={{
              backdropFilter: 'blur(8px)',
              background: 'rgba(255, 255, 255, 0.9)',
              borderBottomColor: T.border,
            }}
          >
            <div className="flex justify-between items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {/* Mobile: profile toggle */}
                  <button
                    onClick={openEdit}
                    className="lg:hidden p-1.5 rounded-lg mr-1"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary }}
                  >
                    <span className="material-symbols-outlined text-[20px]">account_circle</span>
                  </button>
                  <h1 className="text-[24px] font-semibold leading-8 truncate" style={{ color: T.textPrimary }}>
                    {account.name}
                  </h1>
                  <span
                    className="shrink-0 text-[11px] px-2 py-0.5 rounded font-bold uppercase"
                    style={{ background: account.isActive ? `${T.success}15` : `${T.textMuted}15`, color: account.isActive ? T.success : T.textMuted }}
                  >
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[14px] flex-wrap" style={{ color: T.textMuted }}>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    Health Score: {healthScore}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">account_circle</span>
                    RM: {account.owner ? `${account.owner.firstName} ${account.owner.lastName}` : '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasPermission(user, 'crm:write') && (
                  <Link to={`/crm/opportunities/new?accountId=${account.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-[13px] text-white hover:opacity-90 transition-opacity"
                    style={{ textDecoration: 'none', background: T.teal }}>
                    <span className="material-symbols-outlined text-[18px]">add</span> Create Opportunity
                  </Link>
                )}
                {/* More menu */}
                <div ref={moreRef} className="relative">
                  <button
                    onClick={() => setMoreMenuOpen(prev => !prev)}
                    className="flex items-center px-3 py-2 rounded-lg font-bold text-[13px] border hover:bg-[#f8f9ff] transition-colors"
                    style={{ background: T.white, borderColor: T.border, color: T.textSecondary, cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                  </button>
                  {moreMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-56 p-1.5 z-50"
                      style={{ background: T.white, borderRadius: '8px', border: `1px solid ${T.border}`, boxShadow: T.shadow }}
                    >
                      <button
                        onClick={() => { setMoreMenuOpen(false); openEdit(); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] font-semibold transition-colors rounded-[6px] hover:bg-[#f1f5f9]"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary, textAlign: 'left' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span> Edit Account
                      </button>
                      {hasPermission(user, 'crm:delete') && (
                        <button
                          onClick={() => { setMoreMenuOpen(false); setShowDelete(true); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] font-semibold transition-colors rounded-[6px] hover:bg-red-50"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.error, textAlign: 'left' }}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span> Delete Account
                        </button>
                      )}
                      {hasPermission(user, 'credit:read') && (
                        <Link
                          to={`/credit/borrowers?accountId=${account.id}`}
                          onClick={() => setMoreMenuOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] font-semibold transition-colors rounded-[6px] hover:bg-[#f1f5f9]"
                          style={{ textDecoration: 'none', color: T.textSecondary }}
                        >
                          <span className="material-symbols-outlined text-[16px]">credit_score</span> Credit Module
                        </Link>
                      )}
                      <button
                        onClick={() => { setMoreMenuOpen(false); setActiveTab('timeline'); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] font-semibold transition-colors rounded-[6px] hover:bg-[#f1f5f9]"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary, textAlign: 'left' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">history</span> Audit Log
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action toolbar */}
          <div
            className="shrink-0 px-6 py-3 border-b flex gap-6 overflow-x-auto"
            style={{ background: T.white, borderBottomColor: T.border }}
          >
            {ACTION_BUTTONS.map(btn => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="flex items-center gap-2 text-[14px] font-medium hover:opacity-70 transition-opacity whitespace-nowrap"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary, fontFamily: 'var(--font-sans)' }}
              >
                <span className="material-symbols-outlined text-[20px]">{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>

          {/* Tab navigation */}
          <div className="shrink-0 px-6 border-b" style={{ background: T.white, borderBottomColor: T.border }}>
            <div className="flex gap-8" role="tablist" aria-label="Account detail tabs">
              {TABS.map(tab => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`panel-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className="py-4 text-[14px] transition-colors border-b-2 -mb-px"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    borderBottomColor: activeTab === tab ? T.teal : 'transparent',
                    color: activeTab === tab ? T.teal : T.textMuted,
                    fontWeight: activeTab === tab ? 600 : 500,
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ─────────────────────────────────────────── */}
          <div className="p-6 space-y-6">

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI cards */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                    <Customer360KpiCard
                      label="Tenure"
                      value={`${tenure} Year${tenure !== 1 ? 's' : ''}`}
                      subtext={`Since ${formatShortDate(account.createdAt)}`}
                      valueColor={T.teal}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                    <Customer360KpiCard
                      label="Active Facilities"
                      value={String(activeFacilities).padStart(2, '0')}
                      subtext={(account.opportunities ?? []).filter(o => o.stage && !o.stage.isWonStage && !o.stage.isLostStage).slice(0, 2).map(o => o.name).join(', ') || 'None'}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6 lg:col-span-4">
                    <Customer360KpiCard
                      label="Total Debt Service Ratio"
                      value="N/A"
                      subtext="Requires CTOS/CCRIS integration"
                      valueColor={T.textMuted}
                    />
                  </div>
                </div>

                {/* Open Opportunities table */}
                <Customer360OpportunitiesTable
                  opportunities={account.opportunities ?? []}
                  onViewAll={() => setActiveTab('opportunities')}
                />

                {/* Recent Activity timeline */}
                <Customer360ActivityTimeline activities={account.activities ?? []} />

                {/* Hierarchy info (if parent/children) */}
                {(account.parent || (account.children && account.children.length > 0)) && (
                  <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: T.border }}>
                    <h3 className="text-[16px] font-semibold mb-3" style={{ color: T.textPrimary }}>Account Hierarchy</h3>
                    {account.parent && (
                      <div className="flex items-center gap-3 py-2 border-b" style={{ borderColor: T.border }}>
                        <span className="material-symbols-outlined text-[18px]" style={{ color: T.textMuted }}>account_tree</span>
                        <span className="text-[12px] font-medium shrink-0 w-20" style={{ color: T.textMuted }}>Parent</span>
                        <Link to={`/crm/accounts/${account.parent.id}`} style={{ textDecoration: 'none', color: T.teal }} className="text-[13px] font-semibold hover:underline">
                          {account.parent.name}
                        </Link>
                      </div>
                    )}
                    {account.children && account.children.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <p className="text-[12px] font-semibold mb-1" style={{ color: T.textMuted }}>
                          Subsidiaries ({account.children.length})
                        </p>
                        {account.children.map(c => (
                          <Link key={c.id} to={`/crm/accounts/${c.id}`} style={{ textDecoration: 'none' }}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#f8f9ff] transition-colors">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: T.textMuted }}>business</span>
                            <span className="text-[13px] font-medium" style={{ color: T.textPrimary }}>{c.name}</span>
                            {c.industry && <span className="text-[11px] ml-auto" style={{ color: T.textMuted }}>{c.industry}</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {account.description && (
                  <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: T.border }}>
                    <h3 className="text-[16px] font-semibold mb-2" style={{ color: T.textPrimary }}>Description</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: T.textSecondary }}>{account.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* Activities tab */}
            {activeTab === 'activities' && (
              <div id="panel-activities" role="tabpanel" aria-labelledby="tab-activities" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as const).map(type => (
                      <button key={type} onClick={() => setActivityFilter(type)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          activityFilter === type
                            ? 'text-white border-transparent'
                            : 'text-[#45464d] border-[#e2e8f0] hover:bg-[#f8f9ff]'
                        }`}
                        style={{
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          background: activityFilter === type ? T.teal : T.white,
                        }}>
                        {type === 'ALL' ? 'All' : type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  <select value={activitySort} onChange={e => setActivitySort(e.target.value as 'newest' | 'oldest')}
                    className="border border-[#e2e8f0] rounded-lg px-2 py-1.5 text-xs font-semibold bg-white"
                    style={{ fontFamily: 'var(--font-sans)', color: T.textSecondary }}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </div>
                {(() => {
                  let filtered = (account.activities ?? []).slice();
                  if (activityFilter !== 'ALL') filtered = filtered.filter(a => a.activityType === activityFilter);
                  filtered.sort((a, b) => activitySort === 'newest'
                    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                  if (filtered.length === 0) return <EmptyState icon="timeline" title={activityFilter !== 'ALL' ? `No ${activityFilter.replace('_',' ')} activities` : 'No activities yet'} description="Log activities to track interactions." />;
                  return filtered.map(a => (
                    <div key={a.id} className="flex gap-4 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:bg-[#f8f9ff] transition-colors">
                      <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ color: T.teal }}>{ACTIVITY_ICONS[a.activityType]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px]" style={{ color: T.textPrimary }}>{a.subject}</p>
                        {a.description && <p className="text-[12px] mt-0.5" style={{ color: T.textMuted }}>{a.description}</p>}
                        <p className="text-[12px] mt-1" style={{ color: T.textMuted }}>
                          {a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                          {a.scheduledAt && <span className="ml-2" style={{ color: T.teal }}>Scheduled: {formatDate(a.scheduledAt)}</span>}
                          {a.scheduledAt && !a.completedAt && new Date(a.scheduledAt) < new Date() && (
                            <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#fef2f2', color: T.error }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>warning</span> Overdue
                            </span>
                          )}
                          {a.reminderSent && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: T.success }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>notifications_active</span> Reminded
                            </span>
                          )}
                          {a.scheduledAt && new Date(a.scheduledAt) > new Date() && !a.reminderSent && (
                            <button onClick={() => handleSetReminder(a.id)}
                              className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full hover:bg-[#ccfbf1] transition-colors"
                              style={{ color: T.teal, border: 'none', cursor: 'pointer', background: 'none' }}
                              title="Send a reminder for this scheduled activity"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>notifications</span> Set Reminder
                            </button>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasPermission(user, 'crm:edit') && (
                          <button onClick={() => openEditActivity(a)} title="Edit activity"
                            className="p-1 rounded hover:bg-[#f1f5f9] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined text-[16px]" style={{ color: T.textMuted }}>edit</span>
                          </button>
                        )}
                        {hasPermission(user, 'crm:delete') && (
                          <button onClick={() => { setDeletingActivity(a); setShowDeleteActivity(true); }} title="Delete activity"
                            className="p-1 rounded hover:bg-red-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined text-[16px]" style={{ color: T.error }}>delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ));
                })()}
                {hasMoreActivities && (account.activities ?? []).length > 0 && (
                  <div className="flex justify-center mt-4">
                    <button onClick={loadMoreActivities} disabled={loadingMoreActivities}
                      className="flex items-center gap-2 border border-[#e2e8f0] px-6 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#f1f5f9] transition-colors disabled:opacity-50"
                      style={{ background: T.white, cursor: loadingMoreActivities ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>
                      {loadingMoreActivities ? (
                        <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Loading…</>
                      ) : (
                        <><span className="material-symbols-outlined text-[16px]">expand_more</span>Load More</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Opportunities tab */}
            {activeTab === 'opportunities' && (
              <div id="panel-opportunities" role="tabpanel" aria-labelledby="tab-opportunities" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold" style={{ color: T.textPrimary }}>Opportunities</h3>
                  {hasPermission(user, 'crm:write') && (
                    <Link to={`/crm/opportunities/new?accountId=${account.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold text-white hover:opacity-90 transition-opacity"
                      style={{ textDecoration: 'none', background: T.teal }}>
                      <span className="material-symbols-outlined text-[16px]">add_business</span> Create Opportunity
                    </Link>
                  )}
                </div>
                {(account.opportunities ?? []).length === 0 && <EmptyState icon="handshake" title="No deals yet" description="Create opportunities for this account." />}
                {(account.opportunities ?? []).map(o => (
                  <Link key={o.id} to={`/crm/opportunities/${o.id}`} style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-4 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#86f2e4] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px]" style={{ color: T.textPrimary }}>{o.name}</p>
                        <p className="text-[12px]" style={{ color: T.textMuted }}>{o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : ''}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${stageColors[o.stage?.name ?? ''] ?? '#6366f1'}15`, color: stageColors[o.stage?.name ?? ''] ?? '#6366f1' }}>
                        {o.stage?.name ?? '—'}
                      </span>
                      <span className="font-[JetBrains_Mono] text-[13px] font-medium" style={{ color: T.textPrimary }}>{formatCurrency(o.value)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Documents tab (was Notes) */}
            {activeTab === 'documents' && (
              <div id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold" style={{ color: T.textPrimary }}>Documents & Notes</h3>
                  {hasPermission(user, 'crm:write') && (
                    <button onClick={() => setShowAddNote(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold text-white hover:opacity-90 transition-opacity"
                      style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', background: T.teal }}>
                      <span className="material-symbols-outlined text-[16px]">sticky_note_2</span> Add Note
                    </button>
                  )}
                </div>
                {notesLoading ? (
                  <div className="space-y-3">{[...Array(2)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
                ) : notes.length === 0 ? (
                  <EmptyState icon="sticky_note_2" title="No notes yet" description="Add notes to keep track of important information." />
                ) : notes.map(n => (
                  <div key={n.id} className={`bg-white border rounded-xl p-4 ${n.isPinned ? 'border-yellow-300' : 'border-[#e2e8f0]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {n.isPinned && <span className="flex items-center gap-1 text-[12px] mb-2" style={{ color: '#ca8a04' }}><span className="material-symbols-outlined text-[14px]">push_pin</span>Pinned</span>}
                        <div className="text-[13px] leading-relaxed prose prose-sm max-w-none" style={{ color: T.textPrimary }}>
                          <ReactMarkdown>{n.content}</ReactMarkdown>
                        </div>
                        <p className="text-[12px] mt-2" style={{ color: T.textMuted }}>{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleTogglePinNote(n)} title={n.isPinned ? 'Unpin note' : 'Pin note'}
                          className="p-1 rounded hover:bg-yellow-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <span className={`material-symbols-outlined text-[16px] ${n.isPinned ? 'text-yellow-500' : ''}`} style={{ color: n.isPinned ? undefined : T.textMuted }}>push_pin</span>
                        </button>
                        <button onClick={() => { setEditingNote(n); setEditNoteContent(n.content); }} title="Edit note"
                          className="p-1 rounded hover:bg-[#f1f5f9] transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <span className="material-symbols-outlined text-[16px]" style={{ color: T.textMuted }}>edit</span>
                        </button>
                        <button onClick={() => { setDeletingNote(n); setShowDeleteNote(true); }} title="Delete note"
                          className="p-1 rounded hover:bg-red-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <span className="material-symbols-outlined text-[16px]" style={{ color: T.error }}>delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline tab (Audit Log) */}
            {activeTab === 'timeline' && account && (
              <div id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline">
                <CrmAuditLog entityType="account" entityId={account.id} />
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT PANEL: Insights ───────────────────────────────── */}
        <section className="hidden xl:flex xl:w-80 shrink-0 flex-col border-l overflow-y-auto p-4 custom-scrollbar"
          style={{ borderColor: T.border, background: T.surfaceLow, position: 'sticky', top: 0, height: 'calc(100vh - 48px)' }}
        >
          <Customer360Insights account={account} nba={nba} />
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODALS — all preserved from original, styling updated
         ══════════════════════════════════════════════════════════════ */}

      {/* Add Activity modal */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold mb-4" style={{ color: T.textPrimary }}>Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Type</label>
                <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Description</label>
                <textarea rows={3} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px] resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Scheduled At</label>
                  <input type="datetime-local" value={activityForm.scheduledAt ?? ''} onChange={e => setActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Completed At</label>
                  <input type="datetime-local" value={activityForm.completedAt ?? ''} onChange={e => setActivityForm(f => ({ ...f, completedAt: e.target.value }))}
                    className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Duration (minutes)</label>
                <input type="number" min={0} value={activityForm.durationMinutes ?? ''} onChange={e => setActivityForm(f => ({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-[13px] font-bold rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', background: T.teal }}>
                  {saving ? 'Saving…' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Activity modal */}
      {showEditActivity && editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEditActivity(false); setEditingActivity(null); setEditActivityForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold mb-4" style={{ color: T.textPrimary }}>Edit Activity</h2>
            <form onSubmit={handleEditActivity} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Type</label>
                <select value={editActivityForm.activityType ?? 'CALL'} onChange={e => setEditActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Subject *</label>
                <input required value={editActivityForm.subject ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Description</label>
                <textarea rows={3} value={editActivityForm.description ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px] resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Scheduled At</label>
                <input type="datetime-local" value={editActivityForm.scheduledAt ? editActivityForm.scheduledAt.slice(0, 16) : ''} onChange={e => setEditActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Completed At</label>
                <input type="datetime-local" value={editActivityForm.completedAt ? editActivityForm.completedAt.slice(0, 16) : ''} onChange={e => setEditActivityForm(f => ({ ...f, completedAt: e.target.value }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Duration (minutes)</label>
                <input type="number" min={0} value={editActivityForm.durationMinutes ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px]" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditActivity(false); setEditingActivity(null); setEditActivityForm({}); }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-[13px] font-bold rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', background: T.teal }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Activity confirmation */}
      <ConfirmDialog
        open={showDeleteActivity}
        title="Delete Activity"
        message={`Are you sure you want to delete this activity${deletingActivity?.subject ? ` "${deletingActivity.subject}"` : ''}? This action cannot be undone.`}
        confirmVariant="danger"
        loading={saving}
        onConfirm={handleDeleteActivity}
        onCancel={() => { setShowDeleteActivity(false); setDeletingActivity(null); }}
      />

      {/* Add Note modal */}
      {showAddNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddNote(false); setNoteContent(''); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold mb-4" style={{ color: T.textPrimary }}>Add Note</h2>
            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Note *</label>
                <textarea required rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px] resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddNote(false); setNoteContent(''); }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-[13px] font-bold rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', background: T.teal }}>
                  {saving ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Note modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setEditingNote(null); setEditNoteContent(''); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold mb-4" style={{ color: T.textPrimary }}>Edit Note</h2>
            <form onSubmit={handleEditNote} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1" style={{ color: T.textSecondary }}>Note *</label>
                <textarea required rows={5} value={editNoteContent} onChange={e => setEditNoteContent(e.target.value)}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[13px] resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setEditingNote(null); setEditNoteContent(''); }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-[13px] font-bold rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', background: T.teal }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Note confirmation */}
      <ConfirmDialog
        open={showDeleteNote}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmVariant="danger"
        loading={saving}
        onConfirm={handleDeleteNote}
        onCancel={() => { setShowDeleteNote(false); setDeletingNote(null); }}
      />

      {/* Edit Account modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setFormErrors([]); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b shrink-0" style={{ borderColor: T.borderSubtle }}>
              <h2 className="text-[18px] font-bold" style={{ color: T.textPrimary }}>Edit Account</h2>
              <button onClick={() => { setShowEdit(false); setFormErrors([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ color: T.textMuted }}>close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Name *</label>
                  <input required value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className={`w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all${formErrors.some(e => e.field === 'name') ? ' !border-red-500 focus:!ring-red-200' : ''}`}
                    style={{ borderColor: T.border }} />
                  {formErrors.some(e => e.field === 'name') && (<p className="text-[12px] text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Parent Account</label>
                  <select value={editForm.parentAccountId ?? ''} onChange={e => setEditForm(f => ({ ...f, parentAccountId: e.target.value || null }))}
                    className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all"
                    style={{ borderColor: T.border, background: '#fff' }}>
                    <option value="">None (top-level)</option>
                    {allAccounts.filter(a => a.id !== id).map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Registration No.</label>
                    <input value={editForm.registrationNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, registrationNumber: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Tax No.</label>
                    <input value={editForm.taxNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, taxNumber: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Industry</label>
                    <select value={editForm.industry ?? ''} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all"
                      style={{ borderColor: T.border, background: '#fff' }}>
                      <option value="">Select industry</option>
                      {['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Construction', 'Real Estate', 'Legal', 'Conglomerate', 'Family Office', 'Other'].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Company Size</label>
                    <select value={editForm.companySize ?? ''} onChange={e => setEditForm(f => ({ ...f, companySize: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all"
                      style={{ borderColor: T.border, background: '#fff' }}>
                      <option value="">Select size</option>
                      {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Website</label>
                    <input value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                      className={`w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all${formErrors.some(e => e.field === 'website') ? ' !border-red-500 focus:!ring-red-200' : ''}`}
                      style={{ borderColor: T.border }} />
                    {formErrors.some(e => e.field === 'website') && (<p className="text-[12px] text-red-600 mt-1">{formErrors.find(e => e.field === 'website')?.message}</p>)}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Annual Revenue (MYR)</label>
                    <input type="text" inputMode="numeric" placeholder="0"
                      value={editForm.annualRevenue != null ? new Intl.NumberFormat('en-MY').format(Number(editForm.annualRevenue)) : ''}
                      onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); setEditForm(f => ({ ...f, annualRevenue: raw ? raw : null as any })); }}
                      className={`w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all${formErrors.some(e => e.field === 'annualRevenue') ? ' !border-red-500 focus:!ring-red-200' : ''}`}
                      style={{ borderColor: T.border }} />
                    {formErrors.some(e => e.field === 'annualRevenue') && (<p className="text-[12px] text-red-600 mt-1">{formErrors.find(e => e.field === 'annualRevenue')?.message}</p>)}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Email</label>
                    <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      className={`w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all${formErrors.some(e => e.field === 'email') ? ' !border-red-500 focus:!ring-red-200' : ''}`}
                      style={{ borderColor: T.border }} />
                    {formErrors.some(e => e.field === 'email') && (<p className="text-[12px] text-red-600 mt-1">{formErrors.find(e => e.field === 'email')?.message}</p>)}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Phone</label>
                    <input value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Bank Account</label>
                  <input value={editForm.bankAccount ?? ''} onChange={e => setEditForm(f => ({ ...f, bankAccount: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Address</label>
                    <input value={editForm.address ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>City</label>
                    <input value={editForm.city ?? ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>State</label>
                    <input value={editForm.state ?? ''} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Postal Code</label>
                    <input value={editForm.postalCode ?? ''} onChange={e => setEditForm(f => ({ ...f, postalCode: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Country</label>
                    <input value={editForm.country ?? ''} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all" style={{ borderColor: T.border }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold mb-1" style={{ color: T.textPrimary }}>Description</label>
                  <textarea rows={3} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#86f2e4] transition-all resize-none" style={{ borderColor: T.border }} />
                </div>
              </div>
              <div className="sticky bottom-0 bg-white border-t p-4 z-10 flex justify-end gap-3 shrink-0" style={{ borderColor: T.border }}>
                <button type="button" onClick={() => { setShowEdit(false); setFormErrors([]); }}
                  className="px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-[#f1f5f9] transition-colors"
                  style={{ background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: T.textSecondary }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-lg text-[13px] font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: T.teal, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account confirmation */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${account?.name}"? This action cannot be undone.`}
        confirmVariant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-[13px] font-semibold animate-[fadeInUp_.2s_ease-out]"
          style={{ background: T.success, color: '#fff' }}>
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {toast}
        </div>
      )}
    </>
  );
};

export default CrmAccountDetail;