import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useAuth } from '../../src/context/AuthContext';
import { useIsMobile } from '../../src/hooks/useIsMobile';
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
  APPROVE: 'bg-green-600 text-white',
  REJECT: 'bg-red-600 text-white',
  ABSTAIN: 'bg-gray-400 text-white',
};

const CommitteeMeetingDetail: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const hasRedirected = useRef(false);

  // ── Mobile redirect (one-shot on mount) ────────────────────────────────
  useEffect(() => {
    if (isMobile && meetingId && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate(`/credit/m/committee/${meetingId}`, { replace: true });
    }
  }, [isMobile, meetingId, navigate]);

  const [meeting, setMeeting] = useState<CommitteeMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [quorum, setQuorum] = useState<{ quorumMet: boolean; presentCount: number; quorumMin: number } | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [voteData, setVoteData] = useState<Record<string, { approve: number; reject: number; abstain: number; total: number; votes: CommitteeVote[] }>>({});
  const [castingVote, setCastingVote] = useState<string | null>(null);

  // ── Finalize dialog state ─────────────────────────────────────────────
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [showFinalizeRejectDialog, setShowFinalizeRejectDialog] = useState(false);
  const [finalizeRejectComment, setFinalizeRejectComment] = useState('');
  const [finalizingItemId, setFinalizingItemId] = useState<string | null>(null);

  const loadMeeting = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const data = await committeeApi.getMeeting(meetingId);
      setMeeting(data);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load meeting'));
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  const loadVoteResults = useCallback(async (agendaItemId: string) => {
    try {
      const results = await committeeApi.getVoteResults(agendaItemId);
      setVoteData(prev => ({
        ...prev,
        [agendaItemId]: {
          approve: results.approve,
          reject: results.reject,
          abstain: results.abstain,
          total: results.total,
          votes: results.votes ?? [],
        },
      }));
    } catch {
      // vote results may not exist yet
    }
  }, []);

  useEffect(() => {
    if (!meeting) return;
    const items = meeting.agendaItems ?? [];
    items.forEach(item => {
      if (item.votes && item.votes.length > 0) {
        loadVoteResults(item.id);
      }
    });
  }, [meeting, loadVoteResults]);

  const handleAttendance = async (memberId: string, status: AttendanceStatus) => {
    if (!meetingId) return;
    try {
      const updated = await committeeApi.updateAttendance(meetingId, memberId, { attendance: status });
      toast.success('Attendance updated');
      setMeeting(prev => prev ? { ...prev, members: prev.members?.map(m => m.id === updated.id ? updated : m) ?? [updated] } : prev);
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

  // ── Finalize handler ──────────────────────────────────────────────────
  const handleFinalize = async (agendaItemId: string, decision: DecisionType, comment?: string) => {
    setFinalizeLoading(true);
    setFinalizingItemId(agendaItemId);
    try {
      await committeeApi.finalizeDecision(agendaItemId, { decision, comment: comment ?? undefined });
      toast.success('Decision finalized');
      await loadMeeting();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to finalize'));
    } finally {
      setFinalizeLoading(false);
      setFinalizingItemId(null);
      setShowFinalizeRejectDialog(false);
      setFinalizeRejectComment('');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading meeting…</div>;
  if (!meeting) return <div className="p-8 text-center text-gray-400">Meeting not found</div>;

  const members = meeting.members ?? [];
  const agendaItems = meeting.agendaItems ?? [];

  // ── Fixed isChairOrSecretary check (was TODO) ──────────────────────────
  const isChairOrSecretary = members.some(
    m => (m.role === 'CHAIR' || m.role === 'SECRETARY') && m.userId === user?.id
  );

  // ── Vote completion detection ──────────────────────────────────────────
  const getVotesForItem = (itemId: string) => {
    const item = agendaItems.find(i => i.id === itemId);
    return item?.votes ?? [];
  };

  const presentMembers = members.filter(m => m.attendance === 'PRESENT' || (m as any).present === true);

  const allVotesCast = (itemId: string) => {
    const votes = getVotesForItem(itemId);
    return votes.length >= presentMembers.length && presentMembers.length >= (meeting?.quorumMin ?? 3);
  };

  const tally = (itemId: string) => {
    const votes = getVotesForItem(itemId);
    return {
      approve: votes.filter(v => v.vote === 'APPROVE').length,
      reject: votes.filter(v => v.vote === 'REJECT').length,
      abstain: votes.filter(v => v.vote === 'ABSTAIN').length,
      total: votes.length,
    };
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Finalize Reject Dialog ──────────────────────────────────────── */}
      {showFinalizeRejectDialog && finalizingItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Finalize as Rejected</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this item (minimum 10 characters).
            </p>
            <textarea
              value={finalizeRejectComment}
              onChange={e => setFinalizeRejectComment(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full border rounded-md p-2 text-sm"
              rows={3}
            />
            {finalizeRejectComment.trim().length > 0 && finalizeRejectComment.trim().length < 10 && (
              <p className="text-xs text-amber-500 mt-1">
                {finalizeRejectComment.trim().length}/10 characters minimum
              </p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setShowFinalizeRejectDialog(false); setFinalizeRejectComment(''); }}
                className="px-4 py-2 text-sm text-gray-600 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalize(finalizingItemId, 'REJECT' as DecisionType, finalizeRejectComment)}
                disabled={finalizeRejectComment.trim().length < 10 || finalizeLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finalizeLoading ? 'Finalizing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* Status badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[meeting.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {meeting.status}
          </span>
          {quorum && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${quorum.quorumMet ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              Quorum {quorum.quorumMet ? 'Met' : 'Not Met'} ({quorum.presentCount}/{quorum.quorumMin})
            </span>
          )}
        </div>
      </div>

      {/* ── Members / Attendance ──────────────────────────── */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Members & Attendance</h2>
        <div className="flex flex-wrap gap-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <select
                value={m.attendance ?? 'UNKNOWN'}
                onChange={e => handleAttendance(m.userId, e.target.value as AttendanceStatus)}
                disabled={meeting.status !== 'IN_PROGRESS'}
                className={`px-2 py-0.5 rounded text-xs border ${ATTENDANCE_STYLES[m.attendance ?? ''] ?? 'bg-gray-100 text-gray-500'} ${meeting.status !== 'IN_PROGRESS' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="EXCUSED">Excused</option>
              </select>
              <span className="font-medium">{m.user?.firstName ?? m.user?.email ?? m.userId.slice(0, 8)}</span>
              <span className="text-xs text-gray-400">({m.role})</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agenda Items ───────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Agenda Items</h2>
        {agendaItems.map(item => {
          const results = voteData[item.id];
          const cast = allVotesCast(item.id);
          const t = tally(item.id);
          return (
            <div key={item.id} className="bg-white rounded-lg border p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.applicationId ? `Application ${item.applicationId.slice(0, 8)}` : 'Agenda Item'}
                  </span>
                  {item.decisionResult && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.decisionResult === 'APPROVE' ? 'bg-green-100 text-green-800' :
                      item.decisionResult === 'REJECT' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.decisionResult}
                    </span>
                  )}
                </div>
                <span className="text-gray-400">{expandedItem === item.id ? '▲' : '▼'}</span>
              </div>

              {expandedItem === item.id && (
                <div className="mt-3 space-y-3">
                  {/* Vote buttons for each member */}
                  {meeting.status === 'IN_PROGRESS' && !item.decisionResult && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Cast your vote:</p>
                      <div className="flex gap-2">
                        {(['APPROVE', 'REJECT', 'ABSTAIN'] as VoteChoice[]).map(v => (
                          <button key={v}
                            onClick={() => {
                              const myMember = members.find(m => m.userId === user?.id);
                              if (myMember) handleVote(item.id, myMember.id, v);
                              else toast.error('You are not a member of this meeting');
                            }}
                            disabled={castingVote === item.id}
                            className={`px-3 py-1.5 text-xs font-medium rounded ${VOTE_STYLES[v]} disabled:opacity-50`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vote results */}
                  {results && (
                    <div className="mt-3 p-3 bg-blue-50 rounded space-y-1">
                      <h4 className="text-xs font-semibold text-blue-800">Vote Tally</h4>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-700 font-medium">Approve: {results.approve}</span>
                        <span className="text-red-700 font-medium">Reject: {results.reject}</span>
                        <span className="text-gray-600">Abstain: {results.abstain}</span>
                        <span className="text-gray-400">Total: {results.total}</span>
                      </div>
                    </div>
                  )}

                  {/* ── All votes cast banner ─────────────────────────────── */}
                  {cast && !item.decisionResult && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-blue-600">how_to_vote</span>
                        <span className="font-semibold text-blue-900">
                          ✓ All {t.total} votes cast
                        </span>
                      </div>
                      <div className="text-sm text-blue-800 mb-3">
                        {t.approve} Approve · {t.reject} Reject · {t.abstain} Abstain
                      </div>
                      {isChairOrSecretary ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFinalize(item.id, 'APPROVE')}
                            disabled={finalizeLoading}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50"
                          >
                            Finalize as Approved
                          </button>
                          <button
                            onClick={() => { setFinalizingItemId(item.id); setShowFinalizeRejectDialog(true); }}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                          >
                            Finalize as Rejected
                          </button>
                          <button
                            onClick={() => handleFinalize(item.id, 'DEFER')}
                            disabled={finalizeLoading}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium disabled:opacity-50"
                          >
                            Defer
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-blue-700 italic">
                          Awaiting finalization by Chair/Secretary
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vote progress (when not all cast yet) */}
                  {!cast && !item.decisionResult && (
                    <div className="mt-2 text-xs text-gray-500">
                      {getVotesForItem(item.id).length} / {presentMembers.length} votes cast
                      {meeting ? ` (quorum: ${meeting.quorumMin})` : ''}
                    </div>
                  )}

                  {/* Legacy finalize buttons (hidden when all votes cast — handled by banner above) */}
                  {meeting.status === 'IN_PROGRESS' && !item.decisionResult && isChairOrSecretary && !cast && (
                    <div className="mt-3 flex gap-2">
                      {(['APPROVE', 'REJECT', 'DEFER'] as DecisionType[]).map(d => (
                        <button key={d} onClick={() => handleFinalize(item.id, d)}
                          disabled={finalizeLoading}
                          className={`px-3 py-1.5 text-xs font-medium rounded disabled:opacity-50 ${d === 'APPROVE' ? 'bg-green-600 text-white hover:bg-green-700' : d === 'REJECT' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}>
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
  );
};

export default CommitteeMeetingDetail;