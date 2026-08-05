import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import RiskScoreTab from './sections/RiskScoreTab';
import IndustryOutlookTab from './sections/IndustryOutlookTab';
import RiskMitigatorsTab from './sections/RiskMitigatorsTab';
import RiskRatingEclTab from './sections/RiskRatingEclTab';
import ProfitabilityWalletTab from './sections/ProfitabilityWalletTab';
import CounterpartiesTab from './sections/CounterpartiesTab';
import AccountConductTab from './sections/AccountConductTab';
import ForwardLookingRiskTab from './sections/ForwardLookingRiskTab';
import CollapsibleSection from '../../../src/components/credit/CollapsibleSection';

interface RiskAssessmentTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
  isFeatureEnabled: (flag: string) => boolean;
}

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