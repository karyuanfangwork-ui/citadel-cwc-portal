import React from 'react';

interface PlaceholderStepProps {
  step: { id: string; label: string; icon: string };
}

const PlaceholderStep: React.FC<PlaceholderStepProps> = ({ step }) => (
  <div style={{ textAlign: 'center', padding: '80px 24px' }}>
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 48, color: 'var(--cr-outline-variant, #c6c6cd)' }}
    >
      {step.icon}
    </span>
    <h2
      style={{
        fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
        fontSize: 'var(--cr-text-headline-md, 20px)',
        fontWeight: 600,
        color: 'var(--cr-on-surface, #191c1e)',
        marginTop: 16,
        marginBottom: 0,
      }}
    >
      {step.label}
    </h2>
    <p
      style={{
        fontSize: 'var(--cr-text-body-md, 14px)',
        color: 'var(--cr-on-surface-variant, #45464d)',
        marginTop: 8,
      }}
    >
      This section will be available in a future update.
    </p>
  </div>
);

export default PlaceholderStep;