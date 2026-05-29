import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { committeeApi, CommitteeMeeting, CommitteeAgendaItem, VoteChoice } from '../../src/services/credit.service';
import { useAuth } from '../../src/context/AuthContext';
import toast from 'react-hot-toast';

/**
 * CommitteeMobileVote — Mobile-optimized committee voting view (§3.2).
 *
 * Route: /credit/m/committee/:meetingId
 * Optimized for ≤768px screens with:
 *  - Sticky top bar with meeting title and deal counter
 *  - Collapsible approval pack preview
 *  - Large vote buttons (≥44px touch targets)
 *  - Mandatory comment on REJECT
 *  - Progress dots at bottom
 *  - Next/previous navigation
 */
type VoteState = 'idle' | 'voting' | 'submitted';

const CommitteeMobileVote: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<CommitteeMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voteChoice, setVoteChoice] = useState<VoteChoice | null>(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [voteState, setVoteState] = useState<VoteState>('idle');
  const [memoExpanded, setMemoExpanded] = useState(false);

  const agendaItems = meeting?.agendaItems ?? [];
  const currentItem = agendaItems[currentIndex] as CommitteeAgendaItem | undefined;
  const totalItems = agendaItems.length;

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const m = await committeeApi.getMeeting(meetingId);
      setMeeting(m);
    } catch (e) {
      console.error('Failed to load meeting', e);
      toast.error('Failed to load committee meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  // Reset vote state when navigating between items
  useEffect(() => {
    setVoteChoice(null);
    setComment('');
    setShowComment(false);
    setVoteState('idle');
  }, [currentIndex]);

  const handleVote = async () => {
    if (!currentItem || !user) return;
    if (voteChoice === 'REJECT' && !comment.trim()) {
      toast.error('Comment is required when rejecting');
      return;
    }
    setVoteState('voting');
    try {
      // Find the current user's member record
      const myMember = meeting?.members?.find(m => m.userId === user.id);
      if (!myMember) {
        toast.error('You are not a member of this committee');
        setVoteState('idle');
        return;
      }
      await committeeApi.castVote(currentItem.id, {
        memberId: myMember.id,
        vote: voteChoice!,
        comment: comment.trim() || undefined,
      });
      toast.success('Vote recorded');
      setVoteState('submitted');
      // Auto-advance after short delay
      setTimeout(() => {
        if (currentIndex < totalItems - 1) {
          setCurrentIndex(i => i + 1);
        }
      }, 800);
    } catch (e) {
      console.error('Failed to cast vote', e);
      toast.error('Failed to record vote');
      setVoteState('idle');
    }
  };

  const handleNext = () => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  // Touch swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 60) handleNext();      // swipe left → next
    else if (diff < -60) handlePrev(); // swipe right → previous
    setTouchStart(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">Meeting not found</p>
          <button onClick={() => navigate('/credit/committee')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
            Back to Committee
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="main"
      aria-label={`Committee voting — ${meeting.title}`}
    >
      {/* ── Sticky Top Bar ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/credit/committee')}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
            aria-label="Back to committee meetings"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0 text-center px-2">
            <h1 className="text-sm font-bold text-gray-900 truncate">{meeting.title}</h1>
            <p className="text-xs text-gray-500">
              {currentItem ? `${currentIndex + 1} / ${totalItems}` : 'No items'}
            </p>
          </div>
          <button
            onClick={() => setMemoExpanded(!memoExpanded)}
            className="p-2 -mr-2 text-gray-600 hover:text-gray-900"
            aria-label={memoExpanded ? 'Hide approval pack' : 'Show approval pack'}
            aria-expanded={memoExpanded}
          >
            <span className="material-symbols-outlined">{memoExpanded ? 'description' : 'description'}</span>
          </button>
        </div>
      </header>

      {/* ── Collapsible Approval Pack ──────────────────────────── */}
      {memoExpanded && currentItem && (
        <div className="bg-white border-b border-gray-200 max-h-[40vh] overflow-y-auto">
          <iframe
            src={`/api/v1/credit/applications/${currentItem.applicationId}/approval-pack`}
            className="w-full border-0"
            style={{ height: '35vh' }}
            title="Approval Pack Preview"
          />
          <div className="px-4 py-2 border-t border-gray-100">
            <a
              href={`/credit/applications/${currentItem.applicationId}`}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Open full application detail →
            </a>
          </div>
        </div>
      )}

      {/* ── Current Agenda Item Card ───────────────────────────── */}
      <main className="flex-1 px-4 py-4 overflow-y-auto">
        {!currentItem ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-gray-300 block mb-3">check_circle</span>
            <p className="text-lg font-bold text-gray-700">All items reviewed</p>
            <p className="text-sm text-gray-500 mt-1">Return to the committee dashboard</p>
            <button
              onClick={() => navigate('/credit/committee')}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold"
            >
              Done — Back to Committee
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Application header */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {currentItem.application?.borrowerProfile?.account?.name ?? currentItem.applicationId.slice(0, 8)}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Decision type: <span className="font-semibold">{currentItem.decisionType}</span>
                  </p>
                </div>
                {currentItem.decisionResult && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    currentItem.decisionResult === 'APPROVE' ? 'bg-green-50 text-green-700' :
                    currentItem.decisionResult === 'REJECT' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {currentItem.decisionResult}
                  </span>
                )}
              </div>
            </div>

            {/* Existing votes summary */}
            {currentItem.votes && currentItem.votes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Votes so far</h3>
                <div className="flex gap-4 text-center">
                  {(['APPROVE', 'REJECT', 'ABSTAIN'] as VoteChoice[]).map(vc => {
                    const count = currentItem.votes!.filter(v => v.vote === vc).length;
                    return (
                      <div key={vc} className="flex-1">
                        <div className={`text-lg font-bold ${
                          vc === 'APPROVE' ? 'text-green-600' :
                          vc === 'REJECT' ? 'text-red-600' :
                          'text-amber-600'
                        }`}>{count}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{vc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Vote Actions ────────────────────────────────── */}
            {voteState === 'submitted' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                <p className="text-sm font-bold text-green-800 mt-1">Vote recorded</p>
              </div>
            ) : (
              <>
                {/* Vote buttons */}
                <div className="space-y-3" role="radiogroup" aria-label="Cast your vote">
                  {([
                    { choice: 'APPROVE' as VoteChoice, label: 'Approve', color: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white', icon: 'check_circle' },
                    { choice: 'REJECT' as VoteChoice, label: 'Reject', color: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white', icon: 'cancel' },
                    { choice: 'ABSTAIN' as VoteChoice, label: 'Abstain', color: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white', icon: 'remove_circle' },
                  ]).map(({ choice, label, color, icon }) => (
                    <button
                      key={choice}
                      onClick={() => { setVoteChoice(choice); if (choice === 'REJECT') setShowComment(true); }}
                      role="radio"
                      aria-checked={voteChoice === choice}
                      className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold transition-all min-h-[44px] ${
                        voteChoice === choice ? 'ring-4 ring-offset-2 ring-blue-400 ' + color : color
                      }`}
                      disabled={voteState === 'voting'}
                    >
                      <span className="material-symbols-outlined text-xl">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Comment (mandatory for REJECT, collapsible for others) */}
                {voteChoice && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    {voteChoice !== 'REJECT' && !showComment && (
                      <button
                        onClick={() => setShowComment(true)}
                        className="text-xs text-blue-600 font-semibold mb-2"
                      >
                        + Add comment (optional)
                      </button>
                    )}
                    {(voteChoice === 'REJECT' || showComment) && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1" htmlFor="vote-comment">
                          {voteChoice === 'REJECT' ? 'Reason for rejection *' : 'Comment (optional)'}
                        </label>
                        <textarea
                          id="vote-comment"
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                          placeholder={voteChoice === 'REJECT' ? 'Required: explain why you reject this deal...' : 'Optional comments...'}
                          required={voteChoice === 'REJECT'}
                        />
                      </div>
                    )}
                    <button
                      onClick={handleVote}
                      disabled={voteState === 'voting' || (voteChoice === 'REJECT' && !comment.trim())}
                      className="mt-3 w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                    >
                      {voteState === 'voting' ? 'Submitting...' : `Submit — ${voteChoice.charAt(0) + voteChoice.slice(1).toLowerCase()}`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Progress Bar ───────────────────────────────── │ */}
      {totalItems > 0 && (
        <footer className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
              aria-label="Previous agenda item"
            >
              <span className="material-symbols-outlined text-xl">chevron_left</span>
              Prev
            </button>
            <div className="flex gap-1.5" role="group" aria-label={`Progress: item ${currentIndex + 1} of ${totalItems}`}>
              {agendaItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-blue-600 scale-125' : 'bg-gray-300'
                  }`}
                  aria-label={`Go to item ${i + 1}`}
                  aria-current={i === currentIndex ? 'step' : undefined}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              disabled={currentIndex >= totalItems - 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
              aria-label="Next agenda item"
            >
              Next
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default CommitteeMobileVote;