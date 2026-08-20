import React from 'react';
import { Link } from 'react-router-dom';
import type { CreditApplication } from '../../../services/credit.service';
import { formatApplicationState, formatBorrowerDate, formatMyr, formatProductType, getApplicationStateTone } from './borrowerPresentation';
import { StatusPill } from './primitives';

export const BorrowerApplicationSummary: React.FC<{
  applications: CreditApplication[];
  onStartApplication?: () => void;
}> = ({ applications, onStartApplication }) => (
  <section aria-labelledby="borrower-applications-heading" className="rounded-fc border border-fc-outline bg-fc-surface p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 id="borrower-applications-heading" className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Applications</h2><span className="text-xs text-fc-on-variant">{applications.length} total</span></div>
    {applications.length === 0 ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-fc-on-variant">No applications yet.</p>{onStartApplication ? <button type="button" onClick={onStartApplication} className="rounded-fc border border-fc-primary px-3 py-2 text-xs font-semibold text-fc-primary">Start application</button> : null}</div> : <ul className="space-y-3">
      {applications.map((application) => <li key={application.id} className="rounded-fc border border-fc-outline p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><Link to={`/credit/applications/${application.id}`} className="font-semibold text-fc-primary underline">{application.applicationNo}</Link><p className="text-xs text-fc-on-variant">{formatProductType(application.productType)}</p></div><StatusPill label={formatApplicationState(application.state)} tone={getApplicationStateTone(application.state)} /></div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fc-on-variant"><span>{formatMyr(application.requestedAmount)}</span><span>Updated {formatBorrowerDate(application.updatedAt)}</span></div>
      </li>)}
    </ul>}
  </section>
);
export default BorrowerApplicationSummary;
