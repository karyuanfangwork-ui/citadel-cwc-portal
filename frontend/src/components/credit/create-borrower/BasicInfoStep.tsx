import React, { useState } from 'react';
import creditService from '../../../services/credit.service';

type BorrowerType = 'INDIVIDUAL' | 'CORPORATE' | 'SOLE_PROPRIETOR';

export interface UploadedDoc {
  documentClass: string;
  fileName: string;
  file: File;
}

export interface FormData {
  borrowerType: BorrowerType;
  name: string;
  ssm: string;
  nric: string;
  dateOfBirth: string;
  dateOfIncorporation: string;
  businessNature: string;
  industrySector: string;
  estimatedAnnualRevenue: string;
  accountId: string | null;
  contactId: string | null;
  originatorNotes: string;
  // Phase 2 — type-specific fields
  businessType: string;
  authorizedRepresentative: string;
  preferredName: string;
  maritalStatus: string;
  educationLevel: string;
  taxNumber: string;
  // Contact info (Step 3)
  gender: string;
  nationality: string;
  phone: string;
  officePhone: string;
  email: string;
  preferredContactMethod: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  city: string;
  state: string;
  mailingAddress: string;
  // Employment & financials (Step 4)
  employmentType: string;
  employerName: string;
  monthlyGrossIncome: string;
  fixedAllowances: string;
  existingCommitments: string;
  requestedInstallment: string;
  // Compliance (Step 5)
  kycVerified: boolean;
  amlResult: 'not_started' | 'clear' | 'review' | 'prohibited';
  amlNotes: string;
  // Documents (Step 6)
  documents: UploadedDoc[];
}

export const initialFormData = (): FormData => ({
  borrowerType: 'CORPORATE',
  name: '',
  ssm: '',
  nric: '',
  dateOfBirth: '',
  dateOfIncorporation: '',
  businessNature: '',
  industrySector: '',
  estimatedAnnualRevenue: '',
  accountId: null,
  contactId: null,
  originatorNotes: '',
  // Phase 2 — type-specific fields
  businessType: '',
  authorizedRepresentative: '',
  preferredName: '',
  maritalStatus: '',
  educationLevel: '',
  taxNumber: '',
  // Contact info
  gender: '',
  nationality: 'Malaysian',
  phone: '',
  officePhone: '',
  email: '',
  preferredContactMethod: '',
  addressLine1: '',
  addressLine2: '',
  postcode: '',
  city: '',
  state: '',
  mailingAddress: '',
  // Employment & financials
  employmentType: '',
  employerName: '',
  monthlyGrossIncome: '',
  fixedAllowances: '',
  existingCommitments: '',
  requestedInstallment: '',
  // Compliance
  kycVerified: false,
  amlResult: 'not_started',
  amlNotes: '',
  // Documents
  documents: [],
});

const INDUSTRY_OPTIONS = [
  { value: '', label: 'Select industry...' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'RETAIL_TRADE', label: 'Retail Trade' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'FINANCIAL_SERVICES', label: 'Financial Services' },
  { value: 'WHOLESALE_TRADE', label: 'Wholesale Trade' },
  { value: 'TRANSPORTATION', label: 'Transportation & Storage' },
  { value: 'ACCOMMODATION', label: 'Accommodation & Food Services' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional Services' },
  { value: 'OTHER_SERVICES', label: 'Other Services' },
];

const SEGMENT_TAGS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'Retail Fields Loaded',
  SOLE_PROPRIETOR: 'SME Fields Loaded',
  CORPORATE: 'Corporate Fields Loaded',
};

interface BasicInfoStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate';
  duplicateBorrowerId: string | null;
  onDuplicateCheck: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  padding: '0 12px',
  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-body-sm, 13px)',
  color: 'var(--cr-on-surface, #191c1e)',
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-label-md, 12px)',
  fontWeight: 600,
  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
  color: 'var(--cr-on-surface-variant, #45464d)',
  marginBottom: 4,
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 24,
};

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  formData,
  onFormDataChange,
  duplicateStatus,
  duplicateBorrowerId,
  onDuplicateCheck,
}) => {
  const isIndividual = formData.borrowerType === 'INDIVIDUAL';
  const isCorporateType = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Malaysian NRIC format: XXXXXX-XX-XXXX (6 digits - 2 digits - 4 digits)
  // Passport: alphanumeric, min 5 chars
  const validateNric = (val: string): string | null => {
    if (!val.trim()) return null;
    const cleaned = val.replace(/[\s\-]/g, '');
    // NRIC pattern: 12 digits (without dashes) or passport: 5-20 alphanumeric
    if (/^\d{12}$/.test(cleaned)) return null;
    if (/^[A-Za-z0-9]{5,20}$/.test(cleaned)) return null;
    return 'Use NRIC (12 digits) or passport (5–20 alphanumeric chars)';
  };

  // Malaysian SSM format: YYYYNNNNNNNXXX or NN-NNNNNN-X
  const validateSsm = (val: string): string | null => {
    if (!val.trim()) return null;
    const cleaned = val.replace(/[\s\-]/g, '');
    // SSM: 12-14 digits, or with company suffix (e.g. 202301012345)
    if (/^\d{12,14}$/.test(cleaned)) return null;
    // Also accept formats like "1234567-A" (old format)
    if (/^\d{7}[A-Z]$/.test(cleaned.toUpperCase())) return null;
    return 'Enter a valid SSM number (e.g. 202301012345 or 1234567-A)';
  };

  const handleNricBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (duplicateStatus !== 'duplicate') {
      e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)';
      e.currentTarget.style.boxShadow = 'none';
    }
    const err = validateNric(e.target.value);
    setFieldErrors(prev => ({ ...prev, nric: err ?? '' }));
    onDuplicateCheck();
  };

  const handleSsmBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (duplicateStatus !== 'duplicate') {
      e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)';
      e.currentTarget.style.boxShadow = 'none';
    }
    const err = validateSsm(e.target.value);
    setFieldErrors(prev => ({ ...prev, ssm: err ?? '' }));
    onDuplicateCheck();
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-headline-md, 20px)',
              fontWeight: 600,
              color: 'var(--cr-on-surface, #191c1e)',
              margin: 0,
            }}
          >
            Basic Information
          </h2>
          <p style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)', margin: '4px 0 0' }}>
            Enter the core identity details for this borrower profile.
          </p>
        </div>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 9999,
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            backgroundColor: 'var(--cr-secondary-container, #316bf3)',
            color: 'var(--cr-on-secondary-container, #ffffff)',
          }}
        >
          {SEGMENT_TAGS[formData.borrowerType]}
        </span>
      </div>

      {/* ── Identity Section ── */}
      <div style={sectionCardStyle}>
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
          {isIndividual ? 'Personal Identity' : 'Company Identity'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Name — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              {isIndividual ? 'Full Name' : 'Company Name'} <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => onFormDataChange({ name: e.target.value })}
              placeholder={isIndividual ? 'e.g. Ahmad bin Abdullah' : 'e.g. Citadel Holdings Sdn Bhd'}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* SSM (Corporate/SoleProp) */}
          {isCorporateType && (
            <>
              <div>
                <label style={labelStyle}>
                  Registration Number (SSM) <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.ssm}
                  onChange={e => { onFormDataChange({ ssm: e.target.value }); if (fieldErrors.ssm) setFieldErrors(prev => ({ ...prev, ssm: '' })); }}
                  placeholder="e.g. 202301012345"
                  style={{
                    ...inputStyle,
                    ...(duplicateStatus === 'duplicate' ? { borderColor: 'var(--cr-error, #ba1a1a)', boxShadow: '0 0 0 1px var(--cr-error, #ba1a1a)' } : {}),
                    ...(fieldErrors.ssm ? { borderColor: 'var(--cr-error, #ba1a1a)' } : {}),
                  }}
                  onFocus={e => { if (duplicateStatus !== 'duplicate' && !fieldErrors.ssm) { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}}
                  onBlur={handleSsmBlur}
                />
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', marginTop: 4 }}>
                  Checked for duplicates when you leave this field
                </div>
                {fieldErrors.ssm && <div style={errorStyle}>{fieldErrors.ssm}</div>}
              </div>
              <div>
                <label style={labelStyle}>
                  Date of Incorporation <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfIncorporation}
                  onChange={e => onFormDataChange({ dateOfIncorporation: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              {/* ── Additional Corporate Fields ── */}
              <div>
                <label style={labelStyle}>Business Type</label>
                <select
                  value={formData.businessType}
                  onChange={e => onFormDataChange({ businessType: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <option value="">Select</option>
                  <option value="Sendirian Berhad">Sendirian Berhad (Sdn Bhd)</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Public Listed">Public Listed Company (PLC)</option>
                  <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Authorized Representative</label>
                <input
                  type="text"
                  value={formData.authorizedRepresentative}
                  onChange={e => onFormDataChange({ authorizedRepresentative: e.target.value })}
                  placeholder="e.g. Ahmad bin Abdullah (Director)"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          )}

          {/* NRIC (Individual) */}
          {isIndividual && (
            <>
              <div>
                <label style={labelStyle}>
                  NRIC / Passport No. <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.nric}
                  onChange={e => { onFormDataChange({ nric: e.target.value }); if (fieldErrors.nric) setFieldErrors(prev => ({ ...prev, nric: '' })); }}
                  placeholder="e.g. 901231-14-5678"
                  style={{
                    ...inputStyle,
                    ...(duplicateStatus === 'duplicate' ? { borderColor: 'var(--cr-error, #ba1a1a)', boxShadow: '0 0 0 1px var(--cr-error, #ba1a1a)' } : {}),
                    ...(fieldErrors.nric ? { borderColor: 'var(--cr-error, #ba1a1a)' } : {}),
                  }}
                  onFocus={e => { if (duplicateStatus !== 'duplicate' && !fieldErrors.nric) { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}}
                  onBlur={handleNricBlur}
                />
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', marginTop: 4 }}>
                  Checked for duplicates when you leave this field
                </div>
                {fieldErrors.nric && <div style={errorStyle}>{fieldErrors.nric}</div>}
              </div>
              <div>
                <label style={labelStyle}>
                  Date of Birth <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => onFormDataChange({ dateOfBirth: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => onFormDataChange({ gender: e.target.value })}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Nationality <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                  </label>
                  <select
                    value={formData.nationality}
                    onChange={e => onFormDataChange({ nationality: e.target.value })}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="Malaysian">Malaysian</option>
                    <option value="Non-Malaysian">Non-Malaysian</option>
                  </select>
                </div>
              </div>

              {/* ── Additional Individual Fields ── */}
              <div>
                <label style={labelStyle}>Preferred Name</label>
                <input
                  type="text"
                  value={formData.preferredName}
                  onChange={e => onFormDataChange({ preferredName: e.target.value })}
                  placeholder="e.g. Ahmad"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Marital Status</label>
                  <select
                    value={formData.maritalStatus}
                    onChange={e => onFormDataChange({ maritalStatus: e.target.value })}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Education Level</label>
                  <select
                    value={formData.educationLevel}
                    onChange={e => onFormDataChange({ educationLevel: e.target.value })}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="">Select</option>
                    <option value="Secondary">Secondary / SPM</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Bachelor">Bachelor's Degree</option>
                    <option value="Master">Master's Degree</option>
                    <option value="PhD">PhD</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tax Identification Number</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={e => onFormDataChange({ taxNumber: e.target.value })}
                  placeholder="e.g. SG123456780"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          )}
        </div>

        {/* Duplicate check feedback */}
        {duplicateStatus === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
            Checking for duplicates…
          </div>
        )}
        {duplicateStatus === 'clear' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            padding: '8px 12px', borderRadius: 'var(--cr-radius, 0.25rem)',
            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
            fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: '#16a34a',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            No duplicate found — you may proceed.
          </div>
        )}
        {duplicateStatus === 'duplicate' && duplicateBorrowerId && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
            padding: '12px', borderRadius: 'var(--cr-radius, 0.25rem)',
            backgroundColor: '#fffbeb', border: '1px solid #fbbf24',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d97706', marginTop: 1 }}>warning</span>
            <div>
              <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: '#92400e' }}>
                A borrower with this {isIndividual ? 'NRIC' : 'SSM'} already exists.
              </div>
              <a
                href={`/credit/borrowers/${duplicateBorrowerId}`}
                style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600, color: '#0051d5', textDecoration: 'underline' }}
              >
                View Existing Borrower →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Business Details Section (Corporate/SME only) ── */}
      {isCorporateType && (
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
          Business Details
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Business Nature — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              Business Nature / Description <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
            <textarea
              value={formData.businessNature}
              onChange={e => onFormDataChange({ businessNature: e.target.value })}
              placeholder="Brief description of the business activities..."
              rows={3}
              style={{
                ...inputStyle,
                height: 'auto',
                padding: '8px 12px',
                resize: 'vertical',
                minHeight: 72,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Industry Sector */}
          <div>
            <label style={labelStyle}>Industry Sector</label>
            <select
              value={formData.industrySector}
              onChange={e => onFormDataChange({ industrySector: e.target.value })}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {INDUSTRY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Estimated Annual Revenue */}
          <div>
            <label style={labelStyle}>Estimated Annual Revenue</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--cr-text-body-sm, 13px)',
                  color: 'var(--cr-outline, #76777d)',
                  pointerEvents: 'none',
                }}
              >
                RM
              </span>
              <input
                type="text"
                value={formData.estimatedAnnualRevenue}
                onChange={e => onFormDataChange({ estimatedAnnualRevenue: e.target.value })}
                placeholder="e.g. 5,000,000"
                style={{ ...inputStyle, paddingLeft: 36 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Tax Number */}
          <div>
            <label style={labelStyle}>Tax Number</label>
            <input
              type="text"
              value={formData.taxNumber}
              onChange={e => onFormDataChange({ taxNumber: e.target.value })}
              placeholder="e.g. C 123456780"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>
      </div>
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BasicInfoStep;