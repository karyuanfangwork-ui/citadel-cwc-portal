import React from 'react';
import type { Borrower360Activity, Borrower360Summary, BorrowerProfile, CreditApplication } from '../../../services/credit.service';
import type { BorrowerNextAction, BorrowerReadiness } from './borrowerReadiness';
import BorrowerReadinessStrip from './BorrowerReadinessStrip';
import BorrowerNextActions from './BorrowerNextActions';
import BorrowerApplicationSummary from './BorrowerApplicationSummary';
import BorrowerRelationshipSnapshot from './BorrowerRelationshipSnapshot';
import BorrowerExposureSnapshot from './BorrowerExposureSnapshot';
import BorrowerActivityTimeline from './BorrowerActivityTimeline';
import RetailOverview from './RetailOverview';
import CorporateOverview from './CorporateOverview';

export interface BorrowerOverviewProps {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  applications: CreditApplication[];
  applicationsAvailable?: boolean;
  readiness: BorrowerReadiness;
  activity: Borrower360Activity[];
  canWrite: boolean;
  onAction: (action: BorrowerNextAction) => void;
  onEditIncome: () => void;
  onViewExposure: () => void;
}

export const BorrowerOverview: React.FC<BorrowerOverviewProps> = ({ profile, summary, applications, applicationsAvailable = true, readiness, activity, canWrite, onAction, onEditIncome, onViewExposure }) => {
  const onAlertAction = (label: string) => {
    if (label === 'Upload Bureau Report') onAction({ id: 'bureau', severity: 'WARNING', title: 'Refresh bureau report', description: 'The bureau report needs attention.', actionLabel: label, target: 'bureau' });
  };
  const isCorporate = profile.borrowerType === 'CORPORATE';

  return (
    <section aria-labelledby="borrower-overview-heading" aria-label="Borrower overview" className="space-y-4">
      <h2 id="borrower-overview-heading" className="sr-only">Borrower overview</h2>
      <BorrowerReadinessStrip readiness={readiness} onAction={onAction} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><BorrowerNextActions actions={readiness.actions} onAction={onAction} />{applicationsAvailable ? <BorrowerApplicationSummary applications={applications} /> : null}</div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><BorrowerRelationshipSnapshot profile={profile} /><BorrowerExposureSnapshot profile={profile} summary={summary} onViewExposure={onViewExposure} /></div>
      <BorrowerActivityTimeline activity={activity} />
      {summary ? (isCorporate ? <CorporateOverview profile={profile} summary={summary} activity={activity} onAlertAction={onAlertAction} includeAlerts={false} includeActivity={false} /> : <RetailOverview profile={profile} summary={summary} activity={activity} onAlertAction={onAlertAction} onEditIncome={onEditIncome} canWrite={canWrite} includeAlerts={false} includeActivity={false} />) : null}
    </section>
  );
};
export default BorrowerOverview;
