import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import BorrowerProfileTab from './BorrowerProfileTab';
import PartiesTab from './PartiesTab';

interface CustomerProfileTabProps {
  application: CreditApplication;
  fatcaCrsEnabled: boolean;
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

const CustomerProfileTab: React.FC<CustomerProfileTabProps> = ({ application, fatcaCrsEnabled }) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            person
          </span>
          Borrower Profile
        </h3>
        <BorrowerProfileTab application={application} fatcaCrsEnabled={fatcaCrsEnabled} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            groups
          </span>
          Parties &amp; Guarantors
        </h3>
        <PartiesTab app={application} borrowerType={application?.borrowerProfile?.borrowerType} />
      </section>
    </div>
  );
};

export default CustomerProfileTab;