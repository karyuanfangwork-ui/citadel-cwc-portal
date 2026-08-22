import React from 'react';
import { CreditApplication, CreditFacility } from '../../../services/credit.service';
import ApprovalsTab from '../../../../pages/credit/tabs/sections/ApprovalsTab';
import SignoffTab from '../../../../pages/credit/tabs/SignoffTab';
import ApprovalMatrixApplicabilityPanel from '../ApprovalMatrixApplicabilityPanel';
import ConditionsOfferTab from '../../../../pages/credit/tabs/ConditionsOfferTab';
import DisbursementTab from '../../../../pages/credit/tabs/DisbursementTab';
import TimelineAuditTab from '../../../../pages/credit/tabs/TimelineAuditTab';

type DecisionCompletionWorkspaceProps = {
  application: CreditApplication;
  facilities: CreditFacility[];
  activeTab: 'approvals' | 'decision-history' | 'conditions-offer' | 'completion';
  onRefresh: () => void;
  onUpdated: (application: CreditApplication) => void;
};

const headingStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
};

const formatMoney = (value: number | string | null | undefined, currency = 'MYR'): string => {
  if (value == null) return '—';
  return `${currency === 'MYR' ? 'RM' : currency} ${Number(value).toLocaleString()}`;
};

const ApprovedTermsSummary: React.FC<{ application: CreditApplication; facilities: CreditFacility[] }> = ({ application, facilities }) => {
  const approvedFacilities = facilities.filter(facility => facility.approvedAmount != null || facility.approvedTenor != null || facility.approvedRate != null);
  if (approvedFacilities.length === 0) return null;
  return <section aria-labelledby="approved-terms-heading" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <h3 id="approved-terms-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-800">Approved Terms</h3>
    <div className="space-y-3">
      {approvedFacilities.map(facility => <dl key={facility.id} className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-xs text-emerald-700">Amount</dt><dd className="text-sm font-semibold text-emerald-900">{formatMoney(facility.approvedAmount, application.currency)}</dd></div>
        <div><dt className="text-xs text-emerald-700">Tenure</dt><dd className="text-sm font-semibold text-emerald-900">{facility.approvedTenor == null ? '—' : `${facility.approvedTenor} months`}</dd></div>
        <div><dt className="text-xs text-emerald-700">Facility</dt><dd className="text-sm font-semibold text-emerald-900">{facility.facilityType.replaceAll('_', ' ')}</dd></div>
      </dl>)}
    </div>
  </section>;
};

const DecisionCompletionWorkspace: React.FC<DecisionCompletionWorkspaceProps> = ({
  application, facilities, activeTab, onRefresh, onUpdated,
}) => {
  if (activeTab === 'decision-history') return <section aria-labelledby="decision-history-heading">
    <h2 id="decision-history-heading" style={headingStyle} className="text-base font-bold text-slate-900">Decision &amp; History</h2>
    <TimelineAuditTab applicationId={application.id} />
  </section>;

  if (activeTab === 'conditions-offer') return <section aria-labelledby="conditions-offer-heading">
    <h2 id="conditions-offer-heading" style={headingStyle} className="text-base font-bold text-slate-900">Conditions &amp; Offer</h2>
    <ConditionsOfferTab app={application} facilities={facilities} onRefresh={onRefresh} onUpdated={onUpdated} />
  </section>;

  if (activeTab === 'completion') return <section aria-labelledby="completion-heading">
    <h2 id="completion-heading" style={headingStyle} className="text-base font-bold text-slate-900">Completion &amp; Disbursement Handoff</h2>
    <DisbursementTab application={application} onUpdated={onUpdated} />
  </section>;

  return <div className="space-y-8">
    <section aria-labelledby="approval-chain-heading">
      <h2 id="approval-chain-heading" style={headingStyle} className="text-base font-bold text-slate-900">Approval Chain</h2>
      <ApprovedTermsSummary application={application} facilities={facilities} />
      <ApprovalMatrixApplicabilityPanel applicationId={application.id} />
      <ApprovalsTab app={application} onRefresh={onRefresh} />
    </section>
    <section aria-labelledby="management-signoff-heading">
      <h2 id="management-signoff-heading" style={headingStyle} className="text-base font-bold text-slate-900">Management Sign-off</h2>
      <SignoffTab application={application} onUpdated={onUpdated} />
    </section>
  </div>;
};

export type { DecisionCompletionWorkspaceProps };
export default DecisionCompletionWorkspace;
