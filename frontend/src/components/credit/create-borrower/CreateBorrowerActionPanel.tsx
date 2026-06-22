import React from 'react';
import { FormData } from './BasicInfoStep';

type BorrowerType = 'INDIVIDUAL' | 'CORPORATE' | 'SOLE_PROPRIETOR';

interface PendingReq {
  id: string;
  label: string;
  desc: string;
  type: 'error' | 'info';
}

const SEGMENT_LABELS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'Retail',
  SOLE_PROPRIETOR: 'SME',
  CORPORATE: 'Corporate',
};

function computeValidationScore(formData: FormData): number {
  let total = 0;
  let filled = 0;

  // Step 0: Borrower type (always filled)
  total += 1;
  filled += 1;

  // Step 1: Basic Info
  const isIndividual = formData.borrowerType === 'INDIVIDUAL';

  // Name (required)
  total += 1;
  filled += formData.name.trim() ? 1 : 0;

  // SSM or NRIC (required)
  total += 1;
  if (isIndividual) {
    filled += formData.nric.trim() ? 1 : 0;
  } else {
    filled += formData.ssm.trim() ? 1 : 0;
  }

  // Industry (optional but nice)
  total += 1;
  filled += formData.industrySector ? 1 : 0;

  // Revenue (optional)
  total += 1;
  filled += formData.estimatedAnnualRevenue ? 1 : 0;

  // Future steps weight (5 steps, unfilled)
  total += 5;

  return Math.round((filled / total) * 100);
}

function getPendingRequirements(formData: FormData, duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate'): PendingReq[] {
  const reqs: PendingReq[] = [];
  const isIndividual = formData.borrowerType === 'INDIVIDUAL';

  if (!formData.name.trim()) {
    reqs.push({
      id: 'name',
      label: isIndividual ? 'Full Name' : 'Company Name',
      desc: 'Required field',
      type: 'error',
    });
  }
  if (!isIndividual && !formData.ssm.trim()) {
    reqs.push({ id: 'ssm', label: 'SSM Verification', desc: 'Registration number required', type: 'error' });
  }
  if (isIndividual && !formData.nric.trim()) {
    reqs.push({ id: 'nric', label: 'NRIC Verification', desc: 'NRIC/Passport number required', type: 'error' });
  }
  if (duplicateStatus === 'duplicate') {
    reqs.push({ id: 'dup', label: 'Duplicate Detected', desc: 'A borrower with this identifier already exists', type: 'error' });
  }

  // Info-level items for future steps
  reqs.push({ id: 'contact', label: 'Contact Details', desc: 'Contact information incomplete', type: 'info' });
  reqs.push({ id: 'ownership', label: 'Director Details', desc: 'Ownership structure incomplete', type: 'info' });

  return reqs;
}

interface CreateBorrowerActionPanelProps {
  formData: FormData;
  currentStep: number;
  duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate';
}

const CreateBorrowerActionPanel: React.FC<CreateBorrowerActionPanelProps> = ({
  formData,
  currentStep,
  duplicateStatus,
}) => {
  const score = computeValidationScore(formData);
  const pendingReqs = getPendingRequirements(formData, duplicateStatus);
  const segmentLabel = SEGMENT_LABELS[formData.borrowerType];

  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#ba1a1a';

  return (
    <aside
      className="hidden xl:flex flex-col w-80 shrink-0 overflow-y-auto cr-scroll"
      style={{
        backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
        borderLeft: '1px solid var(--cr-outline-variant, #c6c6cd)',
      }}
    >
      {/* Panel content */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Panel Header ── */}
        <div>
          <div
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-label-sm, 11px)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--cr-on-surface-variant, #45464d)',
              marginBottom: 4,
            }}
          >
            Action Panel
          </div>
          <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
            Real-time verification tracking
          </div>
        </div>

        {/* ── Draft Summary ── */}
        <div
          style={{
            backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              marginBottom: 12,
            }}
          >
            Draft Summary
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Segment</span>
              <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>{segmentLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Jurisdiction</span>
              <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>Malaysia</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Status</span>
              <span
                style={{
                  padding: '1px 8px',
                  borderRadius: 9999,
                  fontSize: 'var(--cr-text-label-sm, 11px)',
                  fontWeight: 600,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                }}
              >
                Draft
              </span>
            </div>
            {formData.name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Name</span>
                <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formData.name}
                </span>
              </div>
            )}
            {duplicateStatus === 'duplicate' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>Duplicate</span>
                <span style={{ fontSize: 'var(--cr-text-label-sm, 11px)', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 9999 }}>
                  ⚠ Flagged
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Validation Score ── */}
        <div
          style={{
            backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 'var(--cr-text-label-md, 12px)',
                fontWeight: 600,
                letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                color: 'var(--cr-on-surface-variant, #45464d)',
              }}
            >
              Validation Score
            </span>
            <span
              style={{
                fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                fontSize: 'var(--cr-text-headline-md, 20px)',
                fontWeight: 700,
                color: scoreColor,
              }}
            >
              {score}%
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 8,
              backgroundColor: 'var(--cr-surface-container-high, #e6e8ea)',
              borderRadius: 9999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${score}%`,
                backgroundColor: scoreColor,
                borderRadius: 9999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-on-surface-variant, #45464d)', marginTop: 8 }}>
            {score < 30
              ? 'Complete Basic Information to increase score.'
              : score < 60
              ? 'Good progress. Fill remaining sections to continue.'
              : score < 80
              ? 'Almost there. A few more fields needed.'
              : 'Ready for submission.'}
          </div>
        </div>

        {/* ── Pending Requirements ── */}
        <div
          style={{
            backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              marginBottom: 12,
            }}
          >
            Pending Requirements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingReqs.map(req => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  backgroundColor: req.type === 'error' ? '#fef2f2' : 'var(--cr-surface-container-low, #f2f4f6)',
                  border: `1px solid ${req.type === 'error' ? '#fecaca' : 'var(--cr-outline-variant, #c6c6cd)'}`,
                  borderRadius: 'var(--cr-radius, 0.25rem)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 16,
                    color: req.type === 'error' ? '#dc2626' : '#d97706',
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  {req.type === 'error' ? 'warning' : 'pending'}
                </span>
                <div>
                  <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>
                    {req.label}
                  </div>
                  <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                    {req.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Originator Notes ── */}
        <div
          style={{
            backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              letterSpacing: 'var(--cr-tracking-label, 0.05em)',
              color: 'var(--cr-on-surface-variant, #45464d)',
              marginBottom: 8,
            }}
          >
            Originator Notes
          </div>
          <textarea
            value={formData.originatorNotes}
            onChange={e => { /* Handled by parent via formData */ }}
            placeholder="Internal notes for the credit team…"
            rows={3}
            style={{
              width: '100%',
              minHeight: 72,
              padding: '8px 12px',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-body-sm, 13px)',
              color: 'var(--cr-on-surface, #191c1e)',
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              resize: 'vertical',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>
    </aside>
  );
};

export default CreateBorrowerActionPanel;