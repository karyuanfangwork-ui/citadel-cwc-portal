import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
}

type TabType = 'all' | 'comments' | 'system' | 'internal';

interface ActivityFeedProps {
  activities: Activity[];
  onSubmitComment: (text: string, isInternal: boolean) => Promise<void>;
  canPostInternal: boolean;
  currentUser?: { firstName: string; lastName: string } | null;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onSubmitComment, canPostInternal, currentUser }) => {
  const toast = useToast();
  const [tab, setTab] = useState<TabType>('all');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

  // Merge server activities with any optimistic entries that haven't been confirmed yet.
  // Optimistic entries use ids starting with "temp-". When the server returns the real
  // activity via the parent's activities prop (after onSubmitComment resolves and the
  // parent appends it), the optimistic entry with the matching temp-id will naturally
  // be superseded because we only show optimistic entries whose id is NOT already in
  // the server-supplied activities list.
  const serverIds = new Set(activities.map(a => a.id));

  const mergedActivities = (() => {
    const optimistic: Activity[] = Array.from(optimisticIds)
      .filter(id => !serverIds.has(id))
      .map(id => ({
        id,
        activityType: 'COMMENT',
        message: '', // placeholder — we store the real data separately below
        authorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'You',
        authorRole: null,
        isSystemGenerated: false,
        isInternal: isInternal,
        createdAt: new Date().toISOString(),
      }));
    // We'll track the message text via a separate map
    return [...optimistic, ...activities];
  })();

  // Store optimistic comment text keyed by temp id
  const [optimisticMessages, setOptimisticMessages] = useState<Record<string, string>>({});

  const commentCount  = activities.filter(a => !a.isSystemGenerated && !a.isInternal).length;
  const internalCount = activities.filter(a => a.isInternal).length;

  const filtered = mergedActivities.filter(a => {
    if (tab === 'comments') return !a.isSystemGenerated && !a.isInternal;
    if (tab === 'system')   return a.isSystemGenerated;
    if (tab === 'internal') return a.isInternal;
    return true;
  });

  // Sort by createdAt descending so optimistic entries (just created) appear at the top
  const sortedFiltered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const commentText = comment;
    const isInternalComment = isInternal;

    // Optimistically add the entry
    setOptimisticIds(prev => new Set(prev).add(tempId));
    setOptimisticMessages(prev => ({ ...prev, [tempId]: commentText }));
    setComment('');
    setIsInternal(false);
    setSubmitting(true);

    try {
      await onSubmitComment(commentText, isInternalComment);
      // On success, the parent will have appended the real activity.
      // Remove our optimistic entry since the server data is now authoritative.
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setOptimisticMessages(prev => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
    } catch {
      // Remove the optimistic entry on failure
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setOptimisticMessages(prev => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      toast.error('Comment failed', 'Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'all',      label: 'All' },
    { id: 'comments', label: 'Comments', count: commentCount },
    { id: 'system',   label: 'Activity Log' },
    { id: 'internal', label: 'Internal', count: internalCount },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-3 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'text-[#0052cc] bg-blue-50 border-b-2 border-[#0052cc]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-white ${
                t.id === 'internal' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity list */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {sortedFiltered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No activity yet</p>
        ) : (
          sortedFiltered.map(a => {
            const isOptimistic = a.id.startsWith('temp-');
            const displayMessage = isOptimistic ? (optimisticMessages[a.id] || '') : a.message;
            return (
            <div key={a.id} className={`flex gap-3 ${isOptimistic ? 'opacity-80 animate-pulse' : ''}`}>
              <div className={`size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${
                a.isSystemGenerated ? 'bg-gray-300 text-gray-600' :
                a.isInternal ? 'bg-amber-500' : 'bg-indigo-500'
              }`}>
                {a.isSystemGenerated ? '⚙' : initials(a.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-400 mb-1">
                  <span className="font-bold text-gray-600">{a.authorName}</span>
                  {a.isInternal && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">INTERNAL</span>}
                  <span className="ml-1.5">{formatTime(a.createdAt)}</span>
                  {isOptimistic && <span className="ml-1.5 text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Sending...</span>}
                </div>
                <p className={`text-sm text-gray-700 leading-relaxed ${
                  a.isInternal ? 'bg-amber-50 border-l-2 border-amber-400 pl-3 py-1 rounded-r italic' : ''
                }`}>
                  {displayMessage}
                </p>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      <div className="p-4 border-t border-gray-100">
        {isInternal && (
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-700">
            <span>🔒</span>
            <span>Internal — not visible to requester</span>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={isInternal ? 'Leave an internal note for the team…' : 'Reply to requester…'}
            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none resize-none transition-colors ${
              isInternal ? 'border-amber-300 focus:border-amber-500 bg-amber-50' : 'border-gray-200 focus:border-[#0052cc]'
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            {canPostInternal ? (
              <button
                type="button"
                onClick={() => setIsInternal(!isInternal)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  isInternal ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <span className={`w-8 h-4 rounded-full relative transition-colors ${isInternal ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isInternal ? 'left-4' : 'left-0.5'}`} />
                </span>
                Internal note
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityFeed;
