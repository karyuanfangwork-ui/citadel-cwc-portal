import React, { useRef, useState, useCallback } from 'react';

/**
 * Reusable autosave text/textarea field.
 * Tracks dirty state, calls onSave on blur (debounced 800ms), shows save status.
 * Moved from credit/ to ui/ as a shared primitive.
 */

type AutosaveTextFieldProps = {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onSave: () => void;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
  minRows?: number;
  className?: string;
  type?: 'text' | 'date';
  /** Optional inline error to render with ARIA wiring. */
  error?: string | null;
  /** Optional help text rendered below the input. */
  helpText?: string;
  /** §3.5c — Autosave status indicator. Pass through from useAutosave (saving/savedAt/error). */
  saveStatus?: { saving?: boolean; savedAt?: Date | string | null; error?: string | null };
  /** Retry handler shown alongside the "Save failed" indicator. */
  onRetry?: () => void;
};

// §3.5c — fades out 2s after a successful save
const SavedIndicator: React.FC<{ savedAt: Date | string }> = ({ savedAt }) => {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-green-600 transition-opacity duration-300">
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span> Saved
    </span>
  );
};

const AutosaveStatusChip: React.FC<{ status: NonNullable<AutosaveTextFieldProps['saveStatus']>; onRetry?: () => void }> = ({ status, onRetry }) => {
  if (status.saving) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> Saving…
      </span>
    );
  }
  if (status.error) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span> Save failed
        {onRetry && (
          <button type="button" onClick={onRetry} className="underline hover:no-underline" style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
            retry
          </button>
        )}
      </span>
    );
  }
  if (status.savedAt) {
    return <SavedIndicator savedAt={status.savedAt} />;
  }
  return null;
};

let fieldIdSeq = 0;
const nextFieldId = () => `autosave-field-${++fieldIdSeq}`;

const AutosaveTextField: React.FC<AutosaveTextFieldProps> = ({
  label,
  value,
  onChange,
  onSave,
  disabled = false,
  multiline = false,
  placeholder,
  required = false,
  minRows = 3,
  className = '',
  type = 'text',
  error,
  helpText,
  saveStatus,
  onRetry,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const fieldIdRef = useRef<string>(nextFieldId());
  const fieldId = fieldIdRef.current;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
  const describedBy = [error ? errorId : null, helpText ? helpId : null].filter(Boolean).join(' ') || undefined;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value || null);
      setDirty(true);
      // Debounced save — 800ms
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSave();
        setDirty(false);
      }, 800);
    },
    [onChange, onSave],
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirty) {
      onSave();
      setDirty(false);
    }
  }, [dirty, onSave]);

  const baseInput =
    'w-full rounded-cwc-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-text-secondary';
  const stateBorder = error
    ? 'border-danger focus:ring-danger/30'
    : 'border-cwc-border focus:ring-brand-500/20';
  const inputClass = `${baseInput} ${stateBorder} ${className}`;

  return (
    <div>
      <label htmlFor={fieldId} className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-1">
        <span>
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </span>
        {saveStatus && <AutosaveStatusChip status={saveStatus} onRetry={onRetry} />}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          className={`${inputClass} min-h-[${minRows * 28}px] resize-y`}
          disabled={disabled}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={minRows}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          className={inputClass}
          disabled={disabled}
          placeholder={placeholder}
          value={type === 'date' ? (value ? value.slice(0, 10) : '') : (value ?? '')}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p id={helpId} className="mt-1 text-xs text-text-secondary">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default AutosaveTextField;
export type { AutosaveTextFieldProps };