import React from 'react';
import { Link } from 'react-router-dom';
import { CreditApplication } from '../../../services/credit.service';
import ApplicationDetailsTab from '../../../../pages/credit/tabs/ApplicationDetailsTab';
import PartiesTab from '../../../../pages/credit/tabs/sections/PartiesTab';
import RetailFacilitiesTab from '../../../../pages/credit/tabs/sections/RetailFacilitiesTab';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';

type LocalTab = 'application' | 'facilities' | 'borrower' | 'related-parties';

export interface ApplicationPartiesWorkspaceProps {
  application: CreditApplication;
  activeTab: string;
  onUpdated: (application: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  advancedMemo?: boolean;
}

const heading = (label: string) => <h2 className="text-lg font-bold text-slate-900 mb-4">{label}</h2>;

const ApplicationPartiesWorkspace: React.FC<ApplicationPartiesWorkspaceProps> = ({
  application,
  activeTab,
  onUpdated,
  onDirtyChange,
  advancedMemo,
}) => {
  const tab = (['application', 'facilities', 'borrower', 'related-parties'] as LocalTab[]).includes(activeTab as LocalTab)
    ? activeTab as LocalTab
    : 'application';
  const borrower = application.borrowerProfile;
  const borrowerType = borrower?.borrowerType;

  if (tab === 'borrower') {
    const hasAdditionalDetails = Boolean(borrower?.registrationNumber || borrower?.nricPassport || borrower?.email || borrower?.phone || borrower?.industry);
    return (
      <section aria-labelledby="borrower-context-heading">
        {heading('Borrower')}
        <div id="borrower-context-heading" className={`rounded-lg border border-slate-200 bg-white p-5 ${hasAdditionalDetails ? 'space-y-3' : 'space-y-2'}`}>
          <div><span className="text-xs font-semibold text-slate-500">Name</span><p className="text-sm font-medium text-slate-900">{getBorrowerDisplayName(borrower) || '—'}</p></div>
          <div className={hasAdditionalDetails ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-x-6'}>
            <div><span className="text-xs font-semibold text-slate-500">Borrower type</span><p className="text-sm text-slate-800">{borrowerType || '—'}</p></div>
            {hasAdditionalDetails && <>
              <div><span className="text-xs font-semibold text-slate-500">Registration / NRIC</span><p className="text-sm text-slate-800">{borrower?.registrationNumber || borrower?.nricPassport || '—'}</p></div>
              <div><span className="text-xs font-semibold text-slate-500">Contact</span><p className="text-sm text-slate-800">{borrower?.email || borrower?.phone || '—'}</p></div>
              <div><span className="text-xs font-semibold text-slate-500">Industry</span><p className="text-sm text-slate-800">{borrower?.industry || '—'}</p></div>
            </>}
          </div>
          {borrower?.id && <Link className="inline-flex text-sm font-semibold text-blue-700 hover:underline" to={`/credit/borrowers/${borrower.id}`}>View Borrower 360</Link>}
        </div>
      </section>
    );
  }

  if (tab === 'related-parties') {
    if (borrowerType === 'INDIVIDUAL' || borrowerType === 'JOINT') {
      return <section>{heading('Related Parties')}<p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Not applicable for this borrower type.</p></section>;
    }
    return <section>{heading('Related Parties')}<PartiesTab app={application} borrowerType={borrowerType} /></section>;
  }

  if (tab === 'facilities') {
    return (
      <section aria-labelledby="facilities-heading">
        {heading('Facilities')}
        <div id="facilities-heading">
          <RetailFacilitiesTab application={application} onDirtyChange={onDirtyChange} />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="application-parties-heading">
      {heading(tab === 'facilities' ? 'Facilities' : 'Application')}
      <div id="application-parties-heading">
        <ApplicationDetailsTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} advancedMemo={advancedMemo} />
      </div>
    </section>
  );
};

export default ApplicationPartiesWorkspace;
