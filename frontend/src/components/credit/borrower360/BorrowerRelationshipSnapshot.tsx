import React from 'react';
import type { BorrowerProfile } from '../../../services/credit.service';
import { OutlinedCard } from './primitives';

export const BorrowerRelationshipSnapshot: React.FC<{ profile: BorrowerProfile }> = ({ profile }) => (
  <OutlinedCard title="Relationship snapshot">
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div><dt className="text-xs text-fc-on-variant">Relationship owner</dt><dd className="text-sm font-semibold text-fc-primary">{profile.contact ? `${profile.contact.firstName} ${profile.contact.lastName}` : 'Not assigned'}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Segment</dt><dd className="text-sm font-semibold text-fc-primary">{profile.borrowerType.replace(/_/g, ' ')}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Contact preference</dt><dd className="text-sm font-semibold text-fc-primary">{profile.preferredContactMethod ?? 'Not specified'}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">Industry / occupation</dt><dd className="text-sm font-semibold text-fc-primary">{profile.industry ?? profile.occupation ?? 'Not specified'}</dd></div>
      <div><dt className="text-xs text-fc-on-variant">CRM account</dt><dd className="text-sm font-semibold text-fc-primary">{profile.account?.name ?? 'Not linked'}</dd></div>
    </dl>
  </OutlinedCard>
);
export default BorrowerRelationshipSnapshot;
