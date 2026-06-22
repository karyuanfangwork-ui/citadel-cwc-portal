import React from 'react';
import { FormData, UploadedDoc } from './BasicInfoStep';

interface ReviewStepProps {
  formData: FormData;
  duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate';
  onSubmit: () => void;
  onSaveDraft: () => void;
  saving: boolean;
  canSubmit: boolean;
}

type StatusLevel = 'complete' | 'pending' | 'error';

interface ChecklistItem {
  id: string;
  label: string;
  level: StatusLevel;
  icon: string;
  color: string;
  hint: string;
}

const MANDATORY_DOCS_BY_TYPE: Record<FormData['borrowerType'], string[]> = {
  INDIVIDUAL: ['NRIC_PASSPORT', 'PAYSLIP'],
  SOLE_PROPRIETOR: ['SSM_CERT', 'BANK_STATEMENT', 'AUDITED_FINANCIALS'],
  CORPORATE: ['SSM_CERT', 'BANK_STATEMENT', 'AUDITED_FINANCIALS'],
};

const STATUS_STYLES: Record<StatusLevel, { color: string; icon: string }> = {
  complete: { color: '#22c55e', icon: 'check_circle' },
  pending: { color: '#f59e0b', icon: 'pending' },
  error: { color: '#ef4444', icon: 'cancel' },
};

function getUploadedDocClasses(documents: UploadedDoc[]): Set<string> {
  return new Set(documents.map(d => d.documentClass));
}

function buildChecklist(formData: FormData, duplicateStatus: ReviewStepProps['duplicateStatus']): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // a. Duplicate Check
  let dupLevel: StatusLevel = 'pending';
  let dupHint = 'Not yet checked';
  if (duplicateStatus === 'clear') {
    dupLevel = 'complete';
    dupHint = 'No duplicates found';
  } else if (duplicateStatus === 'duplicate') {
    dupLevel = 'error';
    dupHint = 'Duplicate borrower detected';
  } else if (duplicateStatus === 'checking') {
    dupLevel = 'pending';
    dupHint = 'Checking…';
  }
  items.push({
    id: 'duplicate',
    label: 'Duplicate Check',
    level: dupLevel,
    icon: STATUS_STYLES[dupLevel].icon,
    color: STATUS_STYLES[dupLevel].color,
    hint: dupHint,
  });

  // b. Identity & Contact — type-specific mandatory field check
  const isInd = formData.borrowerType === 'INDIVIDUAL';
  const isCorp = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';
  const identityId = isInd ? formData.nric : formData.ssm;
  let identityComplete = !!formData.name.trim() && !!identityId.trim() && !!formData.phone.trim();
  if (isInd) {
    identityComplete = identityComplete && !!formData.dateOfBirth && !!formData.nationality.trim();
  }
  if (isCorp) {
    identityComplete = identityComplete && !!formData.dateOfIncorporation && !!formData.businessNature.trim();
  }
  let identityHint = identityComplete ? 'Name, ID and phone provided' : 'Name, ID or phone missing';
  if (!identityComplete && isInd) {
    identityHint = 'Missing: ' + [
      !formData.name.trim() && 'Name',
      !formData.nric.trim() && 'NRIC',
      !formData.dateOfBirth && 'DOB',
      !formData.nationality.trim() && 'Nationality',
      !formData.phone.trim() && 'Phone',
    ].filter(Boolean).join(', ');
  }
  if (!identityComplete && isCorp) {
    identityHint = 'Missing: ' + [
      !formData.name.trim() && 'Company Name',
      !formData.ssm.trim() && 'SSM',
      !formData.dateOfIncorporation && 'Incorporation Date',
      !formData.businessNature.trim() && 'Business Nature',
      !formData.phone.trim() && 'Phone',
    ].filter(Boolean).join(', ');
  }
  items.push({
    id: 'identity',
    label: 'Identity & Contact',
    level: identityComplete ? 'complete' : 'pending',
    icon: STATUS_STYLES[identityComplete ? 'complete' : 'pending'].icon,
    color: STATUS_STYLES[identityComplete ? 'complete' : 'pending'].color,
    hint: identityHint,
  });

  // c. Compliance
  let compLevel: StatusLevel = 'pending';
  let compHint = 'KYC and AML not completed';
  if (formData.amlResult === 'prohibited') {
    compLevel = 'error';
    compHint = 'AML screening prohibited — cannot proceed';
  } else if (formData.kycVerified && formData.amlResult === 'clear') {
    compLevel = 'complete';
    compHint = 'KYC verified, AML clear';
  } else if (formData.kycVerified || formData.amlResult === 'review') {
    compLevel = 'pending';
    compHint = formData.kycVerified ? 'KYC done, AML pending' : 'AML in review, KYC pending';
  }
  items.push({
    id: 'compliance',
    label: 'Compliance',
    level: compLevel,
    icon: STATUS_STYLES[compLevel].icon,
    color: STATUS_STYLES[compLevel].color,
    hint: compHint,
  });

  // d. Documents
  const mandatory = MANDATORY_DOCS_BY_TYPE[formData.borrowerType];
  const uploaded = getUploadedDocClasses(formData.documents);
  const missing = mandatory.filter(cls => !uploaded.has(cls));
  let docLevel: StatusLevel = 'pending';
  let docHint = 'No documents uploaded yet';
  if (formData.documents.length === 0) {
    docLevel = 'pending';
    docHint = 'No documents uploaded yet';
  } else if (missing.length > 0) {
    docLevel = 'error';
    docHint = `Missing: ${missing.join(', ')}`;
  } else {
    docLevel = 'complete';
    docHint = 'All mandatory documents uploaded';
  }
  items.push({
    id: 'documents',
    label: 'Documents',
    level: docLevel,
    icon: STATUS_STYLES[docLevel].icon,
    color: STATUS_STYLES[docLevel].color,
    hint: docHint,
  });

  return items;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  formData,
  duplicateStatus,
  onSubmit,
  onSaveDraft,
  saving,
  canSubmit,
}) => {
  const checklist = buildChecklist(formData, duplicateStatus);

  return (
    <div>
      {/* Inline keyframes for spin animation */}
      <style>{`@keyframes crSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 700,
            color: 'var(--cr-secondary, #0051d5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 8,
          }}
        >
          Section 10
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
          Final Review
        </h2>
        <p
          style={{
            fontSize: 'var(--cr-text-body-md, 14px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            margin: '4px 0 0',
          }}
        >
          Review all sections before creating the borrower record.
        </p>
      </div>

      {/* Completeness Checklist panel */}
      <div
        style={{
          backgroundColor: 'var(--cr-primary-container, #131b2e)',
          borderRadius: 'var(--cr-radius-lg, 0.5rem)',
          padding: 24,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#ffffff',
            marginBottom: 20,
          }}
        >
          COMPLETENESS CHECKLIST
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {checklist.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 24,
                  color: item.color,
                  flexShrink: 0,
                  lineHeight: 1,
                  ...(item.level === 'pending' && item.id === 'duplicate' && duplicateStatus === 'checking'
                    ? { animation: 'crSpin 1s linear infinite' }
                    : {}),
                }}
              >
                {item.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                    fontSize: 'var(--cr-text-body-md, 14px)',
                    fontWeight: 600,
                    color: '#f5f6f8',
                    lineHeight: 1.3,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 'var(--cr-text-body-sm, 13px)',
                    color: '#c7cad3',
                    margin: '2px 0 0',
                    lineHeight: 1.3,
                  }}
                >
                  {item.hint}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {/* Create Borrower Record — primary */}
        <button
          onClick={onSubmit}
          disabled={!canSubmit || saving}
          style={{
            flex: 1,
            backgroundColor: 'var(--cr-primary, #000000)',
            color: '#ffffff',
            padding: '12px 24px',
            fontWeight: 700,
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            border: 'none',
            cursor: !canSubmit || saving ? 'not-allowed' : 'pointer',
            fontSize: 'var(--cr-text-body-md, 14px)',
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: !canSubmit || saving ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, animation: 'crSpin 1s linear infinite' }}
              >
                progress_activity
              </span>
              Saving…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                check_circle
              </span>
              Create Borrower Record
            </>
          )}
        </button>

        {/* Save as Draft — outline */}
        <button
          onClick={onSaveDraft}
          disabled={saving}
          style={{
            padding: '12px 24px',
            fontWeight: 600,
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            border: '1px solid var(--cr-outline-variant, #c6c6cd)',
            backgroundColor: 'transparent',
            color: 'var(--cr-on-surface, #191c1e)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 'var(--cr-text-body-md, 14px)',
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, animation: 'crSpin 1s linear infinite' }}
            >
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              save
            </span>
          )}
          Save as Draft
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;