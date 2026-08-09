// frontend/src/components/credit/IntegrationModeBanner.tsx
import React from 'react';

interface Props {
  /** Capability the surrounding screen depends on, e.g. 'cbs' or 'esign'. */
  capability: string;
  /** 'LIVE' | 'PLACEHOLDER' as reported by GET /credit/security/integrations. */
  status: 'LIVE' | 'PLACEHOLDER';
}

/**
 * LOS-021 — This deployment is record-only. When a screen is backed by a
 * placeholder adapter, say so plainly: staff must never read a simulated
 * booking reference as evidence that an external system completed anything.
 */
const IntegrationModeBanner: React.FC<Props> = ({ capability, status }) => {
  if (status === 'LIVE') return null;
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', marginBottom: 16, borderRadius: 6,
        background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontSize: 13,
      }}
    >
      <span className="material-icons" style={{ fontSize: 18 }}>info</span>
      <span>
        <strong>Record-only mode.</strong> No live {capability.toUpperCase()} connection is
        configured. Actions here are recorded in this system only — nothing is sent to an
        external provider, and any reference shown is marked <code>SIMULATED</code>.
      </span>
    </div>
  );
};

export default IntegrationModeBanner;