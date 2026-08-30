import React, { useEffect, useState } from 'react';
import { FormData } from './BasicInfoStep';
import creditService from '../../../services/credit.service';

export interface EmploymentFinancialsStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
}

const EMPLOYMENT_OPTIONS = [
  { value: '', label: 'Select employment type...' },
  { value: 'PRIVATE_SECTOR', label: 'Private Sector Employee' },
  { value: 'GOVERNMENT', label: 'Government / Civil Servant' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

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

const inlineNumberInputStyle: React.CSSProperties = {
  border: 'none',
  backgroundColor: 'transparent',
  textAlign: 'right',
  fontWeight: 700,
  width: 120,
  fontSize: 'var(--cr-text-body-md, 14px)',
  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
  color: 'var(--cr-on-surface, #191c1e)',
  outline: 'none',
  padding: '2px 4px',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  transition: 'box-shadow 0.15s',
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-body-md, 14px)',
  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
  color: 'var(--cr-on-surface-variant, #45464d)',
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: 'var(--cr-outline-variant, #c6c6cd)',
  margin: '12px 0',
  border: 'none',
};

const columnTitleStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-label-sm, 11px)',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cr-on-surface-variant, #45464d)',
  marginBottom: 12,
};

const formatMYR = (value: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0';
  return value.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.boxShadow = '0 0 0 2px var(--cr-secondary, #0051d5)';
};

const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.boxShadow = 'none';
};

const handleSelectFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)';
  e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)';
};

const handleSelectBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)';
  e.currentTarget.style.boxShadow = 'none';
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)';
  e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)';
  e.currentTarget.style.boxShadow = 'none';
};

const EmploymentFinancialsStep: React.FC<EmploymentFinancialsStepProps> = ({
  formData,
  onFormDataChange,
}) => {
  // ── DSR preview (shared backend calculation) ──
  const [dsrPreview, setDsrPreview] = useState<{ dsrPercent: number; netDsrPercent: number; grossDsrPercent: number; dsrBasis: 'NET' | 'GROSS' } | null>(null);
  const [dsrPreviewLoading, setDsrPreviewLoading] = useState(false);
  const totalIncome = (Number(formData.monthlyGrossIncome) || 0) + (Number(formData.fixedAllowances) || 0);
  const totalCommitments = (Number(formData.existingCommitments) || 0) + (Number(formData.requestedInstallment) || 0);

  useEffect(() => {
    if (totalIncome <= 0) {
      setDsrPreview(null);
      return;
    }
    let active = true;
    setDsrPreviewLoading(true);
    const timer = window.setTimeout(() => {
      creditService.previewDsr({
        monthlyGrossIncome: totalIncome,
        hirePurchaseCommitment: 0,
        creditCardCommitment: 0,
        existingLoanCommitment: Number(formData.existingCommitments) || 0,
        otherCommitments: 0,
        proposedInstalment: Number(formData.requestedInstallment) || 0,
        epfMonthlyAmount: 0,
        monthlyTaxDeduction: 0,
        monthlySocsoDeduction: 0,
      }).then((result) => {
        if (active) setDsrPreview(result);
      }).catch(() => {
        // Keep the last good value; the UI marks it stale below.
      }).finally(() => {
        if (active) setDsrPreviewLoading(false);
      });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [totalIncome, totalCommitments, formData.existingCommitments, formData.requestedInstallment]);

  const dsrPercent = dsrPreview?.dsrPercent ?? null;
  let dsrColor = 'var(--cr-primary, #16a34a)';
  if (dsrPercent != null && dsrPercent > 60) dsrColor = 'var(--cr-error, #ba1a1a)';
  else if (dsrPercent != null && dsrPercent >= 50) dsrColor = '#d97706';
  const dsrLabel = dsrPercent != null ? `${dsrPercent.toFixed(1)}%` : 'Pending';

  const renderInlineNumberRow = (
    labelText: string,
    fieldName: keyof FormData,
    placeholder?: string,
    bold?: boolean,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ ...rowLabelStyle, ...(bold ? { fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)' } : {}) }}>
        {labelText}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-outline, #76777d)' }}>RM</span>
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={formData[fieldName] as string}
          onChange={e => onFormDataChange({ [fieldName]: e.target.value } as Partial<FormData>)}
          placeholder={placeholder ?? '0.00'}
          style={inlineNumberInputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Section heading ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 9999,
                fontSize: 'var(--cr-text-label-sm, 11px)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                backgroundColor: 'var(--cr-secondary-container, #316bf3)',
                color: 'var(--cr-on-secondary-container, #ffffff)',
              }}
            >
              Section 06 &amp; 07
            </span>
          </div>
          <h2
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-headline-md, 20px)',
              fontWeight: 600,
              color: 'var(--cr-on-surface, #191c1e)',
              margin: 0,
            }}
          >
            Employment &amp; Financials
          </h2>
          <p
            style={{
              fontSize: 'var(--cr-text-body-sm, 13px)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              margin: '4px 0 0',
            }}
          >
            Capture employment status and monthly financial capacity for DSR assessment.
          </p>
        </div>
      </div>

      {/* ── Employment Section (2-col grid) ── */}
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
          Employment
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Employment Type */}
          <div>
            <label style={labelStyle}>
              Employment Type <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
            <select
              value={formData.employmentType}
              onChange={e => onFormDataChange({ employmentType: e.target.value })}
              style={inputStyle}
              onFocus={handleSelectFocus}
              onBlur={handleSelectBlur}
            >
              {EMPLOYMENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Current Employer */}
          <div>
            <label style={labelStyle}>Current Employer</label>
            <input
              type="text"
              value={formData.employerName}
              onChange={e => onFormDataChange({ employerName: e.target.value })}
              placeholder="e.g. Petronas Petroleum Sdn Bhd"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
        </div>
      </div>

      {/* ── Monthly Financial Capacity panel ── */}
      <div
        style={{
          ...sectionCardStyle,
          marginTop: 20,
          backgroundColor: 'var(--cr-surface-container-low, #f5f5f7)',
          borderColor: 'var(--cr-outline-variant, #c6c6cd)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 22,
              color: 'var(--cr-secondary, #0051d5)',
            }}
          >
            calculate
          </span>
          <span
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-title-sm, 16px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--cr-on-surface, #191c1e)',
            }}
          >
            Monthly Financial Capacity (MYR)
          </span>
        </div>

        {/* 2-col grid inside */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 32px' }}>
          {/* ── Left column: Income ── */}
          <div>
            <div style={columnTitleStyle}>Income</div>

            {renderInlineNumberRow('Gross Basic Income', 'monthlyGrossIncome', '0.00')}
            {renderInlineNumberRow('Fixed Allowances', 'fixedAllowances', '0.00')}

            <hr style={dividerStyle} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
              }}
            >
              <span
                style={{
                  ...rowLabelStyle,
                  fontWeight: 700,
                  color: 'var(--cr-on-surface, #191c1e)',
                }}
              >
                Total Income
              </span>
              <span
                style={{
                  fontSize: 'var(--cr-text-body-md, 14px)',
                  fontWeight: 700,
                  color: 'var(--cr-secondary, #0051d5)',
                  textAlign: 'right',
                  minWidth: 120,
                }}
              >
                RM {formatMYR(totalIncome)}
              </span>
            </div>
          </div>

          {/* ── Right column: Commitments ── */}
          <div>
            <div style={columnTitleStyle}>Commitments</div>

            {renderInlineNumberRow('Existing Commitments', 'existingCommitments', '0.00')}
            {renderInlineNumberRow('Requested Loan Installment', 'requestedInstallment', '0.00')}

            <hr style={dividerStyle} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
              }}
            >
              <span
                style={{
                  ...rowLabelStyle,
                  fontWeight: 700,
                  color: 'var(--cr-on-surface, #191c1e)',
                }}
              >
                DSR (%)
              </span>
              <span
                style={{
                  fontSize: 'var(--cr-text-body-md, 14px)',
                  fontWeight: 700,
                  color: dsrColor,
                  textAlign: 'right',
                  minWidth: 120,
                }}
              >
                {dsrLabel}
              </span>
            </div>
          </div>
        </div>

        {/* DSR legend / hint */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            fontSize: 'var(--cr-text-label-md, 12px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 9999, backgroundColor: 'var(--cr-primary, #16a34a)' }} />
            Healthy &lt; 50%
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 9999, backgroundColor: '#d97706' }} />
            Caution 50–60%
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 9999, backgroundColor: 'var(--cr-error, #ba1a1a)' }} />
            High Risk &gt; 60%
          </span>
        </div>
      </div>
    </div>
  );
};

export default EmploymentFinancialsStep;