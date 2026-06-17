/**
 * ApplicationSlaWidget — Right panel widget showing SLA countdown ring.
 *
 * Collapsible section with header 'SLA MONITOR'. Displays an SVG ring
 * indicating days remaining against a 14-day default SLA. Color-coded:
 * green (>3 days), amber (1–3 days), red (≤0 days / overdue).
 * Red warning highlight (border-left + background) when ≤0 days.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';

interface ApplicationSlaWidgetProps {
  slaDaysLeft: number | null;
  createdAt: string | null;
}

const DEFAULT_SLA_DAYS = 14;

/** SVG progress ring — reuses the ProgressRing pattern from CreditApplicationDetail. */
const SlaRing: React.FC<{ pct: number; color: string; size?: number; centerText: string }> = ({
  pct,
  color,
  size = 40,
  centerText,
}) => {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={`${Math.round(pct)}% SLA elapsed`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          fontFamily: 'var(--cr-font-display)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {centerText}
      </span>
    </div>
  );
};

const ApplicationSlaWidget: React.FC<ApplicationSlaWidgetProps> = ({
  slaDaysLeft,
  createdAt,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const isOverdue = slaDaysLeft !== null && slaDaysLeft <= 0;
  const isWarning = isOverdue; // red highlight when <24h i.e. ≤0 days

  // Determine ring color
  let ringColor = '#16a34a'; // green: >3 days
  if (slaDaysLeft !== null) {
    if (slaDaysLeft <= 0) ringColor = '#dc2626'; // red
    else if (slaDaysLeft <= 3) ringColor = '#d97706'; // amber
  }

  // Calculate percentage: how much of the SLA has elapsed
  const pct =
    slaDaysLeft !== null
      ? Math.max(0, Math.min(100, (slaDaysLeft / DEFAULT_SLA_DAYS) * 100))
      : 0;

  // Center text inside ring
  const centerText = isOverdue ? '!' : slaDaysLeft !== null ? `${slaDaysLeft}` : '—';

  // Human-readable label below ring
  let label = 'No SLA configured';
  if (slaDaysLeft !== null) {
    if (isOverdue) label = 'SLA Overdue';
    else if (slaDaysLeft === 1) label = '1 Day Remaining';
    else label = `${slaDaysLeft} Days Remaining`;
  }

  return (
    <section
      style={{
        padding: 16,
        borderBottom: '1px solid var(--cr-outline-variant)',
        borderLeft: isWarning ? '4px solid #dc2626' : '4px solid transparent',
        background: isWarning ? '#fef2f2' : 'transparent',
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={() => setCollapsed(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cr-font-display)',
            fontSize: 11,
            textTransform: 'uppercase',
            color: 'var(--cr-outline)',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
          }}
        >
          SLA MONITOR
        </span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={{ marginTop: 12 }}>
          {slaDaysLeft === null ? (
            <p
              style={{
                fontFamily: 'var(--cr-font-body)',
                fontSize: 12,
                color: 'var(--cr-on-surface-variant)',
                margin: 0,
                opacity: 0.7,
              }}
            >
              No SLA configured
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SlaRing pct={pct} color={ringColor} centerText={centerText} />

              <div>
                <p
                  style={{
                    fontFamily: 'var(--cr-font-display)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: isOverdue ? '#dc2626' : 'var(--cr-on-surface)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </p>
                {createdAt && (
                  <p
                    style={{
                      fontFamily: 'var(--cr-font-body)',
                      fontSize: 11,
                      color: 'var(--cr-on-surface-variant)',
                      margin: 0,
                      marginTop: 2,
                    }}
                  >
                    Created {new Date(createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ApplicationSlaWidget;