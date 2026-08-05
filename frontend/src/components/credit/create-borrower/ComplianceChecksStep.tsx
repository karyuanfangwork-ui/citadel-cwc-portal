import React, { useState } from 'react';
import { FormData } from './BasicInfoStep';

interface ComplianceChecksStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
}

type AmlResult = FormData['amlResult'];

const AML_OPTIONS: { value: AmlResult; label: string; color: string }[] = [
  { value: 'clear', label: 'Clear', color: 'var(--cr-success, #1e8e3e)' },
  { value: 'review', label: 'Review', color: 'var(--cr-warning, #f9a825)' },
  { value: 'prohibited', label: 'Prohibited', color: 'var(--cr-error, #d93025)' },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const iconBoxStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 'var(--cr-radius, 0.25rem)',
  backgroundColor: 'var(--cr-secondary-container, #316bf3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-label-lg, 14px)',
  fontWeight: 700,
  color: 'var(--cr-on-surface, #191c1e)',
  margin: 0,
  lineHeight: 1.3,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-body-sm, 13px)',
  color: 'var(--cr-on-surface-variant, #45464d)',
  margin: '2px 0 0',
  lineHeight: 1.3,
};

const badgeStyle = (color: string): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: 9999,
  fontSize: 'var(--cr-text-label-sm, 11px)',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: '#ffffff',
  backgroundColor: color,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
});

const buttonStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-secondary, #0051d5)',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  fontSize: 'var(--cr-text-label-md, 12px)',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-label-sm, 11px)',
  color: 'var(--cr-on-surface-variant, #45464d)',
  margin: '6px 0 0',
  fontStyle: 'italic',
};

const KYC_BADGE_MAP = {
  notStarted: { label: 'NOT STARTED', color: 'var(--cr-outline, #76777d)' },
  verified: { label: 'VERIFIED', color: 'var(--cr-success, #1e8e3e)' },
};

const AML_BADGE_MAP: Record<AmlResult, { label: string; color: string }> = {
  not_started: { label: 'NOT STARTED', color: 'var(--cr-outline, #76777d)' },
  clear: { label: 'CLEAR', color: 'var(--cr-success, #1e8e3e)' },
  review: { label: 'REVIEW', color: 'var(--cr-warning, #f9a825)' },
  prohibited: { label: 'PROHIBITED', color: 'var(--cr-error, #d93025)' },
};

const ComplianceChecksStep: React.FC<ComplianceChecksStepProps> = ({
  formData,
  onFormDataChange,
}) => {
  const [showAmlForm, setShowAmlForm] = useState(false);
  const [amlDraftResult, setAmlDraftResult] = useState<AmlResult>(
    formData.amlResult === 'not_started' ? 'clear' : formData.amlResult,
  );
  const [amlDraftNotes, setAmlDraftNotes] = useState(formData.amlNotes);

  const handleKycToggle = () => {
    onFormDataChange({ kycVerified: !formData.kycVerified });
  };

  const handleOpenAmlForm = () => {
    setAmlDraftResult(formData.amlResult === 'not_started' ? 'clear' : formData.amlResult);
    setAmlDraftNotes(formData.amlNotes);
    setShowAmlForm(true);
  };

  const handleConfirmAml = () => {
    onFormDataChange({ amlResult: amlDraftResult, amlNotes: amlDraftNotes });
    setShowAmlForm(false);
  };

  const handleCancelAml = () => {
    setShowAmlForm(false);
  };

  const kycBadge = formData.kycVerified
    ? KYC_BADGE_MAP.verified
    : KYC_BADGE_MAP.notStarted;

  const amlBadge = AML_BADGE_MAP[formData.amlResult];

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
          Section 08
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
          Compliance Checks
        </h2>
        <p
          style={{
            fontSize: 'var(--cr-text-body-md, 14px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            margin: '4px 0 0',
          }}
        >
          Complete e-KYC verification and AML / sanction screening before proceeding.
          These are manual markers confirming checks performed via external systems.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {/* Card 1: e-KYC Verification */}
        <div style={cardStyle}>
          {/* Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={iconBoxStyle}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: 'var(--cr-on-secondary-container, #ffffff)' }}
              >
                verified_user
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={titleStyle}>e-KYC Verification</h3>
              <p style={subtitleStyle}>Biometric & ID matching</p>
              <p style={helpTextStyle}>
                Click to confirm e-KYC verification has been completed.
              </p>
            </div>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <span style={badgeStyle(kycBadge.color)}>{kycBadge.label}</span>
            <button onClick={handleKycToggle} style={buttonStyle}>
              {formData.kycVerified ? 'Reset' : 'Run KYC'}
            </button>
          </div>
        </div>

        {/* Card 2: AML / Sanction Screening */}
        <div
          style={{
            ...cardStyle,
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
          }}
        >
          {/* Top row: left + right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {/* Left side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={iconBoxStyle}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, color: 'var(--cr-on-secondary-container, #ffffff)' }}
                >
                  policy
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={titleStyle}>AML / Sanction Screening</h3>
                <p style={subtitleStyle}>UNSC, PEP, OFAC lists</p>
                <p style={helpTextStyle}>
                  Officer confirms screening against external lists was performed.
                </p>
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <span style={badgeStyle(amlBadge.color)}>{amlBadge.label}</span>
              <button onClick={handleOpenAmlForm} style={buttonStyle}>
                Run AML
              </button>
            </div>
          </div>

          {/* Inline AML form */}
          {showAmlForm && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {AML_OPTIONS.map(opt => {
                  const checked = amlDraftResult === opt.value;
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 'var(--cr-text-body-sm, 13px)',
                        color: 'var(--cr-on-surface, #191c1e)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="aml-result"
                        value={opt.value}
                        checked={checked}
                        onChange={() => setAmlDraftResult(opt.value)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: checked ? 700 : 400 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                    fontSize: 'var(--cr-text-label-md, 12px)',
                    fontWeight: 600,
                    color: 'var(--cr-on-surface-variant, #45464d)',
                    marginBottom: 4,
                  }}
                >
                  Screening Notes
                </label>
                <textarea
                  value={amlDraftNotes}
                  onChange={e => setAmlDraftNotes(e.target.value)}
                  rows={3}
                  placeholder="Record screening findings, list sources checked, match details..."
                  style={{
                    width: '100%',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                    borderRadius: 'var(--cr-radius, 0.25rem)',
                    padding: '8px 12px',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    fontSize: 'var(--cr-text-body-sm, 13px)',
                    color: 'var(--cr-on-surface, #191c1e)',
                    backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={handleCancelAml}
                  style={{
                    ...buttonStyle,
                    backgroundColor: 'transparent',
                    color: 'var(--cr-on-surface-variant, #45464d)',
                    border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                  }}
                >
                  Cancel
                </button>
                <button onClick={handleConfirmAml} style={buttonStyle}>
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceChecksStep;