import React from 'react';
import { CreditApplication, CreditApproval, ApplicationSignoff, ApplicationState } from '../../src/services/credit.service';
import { LANE_LABELS, LANE_DESCRIPTIONS, ProcessingLane as ProcessingLaneType, FATCA_CRS_FLAG } from './creditUtils';
import StateBadge from '../../src/components/credit/StateBadge';

// ── Tab components (same ones used by CreditApplicationDetail) ──
import LoanRequestTab from './tabs/LoanRequestTab';
import BorrowerProfileTab from './tabs/BorrowerProfileTab';
import FinancialsTab from './tabs/FinancialsTab';
import CreditChecksTab from './tabs/CreditChecksTab';
import SignoffTab from './tabs/SignoffTab';
import DocumentsTab from './tabs/DocumentsTab';
import ApplicationComments from '../../src/components/credit/ApplicationComments';
import S7ProcessBanner from '../../src/components/credit/S7ProcessBanner';

// ── P2-2: PersonalFastView ──────────────────────────────────────────────────
// Single scrollable page that renders all core sections vertically stacked.
// No sidebar tab navigation — this is the streamlined PERSONAL_FAST lane experience.

interface PersonalFastViewProps {
  app: CreditApplication;
  lane: string;
  laneReason: string | null;
  onUpdated: (updated: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
  setApp: React.Dispatch<React.SetStateAction<CreditApplication | null>>;
  canApprove: boolean;
  isFeatureEnabled: (flag: string) => boolean;
  signoffs: ApplicationSignoff[];
  allSigned: boolean;
  approvals: CreditApproval[];
  onNavigate: (tab: string) => void;
}

interface SectionDef {
  id: string;
  number: number;
  title: string;
}

const PERSONAL_FAST_SECTIONS: SectionDef[] = [
  { id: 'loan-request',    number: 1, title: 'Loan Request' },
  { id: 'borrower-profile', number: 2, title: 'Borrower Profile' },
  { id: 'financials',      number: 3, title: 'Financials' },
  { id: 'credit-checks',   number: 4, title: 'Bureau & Compliance' },
  { id: 'signoff',         number: 5, title: 'Sign-off' },
  { id: 'documents',       number: 6, title: 'Documents' },
  { id: 'comments',        number: 7, title: 'Comments' },
];

const PersonalFastView: React.FC<PersonalFastViewProps> = ({
  app,
  lane,
  laneReason,
  onUpdated,
  onDirtyChange,
  onRefresh,
  setApp,
  canApprove,
  isFeatureEnabled,
  signoffs,
  allSigned,
  approvals,
  onNavigate,
}) => {
  const currentState = (app.state || app.status) as ApplicationState;

  const renderSection = (section: SectionDef): React.ReactNode => {
    switch (section.id) {
      case 'loan-request':
        return <LoanRequestTab application={app} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />;
      case 'borrower-profile':
        return <BorrowerProfileTab application={app} fatcaCrsEnabled={isFeatureEnabled(FATCA_CRS_FLAG)} />;
      case 'financials':
        return <FinancialsTab application={app} />;
      case 'credit-checks':
        return <CreditChecksTab application={app} onUpdated={setApp} />;
      case 'signoff':
        return (
          <>
            <S7ProcessBanner
              app={app}
              signoffs={signoffs}
              allSigned={allSigned}
              approvals={approvals}
              onNavigate={onNavigate as (tab: 'signoff' | 'approvals') => void}
            />
            <SignoffTab application={app} onUpdated={setApp} />
          </>
        );
      case 'documents':
        return <DocumentsTab app={app} canApprove={canApprove} />;
      case 'comments':
        return <ApplicationComments applicationId={app.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Lane banner */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-green-700 text-xl">bolt</span>
        <div>
          <div className="text-sm font-bold text-green-800">
            {LANE_LABELS[lane as ProcessingLaneType] || 'Personal Fast'} — Streamlined Flow
          </div>
          {laneReason && (
            <div className="text-xs text-green-700 mt-0.5">{laneReason}</div>
          )}
          <div className="text-xs text-green-600 mt-0.5">
            {LANE_DESCRIPTIONS[lane as ProcessingLaneType]}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StateBadge state={currentState} size="md" />
        </div>
      </div>

      {/* All sections stacked vertically */}
      {PERSONAL_FAST_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`pf-section-${section.id}`}
          className="bg-white border border-border rounded-xl shadow-sm overflow-hidden"
        >
          <div className="border-b border-border bg-gray-50 px-6 py-3 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold">
              {section.number}
            </span>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              {section.title}
            </h3>
          </div>
          <div className="p-6">
            {renderSection(section)}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PersonalFastView;