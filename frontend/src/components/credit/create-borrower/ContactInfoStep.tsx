import React, { useState } from 'react';
import type { FormData } from './BasicInfoStep';

export interface ContactInfoStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
}

const MALAYSIAN_STATES = [
  'Selangor',
  'Kuala Lumpur',
  'Johor',
  'Penang',
  'Perak',
  'Sabah',
  'Sarawak',
  'Negeri Sembilan',
  'Pahang',
  'Kelantan',
  'Terengganu',
  'Kedah',
  'Perlis',
  'Melaka',
  'Putrajaya',
  'Labuan',
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--cr-outline, #76777d)',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  fontSize: 'var(--cr-text-body-md, 14px)',
  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  color: 'var(--cr-on-surface, #191c1e)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--cr-text-label-md, 12px)',
  fontWeight: 600,
  color: 'var(--cr-on-surface-variant, #45464d)',
  marginBottom: 4,
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 24,
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)';
  e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)';
};

const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-outline, #76777d)';
  e.currentTarget.style.boxShadow = 'none';
};

const ContactInfoStep: React.FC<ContactInfoStepProps> = ({ formData, onFormDataChange }) => {
  const isCorporateType = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';
  const addressLabel = isCorporateType ? 'Registered Business Address' : 'Residential Address';
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateMobile = (val: string): string | null => {
    if (!val.trim()) return null; // required check is handled by mandatory asterisk
    const digits = val.replace(/[\s\-]/g, '');
    if (!/^\d{8,12}$/.test(digits)) return 'Enter 8–12 digits (without +60 or leading 0)';
    return null;
  };

  const validateEmail = (val: string): string | null => {
    if (!val.trim()) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email format';
    return null;
  };

  const handleMobileBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleBlur(e);
    const err = validateMobile(e.target.value);
    setFieldErrors(prev => ({ ...prev, phone: err ?? '' }));
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleBlur(e);
    const err = validateEmail(e.target.value);
    setFieldErrors(prev => ({ ...prev, email: err ?? '' }));
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 'var(--cr-text-label-sm, 11px)',
    color: 'var(--cr-error, #ba1a1a)',
    marginTop: 4,
    fontWeight: 500,
  };

  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontFamily: 'var(--cr-font-display, Geist)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 700,
            color: 'var(--cr-secondary, #0051d5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 8,
          }}
        >
          Section 05
        </span>
        <h2
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-headline-md, 20px)',
            fontWeight: 600,
            color: 'var(--cr-on-surface, #191c1e)',
            margin: '4px 0 0',
          }}
        >
          Contact Information
        </h2>
        <p
          style={{
            fontSize: 'var(--cr-text-body-sm, 13px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            margin: '4px 0 0',
          }}
        >
          Provide phone, email, and residential address so we can reach the borrower and verify their location.
        </p>
      </div>

      <div style={sectionCardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Mobile Number — with hardcoded +60 prefix addon */}
          <div>
            <label style={labelStyle}>
              Mobile Number <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
            <div style={{ display: 'flex', width: '100%' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  border: '1px solid var(--cr-outline, #76777d)',
                  borderRight: 0,
                  borderRadius: 'var(--cr-radius, 0.25rem) 0 0 var(--cr-radius, 0.25rem)',
                  backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  fontSize: 'var(--cr-text-body-md, 14px)',
                  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                  fontWeight: 600,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                +60
              </span>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => { onFormDataChange({ phone: e.target.value }); if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' })); }}
                placeholder="e.g. 12 345 6789"
                style={{
                  ...inputStyle,
                  borderLeft: 0,
                  borderRadius: '0 var(--cr-radius, 0.25rem) var(--cr-radius, 0.25rem) 0',
                  ...(fieldErrors.phone ? { borderColor: 'var(--cr-error, #ba1a1a)' } : {}),
                }}
                onFocus={handleFocus}
                onBlur={handleMobileBlur}
              />
            </div>
            <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', marginTop: 4 }}>
              Malaysian numbers only — without the leading 0.
            </div>
            {fieldErrors.phone && <div style={errorStyle}>{fieldErrors.phone}</div>}
          </div>

          {/* Email Address */}
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => { onFormDataChange({ email: e.target.value }); if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' })); }}
              placeholder="e.g. ahmad@example.com"
              style={{
                ...inputStyle,
                ...(fieldErrors.email ? { borderColor: 'var(--cr-error, #ba1a1a)' } : {}),
              }}
              onFocus={handleFocus}
              onBlur={handleEmailBlur}
            />
            {fieldErrors.email && <div style={errorStyle}>{fieldErrors.email}</div>}
          </div>

          {/* Office Number — Corporate/SME only */}
          {isCorporateType && (
            <div>
              <label style={labelStyle}>Office Number</label>
              <div style={{ display: 'flex', width: '100%' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    border: '1px solid var(--cr-outline, #76777d)',
                    borderRight: 0,
                    borderRadius: 'var(--cr-radius, 0.25rem) 0 0 var(--cr-radius, 0.25rem)',
                    backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
                    color: 'var(--cr-on-surface-variant, #45464d)',
                    fontSize: 'var(--cr-text-body-md, 14px)',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    fontWeight: 600,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  +60
                </span>
                <input
                  type="tel"
                  value={formData.officePhone}
                  onChange={e => onFormDataChange({ officePhone: e.target.value })}
                  placeholder="e.g. 3 1234 5678"
                  style={{
                    ...inputStyle,
                    borderLeft: 0,
                    borderRadius: '0 var(--cr-radius, 0.25rem) var(--cr-radius, 0.25rem) 0',
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>
          )}

          {/* Preferred Contact Method */}
          <div>
            <label style={labelStyle}>Preferred Contact Method</label>
            <select
              value={formData.preferredContactMethod}
              onChange={e => onFormDataChange({ preferredContactMethod: e.target.value })}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              <option value="">Select</option>
              <option value="MOBILE">Mobile</option>
              <option value="EMAIL">Email</option>
              <option value="OFFICE_PHONE">Office Phone</option>
              <option value="POST">Post / Mail</option>
            </select>
          </div>

          {/* Address — full width group */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              {addressLabel} <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
          </div>

          {/* Address Line 1 */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Line 1</label>
            <input
              type="text"
              value={formData.addressLine1}
              onChange={e => onFormDataChange({ addressLine1: e.target.value })}
              placeholder="e.g. No. 12, Jalan Mutiara 3"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {/* Address Line 2 */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Line 2</label>
            <input
              type="text"
              value={formData.addressLine2}
              onChange={e => onFormDataChange({ addressLine2: e.target.value })}
              placeholder="e.g. Taman Mutiara (optional)"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {/* 3-col grid: Postcode, City, State */}
          <div>
            <label style={labelStyle}>Postcode</label>
            <input
              type="text"
              value={formData.postcode}
              onChange={e => onFormDataChange({ postcode: e.target.value })}
              placeholder="e.g. 47000"
              maxLength={5}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div>
            <label style={labelStyle}>City</label>
            <input
              type="text"
              value={formData.city}
              onChange={e => onFormDataChange({ city: e.target.value })}
              placeholder="e.g. Petaling Jaya"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div>
            <label style={labelStyle}>State</label>
            <select
              value={formData.state}
              onChange={e => onFormDataChange({ state: e.target.value })}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              <option value="">Select state…</option>
              {MALAYSIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Mailing Address Section ── */}
      <div style={{ ...sectionCardStyle, marginTop: 20 }}>
        <div
          style={{
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: 16,
          }}
        >
          Mailing Address
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Mailing Address — full width textarea */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Mailing Address (if different from {isCorporateType ? 'registered business' : 'residential'} address)</label>
            <textarea
              value={formData.mailingAddress}
              onChange={e => onFormDataChange({ mailingAddress: e.target.value })}
              placeholder="Leave blank if same as above"
              rows={2}
              style={{
                ...inputStyle,
                height: 'auto',
                padding: '8px 12px',
                resize: 'vertical',
                minHeight: 60,
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactInfoStep;