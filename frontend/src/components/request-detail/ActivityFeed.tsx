import React, { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { requestService } from '../../services/request.service';
import apiClient from '../../services/api';
import type { Attachment, Activity } from '../request/useRequestDetail';

type TabType = 'all' | 'comments' | 'system' | 'internal';

interface ActivityFeedProps {
  requestId: string;
  activities: Activity[];
  onSubmitComment: (text: string, isInternal: boolean) => Promise<any>;
  onActivityChange?: () => Promise<void>;
  canPostInternal: boolean;
  currentUser?: { firstName: string; lastName: string } | null;
  currentUserId?: string;
}

const MAX_FILES = 5;
const ACCEPTED_TYPES = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';

function formatFileSize(bytes: number | string): string {
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(size) || size < 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType === 'application/zip' || mimeType.includes('compressed')) return '🗜️';
  return '📄';
}

function isImageMimeType(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith('image/');
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  requestId,
  activities,
  onSubmitComment,
  onActivityChange,
  canPostInternal,
  currentUser,
  currentUserId,
}) => {
  const toast = useToast();
  const [tab, setTab] = useState<TabType>('all');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

  // Attachment state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store optimistic comment text keyed by temp id
  const [optimisticMessages, setOptimisticMessages] = useState<Record<string, string>>({});

  const serverIds = new Set(activities.map(a => a.id));

  const mergedActivities = (() => {
    const optimistic: Activity[] = Array.from(optimisticIds)
      .filter(id => !serverIds.has(id))
      .map(id => ({
        id,
        activityType: 'COMMENT',
        message: '',
        authorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'You',
        authorRole: null,
        isSystemGenerated: false,
        isInternal: isInternal,
        createdAt: new Date().toISOString(),
      }));
    return [...optimistic, ...activities];
  })();

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

  const addPendingFile = (file: File) => {
    setPendingFiles(prev => {
      if (prev.length >= MAX_FILES) return prev;
      return [...prev, file];
    });
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_FILES - pendingFiles.length;
    files.slice(0, remaining).forEach(f => addPendingFile(f));
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) addPendingFile(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const remaining = MAX_FILES - pendingFiles.length;
    files.slice(0, remaining).forEach(f => addPendingFile(f));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && pendingFiles.length === 0) return;

    const tempId = `temp-${Date.now()}`;
    const commentText = comment;
    const isInternalComment = isInternal;
    const filesToUpload = [...pendingFiles];

    // Optimistically add the entry
    setOptimisticIds(prev => new Set(prev).add(tempId));
    setOptimisticMessages(prev => ({ ...prev, [tempId]: commentText }));
    setComment('');
    setIsInternal(false);
    setPendingFiles([]);
    setSubmitting(true);

    try {
      // Upload all pending files in parallel
      if (filesToUpload.length > 0) {
        setUploadingFiles(true);
        const uploadPromises = filesToUpload.map(file =>
          requestService.uploadAttachment(requestId, file).catch(err => {
            console.error('Failed to upload file:', file.name, err);
            toast.error('Upload Failed', `Failed to upload ${file.name}`);
            return null;
          })
        );
        await Promise.all(uploadPromises);
        setUploadingFiles(false);
      }

      // Submit the comment — backend auto-links pending attachments
      await onSubmitComment(commentText, isInternalComment);

      // Remove optimistic entry since the server data is now authoritative
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

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await requestService.deleteAttachment(requestId, attachmentId);
      toast.success('Attachment Removed', 'The attachment has been removed.');
      // Refresh activities from server to reflect the deletion
      if (onActivityChange) {
        await onActivityChange();
      }
    } catch {
      toast.error('Delete Failed', 'Failed to remove attachment.');
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
                {/* Attachment grid */}
                {a.attachments && a.attachments.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {a.attachments.map(att => (
                      <AttachmentCard
                        key={att.id}
                        attachment={att}
                        requestId={requestId}
                        canDelete={currentUserId && a.authorName === `${currentUser?.firstName} ${currentUser?.lastName}`}
                        onDelete={handleDeleteAttachment}
                      />
                    ))}
                  </div>
                )}
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
          <div
            className={`relative rounded-lg border-2 border-dashed transition-colors ${
              dragOver ? 'border-[#0052cc] bg-blue-50' : 'border-transparent'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onPaste={handlePaste}
              rows={3}
              placeholder={isInternal ? 'Leave an internal note for the team…' : 'Reply to requester…'}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none resize-none transition-colors ${
                isInternal ? 'border-amber-300 focus:border-amber-500 bg-amber-50' : 'border-gray-200 focus:border-[#0052cc]'
              }`}
            />
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg pointer-events-none">
                <p className="text-sm font-bold text-[#0052cc]">Drop files here…</p>
              </div>
            )}
          </div>

          {/* Pending files preview */}
          {pendingFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="relative group flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-8 h-8 object-cover rounded"
                    />
                  ) : (
                    <span className="text-base">{getFileIcon(file.type)}</span>
                  )}
                  <span className="max-w-[100px] truncate text-gray-700 font-medium">{file.name}</span>
                  <span className="text-gray-400">({formatFileSize(file.size)})</span>
                  <button
                    type="button"
                    onClick={() => removePendingFile(idx)}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pendingFiles.length >= MAX_FILES || submitting}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                title={`Attach file (${pendingFiles.length}/${MAX_FILES})`}
              >
                <span className="text-sm">📎</span>
                Attach
              </button>
              <button
                type="submit"
                disabled={(!comment.trim() && pendingFiles.length === 0) || submitting || uploadingFiles}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting || uploadingFiles ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Attachment Card Component ── */

interface AttachmentCardProps {
  attachment: Attachment;
  requestId: string;
  canDelete?: boolean;
  onDelete: (attachmentId: string) => void;
}

function AttachmentCard({ attachment, requestId, canDelete, onDelete }: AttachmentCardProps) {
  const isImage = isImageMimeType(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(isImage); // only fetch blob for images

  // Build the direct API URL for inline preview (uses same-origin auth cookies)
  const apiBase = (apiClient.defaults as any).baseURL || '/api/v1';
  const inlineUrl = `${apiBase}/requests/${requestId}/attachments/${attachment.id}?inline=true`;
  const downloadUrl = `${apiBase}/requests/${requestId}/attachments/${attachment.id}`;

  // Fetch image via axios (with auth cookies) and create a blob URL for <img src>
  const blobUrlRef = useRef<string | null>(null);
  React.useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await requestService.downloadAttachment(requestId, attachment.id);
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
        }
      } catch {
        // Failed to load image preview — show fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [requestId, attachment.id, isImage]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    // PDFs and images: open in new tab for preview via ?inline=true
    if (isPdf || isImage) {
      window.open(inlineUrl, '_blank');
      return;
    }
    // Other files: force download
    try {
      const blob = await requestService.downloadAttachment(requestId, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open the API URL directly
      window.open(downloadUrl, '_blank');
    }
  };

  if (isImage) {
    return (
      <div
        className="block relative group rounded-lg overflow-hidden border border-gray-200 hover:border-[#0052cc] transition-colors cursor-pointer"
        onClick={handleDownload}
      >
        {loading ? (
          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-xs animate-pulse">Loading…</span>
          </div>
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={attachment.fileName}
            className="w-full h-24 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-lg">🖼️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold transition-opacity">🔍</span>
        </div>
        <div className="px-2 py-1 text-[10px] text-gray-500 truncate">{attachment.fileName}</div>
        {canDelete && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(attachment.id); }}
            className="absolute top-1 right-1 size-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            title="Remove attachment"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 group hover:border-[#0052cc] transition-colors">
      <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>
      <div className="flex-1 min-w-0">
        <button
          onClick={handleDownload}
          className="text-xs font-bold text-gray-700 hover:text-[#0052cc] truncate block text-left"
          title={isPdf ? 'Click to preview' : 'Click to download'}
        >
          {attachment.fileName}
        </button>
        <span className="text-[10px] text-gray-400">
          {formatFileSize(attachment.fileSize)}
          {isPdf && ' · Click to preview'}
        </span>
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(attachment.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove attachment"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default ActivityFeed;