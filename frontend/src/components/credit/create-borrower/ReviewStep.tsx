import React from 'react';
import { FormData, UploadedDoc } from './BasicInfoStep';

export type GovernedIdentityStatus = 'not_started' | 'checking' | 'clear' | 'exact_match' | 'exception_approved' | 'failed';

interface ReviewStepProps {
  formData: FormData;
  governedIdentityStatus: GovernedIdentityStatus;
  onSubmit: () => void;
  onSaveDraft: () => void;
  saving: boolean;
  canSubmit: boolean;
  onEditStep?: (step: number) => void;
}

type StatusLevel = 'complete' | 'pending' | 'error';
type ChecklistCategory = 'creation' | 'followUp';

interface ChecklistItem {
  id: string;
  label: string;
  level: StatusLevel;
  icon: string;
  color: string;
  hint: string;
  category: ChecklistCategory;
  editStep?: number;
  editLabel?: string;
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

function buildChecklist(
  formData: FormData,
  governedIdentityStatus: GovernedIdentityStatus,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // a. Governed duplicate / identity check
  let dupLevel: StatusLevel = 'pending';
  let dupHint = 'Complete the governed identity check before creating.';
  if (governedIdentityStatus === 'clear') {
    dupLevel = 'complete';
    dupHint = 'No duplicates found';
  } else if (governedIdentityStatus === 'exception_approved') {
    dupLevel = 'complete';
    dupHint = 'Exact-match exception approved';
  } else if (governedIdentityStatus === 'exact_match') {
    dupLevel = 'error';
    dupHint = 'Exact identity match requires an approved exception';
  } else if (governedIdentityStatus === 'checking') {
    dupLevel = 'pending';
    dupHint = 'Checking…';
  } else if (governedIdentityStatus === 'failed') {
    dupLevel = 'error';
    dupHint = 'Identity check failed. Run it again before creating.';
  }
  items.push({
    id: 'duplicate',
    label: 'Governed identity check',
    level: dupLevel,
    icon: STATUS_STYLES[dupLevel].icon,
    color: STATUS_STYLES[dupLevel].color,
    hint: dupHint,
    category: 'creation',
  });

  // b. Legal identity — type-specific mandatory field check
  const isInd = formData.borrowerType === 'INDIVIDUAL';
  const isCorp = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';
  const identityMissing = isInd
    ? [
        !formData.name.trim() && 'Full Name',
        !formData.nric.trim() && 'NRIC/Passport',
        !formData.dateOfBirth && 'Date of Birth',
        !formData.nationality.trim() && 'Nationality',
      ].filter(Boolean)
    : [
        !formData.name.trim() && 'Company Name',
        !formData.ssm.trim() && 'SSM Registration Number',
        !formData.dateOfIncorporation && 'Date of Incorporation',
        !formData.businessNature.trim() && 'Business Nature',
      ].filter(Boolean);
  const identityComplete = identityMissing.length === 0;
  items.push({
    id: 'identity',
    label: 'Legal identity',
    level: identityComplete ? 'complete' : 'pending',
    icon: STATUS_STYLES[identityComplete ? 'complete' : 'pending'].icon,
    color: STATUS_STYLES[identityComplete ? 'complete' : 'pending'].color,
    hint: identityComplete ? 'Required legal identity provided' : `Missing: ${identityMissing.join(', ')}`,
    category: 'creation',
    editStep: 1,
    editLabel: 'identity',
  });

  // c. Primary contact — either method satisfies the creation rule.
  const contactComplete = !!formData.phone.trim() || !!formData.email.trim();
  items.push({
    id: 'contact',
    label: 'Primary contact',
    level: contactComplete ? 'complete' : 'pending',
    icon: STATUS_STYLES[contactComplete ? 'complete' : 'pending'].icon,
    color: STATUS_STYLES[contactComplete ? 'complete' : 'pending'].color,
    hint: contactComplete ? 'Phone or email provided' : 'Missing: Phone or email',
    category: 'creation',
    editStep: 2,
    editLabel: 'contact',
  });

  // d. Compliance is follow-up work; it does not gate record creation.
  let compLevel: StatusLevel = 'pending';
  let compHint = 'KYC and AML not completed';
  if (formData.amlResult === 'prohibited') {
    compLevel = 'error';
    compHint = 'AML screening prohibited — escalate for compliance review before any credit activity.';
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
    category: 'followUp',
    editStep: 4,
    editLabel: 'compliance',
  });

  // e. Documents are follow-up work; they do not gate record creation.
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
    category: 'followUp',
    editStep: 4,
    editLabel: 'documents',
  });

  return items;
}

function maskIdentity(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed || '—';
  return `${'•'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  formData,
  governedIdentityStatus,
  onSubmit,
  onSaveDraft,
  saving,
  canSubmit,
  onEditStep,
}) => {
  const checklist = buildChecklist(formData, governedIdentityStatus);
  const blockers = checklist.filter(item => item.category === 'creation' && item.level !== 'complete');
  const followUpItems = checklist.filter(item => item.category === 'followUp' && item.level !== 'complete');
  const identityValue = formData.borrowerType === 'INDIVIDUAL' ? formData.nric : formData.ssm;
  const typeLabel = formData.borrowerType === 'SOLE_PROPRIETOR' ? 'Sole Proprietor' : formData.borrowerType === 'INDIVIDUAL' ? 'Individual' : 'Corporate';

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
                  ...(item.level === 'pending' && item.id === 'duplicate' && governedIdentityStatus === 'checking'
                    ? { animation: 'crSpin 1s linear infinite' }
                    : {}),
                }}
              >
                {item.icon}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
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
              {item.editStep !== undefined && onEditStep && (
                <button
                  type="button"
                  onClick={() => onEditStep(item.editStep!)}
                  aria-label={`Edit ${item.editLabel}`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'underline',
                    flexShrink: 0,
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {blockers.length > 0 && (
        <div role="alert" style={{ marginTop: 20, padding: 16, borderRadius: 'var(--cr-radius-lg, 0.5rem)', background: '#fff4e5', border: '1px solid #f2c078' }}>
          <strong style={{ display: 'block', color: '#92400e', fontSize: 14 }}>Complete these items before creating the borrower</strong>
          <ul style={{ margin: '8px 0 0 18px', color: '#92400e', fontSize: 13 }}>
            {blockers.map(item => <li key={item.id}>{item.label}: {item.hint}</li>)}
          </ul>
        </div>
      )}

      {followUpItems.length > 0 && (
        <section
          aria-labelledby="complete-later-heading"
          style={{ marginTop: 20, padding: 16, borderRadius: 'var(--cr-radius-lg, 0.5rem)', background: 'var(--cr-surface-container-low, #f2f4f6)', border: '1px solid var(--cr-outline-variant, #c6c6cd)' }}
        >
          <h3 id="complete-later-heading" style={{ margin: 0, color: 'var(--cr-on-surface, #191c1e)', fontSize: 14 }}>
            Complete later
          </h3>
          <p style={{ margin: '6px 0 0', color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 13 }}>
            These items can be completed after the borrower record exists.
          </p>
          <ul style={{ margin: '8px 0 0 18px', color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 13 }}>
            {followUpItems.map(item => (
              <li key={item.id} style={{ marginTop: 4 }}>
                <span>{item.label}: {item.hint}</span>
              </li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', color: 'var(--cr-on-surface-variant, #45464d)', fontSize: 13 }}>
            Income and bureau information can also be completed later.
          </p>
        </section>
      )}

      <div style={{ marginTop: 20, padding: 20, border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', background: 'var(--cr-surface-container-lowest, #ffffff)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: 12 }}>Values that will be saved</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 24px', fontSize: 13 }}>
          <div><strong>Legal type</strong><div>{typeLabel}</div></div>
          <div><strong>Name</strong><div>{formData.name || '—'}</div></div>
          <div><strong>Identity</strong><div>{maskIdentity(identityValue)}</div></div>
          <div><strong>Nationality / date</strong><div>{formData.nationality || '—'} · {formData.dateOfBirth || formData.dateOfIncorporation || '—'}</div></div>
          <div><strong>Business nature</strong><div>{formData.businessNature || '—'}</div></div>
          <div><strong>Primary contact</strong><div>{formData.phone || formData.email || '—'}</div></div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Address</strong><div>{[formData.addressLine1, formData.addressLine2, formData.postcode, formData.city, formData.state].filter(Boolean).join(', ') || '—'}</div></div>
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
