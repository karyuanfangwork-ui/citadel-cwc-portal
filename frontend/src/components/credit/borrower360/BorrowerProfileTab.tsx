import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BorrowerProfile } from '../../../services/credit.service';
import { piiRevealApi } from '../../../services/credit.service';
import { OutlinedCard, StatusPill } from './primitives';
import { formatMalaysianNric } from './borrowerPresentation';

interface BorrowerProfileTabProps {
  profile: BorrowerProfile;
  canWrite: boolean;
  onEdit: () => void;
  onEditIncome: () => void;
  onOpenRisk: () => void;
}

const formatCurrency = (value: number | string | null | undefined) => {
  if (value == null || value === '') return 'Not specified';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(amount)
    : 'Not specified';
};

const formatDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'Not specified';

const display = (value: string | null | undefined) => value || 'Not specified';

const ProfileField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-fc-on-variant">{label}</dt>
    <dd className="mt-0.5 text-sm font-semibold text-fc-primary">{value}</dd>
  </div>
);

const NricReveal: React.FC<{ borrowerId: string; value: string }> = ({ borrowerId, value }) => {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    setLoading(true);
    try {
      setRevealed(await piiRevealApi.borrowerContactNric(borrowerId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span>
      {revealed ?? value}
      {!revealed ? <button type="button" onClick={reveal} disabled={loading} className="ml-2 text-xs font-bold text-fc-primary underline">{loading ? 'Loading…' : 'Reveal'}</button> : null}
    </span>
  );
};

const BorrowerProfileTab: React.FC<BorrowerProfileTabProps> = ({ profile, canWrite, onEdit, onEditIncome, onOpenRisk }) => {
  const isIndividual = profile.borrowerType === 'INDIVIDUAL' || profile.borrowerType === 'JOINT';
  const isBusiness = profile.borrowerType === 'CORPORATE' || profile.borrowerType === 'SOLE_PROPRIETOR';

  return (
    <section aria-labelledby="borrower-profile-tab-heading" className="space-y-4">
      <div className="flex flex-col gap-3 rounded-fc border border-fc-outline bg-fc-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="borrower-profile-tab-heading" className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Profile information</h2>
          <p className="mt-1 text-xs text-fc-on-variant">Identity and KYC profile data. Underwriting income and DSR are maintained separately in the income workflow.</p>
        </div>
        {canWrite ? <button type="button" onClick={onEdit} className="rounded-fc border border-fc-primary px-3 py-2 text-xs font-bold text-fc-primary hover:bg-fc-surface-low">Edit profile</button> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OutlinedCard title="Identity & contact">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Borrower type" value={display(profile.borrowerType).replace(/_/g, ' ')} />
            <ProfileField label="Name" value={display(profile.name)} />
            {isIndividual ? <ProfileField label="NRIC / Passport" value={profile.nricPassport ? <NricReveal borrowerId={profile.id} value={formatMalaysianNric(profile.nricPassport)} /> : 'Not specified'} /> : null}
            {isIndividual ? <ProfileField label="Nationality" value={display(profile.nationality)} /> : null}
            {isBusiness ? <ProfileField label="Registration number" value={display(profile.registrationNumber)} /> : null}
            <ProfileField label="Date of birth" value={formatDate(profile.dateOfBirth)} />
            {isBusiness ? <ProfileField label="Date of incorporation" value={formatDate(profile.dateOfIncorporation)} /> : null}
            <ProfileField label="Phone" value={display(profile.phone)} />
            <ProfileField label="Email" value={display(profile.email)} />
            <ProfileField label="Preferred contact" value={display(profile.preferredContactMethod)} />
            <ProfileField label="Address" value={display(profile.address)} />
            <ProfileField label="Mailing address" value={display(profile.mailingAddress)} />
          </dl>
        </OutlinedCard>

        <OutlinedCard title="KYC & compliance" action={<button type="button" onClick={onOpenRisk} className="text-xs font-bold text-fc-primary underline">Open risk & compliance</button>}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Risk rating" value={profile.creditRiskRating ? <StatusPill label={profile.creditRiskRating} tone="neutral" /> : 'Not calculated'} />
            <ProfileField label="AML tier" value={profile.amlRiskTier ? <StatusPill label={profile.amlRiskTier} tone={profile.amlRiskTier === 'LOW' ? 'pos' : 'warn'} /> : 'Not assessed'} />
            <ProfileField label="Sanctioned entity" value={profile.isSanctionedEntity ? <StatusPill label="Yes" tone="neg" /> : <StatusPill label="No" tone="pos" />} />
            <ProfileField label="Exposure limit" value={formatCurrency(profile.exposureLimit)} />
            <ProfileField label="Total exposure" value={formatCurrency(profile.totalExposure)} />
            <ProfileField label="KYC status" value={profile.kycVerifiedAt ? <StatusPill label="Verified" tone="pos" /> : <StatusPill label="Pending" tone="warn" />} />
          </dl>
          <p className="mt-4 text-xs text-fc-on-variant">Risk rating and AML values are controlled by their dedicated workflows and are read-only here.</p>
        </OutlinedCard>

        <OutlinedCard title="Profile financial information" action={canWrite ? <button type="button" onClick={onEditIncome} className="text-xs font-bold text-fc-primary underline">Edit income & DSR</button> : null}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Occupation" value={display(profile.occupation)} />
            <ProfileField label="Employer" value={display(profile.employer)} />
            <ProfileField label="Annual income" value={formatCurrency(profile.annualIncome)} />
            <ProfileField label="Net worth" value={formatCurrency(profile.netWorth)} />
            <ProfileField label="Source of wealth" value={display(profile.sourceOfWealth)} />
            <ProfileField label="Purpose of account" value={display(profile.purposeOfAccount)} />
          </dl>
          <p className="mt-4 text-xs text-fc-on-variant">Annual income is profile information. Monthly income, deductions, commitments, and DSR are maintained in Edit income & DSR.</p>
        </OutlinedCard>

        <OutlinedCard title="Additional details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isIndividual ? <>
              <ProfileField label="Preferred name" value={display(profile.preferredName)} />
              <ProfileField label="Marital status" value={display(profile.maritalStatus)} />
              <ProfileField label="Education level" value={display(profile.educationLevel)} />
              <ProfileField label="Tax ID number" value={display(profile.taxNumber)} />
            </> : <>
              <ProfileField label="Business type" value={display(profile.businessType)} />
              <ProfileField label="Industry" value={display(profile.industry)} />
              <ProfileField label="Business nature" value={display(profile.businessNature)} />
              <ProfileField label="Authorized representative" value={display(profile.authorizedRepresentative)} />
              <ProfileField label="Tax number" value={display(profile.taxNumber)} />
            </>}
          </dl>
        </OutlinedCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OutlinedCard title="CRM relationship">
          {profile.account ? (
            <Link to={`/crm/accounts/${profile.account.id}`} className="flex items-center gap-3 rounded-fc border border-fc-outline bg-fc-surface-low p-3 no-underline hover:border-fc-primary">
              <span aria-hidden="true" className="material-symbols-outlined text-fc-secondary">business</span>
              <span className="text-sm font-bold text-fc-primary">{profile.account.name}</span>
            </Link>
          ) : (
            <p className="text-sm text-fc-on-variant">No CRM account linked. CRM linking is not available from this profile view.</p>
          )}
          {profile.contact ? <p className="mt-3 text-xs text-fc-on-variant">Linked contact: <span className="font-semibold text-fc-primary">{`${profile.contact.firstName} ${profile.contact.lastName}`.trim()}</span></p> : null}
        </OutlinedCard>

        <OutlinedCard title="Record information">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ProfileField label="Created" value={formatDate(profile.createdAt)} />
            <ProfileField label="Updated" value={formatDate(profile.updatedAt)} />
            <ProfileField label="Status" value={<StatusPill label={profile.isActive ? 'Active' : 'Inactive'} tone={profile.isActive ? 'pos' : 'neg'} />} />
          </dl>
        </OutlinedCard>
      </div>
    </section>
  );
};

export default BorrowerProfileTab;
export { BorrowerProfileTab };
