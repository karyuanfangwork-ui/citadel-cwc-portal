/**
 * Sprint 4 — Required field indicator and inline validation helpers.
 *
 * Usage: <RequiredLabel label="Requested Amount" required />
 *       <FieldError error="Amount is required" />
 */

import React from 'react';

interface RequiredLabelProps {
  label: string;
  required?: boolean;
}

export const RequiredLabel: React.FC<RequiredLabelProps> = ({ label, required }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {label}
    {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
  </label>
);

interface FieldErrorProps {
  error?: string | null;
}

export const FieldError: React.FC<FieldErrorProps> = ({ error }) => {
  if (!error) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, color: '#dc2626' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error_outline</span>
      {error}
    </div>
  );
};

interface RequiredIndicatorProps {
  required: boolean;
}

export const RequiredIndicator: React.FC<RequiredIndicatorProps> = ({ required }) => {
  if (!required) return null;
  return <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>;
};

/**
 * Validate required fields and return a map of field -> error message.
 */
export function validateRequired(
  values: Record<string, any>,
  requiredFields: { key: string; label: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of requiredFields) {
    const val = values[field.key];
    if (val == null || String(val).trim() === '') {
      errors[field.key] = `${field.label} is required`;
    }
  }
  return errors;
}

/**
 * Validate numeric fields are positive.
 */
export function validatePositive(
  values: Record<string, any>,
  fields: { key: string; label: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const val = Number(values[field.key]);
    if (!isNaN(val) && val <= 0) {
      errors[field.key] = `${field.label} must be greater than 0`;
    }
  }
  return errors;
}