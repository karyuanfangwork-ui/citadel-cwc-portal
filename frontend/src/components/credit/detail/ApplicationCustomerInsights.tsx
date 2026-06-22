/**
 * ApplicationCustomerInsights — Right panel widget showing borrower insights.
 *
 * Collapsible section with header 'BORROWER INSIGHTS'. Displays:
 *   1. Segment badge (colored pill using SEGMENT_COLORS)
 *   2. Existing relationships count or 'New Borrower'
 *   3. Industry
 *   4. Risk appetite (computed from segment)
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';
import { CreditApplication } from '../../../services/credit.service';
import { BorrowerSegment, SEGMENT_LABELS, SEGMENT_COLORS } from '../../../../pages/credit/creditUtils';

interface ApplicationCustomerInsightsProps {
  app: CreditApplication;
  segment: BorrowerSegment;
}

/** Risk appetite label and color derived from borrower segment. */
const RISK_APPETITE: Record<BorrowerSegment, { label: string; color: string }> = {
  retail: { label: 'Standard', color: '#16a34a' },    // green
  sme: { label: 'Moderate', color: '#d97706' },        // amber
  corporate: { label: 'Complex', color: '#7c3aed' },   // purple
};

const ApplicationCustomerInsights: React.FC<ApplicationCustomerInsightsProps> = ({
  app,
  segment,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const segmentColor = SEGMENT_COLORS[segment];
  const segmentLabel = SEGMENT_LABELS[segment];

  const existingRelationships = (app as any).existingRelationships;
  const hasRelationships = typeof existingRelationships === 'number' && existingRelationships > 0;

  const industry = (app as any).borrower?.industry || '—';

  const riskAppetite = RISK_APPETITE[segment];

  return (
    <section
      style={{
        padding: 16,
        borderBottom: '1px solid var(--cr-outline-variant)',
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
          BORROWER INSIGHTS
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
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 1. Segment Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: 'var(--cr-outline)',
                fontFamily: 'var(--cr-font-display)',
              }}
            >
              Segment
            </span>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: segmentColor.bg,
                color: segmentColor.text,
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {segmentLabel}
            </span>
          </div>

          {/* 2. Existing Relationships */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: 'var(--cr-outline)',
                fontFamily: 'var(--cr-font-display)',
              }}
            >
              Relationships
            </span>
            {hasRelationships ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cr-on-surface)',
                  fontFamily: 'var(--cr-font-body)',
                }}
              >
                {existingRelationships} Product{existingRelationships !== 1 ? 's' : ''}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--cr-on-surface-variant)',
                  fontFamily: 'var(--cr-font-body)',
                  opacity: 0.7,
                }}
              >
                New Borrower
              </span>
            )}
          </div>

          {/* 3. Industry */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: 'var(--cr-outline)',
                fontFamily: 'var(--cr-font-display)',
              }}
            >
              Industry
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--cr-on-surface)',
                fontFamily: 'var(--cr-font-body)',
              }}
            >
              {industry}
            </span>
          </div>

          {/* 4. Risk Appetite */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: 'var(--cr-outline)',
                fontFamily: 'var(--cr-font-display)',
              }}
            >
              Risk Appetite
            </span>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: `${riskAppetite.color}20`,
                color: riskAppetite.color,
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {riskAppetite.label}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default ApplicationCustomerInsights;