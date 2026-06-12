import React, { useState, useEffect, useCallback } from 'react';
import { commentApi, ApplicationComment, CommentListResult } from '../../services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

interface ApplicationCommentsProps {
  applicationId: string;
}

const ApplicationComments: React.FC<ApplicationCommentsProps> = ({ applicationId }) => {
  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showInternal, setShowInternal] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const result: CommentListResult = await commentApi.list(applicationId, page);
      setComments(result.comments);
      setTotalPages(result.totalPages);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load comments'));
    } finally {
      setLoading(false);
    }
  }, [applicationId, page]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSubmit = async () => {
    const content = newComment.trim();
    if (!content) return;
    try {
      setSubmitting(true);
      await commentApi.create(applicationId, {
        content,
        parentId: replyTo ?? undefined,
        isInternal,
      });
      setNewComment('');
      setReplyTo(null);
      toast.success(replyTo ? 'Reply posted' : 'Comment posted');
      await fetchComments();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to post comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await commentApi.update(commentId, { content: editContent.trim() });
      setEditingId(null);
      setEditContent('');
      toast.success('Comment updated');
      await fetchComments();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to update comment'));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentApi.delete(commentId);
      toast.success('Comment deleted');
      await fetchComments();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to delete comment'));
    }
  };

  const startEdit = (c: ApplicationComment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
  };

  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  const visibleComments = showInternal
    ? topLevelComments
    : topLevelComments.filter(c => !c.isInternal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
          Comments ({comments.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInternal(!showInternal)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${showInternal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {showInternal ? 'Showing All' : 'External Only'}
          </button>
        </div>
      </div>

      {/* New comment form */}
      <div className="bg-bg-surface border border-border rounded-xl p-4">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 text-xs text-text-secondary">
            <span className="material-symbols-outlined text-sm">reply</span>
            Replying to thread
            <button onClick={() => setReplyTo(null)} className="text-red-500 hover:text-red-700">Cancel</button>
          </div>
        )}
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="material-symbols-outlined text-sm">lock</span>
            Internal only
          </label>
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">send</span>
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="text-center py-8 text-sm text-text-secondary">Loading comments...</div>
      ) : visibleComments.length === 0 ? (
        <div className="text-center py-8 text-sm text-text-secondary">
          {showInternal ? 'No comments yet. Be the first!' : 'No external comments.'}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleComments.map(comment => (
            <div key={comment.id} className="bg-white border border-border rounded-xl p-4">
              {/* Comment header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                    {comment.author?.firstName?.[0]}{comment.author?.lastName?.[0]}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-text-primary">
                      {comment.author?.firstName} {comment.author?.lastName}
                    </span>
                    <span className="text-xs text-text-secondary ml-2">{formatTime(comment.createdAt)}</span>
                  </div>
                  {comment.isInternal && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                      Internal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReplyTo(comment.id)}
                    className="p-1 text-text-secondary hover:text-brand-600 rounded"
                    title="Reply"
                  >
                    <span className="material-symbols-outlined text-base">reply</span>
                  </button>
                  <button
                    onClick={() => startEdit(comment)}
                    className="p-1 text-text-secondary hover:text-brand-600 rounded"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-text-secondary hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* Comment body */}
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setEditingId(null); setEditContent(''); }}
                      className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleEdit(comment.id)}
                      className="px-3 py-1 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-primary whitespace-pre-wrap">{comment.content}</p>
              )}

              {/* Replies */}
              {getReplies(comment.id).length > 0 && (
                <div className="mt-3 ml-6 space-y-3 border-l-2 border-brand-100 pl-3">
                  {getReplies(comment.id).map(reply => (
                    <div key={reply.id} className="bg-bg-surface rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px] font-bold">
                          {reply.author?.firstName?.[0]}{reply.author?.lastName?.[0]}
                        </div>
                        <span className="text-xs font-semibold text-text-primary">
                          {reply.author?.firstName} {reply.author?.lastName}
                        </span>
                        <span className="text-[10px] text-text-secondary">{formatTime(reply.createdAt)}</span>
                        {reply.isInternal && (
                          <span className="px-1 py-0.5 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                            Internal
                          </span>
                        )}
                      </div>
                      {editingId === reply.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={2}
                            className="w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:ring-2 focus:ring-brand-200 resize-y"
                          />
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditingId(null); setEditContent(''); }} className="px-2 py-0.5 text-[10px] border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleEdit(reply.id)} className="px-2 py-0.5 text-[10px] bg-brand-600 text-white rounded hover:bg-brand-700">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-primary whitespace-pre-wrap">{reply.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-text-secondary py-1">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplicationComments;