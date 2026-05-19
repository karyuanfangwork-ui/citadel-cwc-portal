import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  committeeApi, CommitteeMeeting, CommitteeMember, CommitteeAgendaItem,
  CommitteeVote, MeetingStatus, MeetingType, MemberRole, AttendanceStatus,
  DecisionType, VoteChoice, Pagination,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: '#3b82f620', text: '#2563eb' },
  IN_PROGRESS: { bg: '#f59e0b20', text: '#d97706' },
  COMPLETED: { bg: '#22c55e20', text: '#16a34a' },
  CANCELLED: { bg: '#6b728020', text: '#6b7280' },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  CREDIT_COMMITTEE: 'Credit Committee',
  RISK_COMMITTEE: 'Risk Committee',
  MANAGEMENT: 'Management',
  ADHOC: 'Ad-hoc',
};

const MEETING_STATUSES: MeetingStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const MEMBER_ROLES: MemberRole[] = ['CHAIR', 'SECRETARY', 'MEMBER'];
const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const DECISION_TYPES: DecisionType[] = ['APPROVE', 'REJECT', 'DEFER', 'ESCALATE'];
const MEETING_TYPES: MeetingType[] = ['CREDIT_COMMITTEE', 'RISK_COMMITTEE', 'MANAGEMENT', 'ADHOC'];

const CommitteeMeetings: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [meetingDetail, setMeetingDetail] = useState<CommitteeMeeting | null>(null);
  const [quorumStatus, setQuorumStatus] = useState<{ quorumMet: boolean; presentCount: number; quorumMin: number } | null>(null);

  // Create meeting form
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    scheduledAt: '',
    location: '',
    quorumMin: 3,
    meetingType: 'CREDIT_COMMITTEE' as MeetingType,
  });
  const [creating, setCreating] = useState(false);

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'MEMBER' as MemberRole });
  const [addingMember, setAddingMember] = useState(false);

  // Add agenda item form
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ applicationId: '', decisionType: 'APPROVE' as DecisionType });
  const [addingAgenda, setAddingAgenda] = useState(false);

  // Vote panel for a specific agenda item
  const [votePanelItemId, setVotePanelItemId] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<VoteChoice | ''>('');
  const [voteComment, setVoteComment] = useState('');
  const [castingVote, setCastingVote] = useState(false);

  // Memo viewer
  const [viewingMemo, setViewingMemo] = useState<{ applicationId: string; memo: string } | null>(null);

  const canWrite = hasPermission(user, 'credit:write');

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await committeeApi.listMeetings(params);
      setMeetings(data.meetings);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const fetchDetail = useCallback(async (meetingId: string) => {
    try {
      const data = await committeeApi.getMeeting(meetingId);
      setMeetingDetail(data);
      const q = await committeeApi.checkQuorum(meetingId);
      setQuorumStatus(q);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (expandedId) fetchDetail(expandedId);
  }, [expandedId, fetchDetail]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setVotePanelItemId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await committeeApi.createMeeting({
        title: createForm.title,
        scheduledAt: new Date(createForm.scheduledAt).toISOString(),
        location: createForm.location || undefined,
        quorumMin: createForm.quorumMin,
        meetingType: createForm.meetingType,
      });
      setShowCreateDialog(false);
      setCreateForm({ title: '', scheduledAt: '', location: '', quorumMin: 3, meetingType: 'CREDIT_COMMITTEE' });
      fetchMeetings();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId) return;
    try {
      setAddingMember(true);
      await committeeApi.addMember(expandedId, { userId: memberForm.userId, role: memberForm.role });
      setShowAddMember(false);
      setMemberForm({ userId: '', role: 'MEMBER' });
      fetchDetail(expandedId);
    } catch (e) { console.error(e); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!expandedId || !confirm('Remove this member?')) return;
    try {
      await committeeApi.removeMember(expandedId, userId);
      fetchDetail(expandedId);
    } catch (e) { console.error(e); }
  };

  const handleUpdateAttendance = async (userId: string, attendance: AttendanceStatus) => {
    if (!expandedId) return;
    try {
      await committeeApi.updateAttendance(expandedId, userId, { attendance });
      fetchDetail(expandedId);
    } catch (e) { console.error(e); }
  };

  const handleAddAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId) return;
    try {
      setAddingAgenda(true);
      await committeeApi.addAgendaItem(expandedId, {
        applicationId: agendaForm.applicationId,
        decisionType: agendaForm.decisionType,
      });
      setShowAddAgenda(false);
      setAgendaForm({ applicationId: '', decisionType: 'APPROVE' });
      fetchDetail(expandedId);
    } catch (e) { console.error(e); }
    finally { setAddingAgenda(false); }
  };

  const handleRemoveAgenda = async (itemId: string) => {
    if (!confirm('Remove this agenda item?')) return;
    try {
      await committeeApi.removeAgendaItem(itemId);
      if (expandedId) fetchDetail(expandedId);
    } catch (e) { console.error(e); }
  };

  const handleCastVote = async (agendaItemId: string) => {
    if (!voteChoice || !user) return;
    try {
      setCastingVote(true);
      // Find the current user's member id in meeting detail
      const myMember = meetingDetail?.members?.find(m => m.userId === user.id);
      if (!myMember) { alert('You are not a member of this meeting'); return; }
      await committeeApi.castVote(agendaItemId, {
        memberId: myMember.id,
        vote: voteChoice,
        comment: voteComment || undefined,
      });
      setVoteChoice('');
      setVoteComment('');
      setVotePanelItemId(null);
      if (expandedId) fetchDetail(expandedId);
    } catch (e) { console.error(e); }
    finally { setCastingVote(false); }
  };

  const handleFinalize = async (itemId: string, decision: DecisionType) => {
    if (!confirm(`Finalize decision as ${decision}?`)) return;
    try {
      await committeeApi.finalizeDecision(itemId, { decision });
      if (expandedId) fetchDetail(expandedId);
    } catch (e) { console.error(e); }
  };

  const handleViewMemo = async (applicationId: string) => {
    try {
      const data = await committeeApi.generateMemo(applicationId);
      setViewingMemo({ applicationId, memo: data.memo });
    } catch (e) { console.error(e); }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Delete this meeting?')) return;
    try {
      await committeeApi.deleteMeeting(id);
      if (expandedId === id) setExpandedId(null);
      fetchMeetings();
    } catch (e) { console.error(e); }
  };

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Committee Meetings</h1>
            <p className="text-sm text-text-secondary mt-1">Manage credit committee meetings, agenda items, and decisions</p>
          </div>
          {canWrite && (
            <button onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">add</span> New Meeting
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${statusFilter === '' ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-text-secondary border-border hover:bg-bg-subtle'}`}
            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            All
          </button>
          {MEETING_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${statusFilter === s ? 'ring-2 ring-brand-300' : ''}`}
              style={{
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: (STATUS_COLORS[s]?.bg || '#f3f4f6'),
                color: (STATUS_COLORS[s]?.text || '#6b7280'),
                borderColor: (STATUS_COLORS[s]?.text || '#6b7280') + '40',
              }}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Meetings List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-12 text-text-secondary bg-bg-surface border border-border rounded-xl">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">groups</span>
            <p className="font-semibold">No committee meetings found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => {
              const isExpanded = expandedId === m.id;
              const badge = STATUS_COLORS[m.status] || STATUS_COLORS.SCHEDULED;
              return (
                <div key={m.id} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                  {/* Meeting Row */}
                  <button onClick={() => toggleExpand(m.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <span className="material-symbols-outlined text-lg">groups</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-text-primary text-sm truncate">{m.title}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                          {m.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                          {MEETING_TYPE_LABELS[m.meetingType] || m.meetingType}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {formatDateTime(m.scheduledAt)} {m.location && `· ${m.location}`} · Quorum: {m.quorumMin} · {m._count?.members ?? 0} members · {m._count?.agendaItems ?? 0} items
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-lg text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && meetingDetail && meetingDetail.id === m.id && (
                    <div className="border-t border-border px-5 py-4" onClick={e => e.stopPropagation()}>
                      {/* Quorum Indicator */}
                      {quorumStatus && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm font-bold ${quorumStatus.quorumMet ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          <span className="material-symbols-outlined text-base">{quorumStatus.quorumMet ? 'check_circle' : 'cancel'}</span>
                          Quorum {quorumStatus.quorumMet ? 'Met' : 'Not Met'} ({quorumStatus.presentCount}/{quorumStatus.quorumMin} present)
                        </div>
                      )}

                      {/* Members Table */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Members</h4>
                          {canWrite && (
                            <button onClick={() => setShowAddMember(true)}
                              className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                              <span className="material-symbols-outlined text-sm">person_add</span> Add Member
                            </button>
                          )}
                        </div>
                        {(!meetingDetail.members || meetingDetail.members.length === 0) ? (
                          <p className="text-sm text-text-secondary py-2">No members added yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'var(--color-surface-muted)' }}>
                                  {['Name', 'Role', 'Attendance', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {meetingDetail.members.map(mem => (
                                  <tr key={mem.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                                      {mem.user ? `${mem.user.firstName} ${mem.user.lastName}` : mem.userId.slice(0, 8)}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                                        {mem.role}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 13 }}>
                                      {canWrite ? (
                                        <select value={mem.attendance} onChange={e => handleUpdateAttendance(mem.userId, e.target.value as AttendanceStatus)}
                                          className="text-xs border border-border rounded px-2 py-1"
                                          style={{ fontFamily: 'var(--font-sans)' }}>
                                          {ATTENDANCE_OPTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                                        </select>
                                      ) : (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                          mem.attendance === 'PRESENT' ? 'bg-green-50 text-green-700' :
                                          mem.attendance === 'ABSENT' ? 'bg-red-50 text-red-700' :
                                          mem.attendance === 'LATE' ? 'bg-amber-50 text-amber-700' :
                                          'bg-gray-50 text-gray-700'
                                        }`}>{mem.attendance.replace(/_/g, ' ')}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      {canWrite && (
                                        <button onClick={() => handleRemoveMember(mem.userId)}
                                          className="text-red-500 hover:text-red-700 transition-colors"
                                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                          <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Agenda Items Table */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Agenda Items</h4>
                          {canWrite && (
                            <button onClick={() => setShowAddAgenda(true)}
                              className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                              <span className="material-symbols-outlined text-sm">add_circle</span> Add Agenda Item
                            </button>
                          )}
                        </div>
                        {(!meetingDetail.agendaItems || meetingDetail.agendaItems.length === 0) ? (
                          <p className="text-sm text-text-secondary py-2">No agenda items yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {meetingDetail.agendaItems.map((item, idx) => (
                              <div key={item.id} className="bg-bg-subtle border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-text-secondary bg-bg-surface border border-border rounded px-2 py-0.5">#{idx + 1}</span>
                                    <Link to={`/credit/applications/${item.applicationId}`}
                                      className="text-sm font-semibold text-brand-700 hover:underline"
                                      style={{ textDecoration: 'none' }}>
                                      Application {item.applicationId.slice(0, 8)}...
                                    </Link>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                      {item.decisionType}
                                    </span>
                                    {item.finalDecision && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        item.finalDecision === 'APPROVE' ? 'bg-green-50 text-green-700' :
                                        item.finalDecision === 'REJECT' ? 'bg-red-50 text-red-700' :
                                        'bg-amber-50 text-amber-700'
                                      }`}>
                                        Final: {item.finalDecision}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleViewMemo(item.applicationId)}
                                      className="flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-2 py-1 hover:bg-brand-100 transition-colors"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">description</span> View Memo
                                    </button>
                                    {canWrite && (
                                      <button onClick={() => handleRemoveAgenda(item.id)}
                                        className="text-red-500 hover:text-red-700 transition-colors"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Votes summary */}
                                {item.votes && item.votes.length > 0 && (
                                  <div className="flex gap-2 mb-2 flex-wrap">
                                    {(['APPROVE', 'REJECT', 'ABSTAIN'] as const).map(vt => {
                                      const count = item.votes!.filter(v => v.vote === vt).length;
                                      if (count === 0) return null;
                                      return (
                                        <span key={vt} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          vt === 'APPROVE' ? 'bg-green-50 text-green-700' :
                                          vt === 'REJECT' ? 'bg-red-50 text-red-700' :
                                          'bg-gray-50 text-gray-700'
                                        }`}>
                                          {vt}: {count}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Vote Panel Toggle */}
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setVotePanelItemId(prev => prev === item.id ? null : item.id)}
                                    className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                    <span className="material-symbols-outlined text-sm">how_to_vote</span>
                                    {votePanelItemId === item.id ? 'Hide Vote Panel' : 'Vote'}
                                  </button>
                                  {canWrite && !item.finalDecision && (
                                    <div className="flex gap-1 ml-auto">
                                      {DECISION_TYPES.map(d => (
                                        <button key={d} onClick={() => handleFinalize(item.id, d)}
                                          className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                                            d === 'APPROVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                            d === 'REJECT' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                            d === 'DEFER' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                            'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                          }`}
                                          style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                          Finalize: {d}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Vote Panel */}
                                {votePanelItemId === item.id && (
                                  <div className="mt-3 bg-bg-surface border border-border rounded-lg p-3">
                                    <p className="text-xs font-bold text-text-secondary mb-2">Cast Your Vote</p>
                                    <div className="flex gap-2 mb-2">
                                      {(['APPROVE', 'REJECT', 'ABSTAIN'] as VoteChoice[]).map(vc => (
                                        <button key={vc} onClick={() => setVoteChoice(vc)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                            voteChoice === vc ? 'ring-2 ring-brand-300' : ''
                                          } ${
                                            vc === 'APPROVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                            vc === 'REJECT' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                            'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                          }`}
                                          style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                          {vc}
                                        </button>
                                      ))}
                                    </div>
                                    <textarea value={voteComment} onChange={e => setVoteComment(e.target.value)}
                                      placeholder="Comment (optional)"
                                      rows={2}
                                      className="w-full border border-border rounded-lg px-3 py-2 text-xs resize-none mb-2"
                                      style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                                    <button onClick={() => handleCastVote(item.id)} disabled={!voteChoice || castingVote}
                                      className="px-3 py-1.5 bg-brand-700 text-white rounded-lg text-xs font-bold hover:bg-brand-800 transition-colors disabled:opacity-50"
                                      style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      {castingVote ? 'Submitting...' : 'Submit Vote'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete Meeting */}
                      {canWrite && (
                        <div className="flex justify-end">
                          <button onClick={() => handleDeleteMeeting(m.id)}
                            className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <span className="material-symbols-outlined text-sm">delete</span> Delete Meeting
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Meeting Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCreateDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">New Committee Meeting</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title *</label>
                <input required value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Scheduled At *</label>
                <input required type="datetime-local" value={createForm.scheduledAt} onChange={e => setCreateForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Location</label>
                <input value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Quorum Min *</label>
                  <input required type="number" min="1" value={createForm.quorumMin} onChange={e => setCreateForm(f => ({ ...f, quorumMin: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Meeting Type *</label>
                  <select required value={createForm.meetingType} onChange={e => setCreateForm(f => ({ ...f, meetingType: e.target.value as MeetingType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {MEETING_TYPES.map(t => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={creating}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {creating ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      {showAddMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowAddMember(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Member</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">User ID *</label>
                <input required value={memberForm.userId} onChange={e => setMemberForm(f => ({ ...f, userId: e.target.value }))}
                  placeholder="Enter user ID"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Role *</label>
                <select required value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value as MemberRole }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  {MEMBER_ROLES.map(r => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={addingMember}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Agenda Item Dialog */}
      {showAddAgenda && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowAddAgenda(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Agenda Item</h2>
            <form onSubmit={handleAddAgenda} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Application ID *</label>
                <input required value={agendaForm.applicationId} onChange={e => setAgendaForm(f => ({ ...f, applicationId: e.target.value }))}
                  placeholder="Enter application ID"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Decision Type *</label>
                <select required value={agendaForm.decisionType} onChange={e => setAgendaForm(f => ({ ...f, decisionType: e.target.value as DecisionType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  {DECISION_TYPES.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddAgenda(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={addingAgenda}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {addingAgenda ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Memo Viewer Dialog */}
      {viewingMemo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setViewingMemo(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-text-primary">Credit Memo</h2>
              <button onClick={() => setViewingMemo(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-3">Application: {viewingMemo.applicationId.slice(0, 8)}...</p>
            <div className="text-sm text-text-primary whitespace-pre-wrap bg-bg-subtle border border-border rounded-xl p-4">
              {viewingMemo.memo}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommitteeMeetings;