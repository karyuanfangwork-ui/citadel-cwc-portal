import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import ApprovalsTab from './ApprovalsTab';
import SignoffTab from './SignoffTab';

interface ApprovalsTab360Props {
  app: CreditApplication;
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

const ApprovalsTab360: React.FC<ApprovalsTab360Props> = ({ app, onRefresh, onUpdated }) => {
  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            check_circle
          </span>
          Approvals
        </h3>
        <ApprovalsTab app={app} onRefresh={onRefresh} />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            edit_note
          </span>
          Sign-off
        </h3>
        <SignoffTab application={app} onUpdated={onUpdated} />
      </section>
    </div>
  );
};

export default ApprovalsTab360;