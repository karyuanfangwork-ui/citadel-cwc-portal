import React from 'react';

/**
 * §3.8 — Progress Overlay for long-running credit operations.
 *
 * Displays a full-screen translucent overlay with an indeterminate spinner
 * and a human-readable message. Designed for operations that take >1s:
 * scorecard runs, bureau checks, CA memo generation, report exports.
 *
 * Usage:
 *   <ProgressOverlay message="Calculating risk score…" />
 *   <ProgressOverlay message="Generating approval pack…" progress={65} />
 *
 * Determinate mode: pass `progress` (0-100) for known-percentage ops (PDF gen).
 * Indeterminate mode: omit `progress` for unknown-duration ops (score run).
 */

interface ProgressOverlayProps {
  /** Human-readable label for what's happening, e.g. "Calculating risk score…" */
  message: string;
  /** Optional sub-message with more detail, e.g. "This may take up to 30 seconds" */
  subMessage?: string;
  /** 0-100 for determinate progress. Omit for indeterminate spinner. */
  progress?: number;
  /** Optional cancel handler — shows a Cancel button */
  onCancel?: () => void;
}

const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  message,
  subMessage,
  progress,
  onCancel,
}) => {
  const isDeterminate = typeof progress === 'number';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      role="alert"
      aria-live="assertive"
      aria-label={message}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center"
        style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}
      >
        {/* Spinner */}
        <div className="flex justify-center mb-5">
          {isDeterminate ? (
            /* Determinate: circular progress ring */
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                {/* Track */}
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="var(--border, #e5e7eb)"
                  strokeWidth="6"
                />
                {/* Progress arc */}
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="var(--brand-700, #1d4ed8)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - (progress ?? 0) / 100)}`}
                  className="transition-all duration-300 ease-out"
                />
              </svg>
              {/* Percentage text */}
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text-primary">
                {Math.round(progress ?? 0)}%
              </span>
            </div>
          ) : (
            /* Indeterminate: spinning ring */
            <div
              className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-brand-700"
              style={{
                borderTopColor: 'var(--brand-700, #1d4ed8)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>

        {/* Message */}
        <p className="text-base font-semibold text-text-primary mb-1">{message}</p>
        {subMessage && (
          <p className="text-sm text-text-secondary">{subMessage}</p>
        )}

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}
          >
            Cancel
          </button>
        )}
      </div>

      { /* Keyframe for spin */ }
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProgressOverlay;