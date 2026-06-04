import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmAccount, CrmActivity, CrmNote, CrmActivityType, CrmUser } from '../src/services/crm.service';

import CrmNav from '../src/components/CrmNav';
import AiInsightCard from '../src/components/crm/AiInsightCard';
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

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SkeletonLine = ({ mb = 12 }: { mb?: number }) => (
  <div style={{ height: 18, marginBottom: mb, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
);

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

const CrmAccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [account, setAccount] = useState<CrmAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'deals' | 'activities' | 'notes' | 'credit' | 'audit'>('overview');
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
  const [showMore, setShowMore] = useState(false);

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

  // ── Next Best Action (Task 11) ─────────────────────────────────────
  const nba = useNextBestAction();

  // CRM Users for owner select
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  // Accounts for parent picker
  const [allAccounts, setAllAccounts] = useState<{ id: string; name: string }[]>([]);

  // Credit tab borrower summary
  const [creditSummary, setCreditSummary] = useState<{ borrowerCount: number; loading: boolean }>({ borrowerCount: 0, loading: true });
  useEffect(() => {
    if (activeTab !== 'credit' || !id) return;
    setCreditSummary(prev => ({ ...prev, loading: true }));
    creditService.listBorrowerProfiles({ accountId: id, limit: 1 })
      .then(res => setCreditSummary({ borrowerCount: res.pagination?.total ?? res.profiles?.length ?? 0, loading: false }))
      .catch(() => setCreditSummary(prev => ({ ...prev, loading: false })));
  }, [activeTab, id]);
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
      loadNotes(); // refresh notes list
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

  if (loading) return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-bg-surface border border-border rounded-xl p-5 mb-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  if (!account) return null;

  const stageColors: Record<string, string> = { PROSPECTING: '#6366f1', QUALIFICATION: '#f59e0b', PROPOSAL: '#3b82f6', NEGOTIATION: '#8b5cf6', CLOSED_WON: '#22c55e', CLOSED_LOST: '#ef4444' };

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">CRM</Link>
        <span>/</span>
        <Link to="/crm/accounts" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Accounts</Link>
        {account.parent && (
          <>
            <span>/</span>
            <Link to={`/crm/accounts/${account.parent.id}`} style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">{account.parent.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="font-semibold text-text-primary">{account.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary">{account.name}</h1>
          <p className="text-text-secondary text-sm mt-1">{account.industry || 'No industry'} · {account.city ? `${account.city}, ` : ''}{account.country || ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary actions */}
          <button onClick={() => setShowAddActivity(true)}
            className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">add</span> Log Activity
          </button>
          <button onClick={() => setShowAddNote(true)}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">sticky_note_2</span> Add Note
          </button>
          {/* Secondary actions */}
          {account.website && (
            <a href={account.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">open_in_new</span> Website
            </a>
          )}
          <button onClick={openEdit}
            className="flex items-center gap-2 border border-brand-200 text-brand-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-brand-50 transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">edit</span> Edit
          </button>
          {/* More dropdown (contains Delete) */}
          <div className="relative" id="more-menu-container">
            <button onClick={() => setShowMore(prev => !prev)}
              className="flex items-center gap-1 border border-border px-3 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
              style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">more_vert</span> More
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white rounded-xl shadow-lg border border-border py-1 z-50">
                {hasPermission(user, 'crm:delete') && (
                  <button onClick={() => { setShowMore(false); setShowDelete(true); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-danger hover:bg-red-50 transition-colors"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                    <span className="material-symbols-outlined text-base text-danger">delete</span> Delete Account
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Contacts', value: account._count?.contacts ?? account.contacts?.length ?? 0, icon: 'person', tab: 'contacts' as const },
          { label: 'Deals', value: account._count?.opportunities ?? account.opportunities?.length ?? 0, icon: 'handshake', tab: 'deals' as const },
          { label: 'Leads', value: account._count?.leads ?? account.leads?.length ?? 0, icon: 'trending_up', tab: 'overview' as const },
          { label: 'Revenue', value: formatCurrency(account.annualRevenue), icon: 'payments', tab: 'deals' as const },
        ].concat(
          account.children && account.children.length > 0
            ? [{ label: 'Subsidiary Deals Value', value: `${account.children.length} subsidiaries`, icon: 'account_tree' as const, tab: 'overview' as const }]
            : []
        ).map(s => (
          <button key={s.label} onClick={() => setActiveTab(s.tab)}
            className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
            style={{ background: 'none', border: '1px solid var(--color-border)', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
            <span className="font-bold text-text-primary">{s.value}</span>
            <span className="text-text-secondary">{s.label}</span>
          </button>
        ))}
      </div>

      {/* AI Suggested Actions */}
      {nba.loading && !nba.data && (
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-sm text-brand-500 animate-pulse">auto_awesome</span>
          <span className="text-xs text-text-secondary animate-pulse">Loading suggested actions…</span>
        </div>
      )}
      {nba.data && nba.data.actions?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs font-semibold text-text-secondary">AI Suggested:</span>
          {nba.data.actions.map((a, i) => {
            // Wire action keywords to pre-filled activity modal
            const actionText = a.action.toLowerCase();
            let activityType: CrmActivityType | null = null;
            if (actionText.includes('call')) activityType = 'CALL';
            else if (actionText.includes('email') || actionText.includes('follow-up') || actionText.includes('follow up')) activityType = 'EMAIL';
            else if (actionText.includes('meeting') || actionText.includes('schedule')) activityType = 'MEETING';
            else if (actionText.includes('whatsapp')) activityType = 'WHATSAPP';
            else if (actionText.includes('site visit') || actionText.includes('visit')) activityType = 'SITE_VISIT';
            const handleClick = activityType
              ? () => { setActivityForm({ activityType, subject: a.action }); setShowAddActivity(true); }
              : undefined;
            return (
              <span key={i}
                onClick={handleClick}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-subtle border border-border ${handleClick ? 'cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-colors' : ''}`}
                title={a.reason}
                role={handleClick ? 'button' : undefined}
                tabIndex={handleClick ? 0 : undefined}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                {a.action}
              </span>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6" role="tablist" aria-label="Account detail tabs">
        {(['overview', 'contacts', 'deals', 'activities', 'notes', ...(hasPermission(user, 'credit:read') ? ['credit' as const] : [] as const), 'audit'] as const).map(tab => {
          const tabId = `tab-${tab}`;
          const panelId = `panel-${tab}`;
          return (
            <button key={tab} id={tabId} role="tab" aria-selected={activeTab === tab} aria-controls={panelId}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(e) => {
                const tabs = ['overview', 'contacts', 'deals', 'activities', 'notes', ...(hasPermission(user, 'credit:read') ? ['credit' as const] : [] as const), 'audit'] as const;
                const idx = tabs.indexOf(tab);
                if (e.key === 'ArrowRight') { e.preventDefault(); setActiveTab(tabs[(idx + 1) % tabs.length]); document.getElementById(`tab-${tabs[(idx + 1) % tabs.length]}`)?.focus(); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]); document.getElementById(`tab-${tabs[(idx - 1 + tabs.length) % tabs.length]}`)?.focus(); }
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${activeTab === tab ? 'border-brand-700 text-brand-700 font-bold' : 'border-transparent text-text-secondary font-semibold hover:text-text-primary'}`}>
              {tab === 'credit' ? 'Credit' : tab === 'audit' ? 'Audit Log' : tab}
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Account Info</h3>
            {/* Editable fields — all edits route through the Edit Account modal */}
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">badge</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Name</span>
              <span className="text-sm text-text-primary">{account.name || '—'}</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">factory</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Industry</span>
              <span className="text-sm text-text-primary">{account.industry || '—'}</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">groups</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Company Size</span>
              <span className="text-sm text-text-primary">{account.companySize || '—'}</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">language</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Website</span>
              {account.website ? (
                <a href={account.website} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">{account.website}</a>
              ) : (
                <span className="text-sm text-text-primary">—</span>
              )}
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">call</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Phone</span>
              {account.phone ? (
                <a href={`tel:${account.phone}`} className="text-sm text-brand-700 hover:underline">{account.phone}</a>
              ) : (
                <span className="text-sm text-text-primary">—</span>
              )}
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">mail</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Email</span>
              {account.email ? (
                <a href={`mailto:${account.email}`} className="text-sm text-brand-700 hover:underline">{account.email}</a>
              ) : (
                <span className="text-sm text-text-primary">—</span>
              )}
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">payments</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Annual Revenue</span>
              <span className="text-sm text-text-primary">{formatCurrency(account.annualRevenue)}</span>
            </div>
            {/* Owner — display only; editable via Edit Account modal (crm:write + crm:admin) */}
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">manage_accounts</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Owner</span>
              <span className="text-sm text-text-primary">{account.owner ? `${account.owner.firstName} ${account.owner.lastName}` : '—'}</span>
            </div>
            {/* Read-only fields */}
            <div className="flex items-center gap-3 py-2 border-b border-border bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">badge</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Registration No.</span>
              <span className="text-sm text-text-primary flex-1">{account.registrationNumber || '—'}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">receipt_long</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Tax No.</span>
              <span className="text-sm text-text-primary flex-1">{account.taxNumber || '—'}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">account_balance</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Bank Account</span>
              <span className="text-sm text-text-primary flex-1">{account.bankAccount || '—'}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">check_circle</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Active</span>
              <span className="text-sm text-text-primary flex-1">{account.isActive ? 'Yes' : 'No'}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">calendar_today</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Created</span>
              <span className="text-sm text-text-primary flex-1">{formatDate(account.createdAt)}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
            <div className="flex items-center gap-3 py-2 bg-bg-subtle/50 rounded px-1 opacity-80">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">update</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">Updated</span>
              <span className="text-sm text-text-primary flex-1">{formatDate(account.updatedAt)}</span>
              <span className="material-symbols-outlined text-xs text-text-secondary" title="Read-only">lock</span>
            </div>
          </div>
          {/* Parent & Children hierarchy card */}
          {(account.parent || (account.children && account.children.length > 0)) && (
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Hierarchy</h3>
              {account.parent && (
                <div className="flex items-center gap-3 py-2 border-b border-border">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">account_tree</span>
                  <span className="text-xs text-text-secondary w-28 shrink-0">Parent</span>
                  <Link to={`/crm/accounts/${account.parent.id}`} style={{ textDecoration: 'none' }} className="text-sm text-brand-700 hover:underline">{account.parent.name}</Link>
                </div>
              )}
              {account.children && account.children.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-sm text-text-secondary">family_restroom</span>
                    <span className="text-xs font-semibold text-text-secondary">Subsidiaries ({account.children.length})</span>
                  </div>
                  {account.children.map(c => (
                    <Link key={c.id} to={`/crm/accounts/${c.id}`} style={{ textDecoration: 'none' }}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-subtle transition-colors group">
                      <span className="material-symbols-outlined text-sm text-text-secondary">business</span>
                      <span className="text-sm text-text-primary group-hover:text-brand-700">{c.name}</span>
                      {c.industry && <span className="text-xs text-text-secondary ml-auto">{c.industry}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Address card */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Address</h3>
            {account.address || account.city || account.state || account.postalCode || account.country ? (
              <div className="text-sm text-text-primary space-y-0.5">
                {account.address && <p>{account.address}</p>}
                <p>{[account.city, account.state, account.postalCode].filter(Boolean).join(', ')}</p>
                {account.country && <p>{account.country}</p>}
              </div>
            ) : (
              <p className="text-sm text-text-secondary italic">No address added — click Edit to add one.</p>
            )}
          </div>
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Description</h3>
            {account.description ? (
              <p className="text-sm text-text-primary leading-relaxed">{account.description}</p>
            ) : (
              <p className="text-sm text-text-secondary italic">No description added — click Edit to add one.</p>
            )}
          </div>
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div id="panel-contacts" role="tabpanel" aria-labelledby="tab-contacts" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-text-primary">Contacts</h3>
            {hasPermission(user, 'crm:write') && (
              <Link to={`/crm/contacts/new?accountId=${account.id}`}
                className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">person_add</span> Add Contact
              </Link>
            )}
          </div>
          {(account.contacts ?? []).length === 0 && <EmptyState icon="person" title="No contacts yet" description="Add contacts to this account." />}
          {(account.contacts ?? []).map(c => (
            <Link key={c.id} to={`/crm/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
              <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                  {c.firstName[0]}{c.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary text-sm">{c.firstName} {c.lastName} {c.isPrimary && <span className="ml-1 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Primary</span>}</p>
                  <p className="text-xs text-text-secondary truncate">{c.jobTitle || ''}{c.jobTitle && c.email ? ' · ' : ''}{c.email ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="hover:underline text-brand-700">{c.email}</a> : ''}</p>
                </div>
                {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="text-xs text-brand-700 hover:underline hidden sm:block">{c.phone}</a>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Deals tab */}
      {activeTab === 'deals' && (
        <div id="panel-deals" role="tabpanel" aria-labelledby="tab-deals" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-text-primary">Deals</h3>
            {hasPermission(user, 'crm:write') && (
              <Link to={`/crm/opportunities/new?accountId=${account.id}`}
                className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">add_business</span> Create Opportunity
              </Link>
            )}
          </div>
          {(account.opportunities ?? []).length === 0 && <EmptyState icon="handshake" title="No deals yet" description="Create opportunities for this account." />}
          {(account.opportunities ?? []).map(o => (
            <Link key={o.id} to={`/crm/opportunities/${o.id}`} style={{ textDecoration: 'none' }}>
              <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary text-sm">{o.name}</p>
                  <p className="text-xs text-text-secondary">{o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : ''}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${stageColors[o.stage?.name ?? ''] ?? '#6366f1'}20`, color: stageColors[o.stage?.name ?? ''] ?? '#6366f1' }}>
                  {o.stage?.name ?? '—'}
                </span>
                <span className="text-sm font-bold text-text-primary">{formatCurrency(o.value)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Activities tab */}
      {activeTab === 'activities' && (
        <div id="panel-activities" role="tabpanel" aria-labelledby="tab-activities" className="space-y-3">
          {/* Filter & Sort */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as const).map(type => (
                <button key={type} onClick={() => setActivityFilter(type)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    activityFilter === type
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-bg-surface text-text-secondary border-border hover:bg-bg-subtle hover:border-brand-300'
                  }`}
                  style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {type === 'ALL' ? 'All' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
            <select value={activitySort} onChange={e => setActivitySort(e.target.value as 'newest' | 'oldest')}
              className="border border-border rounded-lg px-2 py-1.5 text-xs font-semibold text-text-secondary bg-bg-surface"
              style={{ fontFamily: 'var(--font-sans)' }}>
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
            <div key={a.id} className="flex gap-4 bg-bg-surface border border-border rounded-xl p-4">
              <span className="material-symbols-outlined text-brand-700 mt-0.5">{ACTIVITY_ICONS[a.activityType]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{a.subject}</p>
                {a.description && <p className="text-xs text-text-secondary mt-0.5">{a.description}</p>}
                <p className="text-xs text-text-secondary mt-1">{a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                  {a.scheduledAt && <span className="ml-2 text-brand-600">Scheduled: {formatDate(a.scheduledAt)}</span>}
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
                      className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-700 px-1.5 py-0.5 rounded-full hover:bg-brand-50 transition-colors"
                      style={{ border: 'none', cursor: 'pointer', background: 'none' }}
                      title="Send a reminder for this scheduled activity"
                    >
                      <span className="material-symbols-outlined text-[10px]">notifications</span>
                      Set Reminder
                    </button>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasPermission(user, 'crm:edit') && (
                  <button onClick={() => openEditActivity(a)} title="Edit activity"
                    className="p-1 rounded hover:bg-bg-subtle transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-text-secondary text-base">edit</span>
                  </button>
                )}
                {hasPermission(user, 'crm:delete') && (
                  <button onClick={() => { setDeletingActivity(a); setShowDeleteActivity(true); }} title="Delete activity"
                    className="p-1 rounded hover:bg-red-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-danger text-base">delete</span>
                  </button>
                )}
              </div>
              <span className="text-xs text-text-secondary shrink-0">{a.activityType}</span>
            </div>
          ));
          })()}
          {hasMoreActivities && (account.activities ?? []).length > 0 && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMoreActivities}
                disabled={loadingMoreActivities}
                className="flex items-center gap-2 border border-border px-6 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--bg-surface)', cursor: loadingMoreActivities ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {loadingMoreActivities ? (
                  <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Loading…</>
                ) : (
                  <><span className="material-symbols-outlined text-base">expand_more</span>Load More</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className="space-y-3">
          {notesLoading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
          ) : notes.length === 0 ? (
            <EmptyState icon="sticky_note_2" title="No notes yet" description="Add notes to keep track of important information." />
          ) : notes.map(n => (
            <div key={n.id} className={`bg-bg-surface border rounded-xl p-4 ${n.isPinned ? 'border-yellow-300' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {n.isPinned && <span className="flex items-center gap-1 text-xs text-yellow-600 mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
                  <div className="text-sm text-text-primary leading-relaxed prose prose-sm max-w-none">
                    <ReactMarkdown>{n.content}</ReactMarkdown>
                  </div>
                  <p className="text-xs text-text-secondary mt-2">{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleTogglePinNote(n)} title={n.isPinned ? 'Unpin note' : 'Pin note'}
                    className="p-1 rounded hover:bg-yellow-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className={`material-symbols-outlined text-base ${n.isPinned ? 'text-yellow-500' : 'text-text-secondary'}`}>push_pin</span>
                  </button>
                  <button onClick={() => { setEditingNote(n); setEditNoteContent(n.content); }} title="Edit note"
                    className="p-1 rounded hover:bg-bg-subtle transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-base text-text-secondary">edit</span>
                  </button>
                  <button onClick={() => { setDeletingNote(n); setShowDeleteNote(true); }} title="Delete note"
                    className="p-1 rounded hover:bg-red-50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-base text-danger">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credit tab — deep link to Credit/Borrower Profiles */}
      {activeTab === 'credit' && (
        <div id="panel-credit" role="tabpanel" aria-labelledby="tab-credit" className="space-y-4">
          {/* Borrower Summary */}
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Borrower Summary</h3>
            {creditSummary.loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-black text-text-primary">{creditSummary.borrowerCount}</p>
                  <p className="text-xs text-text-secondary">Borrower profiles</p>
                </div>
                <div className="flex-1" />
                <Link to={`/credit/borrowers?accountId=${account.id}`}
                  className="flex items-center gap-2 text-sm text-brand-700 font-bold hover:underline"
                  style={{ textDecoration: 'none' }}>
                  View all <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Credit Module</h3>
            <p className="text-sm text-text-secondary mb-4">View and manage borrower profiles, credit applications, and documents for this account from the Credit module.</p>
            <div className="flex gap-3 flex-wrap">
              <Link
                to={`/credit/borrowers?accountId=${account.id}`}
                className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ textDecoration: 'none' }}
              >
                <span className="material-symbols-outlined text-base">person</span> View Borrower Profiles
              </Link>
              <Link
                to="/credit/applications"
                className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
                style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}
              >
                <span className="material-symbols-outlined text-base">description</span> Credit Applications
              </Link>
              <Link
                to="/credit"
                className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
                style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}
              >
                <span className="material-symbols-outlined text-base">dashboard</span> Credit Dashboard
              </Link>
            </div>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-brand-600 text-xl shrink-0 mt-0.5">info</span>
            <div>
              <p className="text-sm font-semibold text-brand-800">Cross-module navigation</p>
              <p className="text-xs text-brand-700 mt-0.5">Clicking "View Borrower Profiles" will take you to the Credit module, pre-filtered to show borrower profiles linked to this account ({account.name}).</p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log tab */}
      {activeTab === 'audit' && account && (
        <div id="panel-audit" role="tabpanel" aria-labelledby="tab-audit">
          <CrmAuditLog entityType="account" entityId={account.id} />
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
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Scheduled At</label>
                  <input type="datetime-local" value={activityForm.scheduledAt ?? ''} onChange={e => setActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Completed At</label>
                  <input type="datetime-local" value={activityForm.completedAt ?? ''} onChange={e => setActivityForm(f => ({ ...f, completedAt: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Duration (minutes)</label>
                <input type="number" min={0} value={activityForm.durationMinutes ?? ''} onChange={e => setActivityForm(f => ({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
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

      {/* Edit Activity modal */}
      {showEditActivity && editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEditActivity(false); setEditingActivity(null); setEditActivityForm({}); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Edit Activity</h2>
            <form onSubmit={handleEditActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
                <select value={editActivityForm.activityType ?? 'CALL'} onChange={e => setEditActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label>
                <input required value={editActivityForm.subject ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea rows={3} value={editActivityForm.description ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Scheduled At</label>
                <input type="datetime-local" value={editActivityForm.scheduledAt ? editActivityForm.scheduledAt.slice(0, 16) : ''} onChange={e => setEditActivityForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Completed At</label>
                <input type="datetime-local" value={editActivityForm.completedAt ? editActivityForm.completedAt.slice(0, 16) : ''} onChange={e => setEditActivityForm(f => ({ ...f, completedAt: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Duration (minutes)</label>
                <input type="number" min={0} value={editActivityForm.durationMinutes ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditActivity(false); setEditingActivity(null); setEditActivityForm({}); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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

      {/* Edit Note modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setEditingNote(null); setEditNoteContent(''); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Edit Note</h2>
            <form onSubmit={handleEditNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Note *</label>
                <textarea required rows={5} value={editNoteContent} onChange={e => setEditNoteContent(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setEditingNote(null); setEditNoteContent(''); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
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
            <div className="flex items-center justify-between p-6 border-b border-border-subtle shrink-0">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Account</h2>
              <button onClick={() => { setShowEdit(false); setFormErrors([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Name *</label>
                <input required value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'name') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                {formErrors.some(e => e.field === 'name') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'name')?.message}</p>)}
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Parent Account</label>
                <select value={editForm.parentAccountId ?? ''} onChange={e => setEditForm(f => ({ ...f, parentAccountId: e.target.value || null }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all">
                  <option value="">None (top-level)</option>
                  {allAccounts.filter(a => a.id !== id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Registration No.</label>
                  <input value={editForm.registrationNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, registrationNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Tax No.</label>
                  <input value={editForm.taxNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, taxNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Industry</label>
                  <select value={editForm.industry ?? ''} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                    style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="">Select industry</option>
                    {['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Construction', 'Real Estate', 'Legal', 'Conglomerate', 'Family Office', 'Other'].map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Company Size</label>
                  <select value={editForm.companySize ?? ''} onChange={e => setEditForm(f => ({ ...f, companySize: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                    style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="">Select size</option>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Website</label>
                  <input value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'website') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'website') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'website')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Annual Revenue (MYR)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={editForm.annualRevenue != null ? new Intl.NumberFormat('en-MY').format(Number(editForm.annualRevenue)) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setEditForm(f => ({ ...f, annualRevenue: raw ? raw : null as any }));
                    }}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'annualRevenue') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'annualRevenue') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'annualRevenue')?.message}</p>)}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Email</label>
                  <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all${formErrors.some(e => e.field === 'email') ? ' !border-red-500 focus:!ring-red-200' : ''}`} />
                  {formErrors.some(e => e.field === 'email') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'email')?.message}</p>)}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Phone</label>
                  <input value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Bank Account</label>
                <input value={editForm.bankAccount ?? ''} onChange={e => setEditForm(f => ({ ...f, bankAccount: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Address</label>
                  <input value={editForm.address ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">City</label>
                  <input value={editForm.city ?? ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">State</label>
                  <input value={editForm.state ?? ''} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Postal Code</label>
                  <input value={editForm.postalCode ?? ''} onChange={e => setEditForm(f => ({ ...f, postalCode: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Country</label>
                  <input value={editForm.country ?? ''} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Description</label>
                <textarea rows={3} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all resize-none" />
              </div>
              </div>{/* end scrollable body */}
              <div className="sticky bottom-0 bg-white border-t border-border p-4 z-10 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => { setShowEdit(false); setFormErrors([]); }} className="px-5 py-2 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-subtle" style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
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
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-[fadeInUp_.2s_ease-out]">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {toast}
        </div>
      )}
    </div>
    </>
  );
};

export default CrmAccountDetail;
