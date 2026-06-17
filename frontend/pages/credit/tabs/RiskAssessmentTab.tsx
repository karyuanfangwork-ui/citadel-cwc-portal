import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import RiskScoreTab from './RiskScoreTab';
import CreditChecksRiskTab from './CreditChecksRiskTab';
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

const sectionHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--cr-on-surface, #0f172a)',
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
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
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            score
          </span>
          Risk Score
        </h3>
        <RiskScoreTab application={application} onUpdated={onUpdated} onRefresh={onRefresh} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            fact_check
          </span>
          Credit Checks &amp; Risk
        </h3>
        <CreditChecksRiskTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </section>

      {isFeatureEnabled('credit:ecl') && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              monitoring
            </span>
            Risk Rating &amp; ECL
          </h3>
          <RiskRatingEclTab application={application} onDirtyChange={onDirtyChange} />
        </section>
      )}

      {isFeatureEnabled('credit:profitability') && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              account_balance
            </span>
            Profitability &amp; Wallet
          </h3>
          <ProfitabilityWalletTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </section>
      )}

      {isFeatureEnabled('credit:counterparties') && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              people
            </span>
            Counterparties
          </h3>
          <CounterpartiesTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </section>
      )}

      {isFeatureEnabled('credit:account_conduct') && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              receipt
            </span>
            Account Conduct
          </h3>
          <AccountConductTab application={application} onUpdated={onUpdated} />
        </section>
      )}

      {isFeatureEnabled('credit:esg') && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              eco
            </span>
            Forward-Looking Risk
          </h3>
          <ForwardLookingRiskTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
        </section>
      )}
    </div>
  );
};

export default RiskAssessmentTab;