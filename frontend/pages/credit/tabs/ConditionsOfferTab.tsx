import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import ConditionsTab from './sections/ConditionsTab';
import SummaryTab from './sections/SummaryTab';

interface ConditionsOfferTabProps {
  app: CreditApplication;
  facilities: any[];
  onRefresh: () => void;
  onUpdated: (app: CreditApplication) => void;
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

const ConditionsOfferTab: React.FC<ConditionsOfferTabProps> = ({ app, facilities, onRefresh, onUpdated }) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            assignment_turned_in
          </span>
          Conditions &amp; Precedents
        </h3>
        <ConditionsTab />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            summarize
          </span>
          Summary
        </h3>
        <SummaryTab app={app} facilities={facilities} onRefresh={onRefresh} />
      </section>
    </div>
  );
};

export default ConditionsOfferTab;