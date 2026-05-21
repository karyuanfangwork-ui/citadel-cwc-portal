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
};

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
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);

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
    'w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-gray-50 disabled:text-text-secondary';
  const inputClass = `${baseInput} ${className}`;

  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-[${minRows * 28}px] resize-y`}
          disabled={disabled}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={minRows}
        />
      ) : (
        <input
          type={type}
          className={inputClass}
          disabled={disabled}
          placeholder={placeholder}
          value={type === 'date' ? (value ? value.slice(0, 10) : '') : (value ?? '')}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      )}
    </div>
  );
};

export default AutosaveTextField;