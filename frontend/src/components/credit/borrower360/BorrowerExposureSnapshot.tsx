import React from 'react';
import type { Borrower360Summary, BorrowerProfile } from '../../../services/credit.service';
import { formatMyr } from './borrowerPresentation';
import { OutlinedCard } from './primitives';

export const BorrowerExposureSnapshot: React.FC<{ profile: BorrowerProfile; summary: Borrower360Summary | null; onViewExposure: () => void }> = ({ profile, summary, onViewExposure }) => (
  <OutlinedCard title="Exposure snapshot" action={<button type="button" onClick={onViewExposure} className="text-xs font-bold text-fc-primary underline">View exposure</button>}>
    <dl className="grid grid-cols-2 gap-3">
      <div><dt className="text-xs text-fc-on-variant">Total exposure</dt><dd className="text-sm font-semibold tabular-nums text-fc-primary">{formatMyr(summary?.totalExposure ?? profile.totalExposure)}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Exposure limit</dt><dd className="text-sm font-semibold tabular-nums text-fc-primary">{formatMyr(profile.exposureLimit)}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Active applications</dt><dd className="text-sm font-semibold text-fc-primary">{summary?.activeApps ?? 0}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Facilities</dt><dd className="text-sm font-semibold text-fc-primary">{summary?.facilityCount ?? 0}</dd></div>
    </dl>
  </OutlinedCard>
);
export default BorrowerExposureSnapshot;
