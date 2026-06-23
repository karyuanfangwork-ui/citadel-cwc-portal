import React from 'react';
import { Link } from 'react-router-dom';
import { StatusPill } from './primitives';
import type { BorrowerProfile, Borrower360Summary } from '../../../services/credit.service';
import { getBorrowerDisplayName } from '../BorrowerSummaryCard';

const ActionBtn: React.FC<{
  icon: string;
  label: string;
  onClick?: () => void;
  primary?: boolean;
}> = ({ icon, label, onClick, primary }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-fc border px-3 py-2 text-sm font-semibold transition-colors ${
      primary
        ? 'border-fc-primary bg-fc-primary text-white hover:opacity-90'
        : 'border-fc-outline bg-white text-fc-primary hover:bg-fc-surface-low'
    }`}
  >
    <span className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
  </button>
);

export const Borrower360Header: React.FC<{
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  canWrite: boolean;
  onEdit: () => void;
  onUploadBureau: () => void;
  onRunKyc: () => void;
  onNewApp: () => void;
}> = ({ profile, summary, canWrite, onEdit, onUploadBureau, onRunKyc, onNewApp }) => {
  const isRetail = profile.borrowerType !== 'CORPORATE';
  const name = getBorrowerDisplayName(profile);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fc-on-variant">
          <Link to="/credit" className="hover:text-fc-primary" style={{ textDecoration: 'none', color: 'inherit' }}>
            Credit
          </Link>
          <span>/</span>
          <Link to="/credit/borrowers" className="hover:text-fc-primary" style={{ textDecoration: 'none', color: 'inherit' }}>
            Borrowers
          </Link>
          <span>/</span>
          <span className="text-fc-primary">{name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-headline-lg text-fc-primary">
            {name}
            {profile.registrationNumber ? <span className="font-normal text-fc-on-variant"> | {profile.registrationNumber}</span> : null}
          </h1>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={isRetail ? 'Retail' : 'Corporate'} tone="info" />
            <StatusPill label={profile.kycVerifiedAt ? 'KYC Verified' : 'KYC Pending'} tone={profile.kycVerifiedAt ? 'pos' : 'warn'} />
            {profile.creditRiskRating ? <StatusPill label={`Risk: ${profile.creditRiskRating}`} tone="neutral" /> : null}
            {summary ? (
              <StatusPill label={summary.bureau.stale ? 'Bureau Stale' : 'Bureau Fresh'} tone={summary.bureau.stale ? 'warn' : 'pos'} />
            ) : null}
          </div>
        </div>
      </div>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <ActionBtn icon="edit" label="Edit" onClick={onEdit} />
          <ActionBtn icon="upload_file" label="Upload Bureau Report" onClick={onUploadBureau} />
          <ActionBtn icon="fingerprint" label="Verify KYC" onClick={onRunKyc} />
          <ActionBtn icon="add_circle" label="Create App" onClick={onNewApp} primary />
        </div>
      ) : null}
    </div>
  );
};

export default Borrower360Header;
