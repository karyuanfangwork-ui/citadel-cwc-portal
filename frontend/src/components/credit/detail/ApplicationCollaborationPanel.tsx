/**
 * ApplicationCollaborationPanel — Right sidebar compact comment preview.
 *
 * Shows latest 3 comments with @mention support and an "Add a note" input.
 * Clicking any comment or submitting opens the full Comments tab.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';

interface CommentPreview {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  timeAgo: string;
}

interface ApplicationCollaborationPanelProps {
  comments: CommentPreview[];
  applicationId: string;
  onOpenFullThread: () => void;
  onAddNote: (text: string) => void;
}

const ApplicationCollaborationPanel: React.FC<ApplicationCollaborationPanelProps> = ({
  comments,
  applicationId,
  onOpenFullThread,
  onAddNote,
}) => {
  const [noteText, setNoteText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noteText.trim()) {
      onAddNote(noteText.trim());
      setNoteText('');
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-center justify-between">
        <h3
          className="font-bold uppercase tracking-wider"
          style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
        >
          Collaboration
        </h3>
        <button
          onClick={onOpenFullThread}
          className="font-bold"
          style={{
            fontSize: 12,
            color: 'var(--cr-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--cr-font-display)',
          }}
        >
          View All →
        </button>
      </div>

      {/* Comment previews */}
      <div className="flex flex-col gap-2.5">
        {comments.slice(0, 3).map((comment) => (
          <div
            key={comment.id}
            className="flex gap-2.5 cursor-pointer p-2 rounded transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-high)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={onOpenFullThread}
          >
            {/* Avatar */}
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold"
              style={{
                backgroundColor: 'var(--cr-secondary-container)',
                color: 'var(--cr-on-secondary-container)',
                fontSize: 11,
                fontFamily: 'var(--cr-font-display)',
              }}
            >
              {comment.author.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-bold truncate"
                  style={{ fontSize: 12, color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}
                >
                  {comment.author}
                </span>
                <span style={{ fontSize: 10, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
                  {comment.timeAgo}
                </span>
              </div>
              <p
                className="line-clamp-2"
                style={{ fontSize: 12, color: 'var(--cr-on-surface-variant)', fontFamily: 'var(--cr-font-body)' }}
              >
                {comment.content}
              </p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}>
            No comments yet.
          </p>
        )}
      </div>

      {/* Add note input */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            backgroundColor: 'var(--cr-surface-container-high)',
            border: '1px solid var(--cr-outline-variant)',
            borderRadius: 'var(--cr-radius)',
          }}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--cr-outline)' }}>
            chat_bubble
          </span>
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note… use @ to mention"
            className="flex-1 bg-transparent border-none outline-none"
            style={{
              fontSize: 12,
              color: 'var(--cr-on-surface)',
              fontFamily: 'var(--cr-font-body)',
            }}
          />
          {noteText.trim() && (
            <button
              type="submit"
              className="shrink-0"
              style={{
                background: 'var(--cr-secondary)',
                color: 'var(--cr-on-secondary)',
                border: 'none',
                borderRadius: 'var(--cr-radius)',
                padding: '2px 8px',
                fontSize: 11,
                fontFamily: 'var(--cr-font-display)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ApplicationCollaborationPanel;