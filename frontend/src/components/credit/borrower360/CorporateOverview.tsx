import React from 'react';
import { ActivityTimeline, AlertCard, OutlinedCard } from './primitives';
import type { BorrowerProfile, Borrower360Summary, Borrower360Activity } from '../../../services/credit.service';

type CorporateOverviewProps = {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  activity: Borrower360Activity[];
  onAlertAction: (label: string) => void;
};

const MYR = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const fmtMyr = (value: number | string | null | undefined) => {
  if (value == null) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(num) ? MYR.format(num) : '—';
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ACTIVITY_ICON: Record<string, { icon: string; tone: 'pos' | 'warn' | 'neg' | 'info' | 'neutral' | 'default' }> = {
  KYC_VERIFIED: { icon: 'verified_user', tone: 'pos' },
  BUREAU_UPLOADED: { icon: 'description', tone: 'info' },
  SCORE_RECORDED: { icon: 'speed', tone: 'info' },
  INCOME_UPDATED: { icon: 'payments', tone: 'info' },
  APP_CREATED: { icon: 'description', tone: 'neutral' },
};

export const CorporateOverview: React.FC<CorporateOverviewProps> = ({ profile, summary, activity, onAlertAction }) => {
  const businessRows = [
    { label: 'Borrower Type', value: profile.borrowerType?.replace(/_/g, ' ') ?? '—' },
    { label: 'Registration No.', value: profile.registrationNumber ?? '—' },
    { label: 'Industry', value: profile.industry ?? '—' },
    { label: 'Annual Turnover', value: fmtMyr(profile.annualTurnover ?? null) },
    { label: 'Years Trading', value: profile.yearsTrading != null ? String(profile.yearsTrading) : '—' },
    { label: 'Purpose of Account', value: profile.purposeOfAccount ?? '—' },
  ];

  const riskRows = [
    { label: 'Risk Rating', value: profile.creditRiskRating ?? '—' },
    { label: 'AML Tier', value: profile.amlRiskTier ?? '—' },
    { label: 'Sanctioned Entity', value: profile.isSanctionedEntity ? 'Yes' : 'No' },
    { label: 'Exposure Limit', value: fmtMyr(profile.exposureLimit) },
    { label: 'Total Exposure', value: fmtMyr(profile.totalExposure) },
  ];

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OutlinedCard title="Credit Risk">
          <div className="space-y-2">
            {riskRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 border-b border-fc-outline py-2 last:border-0">
                <span className="text-xs text-fc-on-variant">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-fc-primary">{row.value}</span>
              </div>
            ))}
            <div className="pt-2 text-[12px] text-fc-on-variant">
              <span className="font-semibold text-fc-primary">{summary?.facilityCount ?? 0}</span> facilities on bureau record ·{' '}
              <span className="font-semibold text-fc-primary">{summary?.activeApps ?? 0}</span> active applications
            </div>
          </div>
        </OutlinedCard>

        <OutlinedCard title="Business Information">
          <div className="space-y-2">
            {businessRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 border-b border-fc-outline py-2 last:border-0">
                <span className="text-xs text-fc-on-variant">{row.label}</span>
                <span className="text-sm font-semibold text-fc-primary">{row.value}</span>
              </div>
            ))}
            <div className="pt-2 text-[12px] text-fc-on-variant">
              Directors: <span className="font-semibold text-fc-primary">{profile.directors?.length ?? 0}</span> · Shareholders:{' '}
              <span className="font-semibold text-fc-primary">{profile.shareholders?.length ?? 0}</span> · UBOs:{' '}
              <span className="font-semibold text-fc-primary">{profile.beneficialOwners?.length ?? 0}</span>
            </div>
          </div>
        </OutlinedCard>
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

export default CorporateOverview;
