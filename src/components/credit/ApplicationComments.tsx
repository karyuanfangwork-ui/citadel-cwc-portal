/**
 * P2-4: Application Comments — threaded comment thread per application.
 *
 * Features:
 * - Threaded comments (top-level + replies)
 * - Internal (staff-only) / External (borrower-visible) toggle
 * - Edit own comments inline
 * - Soft-delete (author or admin)
 * - SSE real-time updates via NotificationContext
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { commentApi, ApplicationComment } from '../../services/credit.service';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApplicationCommentsProps {
  applicationId: string;
  className?: string;
}

// ── Comment Item ─────────────────────────────────────────────────────────────

const CommentItem: React.FC<{
  comment: ApplicationComment;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (id: string, content: string, isInternal: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReply: (parentId: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  depth?: number;
}> = ({ comment, currentUserId, isAdmin, onEdit, onDelete, onReply, editingId, setEditingId, depth = 0 }) => {
  const [editContent, setEditContent] = useState(comment.content);
  const [editInternal, setEditInternal] = useState(comment.isInternal);
  const [saving, setSaving] = useState(false);

  const isOwn = comment.authorId === currentUserId;
  const isEditing = editingId === comment.id;

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editContent.trim(), editInternal);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className={`flex items-start gap-3 py-3 ${comment.isDeleted ? 'opacity-50' : ''}`}>
        {/* Avatar */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          {comment.author?.firstName?.[0] || '?'}{comment.author?.lastName?.[0] || ''}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">
              {comment.author?.firstName} {comment.author?.lastName}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
            {comment.isInternal ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                Internal
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                External
              </span>
            )}
            {comment.updatedAt !== comment.createdAt && (
              <span className="text-[10px] text-gray-400 italic">(edited)</span>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editInternal}
                    onChange={e => setEditInternal(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Staff-only (internal)
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  disabled={saving || !editContent.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap break-words">
              {comment.isDeleted ? '[deleted]' : comment.content}
            </div>
          )}

          {/* Actions */}
          {!comment.isDeleted && !isEditing && (
            <div className="flex items-center gap-3 mt-1">
              {depth === 0 && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  Reply
                </button>
              )}
              {isOwn && (
                <button
                  onClick={() => setEditingId(comment.id)}
                  className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  Edit
                </button>
              )}
              {(isOwn || isAdmin) && (
                <button
                  onClick={async () => {
                    if (confirm('Delete this comment?')) await onDelete(comment.id);
                  }}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies
            .filter(r => !r.isDeleted || r.replies?.length)
            .map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                editingId={editingId}
                setEditingId={setEditingId}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const ApplicationComments: React.FC<ApplicationCommentsProps> = ({ applicationId, className }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const listEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const result = await commentApi.list(applicationId, page, 50);
      setComments(result.comments);
      setTotal(result.total);
    } catch (e) {
      console.error('Failed to load comments', e);
    } finally {
      setLoading(false);
    }
  }, [applicationId, page]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Scroll to bottom when new comment is added
  useEffect(() => {
    if (comments.length > 0 && !loading) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, loading]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const comment = await commentApi.create(applicationId, {
        content: newContent.trim(),
        isInternal,
      });
      setComments(prev => [comment, ...prev]);
      setTotal(prev => prev + 1);
      setNewContent('');
      toast.success('Comment added');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to add comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !replyToId) return;
    setSubmitting(true);
    try {
      const reply = await commentApi.create(applicationId, {
        content: replyContent.trim(),
        parentId: replyToId,
        isInternal,
      });
      // Insert reply into the parent comment's replies array
      setComments(prev => prev.map(c => {
        if (c.id === replyToId) {
          return { ...c, replies: [...(c.replies || []), reply] };
        }
        return c;
      }));
      setReplyContent('');
      setReplyToId(null);
      toast.success('Reply added');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to add reply'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: string, content: string, isInternal: boolean) => {
    const updated = await commentApi.update(id, { content, isInternal });
    setComments(prev => prev.map(c => {
      if (c.id === id) return updated;
      // Check replies
      if (c.replies?.some(r => r.id === id)) {
        return { ...c, replies: c.replies.map(r => r.id === id ? updated : r) };
      }
      return c;
    }));
    toast.success('Comment updated');
  };

  const handleDelete = async (id: string) => {
    await commentApi.delete(id);
    setComments(prev => prev.map(c => {
      if (c.id === id) return { ...c, isDeleted: true, content: '[deleted]' };
      if (c.replies?.some(r => r.id === id)) {
        return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, isDeleted: true, content: '[deleted]' } : r) };
      }
      return c;
    }));
    toast.success('Comment deleted');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'create' | 'reply') => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (action === 'create') handleCreate();
      else handleReply();
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="material-icons text-blue-600">comment</span>
          Comments
          {total > 0 && (
            <span className="text-sm font-normal text-gray-500">({total})</span>
          )}
        </h3>
      </div>

      {/* New comment form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          onKeyDown={e => handleKeyDown(e, 'create')}
          placeholder="Add a comment… (Ctrl+Enter to send)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="material-icons text-base text-amber-500">lock</span>
            Staff-only (internal)
          </label>
          <button
            onClick={handleCreate}
            disabled={submitting || !newContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span className="material-icons text-base">send</span>
            {submitting ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </div>

      {/* Reply form (appears inline when replying) */}
      {replyToId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              Replying to comment…
            </span>
            <button
              onClick={() => { setReplyToId(null); setReplyContent(''); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          <textarea
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            onKeyDown={e => handleKeyDown(e, 'reply')}
            placeholder="Write a reply… (Ctrl+Enter to send)"
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Comments thread */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <span className="material-icons animate-spin mr-2">refresh</span>
          Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <span className="material-icons text-4xl mb-2 block">chat_bubble_outline</span>
          <p className="text-sm">No comments yet. Start the conversation.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id || ''}
              isAdmin={user?.role === 'ADMIN'}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={(parentId) => { setReplyToId(parentId); }}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ))}
          <div ref={listEndRef} />
        </div>
      )}

      {/* Pagination for long threads */}
      {total > 50 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplicationComments;