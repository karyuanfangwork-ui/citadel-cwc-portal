import React from 'react';
import { Link } from 'react-router-dom';
import type { Borrower360Summary, BorrowerProfile } from '../../../services/credit.service';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';
import { formatBorrowerType, formatMalaysianNric } from './borrowerPresentation';
import { StatusPill } from './primitives';

export interface BorrowerWorkspaceHeaderProps {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  primaryAction: { label: string; applicationId: string | null };
  applicationsAvailable?: boolean;
  canWrite: boolean;
  canCreate: boolean;
  applicationReady?: boolean;
  onPrimaryAction: () => void;
  onEdit: () => void;
  onRecalculateRisk: () => void;
}

const ActionButton: React.FC<{ label: string; icon: string; onClick: () => void; primary?: boolean }> = ({ label, icon, onClick, primary }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-1.5 rounded-fc border px-3 py-2 text-sm font-semibold transition-colors ${primary ? 'border-fc-primary bg-fc-primary text-white hover:opacity-90' : 'border-fc-outline bg-white text-fc-primary hover:bg-fc-surface-low'}`}
  >
    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
  </button>
);

const BorrowerWorkspaceHeader: React.FC<BorrowerWorkspaceHeaderProps> = ({
  profile, summary, primaryAction, applicationsAvailable = true, applicationReady = true, canWrite, canCreate, onPrimaryAction, onEdit, onRecalculateRisk,
}) => {
  const name = getBorrowerDisplayName(profile);
  const risk = profile.creditRiskRating || summary?.riskRating?.effective;

  return (
    <header className="space-y-4" aria-labelledby="borrower-workspace-heading">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fc-on-variant">
        <Link to="/credit" className="hover:text-fc-primary">Credit</Link><span aria-hidden="true">/</span>
        <Link to="/credit/borrowers" className="hover:text-fc-primary">Borrowers</Link><span aria-hidden="true">/</span>
        <span className="text-fc-primary">{name}</span>
      </nav>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 id="borrower-workspace-heading" className="font-display text-headline-lg text-fc-primary">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-fc-on-variant">
            <span>{profile.registrationNumber || (profile.nricPassport ? formatMalaysianNric(profile.nricPassport) : 'Identity reference unavailable')}</span>
            <span aria-hidden="true">•</span><span>{formatBorrowerType(profile.borrowerType)}</span>
            {profile.account?.name ? <><span aria-hidden="true">•</span><span>{profile.account.name}</span></> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={profile.kycVerifiedAt ? 'KYC verified' : 'KYC pending'} tone={profile.kycVerifiedAt ? 'pos' : 'warn'} />
            <StatusPill label={risk ? `Risk: ${risk}` : 'Risk pending'} tone={risk ? 'neutral' : 'warn'} />
            {summary ? <StatusPill label={summary.bureau.stale ? 'Bureau stale' : 'Bureau fresh'} tone={summary.bureau.stale ? 'warn' : 'pos'} /> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Borrower actions">
          {applicationsAvailable && (primaryAction.label !== 'Start application' || (canCreate && applicationReady)) ? <ActionButton label={primaryAction.label} icon="arrow_forward" onClick={onPrimaryAction} primary /> : null}
          {canWrite ? <>
            <ActionButton label="Edit borrower" icon="edit" onClick={onEdit} />
            <ActionButton label="Recalculate risk" icon="calculate" onClick={onRecalculateRisk} />
          </> : null}
        </div>
      </div>
    </header>
  );
};

export default BorrowerWorkspaceHeader;
export { BorrowerWorkspaceHeader };
