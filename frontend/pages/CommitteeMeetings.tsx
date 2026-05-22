import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import creditService from '../src/services/credit.service';
import {
  committeeApi, CommitteeMeeting, CommitteeMember, CommitteeAgendaItem,
  CommitteeVote, MeetingStatus, MeetingType, MemberRole, AttendanceStatus,
  DecisionType, VoteChoice, Pagination,
} from '../src/services/credit.service';
import { adminService } from '../src/services/admin.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import StateBadge from '../src/components/ui/StateBadge';

const formatDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Bug fix: align with backend Prisma enum CommitteeMeetingType
const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  ADHOC: 'Ad-hoc',
};

const MEETING_STATUSES: MeetingStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const MEMBER_ROLES: MemberRole[] = ['CHAIR', 'SECRETARY', 'MEMBER'];
// Bug fix: removed LATE (not in Prisma CommitteeAttendance enum)
const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'EXCUSED'];
// Bug fix: removed ESCALATE (not in Prisma AgendaItemDecisionType enum)
const DECISION_TYPES: DecisionType[] = ['APPROVE', 'REJECT', 'DEFER'];
// Bug fix: align with backend MeetingType REGULAR | ADHOC
const MEETING_TYPES: MeetingType[] = ['REGULAR', 'ADHOC'];

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AppOption {
  id: string;
  applicantName: string;
  status: string;
}

const CommitteeMeetings: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<MeetingType | ''>('');
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
    meetingType: 'REGULAR' as MeetingType,
  });
  const [creating, setCreating] = useState(false);

  // Edit meeting form
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    scheduledAt: '',
    location: '',
    status: '' as MeetingStatus,
    quorumMin: 3,
    meetingType: 'REGULAR' as MeetingType,
  });
  const [updating, setUpdating] = useState(false);

  // Add member form (with user search)
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'MEMBER' as MemberRole });
  const [addingMember, setAddingMember] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // Add agenda item form (with app search)
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ applicationId: '', decisionType: 'APPROVE' as DecisionType });
  const [addingAgenda, setAddingAgenda] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [appResults, setAppResults] = useState<AppOption[]>([]);
  const [appSearchLoading, setAppSearchLoading] = useState(false);

  // Vote panel for a specific agenda item
  const [votePanelItemId, setVotePanelItemId] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<VoteChoice | ''>('');
  const [voteComment, setVoteComment] = useState('');
  const [castingVote, setCastingVote] = useState(false);

  // Vote results detail view
  const [showVoteResults, setShowVoteResults] = useState<{ itemId: string; results: any } | null>(null);

  // Memo viewer
  const [viewingMemo, setViewingMemo] = useState<{ applicationId: string; memo: any } | null>(null);

  const canWrite = hasPermission(user, 'credit:write');
  const canAdmin = hasPermission(user, 'credit:admin');

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.meetingType = typeFilter;
      const data = await committeeApi.listMeetings(params);
      setMeetings(data.meetings);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, currentPage]);

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

  // ── User search ────────────────────────────────────────────

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    try {
      setUserSearchLoading(true);
      const res = await adminService.listUsers({ search: query, limit: 20 });
      const users = (res as any).data?.users ?? (res as any).users ?? res;
      setUserResults(Array.isArray(users) ? users.map((u: any) => ({
        id: u.id, firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email ?? '',
      })) : []);
    } catch { setUserResults([]); }
    finally { setUserSearchLoading(false); }
  }, []);

  useEffect(() => { const t = setTimeout(() => searchUsers(userSearch), 300); return () => clearTimeout(t); }, [userSearch, searchUsers]);

  // ── Application search ──────────────────────────────────────

  const searchApps = useCallback(async (query: string) => {
    if (query.length < 2) { setAppResults([]); return; }
    try {
      setAppSearchLoading(true);
      const res = await creditService.listApplications({ search: query, limit: 10 });
      const apps = (res as any).applications ?? res;
      setAppResults(Array.isArray(apps) ? apps.map((a: any) => ({
        id: a.id,
        applicantName: a.borrowerName ?? a.applicantName ?? `App ${a.id?.slice(0, 8)}`,
        status: a.status ?? '',
      })) : []);
    } catch { setAppResults([]); }
    finally { setAppSearchLoading(false); }
  }, []);

  useEffect(() => { const t = setTimeout(() => searchApps(appSearch), 300); return () => clearTimeout(t); }, [appSearch, searchApps]);

  // ── Handlers ────────────────────────────────────────────────

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
      setCreateForm({ title: '', scheduledAt: '', location: '', quorumMin: 3, meetingType: 'REGULAR' });
      fetchMeetings();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const openEditDialog = () => {
    if (!meetingDetail) return;
    setEditForm({
      title: meetingDetail.title,
      scheduledAt: meetingDetail.scheduledAt ? meetingDetail.scheduledAt.slice(0, 16) : '',
      location: meetingDetail.location ?? '',
      status: meetingDetail.status,
      quorumMin: meetingDetail.quorumMin,
      meetingType: meetingDetail.meetingType,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId) return;
    try {
      setUpdating(true);
      await committeeApi.updateMeeting(expandedId, {
        title: editForm.title,
        scheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : undefined,
        location: editForm.location || undefined,
        status: editForm.status,
        quorumMin: editForm.quorumMin,
        meetingType: editForm.meetingType,
      });
      setShowEditDialog(false);
      fetchDetail(expandedId);
    } catch (e) { console.error(e); }
    finally { setUpdating(false); }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId || !memberForm.userId) return;
    try {
      setAddingMember(true);
      await committeeApi.addMember(expandedId, { userId: memberForm.userId, role: memberForm.role });
      setShowAddMember(false);
      setMemberForm({ userId: '', role: 'MEMBER' });
      setUserSearch('');
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
    if (!expandedId || !agendaForm.applicationId) return;
    try {
      setAddingAgenda(true);
      await committeeApi.addAgendaItem(expandedId, {
        applicationId: agendaForm.applicationId,
        decisionType: agendaForm.decisionType,
      });
      setShowAddAgenda(false);
      setAgendaForm({ applicationId: '', decisionType: 'APPROVE' });
      setAppSearch('');
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
      setViewingMemo({ applicationId, memo: data });
    } catch (e) { console.error(e); }
  };

  const handleViewVoteResults = async (itemId: string) => {
    try {
      const results = await committeeApi.getVoteResults(itemId);
      setShowVoteResults({ itemId, results });
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

  // ── Memo structured renderer ────────────────────────────────
  const renderMemo = (memo: any) => {
    if (typeof memo === 'string') {
      return <pre className="text-sm whitespace-pre-wrap">{memo}</pre>;
    }
    // Structured memo JSON
    return (
      <div className="space-y-4">
        {memo.borrowerSummary && (
          <div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Borrower Summary</h4>
            <div className="bg-bg-subtle border border-border rounded-lg p-3 text-sm">{renderMemoSection(memo.borrowerSummary)}</div>
          </div>
        )}
        {memo.facilityDetails && (
          <div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Facility Details</h4>
            <div className="bg-bg-subtle border border-border rounded-lg p-3 text-sm">{renderMemoSection(memo.facilityDetails)}</div>
          </div>
        )}
        {memo.scoringSummary && (
          <div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Scoring Summary</h4>
            <div className="bg-bg-subtle border border-border rounded-lg p-3 text-sm">{renderMemoSection(memo.scoringSummary)}</div>
          </div>
        )}
        {memo.recommendation && (
          <div>
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Recommendation</h4>
            <div className="bg-bg-subtle border border-border rounded-lg p-3 text-sm font-semibold">{memo.recommendation}</div>
          </div>
        )}
        {!memo.borrowerSummary && !memo.facilityDetails && !memo.scoringSummary && (
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(memo, null, 2)}</pre>
        )}
      </div>
    );
  };

  const renderMemoSection = (section: any) => {
    if (typeof section === 'string') return section;
    if (Array.isArray(section)) return section.map((s: any, i: number) => <div key={i}>{typeof s === 'string' ? s : JSON.stringify(s)}</div>);
    return Object.entries(section).map(([k, v]) => (
      <div key={k} className="flex justify-between py-0.5">
        <span className="text-text-secondary">{k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
        <span className="font-semibold text-text-primary">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
      </div>
    ));
  };

  // ── Render ──────────────────────────────────────────────────

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

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap items-center">
          {/* Status Filter */}
          <div className="flex gap-1">
            <button onClick={() => { setStatusFilter(''); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${statusFilter === '' ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-text-secondary border-border hover:bg-bg-subtle'}`}
              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              All
            </button>
            {MEETING_STATUSES.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${statusFilter === s ? 'ring-2 ring-brand-300' : ''}`}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <StateBadge state={s} size="sm" />
              </button>
            ))}
          </div>
          {/* Type Filter */}
          <div className="h-6 w-px bg-border" />
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as MeetingType | ''); setCurrentPage(1); }}
            className="border border-border rounded-lg px-3 py-1.5 text-sm"
            style={{ fontFamily: 'var(--font-sans)' }}>
            <option value="">All Types</option>
            {MEETING_TYPES.map(t => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
          </select>
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
            {canWrite && <p className="text-sm mt-1">Create a new meeting to get started.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => {
              const isExpanded = expandedId === m.id;
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
                        <StateBadge state={m.status} size="sm" />
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
                      {/* Action buttons */}
                      {canAdmin && (
                        <div className="flex items-center gap-2 mb-3">
                          {/* Status flow buttons */}
                          {m.status === 'SCHEDULED' && (
                            <button onClick={() => { handleUpdate(new Event('submit') as any); }}
                              className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 transition-colors"
                              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                              <span className="material-symbols-outlined text-sm">play_arrow</span> Start Meeting
                            </button>
                          )}
                          {m.status === 'IN_PROGRESS' && (
                            <button onClick={() => { setEditForm(prev => ({ ...prev, status: 'COMPLETED' })); openEditDialog(); }}
                              className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 hover:bg-green-100 transition-colors"
                              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                              <span className="material-symbols-outlined text-sm">check_circle</span> Complete
                            </button>
                          )}
                          <button onClick={openEditDialog}
                            className="flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-2 py-1 hover:bg-brand-100 transition-colors"
                            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <span className="material-symbols-outlined text-sm">edit</span> Edit
                          </button>
                        </div>
                      )}

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
                          {canAdmin && (
                            <button onClick={() => { setShowAddMember(true); setUserSearch(''); setUserResults([]); }}
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
                                          'bg-gray-50 text-gray-700'
                                        }`}>{mem.attendance.replace(/_/g, ' ')}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      {canAdmin && (
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

                      {/* Agenda Items */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Agenda Items</h4>
                          {canAdmin && (
                            <button onClick={() => { setShowAddAgenda(true); setAppSearch(''); setAppResults([]); }}
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
                                    {item.decidedAt && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                                        Decided
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleViewVoteResults(item.id)}
                                      className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-100 transition-colors"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">poll</span> Results
                                    </button>
                                    <button onClick={() => handleViewMemo(item.applicationId)}
                                      className="flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-2 py-1 hover:bg-brand-100 transition-colors"
                                      style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                      <span className="material-symbols-outlined text-sm">description</span> Memo
                                    </button>
                                    {canAdmin && (
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
                                  {canAdmin && !item.decidedAt && (
                                    <div className="flex gap-1 ml-auto">
                                      {DECISION_TYPES.map(d => (
                                        <button key={d} onClick={() => handleFinalize(item.id, d)}
                                          className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                                            d === 'APPROVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :
                                            d === 'REJECT' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                                            'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
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
                      {canAdmin && (
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle disabled:opacity-40 transition-colors"
              style={{ background: 'none', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              Previous
            </button>
            <span className="text-sm text-text-secondary">Page {currentPage} of {pagination.totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={currentPage >= pagination.totalPages}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle disabled:opacity-40 transition-colors"
              style={{ background: 'none', cursor: currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Create Meeting Dialog ──────────────────────────────── */}
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

      {/* ── Edit Meeting Dialog ───────────────────────────────── */}
      {showEditDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowEditDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Edit Meeting</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title *</label>
                <input required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Scheduled At *</label>
                <input required type="datetime-local" value={editForm.scheduledAt} onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Location</label>
                <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Status *</label>
                  <select required value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as MeetingStatus }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {MEETING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Quorum *</label>
                  <input required type="number" min="1" value={editForm.quorumMin} onChange={e => setEditForm(f => ({ ...f, quorumMin: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Type *</label>
                  <select required value={editForm.meetingType} onChange={e => setEditForm(f => ({ ...f, meetingType: e.target.value as MeetingType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {MEETING_TYPES.map(t => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={updating}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Member Dialog (with user search) ──────────────── */}
      {showAddMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowAddMember(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Member</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Search User *</label>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Type to search users..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                {memberForm.userId && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    <span className="material-symbols-outlined text-sm align-middle">check_circle</span> User selected
                  </p>
                )}
                {userSearch.length >= 2 && !memberForm.userId && (
                  <div className="mt-1 border border-border rounded-lg max-h-40 overflow-y-auto bg-white">
                    {userSearchLoading ? (
                      <p className="p-2 text-xs text-text-secondary">Searching...</p>
                    ) : userResults.length === 0 ? (
                      <p className="p-2 text-xs text-text-secondary">No users found.</p>
                    ) : (
                      userResults.map(u => (
                        <button key={u.id} type="button" onClick={() => setMemberForm(f => ({ ...f, userId: u.id }))}
                          className="w-full text-left px-3 py-2 hover:bg-bg-subtle transition-colors border-b border-border last:border-b-0"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                          <p className="text-sm font-semibold">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-text-secondary">{u.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
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
                <button type="submit" disabled={!memberForm.userId || addingMember}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Agenda Item Dialog (with app search) ──────────── */}
      {showAddAgenda && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowAddAgenda(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Agenda Item</h2>
            <form onSubmit={handleAddAgenda} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Search Application *</label>
                <input value={appSearch} onChange={e => setAppSearch(e.target.value)}
                  placeholder="Search by applicant name or ID..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                {agendaForm.applicationId && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    <span className="material-symbols-outlined text-sm align-middle">check_circle</span> Application selected
                  </p>
                )}
                {appSearch.length >= 2 && !agendaForm.applicationId && (
                  <div className="mt-1 border border-border rounded-lg max-h-40 overflow-y-auto bg-white">
                    {appSearchLoading ? (
                      <p className="p-2 text-xs text-text-secondary">Searching...</p>
                    ) : appResults.length === 0 ? (
                      <p className="p-2 text-xs text-text-secondary">No applications found.</p>
                    ) : (
                      appResults.map(a => (
                        <button key={a.id} type="button" onClick={() => setAgendaForm(f => ({ ...f, applicationId: a.id }))}
                          className="w-full text-left px-3 py-2 hover:bg-bg-subtle transition-colors border-b border-border last:border-b-0"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                          <p className="text-sm font-semibold">{a.applicantName}</p>
                          <p className="text-xs text-text-secondary">{a.status} · {a.id.slice(0, 8)}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
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
                <button type="submit" disabled={!agendaForm.applicationId || addingAgenda}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {addingAgenda ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Vote Results Dialog ──────────────────────────────── */}
      {showVoteResults && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowVoteResults(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-text-primary">Vote Results</h2>
              <button onClick={() => setShowVoteResults(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3">
              {(['APPROVE', 'REJECT', 'ABSTAIN'] as const).map(vt => {
                const count = showVoteResults.results[vt.toLowerCase()] || 0;
                const total = showVoteResults.results.total || 1;
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
                return (
                  <div key={vt} className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      vt === 'APPROVE' ? 'bg-green-50 text-green-700' :
                      vt === 'REJECT' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>{vt}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className={`h-3 rounded-full ${
                        vt === 'APPROVE' ? 'bg-green-500' :
                        vt === 'REJECT' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
              <p className="text-xs text-text-secondary mt-2">Total votes: {showVoteResults.results.total}</p>
            </div>
            {showVoteResults.results.votes && showVoteResults.results.votes.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Individual Votes</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {showVoteResults.results.votes.map((v: CommitteeVote) => (
                    <div key={v.id} className="flex items-center justify-between text-xs py-1">
                      <span className="font-semibold">{v.member?.user ? `${(v.member as any).user.firstName} ${(v.member as any).user.lastName}` : v.memberId.slice(0, 8)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                        v.vote === 'APPROVE' ? 'bg-green-50 text-green-700' :
                        v.vote === 'REJECT' ? 'bg-red-50 text-red-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>{v.vote}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Memo Viewer Dialog ────────────────────────────────── */}
      {viewingMemo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setViewingMemo(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-text-primary">Credit Memo</h2>
              <button onClick={() => setViewingMemo(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-3">Application: {viewingMemo.applicationId.slice(0, 8)}...</p>
            <div className="text-sm text-text-primary">
              {renderMemo(viewingMemo.memo)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommitteeMeetings;