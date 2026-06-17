import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import FinancialsTab from './FinancialsTab';
import SmeFinancialsTab from './SmeFinancialsTab';
import PaymentCapabilityTab from './PaymentCapabilityTab';

interface FinancialProfileTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
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

const FinancialProfileTab: React.FC<FinancialProfileTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
}) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            trending_up
          </span>
          Financial Statements
        </h3>
        <FinancialsTab application={application} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            store
          </span>
          SME Financials
        </h3>
        <SmeFinancialsTab application={application} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            account_balance_wallet
          </span>
          Payment Capability
        </h3>
        <PaymentCapabilityTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </section>
    </div>
  );
};

export default FinancialProfileTab;