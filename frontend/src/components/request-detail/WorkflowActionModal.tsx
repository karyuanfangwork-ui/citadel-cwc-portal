// frontend/src/components/request-detail/WorkflowActionModal.tsx
// Generic config-driven workflow action modal.
// Driven entirely by WorkflowModalConfig — no per-action hard-coding needed.

import React, { useState, useCallback } from 'react';
import ModalWrapper from '../ModalWrapper';
import { WorkflowModalConfig, WorkflowModalField } from '../../utils/workflowModalConfig';

interface WorkflowActionModalProps {
  open: boolean;
  requestId: string;
  config: WorkflowModalConfig;
  onSuccess: () => void;
  onClose: () => void;
}

/* ---- Submit button colour mapping ---- */
const SUBMIT_BUTTON_CLASSES: Record<string, string> = {
  primary:
    'bg-[#0052cc] text-white hover:bg-blue-700 focus-visible:ring-[#0052cc]',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600',
  success:
    'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600',
};

/* ---- Field renderer ---- */
const renderField = (
  field: WorkflowModalField,
  value: string,
  onChange: (val: string) => void,
) => {
  const sharedInputClass =
    'w-full px-3 py-2.5 text-sm border border-cwc-border rounded-cwc-md bg-white text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-[#0052cc]/30 focus:border-[#0052cc] transition-colors';

  const labelEl = (
    <label
      htmlFor={field.name}
      className="block text-xs font-bold text-text-secondary uppercase tracking-wide mb-1.5"
    >
      {field.label}
      {field.required ? (
        <span className="text-red-500 ml-0.5">*</span>
      ) : (
        <span className="font-normal normal-case text-text-tertiary ml-1">(optional)</span>
      )}
    </label>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <div key={field.name}>
          {labelEl}
          <textarea
            id={field.name}
            name={field.name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={field.rows ?? 3}
            placeholder={field.placeholder}
            required={field.required}
            className={`${sharedInputClass} resize-none`}
          />
        </div>
      );

    case 'select':
      return (
        <div key={field.name}>
          {labelEl}
          <select
            id={field.name}
            name={field.name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className={sharedInputClass}
          >
            <option value="">Select…</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'date':
      return (
        <div key={field.name}>
          {labelEl}
          <input
            id={field.name}
            name={field.name}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className={sharedInputClass}
          />
        </div>
      );

    case 'number':
      return (
        <div key={field.name}>
          {labelEl}
          <input
            id={field.name}
            name={field.name}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            min="0"
            step="0.01"
            className={sharedInputClass}
          />
        </div>
      );

    case 'text':
    default:
      return (
        <div key={field.name}>
          {labelEl}
          <input
            id={field.name}
            name={field.name}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className={sharedInputClass}
          />
        </div>
      );
  }
};

/* ---- Main component ---- */
const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  open,
  requestId,
  config,
  onSuccess,
  onClose,
}) => {
  // Build initial form state from field defaults
  const buildInitialState = (): Record<string, string> => {
    const state: Record<string, string> = {};
    for (const field of config.fields) {
      state[field.name] = field.defaultValue ?? '';
    }
    return state;
  };

  const [formData, setFormData] = useState<Record<string, string>>(buildInitialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side required validation
    for (const field of config.fields) {
      if (field.required && !formData[field.name]?.trim()) {
        setError(`${field.label} is required`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      // Convert number fields from string to actual number for the API
      const values: Record<string, unknown> = {};
      for (const field of config.fields) {
        const raw = formData[field.name];
        if (field.type === 'number' && raw !== '') {
          values[field.name] = parseFloat(raw);
        } else {
          values[field.name] = raw;
        }
      }

      await config.onSubmit(requestId, values);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBtnClass =
    SUBMIT_BUTTON_CLASSES[config.submitColor] ?? SUBMIT_BUTTON_CLASSES.primary;

  return (
    <ModalWrapper open={open} onClose={onClose} title={config.title}>
      {/* Header icon + subtitle */}
      {config.icon && (
        <div className="flex items-center gap-3 mb-4 -mt-1">
          <div
            className={`size-9 rounded-lg flex items-center justify-center ${config.iconBgClass ?? 'bg-blue-100'}`}
          >
            <span
              className={`material-symbols-outlined ${config.iconTextClass ?? 'text-blue-600'}`}
            >
              {config.icon}
            </span>
          </div>
          {config.subtitle && (
            <p className="text-xs text-text-tertiary">{config.subtitle}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          {config.fields.map((field) =>
            renderField(field, formData[field.name], (val) =>
              handleChange(field.name, val),
            ),
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-cwc-md">
              {error}
            </p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-cwc-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-text-secondary bg-white border border-cwc-border rounded-cwc-md hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-4 py-2.5 text-sm font-bold rounded-cwc-md transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${submitBtnClass}`}
          >
            {submitting ? 'Submitting…' : config.submitLabel}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default WorkflowActionModal;