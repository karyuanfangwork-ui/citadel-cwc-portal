import React from 'react';
import type { Borrower360Activity } from '../../../services/credit.service';
import { formatBorrowerDate } from './borrowerPresentation';
import { ActivityTimeline, OutlinedCard } from './primitives';

const ICONS: Record<string, { icon: string; tone: 'pos' | 'warn' | 'neg' | 'info' | 'neutral' }> = {
  KYC_VERIFIED: { icon: 'verified_user', tone: 'pos' }, BUREAU_UPLOADED: { icon: 'description', tone: 'info' }, SCORE_RECORDED: { icon: 'speed', tone: 'info' }, INCOME_UPDATED: { icon: 'payments', tone: 'info' }, APP_CREATED: { icon: 'description', tone: 'neutral' }, ONBOARDED: { icon: 'person_add', tone: 'pos' },
};

export const BorrowerActivityTimeline: React.FC<{ activity: Borrower360Activity[] }> = ({ activity }) => (
  <OutlinedCard title="Recent activity">
    {activity.length === 0 ? <p className="text-sm italic text-fc-on-variant">No activity recorded yet.</p> : <ActivityTimeline events={activity.map((event) => ({ icon: ICONS[event.type]?.icon ?? 'circle', tone: ICONS[event.type]?.tone ?? 'neutral', title: event.title, detail: event.detail ?? event.type, at: formatBorrowerDate(event.createdAt) }))} />}
  </OutlinedCard>
);
export default BorrowerActivityTimeline;
