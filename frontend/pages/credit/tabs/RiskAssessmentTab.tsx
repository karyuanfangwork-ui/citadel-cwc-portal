import React, { useState } from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import RiskScoreTab from './RiskScoreTab';
import IndustryOutlookTab from './IndustryOutlookTab';
import RiskMitigatorsTab from './RiskMitigatorsTab';
import RiskRatingEclTab from './RiskRatingEclTab';
import ProfitabilityWalletTab from './ProfitabilityWalletTab';
import CounterpartiesTab from './CounterpartiesTab';
import AccountConductTab from './AccountConductTab';
import ForwardLookingRiskTab from './ForwardLookingRiskTab';

interface RiskAssessmentTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
  isFeatureEnabled: (flag: string) => boolean;
}

// ── Collapsible Section ──────────────────────────────────────────

interface SectionProps {
  id: string;
  label: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<SectionProps> = ({ id, label, icon, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id}>
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          fontFamily: 'var(--cr-font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--cr-on-surface, #0f172a)',
          borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
          paddingBottom: 8,
          marginBottom: 16,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
          {icon}
        </span>
        {label}
        <span
          className="material-symbols-outlined"
          style={{
            marginLeft: 'auto',
            fontSize: 20,
            color: 'var(--cr-outline)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          expand_more
        </span>
      </button>
      {open && <div style={{ marginBottom: 8 }}>{children}</div>}
    </section>
  );
};

const RiskAssessmentTab: React.FC<RiskAssessmentTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
  onRefresh,
  isFeatureEnabled,
}) => {
  return (
    <div className="space-y-8">
      <CollapsibleSection id="risk-score" label="Risk Score" icon="score" defaultOpen>
        <RiskScoreTab application={application} onUpdated={onUpdated} onRefresh={onRefresh} />
      </CollapsibleSection>

      <CollapsibleSection id="risk-industry" label="Industry / Conduct Risk" icon="travel_explore">
        <IndustryOutlookTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </CollapsibleSection>

      <CollapsibleSection id="risk-mitigants" label="Risk Mitigants" icon="health_and_safety">
        <RiskMitigatorsTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </CollapsibleSection>

      {isFeatureEnabled('credit:ecl') && (
        <CollapsibleSection id="risk-ecl" label="Risk Rating & ECL" icon="monitoring">
          <RiskRatingEclTab application={application} onDirtyChange={onDirtyChange} />
        </CollapsibleSection>
      )}

      {isFeatureEnabled('credit:profitability') && (
        <CollapsibleSection id="risk-profitability" label="Profitability & Wallet" icon="account_balance">
          <ProfitabilityWalletTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </CollapsibleSection>
      )}

      {isFeatureEnabled('credit:counterparties') && (
        <CollapsibleSection id="risk-counterparties" label="Counterparties" icon="people">
          <CounterpartiesTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </CollapsibleSection>
      )}

      {isFeatureEnabled('credit:account_conduct') && (
        <CollapsibleSection id="risk-conduct" label="Account Conduct" icon="receipt">
          <AccountConductTab application={application} onUpdated={onUpdated} />
        </CollapsibleSection>
      )}

      {isFeatureEnabled('credit:esg') && (
        <CollapsibleSection id="risk-forward" label="Forward-Looking Risk" icon="eco">
          <ForwardLookingRiskTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </CollapsibleSection>
      )}
    </div>
  );
};

export default RiskAssessmentTab;