import React from 'react';
import { AlertCard, ActivityTimeline, MiniBar, OutlinedCard } from './primitives';
import type { BorrowerProfile, Borrower360Summary, Borrower360Activity } from '../../../services/credit.service';

type RetailOverviewProps = {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  activity: Borrower360Activity[];
  onAlertAction: (label: string) => void;
  onEditIncome?: () => void;
  canWrite?: boolean;
};

const MYR = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const fmtMyr = (value: number | null | undefined) => (value == null ? '—' : MYR.format(value));
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ACTIVITY_ICON: Record<string, { icon: string; tone: 'pos' | 'warn' | 'neg' | 'info' | 'neutral' | 'default' }> = {
  KYC_VERIFIED: { icon: 'verified_user', tone: 'pos' },
  BUREAU_UPLOADED: { icon: 'description', tone: 'info' },
  SCORE_RECORDED: { icon: 'speed', tone: 'info' },
  INCOME_UPDATED: { icon: 'payments', tone: 'info' },
  APP_CREATED: { icon: 'description', tone: 'neutral' },
  ONBOARDED: { icon: 'person_add', tone: 'pos' },
};

export const RetailOverview: React.FC<RetailOverviewProps> = ({ profile, summary, activity, onAlertAction, onEditIncome, canWrite }) => {
  const income = summary?.income;
  const gross = income?.gross ?? 0;
  const commitments = income?.commitments ?? 0;
  const netIncome = income?.netIncome ?? (gross - commitments);
  const max = Math.max(gross, commitments, netIncome, Number(profile.exposureLimit ?? 0), Number(profile.totalExposure ?? 0), 1);

  return (
    <div className="space-y-4">
      {(summary?.alerts ?? []).length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {summary!.alerts.map((alert) => (
            <AlertCard
              key={`${alert.title}-${alert.body}`}
              tone={alert.tone}
              icon={alert.icon}
              title={alert.title}
              body={alert.body}
              actionLabel={alert.actionLabel}
              onAction={() => alert.actionLabel && onAlertAction(alert.actionLabel)}
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-4">
          <OutlinedCard
            title="Income vs Commitment"
            action={
              canWrite && onEditIncome ? (
                <button type="button" onClick={onEditIncome} className="rounded-full border border-fc-outline px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-fc-primary hover:bg-fc-surface-low">
                  Edit Income
                </button>
              ) : null
            }
          >
            {income ? (
              <div className="space-y-4">
                <MiniBar label="Monthly Gross Income" value={gross} max={max} display={fmtMyr(gross)} tone="pos" />
                <MiniBar label="Debt Obligations" value={commitments} max={max} display={fmtMyr(commitments)} tone="neg" />
                <MiniBar label="Disposable Income" value={Math.max(netIncome, 0)} max={max} display={fmtMyr(netIncome)} tone="pos" />
                <div className="grid grid-cols-1 gap-2 text-[12px] text-fc-on-variant">
                  <p>Gross income: <span className="font-semibold text-fc-primary tabular-nums">{fmtMyr(gross)}</span></p>
                  <p>Commitments: <span className="font-semibold text-fc-primary tabular-nums">{fmtMyr(commitments)}</span></p>
                  <p>Net income: <span className="font-semibold text-fc-primary tabular-nums">{fmtMyr(netIncome)}</span></p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] italic text-fc-on-variant">No income recorded yet. Use Edit to add income & commitments.</p>
            )}
          </OutlinedCard>
        </div>

        <div className="col-span-12 xl:col-span-8">
          <OutlinedCard title="Debt Breakdown (CCRIS Style)">
            {(summary?.bureauFacilities ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-fc-surface-low text-[10px] uppercase tracking-wide text-fc-on-variant">
                      <th className="px-3 py-2">Facility</th>
                      <th className="px-3 py-2">Lender</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-right">Installment</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary!.bureauFacilities.map((facility) => (
                      <tr key={facility.id} className="border-b border-fc-outline last:border-0">
                        <td className="px-3 py-2 font-semibold text-fc-primary">{facility.facilityType}</td>
                        <td className="px-3 py-2 text-fc-on-variant">{facility.lender ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMyr(facility.balance != null ? Number(facility.balance) : null)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMyr(facility.installment != null ? Number(facility.installment) : null)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                            {facility.conductStatus ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-4 text-[12px] italic text-fc-on-variant">
                No bureau report on file. Upload a CTOS / CCRIS report to populate conduct data.
              </p>
            )}
          </OutlinedCard>
        </div>
      </div>

      <OutlinedCard title="Recent Activity">
        {activity.length > 0 ? (
          <ActivityTimeline
            events={activity.map((event) => ({
              icon: ACTIVITY_ICON[event.type]?.icon ?? 'circle',
              tone: ACTIVITY_ICON[event.type]?.tone ?? 'neutral',
              title: event.title,
              detail: event.detail ?? event.type,
              at: formatDate(event.createdAt),
            }))}
          />
        ) : (
          <p className="text-[12px] italic text-fc-on-variant">No activity recorded yet.</p>
        )}
      </OutlinedCard>
    </div>
  );
};

export default RetailOverview;
