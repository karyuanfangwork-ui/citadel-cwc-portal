/**
 * ApplicationNotesWidget — Right panel widget showing quick notes / comments.
 *
 * Collapsible section with header 'QUICK NOTES'. Shows last 3 notes with
 * relative timestamps, an add-note input, and a 'View all' link.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface Note {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface ApplicationNotesWidgetProps {
  notes: Note[];
  onAddNote: (text: string) => void;
  onViewAll: () => void;
}

/** Compute a simple relative-time string from an ISO date string. */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const ApplicationNotesWidget: React.FC<ApplicationNotesWidgetProps> = ({
  notes,
  onAddNote,
  onViewAll,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea rows (1–3) based on content
  const adjustTextareaRows = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const maxRows = 3;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaRows();
  }, [inputValue, adjustTextareaRows]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setInputValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, onAddNote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Show the last 3 notes (most recent first)
  const visibleNotes = notes.slice(-3).reverse();

  return (
    <section
      style={{
        padding: 16,
        /* No border-bottom — last widget in panel */
      }}
    >
      {/* ── Collapsible Header ── */}
      <div
        onClick={() => setCollapsed(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cr-font-display)',
            fontSize: 11,
            textTransform: 'uppercase',
            color: 'var(--cr-outline)',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
          }}
        >
          QUICK NOTES
        </span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={{ marginTop: 12 }}>
          {/* Notes list */}
          {visibleNotes.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--cr-font-body)',
                fontSize: 12,
                color: 'var(--cr-on-surface-variant)',
                margin: 0,
                opacity: 0.6,
                fontStyle: 'italic',
              }}
            >
              No notes yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleNotes.map(note => (
                <div key={note.id}>
                  {/* First line: author (bold) + relative time (muted) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--cr-font-body)',
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: 'var(--cr-on-surface)',
                      }}
                    >
                      {note.author}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--cr-font-body)',
                        fontSize: 11,
                        color: 'var(--cr-on-surface-variant)',
                        opacity: 0.7,
                      }}
                    >
                      {relativeTime(note.createdAt)}
                    </span>
                  </div>
                  {/* Second line: note text, max 2 lines with ellipsis */}
                  <p
                    style={{
                      fontFamily: 'var(--cr-font-body)',
                      fontSize: 12,
                      color: 'var(--cr-on-surface-variant)',
                      margin: 0,
                      marginTop: 2,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Add-note input row ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 6,
              marginTop: 12,
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
              rows={1}
              style={{
                flex: 1,
                fontFamily: 'var(--cr-font-body)',
                fontSize: 12,
                color: 'var(--cr-on-surface)',
                background: 'var(--cr-surface-container-high)',
                border: '1px solid var(--cr-outline-variant)',
                borderRadius: 8,
                padding: '6px 10px',
                resize: 'none',
                overflow: 'auto',
                lineHeight: '20px',
                minHeight: '32px',
                maxHeight: '60px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: inputValue.trim()
                  ? 'var(--cr-primary)'
                  : 'var(--cr-surface-container-high)',
                color: inputValue.trim()
                  ? 'var(--cr-on-primary)'
                  : 'var(--cr-outline)',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s, color 0.15s',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_upward
              </span>
            </button>
          </div>

          {/* ── View all link ── */}
          <div
            onClick={onViewAll}
            style={{
              marginTop: 10,
              fontSize: 11,
              color: 'var(--cr-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--cr-font-body)',
              userSelect: 'none',
            }}
          >
            View all
          </div>
        </div>
      )}
    </section>
  );
};

export default ApplicationNotesWidget;