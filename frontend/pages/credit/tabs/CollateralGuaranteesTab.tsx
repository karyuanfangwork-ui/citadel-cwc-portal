import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import CollateralTab from './sections/CollateralTab';
import SecurityGuaranteesTab from './sections/SecurityGuaranteesTab';
import GuarantorFinancialAssessmentTab from './sections/GuarantorFinancialAssessmentTab';

interface CollateralGuaranteesTabProps {
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

const CollateralGuaranteesTab: React.FC<CollateralGuaranteesTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
}) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            shield
          </span>
          Collateral
        </h3>
        <CollateralTab />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            verified_user
          </span>
          Security &amp; Guarantees
        </h3>
        <SecurityGuaranteesTab application={application} onUpdated={onUpdated} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            person_check
          </span>
          Guarantor Financial Assessment
        </h3>
        <GuarantorFinancialAssessmentTab
          application={application}
          onUpdated={onUpdated}
          onDirtyChange={onDirtyChange}
        />
      </section>
    </div>
  );
};

export default CollateralGuaranteesTab;