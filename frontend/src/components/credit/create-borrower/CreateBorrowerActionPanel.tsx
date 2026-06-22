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

const SEGMENT_ICONS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'person',
  SOLE_PROPRIETOR: 'storefront',
  CORPORATE: 'business',
};

// Mandatory document classes by borrower type
const MANDATORY_DOCS: Record<string, string[]> = {
  INDIVIDUAL: ['NRIC_PASSPORT', 'PAYSLIP'],
  SOLE_PROPRIETOR: ['SSM_CERT', 'BANK_STATEMENT', 'AUDITED_FINANCIALS'],
  CORPORATE: ['SSM_CERT', 'BANK_STATEMENT', 'AUDITED_FINANCIALS'],
};

function computeCompletion(formData: FormData, duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate'): number {
  const sections = [
    { filled: duplicateStatus === 'clear', weight: 1 },           // Duplicate check
    { filled: !!formData.borrowerType, weight: 1 },                // Borrower type
    { filled: !!formData.name.trim() && (!!formData.nric.trim() || !!formData.ssm.trim()), weight: 2 }, // Basic info
    { filled: !!formData.phone.trim() && !!formData.email.trim(), weight: 1 }, // Contact
    { filled: !!formData.employmentType && !!formData.monthlyGrossIncome, weight: 1 }, // Employment
    { filled: formData.kycVerified || formData.amlResult !== 'not_started', weight: 1 }, // Compliance
    { filled: formData.documents.length > 0, weight: 1 },          // Documents
  ];
  const totalWeight = sections.reduce((s, x) => s + x.weight, 0);
  const filledWeight = sections.filter(x => x.filled).reduce((s, x) => s + x.weight, 0);
  return Math.round((filledWeight / totalWeight) * 100);
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
  if (!formData.phone.trim()) {
    reqs.push({ id: 'contact', label: 'Contact Details', desc: 'Phone and email not yet entered', type: 'info' });
  }
  if (!formData.monthlyGrossIncome) {
    reqs.push({ id: 'income', label: 'Income Details', desc: 'Employment & financials incomplete', type: 'info' });
  }

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
  const completion = computeCompletion(formData, duplicateStatus);
  const pendingReqs = getPendingRequirements(formData, duplicateStatus);
  const segmentLabel = SEGMENT_LABELS[formData.borrowerType];
  const segmentIcon = SEGMENT_ICONS[formData.borrowerType];

  const completionColor = completion >= 80 ? '#16a34a' : completion >= 50 ? '#d97706' : '#ba1a1a';

  // Compliance status items
  const mandatoryDocs = MANDATORY_DOCS[formData.borrowerType] || [];
  const uploadedClasses = formData.documents.map(d => d.documentClass);
  const allMandatoryDocsUploaded = mandatoryDocs.every(c => uploadedClasses.includes(c));

  const complianceItems = [
    {
      label: 'Duplicate Check',
      status: duplicateStatus === 'clear' ? 'pass' : duplicateStatus === 'duplicate' ? 'fail' : 'pending',
    },
    {
      label: 'KYC Status',
      status: formData.kycVerified ? 'pass' : 'pending',
    },
    {
      label: 'AML Screening',
      status: formData.amlResult === 'clear' ? 'pass' : formData.amlResult === 'prohibited' ? 'fail' : 'pending',
    },
    {
      label: 'Doc Verification',
      status: allMandatoryDocsUploaded ? 'pass' : formData.documents.length > 0 ? 'pending' : 'fail',
    },
  ];

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
            Application Summary
          </div>
          <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
            Real-time verification tracking
          </div>
        </div>

        {/* ── Applicant Type ── */}
        <div>
          <p style={{ fontSize: 10, color: 'var(--cr-on-surface-variant, #45464d)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Applicant Type
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--cr-secondary, #0051d5)' }}>
              {segmentIcon}
            </span>
            <span style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)' }}>
              {segmentLabel}
            </span>
          </div>
        </div>

        {/* ── Name ── */}
        <div>
          <p style={{ fontSize: 10, color: 'var(--cr-on-surface-variant, #45464d)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Name
          </p>
          <p style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 700, color: 'var(--cr-on-surface-variant, #45464d)', fontStyle: formData.name ? 'normal' : 'italic' }}>
            {formData.name || 'Enter name in Step 2'}
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)', margin: 0 }} />

        {/* ── Form Completion ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 700, color: 'var(--cr-on-surface-variant, #45464d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Form Completion
            </span>
            <span style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 700, color: 'var(--cr-secondary, #0051d5)' }}>
              {completion}%
            </span>
          </div>
          <div style={{ width: '100%', height: 8, backgroundColor: 'var(--cr-surface-container, #eceef0)', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completion}%`, backgroundColor: completionColor, borderRadius: 9999, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* ── Status Checklist ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {complianceItems.map(item => {
            const icon = item.status === 'pass' ? 'check' : item.status === 'fail' ? 'warning' : 'pending';
            const color = item.status === 'pass' ? '#16a34a' : item.status === 'fail' ? '#ba1a1a' : 'var(--cr-on-surface-variant, #45464d)';
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--cr-text-body-sm, 13px)' }}>
                <span style={{ color: 'var(--cr-on-surface-variant, #45464d)' }}>{item.label}</span>
                <span style={{ color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                  {item.status === 'pass' ? 'Cleared' : item.status === 'fail' ? 'Incomplete' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)', margin: 0 }} />

        {/* ── Profile Card ── */}
        <div
          style={{
            padding: 16,
            backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--cr-surface-container, #eceef0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--cr-on-surface-variant, #45464d)' }}>account_circle</span>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--cr-on-surface-variant, #45464d)', textTransform: 'uppercase', margin: 0 }}>Pending Profile</p>
              <p style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', margin: 0, maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formData.name || 'N/A'}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
            <div style={{ padding: 8, backgroundColor: 'var(--cr-surface-container, #eceef0)', borderRadius: 'var(--cr-radius, 0.25rem)' }}>
              <p style={{ color: 'var(--cr-on-surface-variant, #45464d)', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 2px' }}>Region</p>
              <p style={{ fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', margin: 0 }}>ASEAN (MY)</p>
            </div>
            <div style={{ padding: 8, backgroundColor: 'var(--cr-surface-container, #eceef0)', borderRadius: 'var(--cr-radius, 0.25rem)' }}>
              <p style={{ color: 'var(--cr-on-surface-variant, #45464d)', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 2px' }}>Segment</p>
              <p style={{ fontWeight: 700, color: 'var(--cr-on-surface, #191c1e)', margin: 0 }}>{segmentLabel}</p>
            </div>
          </div>
        </div>

        {/* ── Policy Note ── */}
        <div
          style={{
            padding: 12,
            backgroundColor: 'rgba(0, 81, 213, 0.08)',
            border: '1px solid rgba(0, 81, 213, 0.2)',
            borderRadius: 'var(--cr-radius, 0.25rem)',
            fontSize: 11,
            color: 'var(--cr-secondary, #0051d5)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Policy Note:</span>
          Underwriting requires 3 consecutive months of bank statements for individuals. For SME/Corp, 6 months of audited management accounts are mandatory.
        </div>

        {/* ── Pending Requirements ── */}
        {pendingReqs.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 'var(--cr-text-label-md, 12px)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'var(--cr-on-surface-variant, #45464d)',
                marginBottom: 10,
                textTransform: 'uppercase',
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
        )}

      </div>
    </aside>
  );
};

export default CreateBorrowerActionPanel;