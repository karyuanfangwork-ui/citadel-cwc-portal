import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { stageBadgeColor } from './crmConstants';

interface StageOption {
  id: string;
  name: string;
  probability: number;
  displayOrder?: number;
  color?: string;
  isWonStage?: boolean;
  isLostStage?: boolean;
}

interface StageDropdownProps {
  currentStage: { id: string; name: string; displayOrder?: number; color?: string; isLostStage?: boolean };
  stages: StageOption[];
  onChange: (stageId: string, lostReason?: string) => void;
  compact?: boolean;
}

const StageDropdown: React.FC<StageDropdownProps> = ({ currentStage, stages, onChange, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pendingLostStage, setPendingLostStage] = useState<StageOption | null>(null);
  const [lostReason, setLostReason] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const badgeColor = stageBadgeColor(currentStage);
  const label = currentStage.name.replace(/_/g, ' ');

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen(prev => !prev);
  }, []);

  const handleSelect = useCallback((stage: StageOption) => {
    // If the target stage is a LOST stage, intercept and ask for lostReason
    const isLost = stage.isLostStage || /lost/i.test(stage.name) || stage.probability === 0;
    if (isLost) {
      setPendingLostStage(stage);
      setLostReason('');
      // Keep dropdown open so the inline form renders
      return;
    }
    setOpen(false);
    if (stage.id !== currentStage.id) {
      onChange(stage.id);
    }
  }, [currentStage.id, onChange]);

  const confirmLost = useCallback(() => {
    if (!pendingLostStage) return;
    setOpen(false);
    onChange(pendingLostStage.id, lostReason || undefined);
    setPendingLostStage(null);
    setLostReason('');
  }, [pendingLostStage, lostReason, onChange]);

  const cancelLost = useCallback(() => {
    setPendingLostStage(null);
    setLostReason('');
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingLostStage(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setPendingLostStage(null); }
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
        top: Math.min(rect.bottom + 4, window.innerHeight - 300),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
        zIndex: 9999,
        minWidth: 200,
        maxWidth: 320,
      }}
      className="bg-white rounded-lg shadow-xl border border-border overflow-hidden"
    >
      {!pendingLostStage ? (
        // Stage list
        <div className="max-h-64 overflow-y-auto">
          {stages.map(stage => {
            const color = stageBadgeColor(stage);
            const isCurrent = stage.id === currentStage.id;
            return (
              <button
                key={stage.id}
                onClick={() => handleSelect(stage)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-gray-50 transition-colors"
                style={{ border: 'none', background: isCurrent ? 'var(--color-surface-muted)' : undefined, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="flex-1" style={{ color: isCurrent ? color : 'var(--color-text-primary)' }}>
                  {stage.name.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-text-tertiary">{stage.probability}%</span>
                {isCurrent && (
                  <span className="material-symbols-outlined text-base ml-1" style={{ color }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // Lost reason form
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-base text-danger">warning</span>
            <span className="text-sm font-bold text-text-primary">Mark as Lost</span>
          </div>
          <p className="text-xs text-text-secondary mb-2">
            Please provide a reason for moving to <strong>{pendingLostStage.name.replace(/_/g, ' ')}</strong>.
          </p>
          <textarea
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            placeholder="Lost reason (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={confirmLost}
              className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Confirm Lost
            </button>
            <button
              onClick={cancelLost}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              style={{ background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', borderRadius: 8, fontFamily: 'var(--font-sans)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
        style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}40`, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        title={`Stage: ${label} — click to change`}
        aria-label={`Stage: ${label}`}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: badgeColor }}
        />
        {label}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {dropdown}
    </>
  );
};

export default StageDropdown;