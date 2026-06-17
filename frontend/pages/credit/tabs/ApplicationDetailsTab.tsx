import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import LoanRequestTab from './LoanRequestTab';
import RequestsFacilitiesTab from './RequestsFacilitiesTab';

interface ApplicationDetailsTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  advancedMemo?: boolean;
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

const ApplicationDetailsTab: React.FC<ApplicationDetailsTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
  advancedMemo,
}) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            description
          </span>
          Loan Request
        </h3>
        <LoanRequestTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </section>

      {advancedMemo && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              account_balance
            </span>
            Facilities &amp; CA Memo
          </h3>
          <RequestsFacilitiesTab application={application} onDirtyChange={onDirtyChange} />
        </section>
      )}
    </div>
  );
};

export default ApplicationDetailsTab;