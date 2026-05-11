import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, { CrmOpportunity, CrmActivity, CrmActivityType } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: '#6366f1', QUALIFICATION: '#f59e0b', PROPOSAL: '#3b82f6',
  NEGOTIATION: '#8b5cf6', CLOSED_WON: '#22c55e', CLOSED_LOST: '#ef4444',
};

const CrmOpportunityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<CrmOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes'>('overview');
  const [showMoveStage, setShowMoveStage] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => {
    if (!id) return;
    setLoading(true);
    crmService.getOpportunity(id).then(setOpp).catch(() => navigate('/crm/pipeline')).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  const handleMoveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedStageId) return;
    try {
      setSaving(true);
      await crmService.moveStage(id, selectedStageId, lostReason || undefined);
      reload();
      setShowMoveStage(false);
      setLostReason('');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
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

  if (loading) return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem' }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height: 18, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  if (!opp) return null;

  const stages = opp.pipeline?.stages ?? [];
  const currentStageOrder = opp.stage?.displayOrder ?? 0;
  const isLost = opp.stage?.isLostStage;
  const isWon = opp.stage?.isWonStage;

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">CRM</Link>
        <span>/</span>
        <Link to="/crm/pipeline" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Pipeline</Link>
        <span>/</span>
        <span className="font-semibold text-text-primary">{opp.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary">{opp.name}</h1>
          <p className="text-text-secondary text-sm mt-1">
            {opp.account && <Link to={`/crm/accounts/${opp.account.id}`} style={{ textDecoration: 'none' }} className="text-brand-700 hover:underline">{opp.account.name}</Link>}
            {opp.contact && <> · {opp.contact.firstName} {opp.contact.lastName}</>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setSelectedStageId(opp.stageId); setShowMoveStage(true); }}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">move_down</span> Move Stage
          </button>
          <button onClick={() => setShowAddActivity(true)}
            className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">add</span> Log Activity
          </button>
        </div>
      </div>

      {/* Stage progress bar */}
      {stages.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((s, i) => {
              const isPast = s.displayOrder < currentStageOrder;
              const isCurrent = s.id === opp.stageId;
              const color = STAGE_COLORS[s.name] ?? '#6366f1';
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors"
                      style={{ borderColor: isCurrent || isPast ? color : 'var(--border)', background: isCurrent ? color : isPast ? `${color}30` : 'var(--bg-subtle)', color: isCurrent ? '#fff' : isPast ? color : 'var(--text-secondary)' }}>
                      {isPast && !isCurrent ? <span className="material-symbols-outlined text-xs">check</span> : i + 1}
                    </div>
                    <span className="text-xs text-text-secondary mt-1 text-center leading-tight" style={{ maxWidth: 72 }}>{s.name}</span>
                  </div>
                  {i < stages.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 mt-[-14px]"
                      style={{ background: s.displayOrder < currentStageOrder ? color : 'var(--border)' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
          <span className="material-symbols-outlined text-base text-green-600">payments</span>
          <span className="font-bold text-text-primary">{formatCurrency(opp.value)}</span>
          <span className="text-text-secondary">Deal Value</span>
        </div>
        <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
          <span className="material-symbols-outlined text-base text-brand-700">percent</span>
          <span className="font-bold text-text-primary">{opp.probability}%</span>
          <span className="text-text-secondary">Probability</span>
        </div>
        {opp.expectedCloseDate && (
          <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-text-secondary">calendar_today</span>
            <span className="font-bold text-text-primary">{formatDate(opp.expectedCloseDate)}</span>
            <span className="text-text-secondary">Close Date</span>
          </div>
        )}
        {(isWon || isLost) && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border"
            style={{ background: isWon ? '#f0fdf4' : '#fef2f2', borderColor: isWon ? '#86efac' : '#fca5a5', color: isWon ? '#15803d' : '#dc2626' }}>
            <span className="material-symbols-outlined text-base">{isWon ? 'emoji_events' : 'cancel'}</span>
            <span className="font-bold">{isWon ? 'Won' : 'Lost'}</span>
          </div>
        )}
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

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Deal Info</h3>
            {[
              { label: 'Pipeline', value: opp.pipeline?.name, icon: 'account_tree' },
              { label: 'Stage', value: opp.stage?.name, icon: 'flag' },
              { label: 'Owner', value: opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : '—', icon: 'manage_accounts' },
              { label: 'Created', value: formatDate(opp.createdAt), icon: 'calendar_today' },
              { label: 'Won At', value: opp.wonAt ? formatDate(opp.wonAt) : null, icon: 'emoji_events' },
            ].map(f => f.value && (
              <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                <span className="text-xs text-text-secondary w-16 shrink-0">{f.label}</span>
                <span className="text-sm text-text-primary">{f.value}</span>
              </div>
            ))}
          </div>
          {opp.description && (
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Description</h3>
              <p className="text-sm text-text-primary leading-relaxed">{opp.description}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowAddActivity(true)}
              className="flex items-center gap-1 text-sm text-brand-700 font-semibold hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-sm">add</span> Log Activity
            </button>
          </div>
          {(opp.activities ?? []).length === 0 && <p className="text-text-secondary text-sm">No activities yet.</p>}
          {(opp.activities ?? []).map(a => (
            <div key={a.id} className="flex gap-4 bg-bg-surface border border-border rounded-xl p-4">
              <span className="material-symbols-outlined text-brand-700 mt-0.5">{ACTIVITY_ICONS[a.activityType]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{a.subject}</p>
                {a.description && <p className="text-xs text-text-secondary mt-0.5">{a.description}</p>}
                <p className="text-xs text-text-secondary mt-1">{a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowAddNote(true)}
              className="flex items-center gap-1 text-sm text-brand-700 font-semibold hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-sm">add</span> Add Note
            </button>
          </div>
          {(opp.notes ?? []).length === 0 && <p className="text-text-secondary text-sm">No notes yet.</p>}
          {(opp.notes ?? []).map(n => (
            <div key={n.id} className={`bg-bg-surface border rounded-xl p-4 ${n.isPinned ? 'border-yellow-300' : 'border-border'}`}>
              {n.isPinned && <span className="flex items-center gap-1 text-xs text-yellow-600 mb-2"><span className="material-symbols-outlined text-sm">push_pin</span>Pinned</span>}
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-text-secondary mt-2">{n.author ? `${n.author.firstName} ${n.author.lastName}` : ''} · {formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Move Stage modal */}
      {showMoveStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-black text-text-primary mb-4">Move Stage</h2>
            <form onSubmit={handleMoveStage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select Stage</label>
                <select value={selectedStageId} onChange={e => setSelectedStageId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }}>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>)}
                </select>
              </div>
              {stages.find(s => s.id === selectedStageId)?.isLostStage && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Lost Reason</label>
                  <input value={lostReason} onChange={e => setLostReason(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }} />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMoveStage(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Moving…' : 'Move'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity modal */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-black text-text-primary mb-4">Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
                <select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }}>
                  {(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label>
                <input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea rows={3} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddActivity(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-black text-text-primary mb-4">Add Note</h2>
            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea required rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)' }} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddNote(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : 'Add Note'}
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

export default CrmOpportunityDetail;
