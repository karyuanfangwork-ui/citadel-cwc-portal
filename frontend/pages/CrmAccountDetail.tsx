import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmAccount, CrmActivity, CrmNote, CrmActivityType, CrmTrustProduct } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import EmptyState from '../src/components/ui/EmptyState';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'deals' | 'activities' | 'notes' | 'credit' | 'trustProducts'>('overview');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [showDelete, setShowDelete] = useState(false);

  // Trust Products state
  const [trustProducts, setTrustProducts] = useState<CrmTrustProduct[]>([]);
  const [trustProductsLoading, setTrustProductsLoading] = useState(false);
  const [showCreateTP, setShowCreateTP] = useState(false);
  const [showEditTP, setShowEditTP] = useState(false);
  const [tpForm, setTpForm] = useState<Partial<CrmTrustProduct>>({ trustType: 'TRUST', status: 'ACTIVE', currency: 'MYR' });
  const [editingTP, setEditingTP] = useState<CrmTrustProduct | null>(null);
  const [showDeleteTP, setShowDeleteTP] = useState(false);
  const [deletingTP, setDeletingTP] = useState<CrmTrustProduct | null>(null);

  const loadTrustProducts = () => {
    if (!id) return;
    setTrustProductsLoading(true);
    crmService.listTrustProducts({ accountId: id })
      .then(res => setTrustProducts(res.trustProducts ?? []))
      .catch(() => {})
      .finally(() => setTrustProductsLoading(false));
  };

  useEffect(() => {
    if (activeTab !== 'trustProducts' || !id) return;
    loadTrustProducts();
  }, [activeTab, id]);

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

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !noteContent.trim()) return;
    try {
      setSaving(true);
      await crmService.createNote({ content: noteContent, accountId: id });
      loadNotes(); // refresh notes list
      setShowAddNote(false);
      setNoteContent('');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openEdit = () => {
    if (!account) return;
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
    });
    setShowEdit(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSaving(true);
      const payload = cleanFormPayload(editForm, NUMERIC_KEYS.account);
      await crmService.updateAccount(id, payload);
      setShowEdit(false);
      const updated = await crmService.getAccount(id);
      setAccount(updated);
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
        <span>/</span>
        <span className="font-semibold text-text-primary">{account.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary">{account.name}</h1>
          <p className="text-text-secondary text-sm mt-1">{account.industry || 'No industry'} · {account.city ? `${account.city}, ` : ''}{account.country || ''}</p>
        </div>
        <div className="flex gap-2">
          {account.website && (
            <a href={account.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">open_in_new</span> Website
            </a>
          )}
          <button onClick={openEdit}
            className="flex items-center gap-2 border border-brand-200 text-brand-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-50 transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">edit</span> Edit
          </button>
          {hasPermission(user, 'crm:delete') && (
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 text-danger px-3 py-2 rounded-lg text-sm font-bold hover:bg-danger/10 transition-colors"
              style={{ background: 'none', border: '1px solid var(--color-danger)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">delete</span> Delete
            </button>
          )}
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
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Contacts', value: account._count?.contacts ?? account.contacts?.length ?? 0, icon: 'person' },
          { label: 'Deals', value: account._count?.opportunities ?? account.opportunities?.length ?? 0, icon: 'handshake' },
          { label: 'Leads', value: account._count?.leads ?? account.leads?.length ?? 0, icon: 'trending_up' },
          { label: 'Revenue', value: formatCurrency(account.annualRevenue), icon: 'payments' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
            <span className="font-bold text-text-primary">{s.value}</span>
            <span className="text-text-secondary">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {(['overview', 'contacts', 'deals', 'activities', 'notes', ...(hasPermission(user, 'credit:read') ? ['credit' as const] : [] as const), 'trustProducts'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {tab === 'trustProducts' ? 'Trust Products' : tab === 'credit' ? 'Credit' : tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Account Info</h3>
            {[
              { label: 'Email', value: account.email, icon: 'mail' },
              { label: 'Phone', value: account.phone, icon: 'call' },
              { label: 'Website', value: account.website, icon: 'language' },
              { label: 'Size', value: account.companySize, icon: 'groups' },
              { label: 'Registration No.', value: account.registrationNumber, icon: 'badge' },
              { label: 'Tax No.', value: account.taxNumber, icon: 'receipt_long' },
              { label: 'Bank Account', value: account.bankAccount, icon: 'account_balance' },
              { label: 'Owner', value: account.owner ? `${account.owner.firstName} ${account.owner.lastName}` : '—', icon: 'manage_accounts' },
              { label: 'Created', value: formatDate(account.createdAt), icon: 'calendar_today' },
            ].map(f => f.value && (
              <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                <span className="text-xs text-text-secondary w-16 shrink-0">{f.label}</span>
                <span className="text-sm text-text-primary">{f.value}</span>
              </div>
            ))}
          </div>
          {account.description && (
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Description</h3>
              <p className="text-sm text-text-primary leading-relaxed">{account.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-3">
          {(account.contacts ?? []).length === 0 && <EmptyState icon="person" title="No contacts yet" description="Add contacts to this account." />}
          {(account.contacts ?? []).map(c => (
            <Link key={c.id} to={`/crm/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
              <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                  {c.firstName[0]}{c.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary text-sm">{c.firstName} {c.lastName} {c.isPrimary && <span className="ml-1 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Primary</span>}</p>
                  <p className="text-xs text-text-secondary truncate">{c.jobTitle || ''}{c.jobTitle && c.email ? ' · ' : ''}{c.email || ''}</p>
                </div>
                {c.phone && <span className="text-xs text-text-secondary hidden sm:block">{c.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Deals tab */}
      {activeTab === 'deals' && (
        <div className="space-y-3">
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
        <div className="space-y-3">
          {(account.activities ?? []).length === 0 && <EmptyState icon="timeline" title="No activities yet" description="Log activities to track interactions." />}
          {(account.activities ?? []).map(a => (
            <div key={a.id} className="flex gap-4 bg-bg-surface border border-border rounded-xl p-4">
              <span className="material-symbols-outlined text-brand-700 mt-0.5">{ACTIVITY_ICONS[a.activityType]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{a.subject}</p>
                {a.description && <p className="text-xs text-text-secondary mt-0.5">{a.description}</p>}
                <p className="text-xs text-text-secondary mt-1">{a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}</p>
              </div>
              <span className="text-xs text-text-secondary shrink-0">{a.activityType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {notesLoading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
          ) : notes.length === 0 ? (
            <EmptyState icon="sticky_note_2" title="No notes yet" description="Add notes to keep track of important information." />
          ) : notes.map(n => (
            <div key={n.id} className={`bg-bg-surface border rounded-xl p-4 ${n.isPinned ? 'border-yellow-300' : 'border-border'}`}>
              {n.isPinned && <span className="flex items-center gap-1 text-xs text-yellow-600 mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-text-secondary mt-2">{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Credit tab — deep link to Credit/Borrower Profiles */}
      {activeTab === 'credit' && (
        <div className="space-y-4">
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

      {/* Trust Products tab */}
      {activeTab === 'trustProducts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-text-primary">Trust Products</h3>
            <button onClick={() => { setTpForm({ trustType: 'TRUST', status: 'ACTIVE', currency: 'MYR' }); setShowCreateTP(true); }}
              className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">add</span> Add Trust Product
            </button>
          </div>
          {trustProductsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
          ) : trustProducts.length === 0 ? (
            <p className="text-text-secondary text-sm">No trust products yet. Add one.</p>
          ) : trustProducts.map(tp => (
            <div key={tp.id} className="bg-bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-text-primary text-sm">{tp.trustType}{tp.deedRefNumber ? ` · ${tp.deedRefNumber}` : ''}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                    style={{
                      background: tp.status === 'ACTIVE' ? '#22c55e20' : tp.status === 'PENDING' ? '#f59e0b20' : tp.status === 'MATURED' ? '#6366f120' : '#ef444420',
                      color: tp.status === 'ACTIVE' ? '#22c55e' : tp.status === 'PENDING' ? '#f59e0b' : tp.status === 'MATURED' ? '#6366f1' : '#ef4444',
                    }}>
                    {tp.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingTP(tp);
                    setTpForm({
                      trustType: tp.trustType,
                      deedRefNumber: tp.deedRefNumber ?? '',
                      status: tp.status,
                      assetValue: tp.assetValue ?? undefined,
                      currency: tp.currency,
                      assetDescription: tp.assetDescription ?? '',
                      trusteeName: tp.trusteeName ?? '',
                      trusteeContact: tp.trusteeContact ?? '',
                      settlementDate: tp.settlementDate ?? '',
                      maturityDate: tp.maturityDate ?? '',
                      nextReviewDate: tp.nextReviewDate ?? '',
                      ownerId: tp.ownerId ?? '',
                    } as any);
                    setShowEditTP(true);
                  }}
                    className="flex items-center gap-1 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-50 transition-colors"
                    style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <span className="material-symbols-outlined text-sm">edit</span> Edit
                  </button>
                  <button onClick={() => { setDeletingTP(tp); setShowDeleteTP(true); }}
                    className="flex items-center gap-1 text-danger px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-danger/10 transition-colors"
                    style={{ background: 'none', border: '1px solid var(--color-danger)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <span className="material-symbols-outlined text-sm">delete</span> Delete
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-text-secondary">Value</p>
                  <p className="font-semibold text-text-primary">{formatCurrency(tp.assetValue ?? 0)} {tp.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Trustee</p>
                  <p className="font-semibold text-text-primary">{tp.trusteeName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Maturity</p>
                  <p className="font-semibold text-text-primary">{formatDate(tp.maturityDate ?? null)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Next Review</p>
                  <p className="font-semibold text-text-primary">{formatDate(tp.nextReviewDate ?? null)}</p>
                </div>
                {tp.assetDescription && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-text-secondary">Description</p>
                    <p className="text-sm text-text-primary">{tp.assetDescription}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Trust Product modal */}
      {(showCreateTP || showEditTP) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowCreateTP(false); setShowEditTP(false); setEditingTP(null); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-extrabold text-text-primary">{showEditTP ? 'Edit Trust Product' : 'Create Trust Product'}</h2>
              <button onClick={() => { setShowCreateTP(false); setShowEditTP(false); setEditingTP(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setSaving(true);
                const data = { ...tpForm, accountId: id };
                if (showEditTP && editingTP) {
                  await crmService.updateTrustProduct(editingTP.id, data);
                } else {
                  await crmService.createTrustProduct(data);
                }
                setShowCreateTP(false);
                setShowEditTP(false);
                setEditingTP(null);
                loadTrustProducts();
              } catch (e) { console.error(e); }
              finally { setSaving(false); }
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Trust Type *</label>
                  <select value={tpForm.trustType ?? ''} onChange={e => setTpForm(f => ({ ...f, trustType: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    {['TRUST', 'ESTATE', 'WILL', 'CUSTODY', 'OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Deed Ref Number</label>
                  <input value={tpForm.deedRefNumber ?? ''} onChange={e => setTpForm(f => ({ ...f, deedRefNumber: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Status *</label>
                  <select value={tpForm.status ?? ''} onChange={e => setTpForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    {['ACTIVE', 'PENDING', 'INACTIVE', 'MATURED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Asset Value</label>
                  <input type="number" value={tpForm.assetValue ?? ''} onChange={e => setTpForm(f => ({ ...f, assetValue: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Currency</label>
                  <input value={tpForm.currency ?? 'MYR'} onChange={e => setTpForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Owner ID</label>
                  <input value={tpForm.ownerId ?? ''} onChange={e => setTpForm(f => ({ ...f, ownerId: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Asset Description</label>
                <textarea rows={3} value={tpForm.assetDescription ?? ''} onChange={e => setTpForm(f => ({ ...f, assetDescription: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Trustee Name</label>
                  <input value={tpForm.trusteeName ?? ''} onChange={e => setTpForm(f => ({ ...f, trusteeName: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Trustee Contact</label>
                  <input value={tpForm.trusteeContact ?? ''} onChange={e => setTpForm(f => ({ ...f, trusteeContact: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Settlement Date</label>
                  <input type="date" value={tpForm.settlementDate ?? ''} onChange={e => setTpForm(f => ({ ...f, settlementDate: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Maturity Date</label>
                  <input type="date" value={tpForm.maturityDate ?? ''} onChange={e => setTpForm(f => ({ ...f, maturityDate: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Next Review Date</label>
                  <input type="date" value={tpForm.nextReviewDate ?? ''} onChange={e => setTpForm(f => ({ ...f, nextReviewDate: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateTP(false); setShowEditTP(false); setEditingTP(null); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : showEditTP ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trust Product confirmation */}
      <ConfirmDialog
        open={showDeleteTP}
        title="Delete Trust Product"
        message={`Are you sure you want to delete this trust product${deletingTP?.deedRefNumber ? ` (${deletingTP.deedRefNumber})` : ''}? This action cannot be undone.`}
        confirmVariant="danger"
        loading={saving}
        onConfirm={async () => {
          if (!deletingTP) return;
          try {
            setSaving(true);
            await crmService.deleteTrustProduct(deletingTP.id);
            setShowDeleteTP(false);
            setDeletingTP(null);
            loadTrustProducts();
          } catch (e) { console.error(e); }
          finally { setSaving(false); }
        }}
        onCancel={() => { setShowDeleteTP(false); setDeletingTP(null); }}
      />

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

      {/* Edit Account modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-extrabold text-text-primary">Edit Account</h2>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined text-text-secondary">close</span></button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Name *</label>
                <input required value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
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
                  <input value={editForm.industry ?? ''} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Company Size</label>
                  <input value={editForm.companySize ?? ''} onChange={e => setEditForm(f => ({ ...f, companySize: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Website</label>
                  <input value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Annual Revenue (MYR)</label>
                  <input type="number" min="0" value={editForm.annualRevenue ?? ''} onChange={e => setEditForm(f => ({ ...f, annualRevenue: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Email</label>
                  <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
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
    </div>
    </>
  );
};

export default CrmAccountDetail;
