import React from 'react';
import { CreditApplication } from '../../../services/credit.service';
import { useAuth } from '../../../context/AuthContext';
import QualitativeAssessmentTab from '../../../../pages/credit/tabs/sections/QualitativeAssessmentTab';
import IndustryOutlookTab from '../../../../pages/credit/tabs/sections/IndustryOutlookTab';
import RecommendationSection from '../RecommendationSection';
import CaMemoPreviewTab from '../../../../pages/credit/tabs/CaMemoPreviewTab';

type AssessmentRecommendationWorkspaceProps = {
  application: CreditApplication;
  activeTab: 'assessment' | 'deviations-mitigants' | 'recommendation' | 'ca-memo';
  lane?: string | null;
  isFeatureEnabled: (flag: string) => boolean;
  onUpdated: (application: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
};

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
};

const ASSESSMENT_EDITABLE_STATES = new Set(['DRAFT', 'UNDERWRITING', 'CREDIT_ASSESSMENT', 'REFERRED_BACK']);

const isAssessmentEditable = (state: string): boolean => ASSESSMENT_EDITABLE_STATES.has(state);

const formatMoney = (value: number | string | null | undefined, currency = 'MYR'): string => {
  if (value == null) return '—';
  return `${currency === 'MYR' ? 'RM' : currency} ${Number(value).toLocaleString()}`;
};

const RequestedTermsSummary: React.FC<{ application: CreditApplication }> = ({ application }) => (
  <section aria-labelledby="requested-terms-heading" className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 id="requested-terms-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Requested Terms</h3>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div><dt className="text-xs text-slate-500">Amount</dt><dd className="text-sm font-semibold text-slate-800">{formatMoney(application.requestedAmount, application.currency)}</dd></div>
      <div><dt className="text-xs text-slate-500">Tenure</dt><dd className="text-sm font-semibold text-slate-800">{application.requestedTenor == null ? '—' : `${application.requestedTenor} months`}</dd></div>
      <div><dt className="text-xs text-slate-500">Facility</dt><dd className="text-sm font-semibold text-slate-800">{application.productType.replaceAll('_', ' ')}</dd></div>
    </dl>
  </section>
);

const ReadOnlyEvidence: React.FC<{ application: CreditApplication }> = ({ application }) => (
  <section aria-labelledby="assessment-evidence-heading" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 id="assessment-evidence-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Assessment Evidence</h3>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs text-slate-500">Current risk rating</dt><dd className="text-sm font-semibold text-slate-800">{application.riskRating || '—'}</dd></div>
      <div><dt className="text-xs text-slate-500">Latest score</dt><dd className="text-sm font-semibold text-slate-800">{application.totalScore ?? '—'}</dd></div>
      <div><dt className="text-xs text-slate-500">DSCR</dt><dd className="text-sm font-semibold text-slate-800">{application.dscr ?? '—'}</dd></div>
      <div><dt className="text-xs text-slate-500">Score source</dt><dd className="text-sm font-semibold text-slate-800">{application.calculationSource || '—'}</dd></div>
    </dl>
    {application.missingInputs && application.missingInputs.length > 0 && (
      <p className="mt-3 text-xs text-amber-700">Some score inputs remain unavailable; resolve them in Risk &amp; Compliance.</p>
    )}
  </section>
);

const DeviationsSummary: React.FC<{ application: CreditApplication }> = ({ application }) => (
  <section aria-labelledby="deviations-heading" className="rounded-xl border border-slate-200 p-5">
    <h3 id="deviations-heading" style={sectionStyle} className="text-sm font-bold text-slate-800">Deviations &amp; Mitigants</h3>
    <p className="text-sm text-slate-600">
      Existing deviation and override evidence is shown read-only here. No second deviation record or calculation is created by this workspace.
    </p>
    {application.isOverride || (application.bureauCapsApplied?.length ?? 0) > 0 ? (
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {application.isOverride && <li>Risk rating override is present.</li>}
        {application.bureauCapsApplied?.map(cap => <li key={cap}>{cap}</li>)}
      </ul>
    ) : <p className="mt-4 text-sm text-slate-500">No recorded deviations or mitigants.</p>}
  </section>
);

const AssessmentRecommendationWorkspace: React.FC<AssessmentRecommendationWorkspaceProps> = ({
  application, activeTab, isFeatureEnabled, onUpdated, onDirtyChange, onRefresh,
}) => {
  const { user } = useAuth();
  if (activeTab === 'recommendation') {
    return <section aria-labelledby="recommendation-workspace-heading">
      <h2 id="recommendation-workspace-heading" style={sectionStyle} className="text-base font-bold text-slate-900">Analyst Recommendation</h2>
      <RequestedTermsSummary application={application} />
      <RecommendationSection applicationId={application.id} applicationState={application.state} currentUserId={user?.id ?? ''} onChanged={onRefresh} />
    </section>;
  }

  if (activeTab === 'ca-memo') {
    return <section aria-labelledby="ca-memo-workspace-heading">
      <h2 id="ca-memo-workspace-heading" style={sectionStyle} className="text-base font-bold text-slate-900">CA Memo Preview</h2>
      <CaMemoPreviewTab applicationId={application.id} applicationNo={application.applicationNo} />
    </section>;
  }

  if (activeTab === 'deviations-mitigants') return <DeviationsSummary application={application} />;

  return <div className="space-y-8">
    {(() => {
      const editable = isAssessmentEditable(application.state);
      return <section aria-labelledby="analyst-assessment-heading">
        <h2 id="analyst-assessment-heading" style={sectionStyle} className="text-base font-bold text-slate-900">Analyst Assessment</h2>
        <QualitativeAssessmentTab applicationId={application.id} readOnly={!editable} />
        <IndustryOutlookTab application={application} readOnly={!editable} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </section>;
    })()}
    <ReadOnlyEvidence application={application} />
    {isFeatureEnabled('credit:advanced_memo') && <p className="text-xs text-slate-500">Advanced assessment evidence is available in Risk &amp; Compliance.</p>}
  </div>;
};

export type { AssessmentRecommendationWorkspaceProps };
export default AssessmentRecommendationWorkspace;
