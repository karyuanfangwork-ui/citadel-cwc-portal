import React from 'react';

type BorrowerType = 'INDIVIDUAL' | 'CORPORATE' | 'SOLE_PROPRIETOR';

interface BorrowerTypeStepProps {
  value: BorrowerType;
  onChange: (value: BorrowerType) => void;
}

const TYPE_CARDS: {
  value: BorrowerType;
  icon: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'INDIVIDUAL',
    icon: 'person',
    label: 'Individual',
    description: 'An individual customer with personal identity documents.',
  },
  {
    value: 'SOLE_PROPRIETOR',
    icon: 'storefront',
    label: 'Sole Proprietor',
    description: 'A sole proprietor legal form; this maps to the SME operational segment.',
  },
  {
    value: 'CORPORATE',
    icon: 'domain',
    label: 'Corporate',
    description: 'A registered company or other corporate legal entity.',
  },
];

const SEGMENT_TAGS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'Retail Fields Loaded',
  SOLE_PROPRIETOR: 'SME Fields Loaded',
  CORPORATE: 'Corporate Fields Loaded',
};

const BorrowerTypeStep: React.FC<BorrowerTypeStepProps> = ({ value, onChange }) => {
  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-headline-md, 20px)',
            fontWeight: 600,
            color: 'var(--cr-on-surface, #191c1e)',
            margin: '0 0 4px',
          }}
        >
          Borrower Type
        </h2>
        <p
          style={{
            fontSize: 'var(--cr-text-body-md, 14px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            margin: 0,
          }}
        >
          Select the legal borrower type. The operational segment and KYC thresholds are applied after this choice.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {TYPE_CARDS.map(card => {
          const isSelected = value === card.value;
          return (
            <button
              key={card.value}
              onClick={() => onChange(card.value)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '24px 20px',
                backgroundColor: isSelected
                  ? 'rgba(49, 107, 243, 0.06)'
                  : 'var(--cr-surface-container-lowest, #ffffff)',
                border: isSelected
                  ? '2px solid var(--cr-secondary, #0051d5)'
                  : '1px solid var(--cr-outline-variant, #c6c6cd)',
                borderRadius: 'var(--cr-radius-lg, 0.5rem)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
                boxShadow: isSelected
                  ? '0 0 0 1px var(--cr-secondary, #0051d5)'
                  : 'none',
                textAlign: 'center',
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--cr-outline, #76777d)';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)';
                }
              }}
            >
              {/* Check indicator */}
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: 20,
                  color: isSelected
                    ? 'var(--cr-secondary, #0051d5)'
                    : 'var(--cr-outline-variant, #c6c6cd)',
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                {isSelected ? 'check_circle' : 'radio_button_unchecked'}
              </span>

              {/* Icon */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
                  backgroundColor: isSelected
                    ? 'var(--cr-secondary-container, #316bf3)'
                    : 'var(--cr-surface-container, #eceef0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 28,
                    color: isSelected
                      ? 'var(--cr-on-secondary-container, #ffffff)'
                      : 'var(--cr-on-surface-variant, #45464d)',
                  }}
                >
                  {card.icon}
                </span>
              </div>

              {/* Label */}
              <h3
                style={{
                  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                  fontSize: 'var(--cr-text-label-lg, 14px)',
                  fontWeight: 700,
                  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                  color: isSelected
                    ? 'var(--cr-secondary, #0051d5)'
                    : 'var(--cr-on-surface, #191c1e)',
                  margin: 0,
                }}
              >
                {card.label}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontSize: 'var(--cr-text-body-sm, 13px)',
                  color: 'var(--cr-on-surface-variant, #45464d)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {card.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Segment tag hint */}
      <div
        style={{
          marginTop: 20,
          padding: '10px 16px',
          backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
          borderRadius: 'var(--cr-radius, 0.25rem)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 'var(--cr-text-body-sm, 13px)',
          color: 'var(--cr-on-surface-variant, #45464d)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--cr-secondary, #0051d5)' }}>
          info
        </span>
        <span>
          <strong>{SEGMENT_TAGS[value]}</strong> — form fields and validation rules will adapt based on your selection.
        </span>
      </div>
    </div>
  );
};

export default BorrowerTypeStep;