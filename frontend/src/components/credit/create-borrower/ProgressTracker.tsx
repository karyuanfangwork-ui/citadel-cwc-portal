import React from 'react';

export const STEPS = [
  { id: 'duplicate-check',  label: 'Duplicate Check',       icon: 'search' },
  { id: 'customer-type',    label: 'Borrower Type',         icon: 'category' },
  { id: 'basic-info',       label: 'Basic Information',     icon: 'person' },
  { id: 'contact-info',    label: 'Contact Details',       icon: 'contacts' },
  { id: 'employment',      label: 'Employment & Financials', icon: 'account_balance' },
  { id: 'kyc',             label: 'KYC & Compliance',       icon: 'verified_user' },
  { id: 'documents',       label: 'Documents',              icon: 'attachment' },
  { id: 'review',          label: 'Review & Submit',        icon: 'task_alt' },
];

interface ProgressTrackerProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (stepIndex: number) => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
}) => {
  return (
    <nav
      aria-label="Create borrower steps"
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 256,
        borderRight: '1px solid var(--cr-outline-variant, #e2e8f0)',
        backgroundColor: 'var(--cr-surface-container-lowest, #f8fafc)',
        overflowY: 'auto',
      }}
    >
      {/* Back link */}
      <button
        onClick={() => window.history.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
          fontSize: 'var(--cr-text-body-sm, 13px)',
          fontWeight: 500,
          color: 'var(--cr-action, #0051d5)',
          width: '100%',
          textAlign: 'left',
          transition: 'background-color 0.15s',
          borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Borrower Profiles
      </button>

      {/* Header */}
      <div
        style={{
          padding: '16px 16px 8px',
          fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
          fontSize: 'var(--cr-text-headline-sm, 16px)',
          fontWeight: 700,
          color: 'var(--cr-on-surface, #191c1e)',
        }}
      >
        New Borrower
      </div>
      <div
        style={{
          padding: '0 16px 16px',
          fontSize: 'var(--cr-text-body-sm, 13px)',
          color: 'var(--cr-on-surface-variant, #45464d)',
        }}
      >
        Complete each step to register the borrower.
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--cr-outline-variant, #c6c6cd)', margin: '0 16px' }} />

      {/* Step items */}
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = currentStep === index;
        const isUpcoming = !isCompleted && !isCurrent;

        return (
          <button
            key={step.id}
            onClick={() => onStepClick(index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              border: 'none',
              borderBottom: '1px solid transparent',
              borderLeft: isCurrent
                ? '3px solid var(--cr-action, #0051d5)'
                : '3px solid transparent',
              background: isCurrent
                ? 'var(--cr-action-container, rgba(0,81,213,0.08))'
                : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)';
            }}
            onMouseLeave={e => {
              if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Step indicator */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                ...(isCompleted
                  ? { backgroundColor: 'var(--cr-success, #16a34a)', color: '#ffffff' }
                  : isCurrent
                  ? { backgroundColor: 'var(--cr-action, #0051d5)', color: '#ffffff' }
                  : { backgroundColor: 'var(--cr-surface-container-high, #e6e8ea)', color: 'var(--cr-outline, #76777d)' }),
              }}
            >
              {isCompleted ? (
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
              ) : (
                index + 1
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                  fontSize: 'var(--cr-text-label-md, 12px)',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent
                    ? 'var(--cr-on-surface, #191c1e)'
                    : isUpcoming
                    ? 'var(--cr-outline, #76777d)'
                    : 'var(--cr-on-surface-variant, #45464d)',
                  lineHeight: 1.3,
                }}
              >
                {step.label}
              </div>
              {isCurrent && (
                <div
                  style={{
                    fontSize: 'var(--cr-text-label-sm, 11px)',
                    color: 'var(--cr-action, #0051d5)',
                    fontWeight: 600,
                    marginTop: 1,
                  }}
                >
                  Current step
                </div>
              )}
            </div>

            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                color: isCompleted
                  ? 'var(--cr-success, #16a34a)'
                  : isUpcoming
                  ? 'var(--cr-outline, #94a3b8)'
                  : 'var(--cr-action, #0051d5)',
              }}
            >
              {isCompleted ? 'check_circle' : isCurrent ? 'chevron_right' : 'radio_button_unchecked'}
            </span>
          </button>
        );
      })}

      {/* Footer */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
          fontSize: 'var(--cr-text-label-sm, 11px)',
          color: 'var(--cr-outline, #76777d)',
          textAlign: 'center',
        }}
      >
        Step {currentStep + 1} of {STEPS.length}
      </div>
    </nav>
  );
};

export default ProgressTracker;