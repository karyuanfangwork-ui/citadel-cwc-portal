import React, { useRef, useState, useCallback } from 'react';

// Reusable autosave text/textarea field — used across CA Memo tabs.
// Tracks dirty state, calls onSave on blur (debounced 800ms), shows save status.

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
    'w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-text-secondary';
  const stateBorder = error
    ? 'border-red-400 focus:ring-red-500'
    : 'border-gray-200 focus:ring-brand-600';
  const inputClass = `${baseInput} ${stateBorder} ${className}`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs font-semibold text-text-secondary mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
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
        <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-red-600">
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