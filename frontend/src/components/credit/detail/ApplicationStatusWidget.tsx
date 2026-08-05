/**
 * ApplicationStatusWidget — Right panel widget showing current status
 * and next required action for an application.
 *
 * Collapsible section with header 'CURRENT STATUS', StateBadge for the
 * current state, and the next required action (or fallback text).
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React, { useState } from 'react';
import { ApplicationState } from '../../../services/credit.service';
import StateBadge from '../StateBadge';

interface ApplicationStatusWidgetProps {
  currentState: ApplicationState;
  nextRequiredAction: string | null;
}

const ApplicationStatusWidget: React.FC<ApplicationStatusWidgetProps> = ({
  currentState,
  nextRequiredAction,
}) => {
  const [collapsed, setCollapsed] = useState(false);

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
          CURRENT STATUS
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
          <StateBadge state={currentState} size="sm" />

          <p
            style={{
              fontFamily: 'var(--cr-font-body)',
              fontSize: 12,
              color: 'var(--cr-on-surface-variant)',
              marginTop: 8,
              marginBottom: 0,
            }}
          >
            {nextRequiredAction ?? 'No pending actions'}
          </p>
        </div>
      )}
    </section>
  );
};

export default ApplicationStatusWidget;