import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface InlineEditProps {
  value: string | number | null;
  onSave: (newValue: string) => Promise<void>;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
  display?: string;
  className?: string;
  editable?: boolean;
  placeholder?: string;
  format?: (v: string | number | null) => string;
}

const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  onSave,
  type = 'text',
  options = [],
  display,
  className = '',
  editable = true,
  placeholder = '—',
  format,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Display text
  const displayText = display ?? (value != null ? (format ? format(value) : String(value)) : placeholder);

  const startEdit = useCallback(() => {
    if (!editable) return;
    setEditValue(value != null ? String(value) : '');
    setEditing(true);
    setError(false);
  }, [editable, value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ((type === 'text' || type === 'number') && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing, type]);

  const save = async () => {
    const newVal = type === 'number' ? editValue : editValue;
    // Don't save if unchanged
    if (newVal === (value != null ? String(value) : '')) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      setError(false);
      await onSave(newVal);
      setEditing(false);
    } catch {
      setError(true);
      // Revert after a brief flash
      setTimeout(() => setError(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setEditing(false);
    setError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Tab') {
      // Save on tab (natural flow to next field)
      save();
    }
  };

  // Read-only mode
  if (!editable) {
    return (
      <span className={`text-sm text-text-primary ${className}`}>
        {displayText}
      </span>
    );
  }

  // Editing mode
  if (editing) {
    const inputClass = `flex-1 min-w-0 px-2 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-brand-200 outline-none ${
      error ? 'border-danger' : 'border-brand-200'
    }`;
    const inputStyle: React.CSSProperties = {
      fontFamily: 'var(--font-sans)',
      background: 'var(--bg-surface)',
    };

    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {type === 'select' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            disabled={saving}
            className={`${inputClass} pr-6`}
            style={inputStyle}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            disabled={saving}
            className={inputClass}
            style={inputStyle}
            placeholder={placeholder}
          />
        )}
        {saving && (
          <span className="material-symbols-outlined text-sm text-brand-600 animate-spin">progress_activity</span>
        )}
        {error && (
          <span className="material-symbols-outlined text-sm text-danger" title="Save failed — click to retry">error</span>
        )}
      </span>
    );
  }

  // Display mode (click to edit)
  return (
    <span
      className={`inline-flex items-center gap-0.5 cursor-pointer group ${className}`}
      onClick={startEdit}
      title="Click to edit"
    >
      <span className={`text-sm ${value == null ? 'text-text-secondary' : 'text-text-primary'} group-hover:text-brand-700 transition-colors`}>
        {displayText}
      </span>
      <span className="material-symbols-outlined text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">edit</span>
    </span>
  );
};

export default InlineEdit;