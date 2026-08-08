import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import ApprovalsTab from './sections/ApprovalsTab';
import SignoffTab from './SignoffTab';
import ApprovalMatrixApplicabilityPanel from '../../../src/components/credit/ApprovalMatrixApplicabilityPanel';
import RecommendationSection from '../../../src/components/credit/RecommendationSection';
import { useAuth } from '../../../src/context/AuthContext';

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
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  return (
    <div className="space-y-8">
      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            recommend
          </span>
          Recommendation
        </h3>
        <RecommendationSection
          applicationId={app.id}
          applicationState={app.state}
          currentUserId={currentUserId}
          onChanged={onRefresh}
        />
      </section>

      <section>
        <h3 style={sectionHeaderStyle}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            rule
          </span>
          Approval Matrix
        </h3>
        <ApprovalMatrixApplicabilityPanel applicationId={app.id} />
      </section>

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