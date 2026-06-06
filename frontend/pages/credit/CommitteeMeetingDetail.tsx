import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  committeeApi,
  CommitteeMeeting,
  CommitteeMember,
  CommitteeAgendaItem,
  CommitteeVote,
  MeetingStatus,
  AttendanceStatus,
  VoteChoice,
  DecisionType,
  MemberRole,
  CreditApplication,
} from '../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../src/utils/errorMessages';

// ── Status / type label maps ──────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const ATTENDANCE_STYLES: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  EXCUSED: 'bg-yellow-100 text-yellow-800',
};

const VOTE_STYLES: Record<string, string> = {
  APPROVE: 'bg-green-100 text-green-800',
  REJECT: 'bg-red-100 text-red-800',
  ABSTAIN: 'bg-gray-100 text-gray-600',
};

const ROLE_BADGE: Record<string, string> = {
  CHAIR: 'bg-purple-100 text-purple-800',
  SECRETARY: 'bg-blue-100 text-blue-800',
  MEMBER: 'bg-gray-100 text-gray-700',
};

// ── Component ─────────────────────────────────────────────────────────────
const CommitteeMeetingDetail: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<CommitteeMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [quorum, setQuorum] = useState<{ quorumMet: boolean; presentCount: number; quorumMin: number } | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [voteData, setVoteData] = useState<Record<string, { approve: number; reject: number; abstain: number; total: number; votes: CommitteeVote[] }>>({});
  const [castingVote, setCastingVote] = useState<string | null>(null);

  const loadMeeting = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const data = await committeeApi.getMeeting(meetingId);
      setMeeting(data);
      // Auto-load quorum for active meetings
      if (data.status === 'IN_PROGRESS' || data.status === 'SCHEDULED') {
        const q = await committeeApi.checkQuorum(meetingId);
        setQuorum(q);
      }
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load meeting'));
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  const loadVoteResults = async (itemId: string) => {
    try {
      const results = await committeeApi.getVoteResults(itemId);
      setVoteData(prev => ({ ...prev, [itemId]: results }));
    } catch { /* already loaded or meeting not active */ }
  };

  const toggleItem = async (itemId: string) => {
    if (expandedItem === itemId) { setExpandedItem(null); return; }
    setExpandedItem(itemId);
    await loadVoteResults(itemId);
  };

  const handleStatusChange = async (status: MeetingStatus) => {
    if (!meetingId || !meeting) return;
    try {
      await committeeApi.updateMeeting(meetingId, { status } as any);
      toast.success(`Meeting ${status.toLowerCase()}`);
      loadMeeting();
    } catch (e) {
      toast.error(friendlyMessage(e, `Failed to update status`));
    }
  };

  const handleAttendance = async (memberId: string, attendance: AttendanceStatus) => {
    if (!meetingId) return;
    try {
      await committeeApi.updateAttendance(meetingId, memberId, { attendance });
      toast.success('Attendance updated');
      loadMeeting();
      // Refresh quorum
      const q = await committeeApi.checkQuorum(meetingId);
      setQuorum(q);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to update attendance'));
    }
  };

  const handleVote = async (agendaItemId: string, memberId: string, vote: VoteChoice, comment?: string) => {
    setCastingVote(agendaItemId);
    try {
      await committeeApi.castVote(agendaItemId, { memberId, vote, comment });
      toast.success('Vote recorded');
      loadVoteResults(agendaItemId);
      loadMeeting();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to cast vote'));
    } finally {
      setCastingVote(null);
    }
  };

  const handleFinalize = async (agendaItemId: string, decision: DecisionType) => {
    try {
      await committeeApi.finalizeDecision(agendaItemId, { decision });
      toast.success(`Item ${decision.toLowerCase()}`);
      loadMeeting();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to finalize'));
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading meeting…</div>;
  if (!meeting) return <div className="p-8 text-center text-gray-400">Meeting not found</div>;

  const members = meeting.members ?? [];
  const agendaItems = meeting.agendaItems ?? [];
  const isChairOrSecretary = members.some(m =>
    (m.role === 'CHAIR' || m.role === 'SECRETARY') /* TODO: && m.userId === currentUser.id */
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/credit/committee')} className="text-sm text-blue-600 hover:underline mb-2">
            ← Back to Meetings
          </button>
          <h1 className="text-xl font-bold text-gray-900">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{meeting.meetingType}</span>
            <span>·</span>
            <span>{new Date(meeting.scheduledAt).toLocaleString()}</span>
            {meeting.location && <><span>·</span><span>{meeting.location}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[meeting.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {meeting.status}
          </span>
          {meeting.status === 'SCHEDULED' && (
            <button onClick={() => handleStatusChange('IN_PROGRESS')} className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded hover:bg-yellow-600">
              Start Meeting
            </button>
          )}
          {meeting.status === 'IN_PROGRESS' && quorum && (
            <button onClick={() => handleStatusChange('COMPLETED')} disabled={!quorum.quorumMet} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" title={!quorum?.quorumMet ? 'Quorum not met' : ''}>
              Complete Meeting
            </button>
          )}
          {meeting.status === 'SCHEDULED' && (
            <button onClick={() => handleStatusChange('CANCELLED')} className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Quorum Indicator ────────────────────────────── */}
      {quorum && (meeting.status === 'IN_PROGRESS' || meeting.status === 'SCHEDULED') && (
        <div className={`p-3 rounded-lg border ${quorum.quorumMet ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${quorum.quorumMet ? 'text-green-600' : 'text-red-600'}`}>
              {quorum.quorumMet ? 'check_circle' : 'error'}
            </span>
            <span className={`text-sm font-medium ${quorum.quorumMet ? 'text-green-800' : 'text-red-800'}`}>
              Quorum: {quorum.presentCount} / {quorum.quorumMin} required
              {!quorum.quorumMet && ' — Not met'}
            </span>
          </div>
        </div>
      )}

      {/* ── Members & Attendance ──────────────────────────── */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Members & Attendance</h2>
        {members.length === 0 && <p className="text-xs text-gray-400 italic">No members assigned.</p>}
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-600'}`}>{m.role}</span>
                <span className="text-sm font-medium">{m.user?.firstName} {m.user?.lastName}</span>
              </div>
              {meeting.status === 'IN_PROGRESS' ? (
                <div className="flex gap-1">
                  {(['PRESENT', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map(opt => (
                    <button key={opt} onClick={() => handleAttendance(m.userId, opt)}
                      className={`px-2 py-0.5 text-xs rounded ${m.attendance === opt ? ATTENDANCE_STYLES[opt] + ' ring-2 ring-offset-1' : 'bg-white border text-gray-500 hover:bg-gray-100'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`px-2 py-0.5 rounded text-xs ${ATTENDANCE_STYLES[m.attendance] ?? 'bg-gray-100 text-gray-500'}`}>{m.attendance}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Agenda Items ────────────────────────────────── */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Agenda</h2>
        {agendaItems.length === 0 && <p className="text-xs text-gray-400 italic">No agenda items.</p>}
        <div className="space-y-2">
          {agendaItems.sort((a, b) => a.displayOrder - b.displayOrder).map(item => {
            const app = item.application;
            const isExpanded = expandedItem === item.id;
            const results = voteData[item.id];
            return (
              <div key={item.id} className="border rounded-lg">
                <button onClick={() => toggleItem(item.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {app ? `${(app as any).applicationNo ?? 'N/A'} — ${app.borrowerProfile?.name ?? 'Borrower'}` : item.applicationId}
                    </span>
                    {item.decisionResult && (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.decisionResult === 'APPROVE' ? 'bg-green-100 text-green-800' : item.decisionResult === 'REJECT' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {item.decisionResult}
                      </span>
                    )}
                  </div>
                  <span className={`material-symbols-outlined text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t">
                    {/* Application details */}
                    {app && (
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
                        <div><strong>Application:</strong> {(app as any).applicationNo ?? '—'}</div>
                        <div><strong>Borrower:</strong> {app.borrowerProfile?.name ?? '—'}</div>
                      </div>
                    )}

                    {/* Voting panel */}
                    {meeting.status === 'IN_PROGRESS' && !item.decisionResult && (
                      <div className="mt-3 p-3 bg-gray-50 rounded space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700">Cast Vote</h4>
                        {members.filter(m => m.attendance === 'PRESENT').map(m => (
                          <div key={m.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-36">{m.user?.firstName} {m.user?.lastName}</span>
                            <div className="flex gap-1">
                              {(['APPROVE', 'REJECT', 'ABSTAIN'] as VoteChoice[]).map(v => (
                                <button key={v} disabled={castingVote === item.id}
                                  onClick={() => handleVote(item.id, m.id, v)}
                                  className={`px-2 py-0.5 text-xs rounded ${VOTE_STYLES[v]} hover:opacity-80 disabled:opacity-50`}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vote results */}
                    {results && (
                      <div className="mt-3 p-3 bg-blue-50 rounded space-y-1">
                        <h4 className="text-xs font-semibold text-blue-800">Vote Tally ({isChairOrSecretary ? 'visible' : 'hidden until concluded'})</h4>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-700 font-medium">Approve: {results.approve}</span>
                          <span className="text-red-700 font-medium">Reject: {results.reject}</span>
                          <span className="text-gray-600">Abstain: {results.abstain}</span>
                          <span className="text-gray-400">Total: {results.total}</span>
                        </div>
                      </div>
                    )}

                    {/* Finalize */}
                    {meeting.status === 'IN_PROGRESS' && !item.decisionResult && isChairOrSecretary && (
                      <div className="mt-3 flex gap-2">
                        {(['APPROVE', 'REJECT', 'DEFER'] as DecisionType[]).map(d => (
                          <button key={d} onClick={() => handleFinalize(item.id, d)}
                            className={`px-3 py-1.5 text-xs font-medium rounded ${d === 'APPROVE' ? 'bg-green-600 text-white hover:bg-green-700' : d === 'REJECT' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommitteeMeetingDetail;