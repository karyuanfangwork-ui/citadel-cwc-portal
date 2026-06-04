import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { STATUS_STYLES, ALL_STATUSES } from './crmConstants';
import type { LeadStatus } from '../../services/crm.service';

interface StatusDropdownProps {
  currentStatus: LeadStatus;
  onChange: (newStatus: LeadStatus) => void;
  compact?: boolean;
}

const StatusDropdown: React.FC<StatusDropdownProps> = ({ currentStatus, onChange, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const style = STATUS_STYLES[currentStatus] || STATUS_STYLES.NEW;
  const label = currentStatus.replace(/_/g, ' ');

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen(prev => !prev);
  }, []);

  const handleSelect = useCallback((status: LeadStatus) => {
    setOpen(false);
    if (status !== currentStatus) {
      onChange(status);
    }
  }, [currentStatus, onChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Reposition dropdown on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        setRect(triggerRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const dropdown = open && rect ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
        minWidth: 160,
      }}
      className="bg-white rounded-lg shadow-xl border border-border overflow-hidden"
    >
      {ALL_STATUSES.map(status => {
        const st = STATUS_STYLES[status];
        return (
          <button
            key={status}
            onClick={() => handleSelect(status as LeadStatus)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-gray-50 transition-colors ${
              status === currentStatus ? 'bg-gray-50' : ''
            }`}
            style={{ border: 'none', background: status === currentStatus ? 'var(--color-surface-muted)' : undefined, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: st.text }}>{st.icon}</span>
            <span style={{ color: status === currentStatus ? st.text : 'var(--color-text-primary)' }}>
              {status.replace(/_/g, ' ')}
            </span>
            {status === currentStatus && (
              <span className="material-symbols-outlined text-base ml-auto" style={{ color: st.text }}>check</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-full font-bold transition-all hover:shadow-sm ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}
        style={{ background: style.bg, color: style.text, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        title={`Status: ${label} — click to change`}
        aria-label={`Status: ${label}`}
      >
        <span className="material-symbols-outlined text-sm">{style.icon}</span>
        {label}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {dropdown}
    </>
  );
};

export default StatusDropdown;