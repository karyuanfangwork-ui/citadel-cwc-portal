import React from 'react';
import { Link } from 'react-router-dom';
import type { BorrowerExposurePresentation, ExposurePresentationStatus } from '../../../services/credit.service';
import { formatBorrowerDate, formatMyr, formatBorrowerType } from './borrowerPresentation';
import { KpiCell, OutlinedCard, StatusPill } from './primitives';

const FACILITY_TYPE_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', OVERDRAFT: 'Overdraft',
  LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee', TRADE_FINANCE: 'Trade Finance',
  BRIDGE_LOAN: 'Bridge Loan', PROJECT_FINANCE: 'Project Finance',
};

function formatOriginalCurrency(value: number | null, currency: string): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

const STATUS_COPY: Record<ExposurePresentationStatus, { label: string; tone: 'pos' | 'warn' | 'neg' | 'neutral'; body: string }> = {
  NO_EXPOSURE: { label: 'No current exposure', tone: 'neutral', body: 'No qualifying facilities currently contribute to borrower exposure.' },
  WITHIN_LIMIT: { label: 'Within limit', tone: 'pos', body: 'Current exposure is below the configured warning threshold.' },
  APPROACHING_LIMIT: { label: 'Approaching limit', tone: 'warn', body: 'Current exposure has reached the configured warning threshold.' },
  LIMIT_BREACHED: { label: 'Limit breached', tone: 'neg', body: 'Current exposure exceeds the configured borrower limit.' },
  LIMIT_NOT_CONFIGURED: { label: 'Limit not configured', tone: 'neutral', body: 'Exposure is available, but no borrower exposure limit is configured.' },
};

const ExposureFacilitiesTab: React.FC<{ data: BorrowerExposurePresentation; onRetry?: () => void }> = ({ data, onRetry }) => {
  const status = STATUS_COPY[data.summary.status];
  return (
    <section role="tabpanel" aria-label="Exposure & Facilities" data-testid="exposure-facilities-tab" className="space-y-4">
      <div data-testid="exposure-summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCell label="Current exposure" value={formatMyr(data.summary.currentExposure)} />
        <KpiCell label="Exposure limit" value={data.summary.exposureLimit == null ? 'Not configured' : formatMyr(data.summary.exposureLimit)} />
        <KpiCell label="Available headroom" value={data.summary.availableHeadroom == null ? '—' : formatMyr(data.summary.availableHeadroom)} />
        <KpiCell label="Utilization" value={data.summary.utilizationPct == null ? '—' : `${data.summary.utilizationPct.toFixed(1)}%`} />
        <KpiCell label="Base currency" value={data.baseCurrency} sub="as calculated" />
      </div>

      <OutlinedCard title="Exposure status">
        <div data-testid="exposure-status" className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusPill label={status.label} tone={status.tone} />
            <p className="mt-2 text-sm text-fc-on-variant">{status.body}</p>
          </div>
          <div className="text-right text-xs text-fc-on-variant">
            <p>Calculated {formatBorrowerDate(data.calculatedAt)}</p>
            <p>States: {data.includedStates.join(', ')}</p>
          </div>
        </div>
      </OutlinedCard>

      <OutlinedCard title="Current facilities">
        {data.facilities.length === 0 ? (
          <div data-testid="exposure-empty" className="py-4 text-center text-sm text-fc-on-variant">
            <p className="font-semibold">No active facilities</p>
            <p className="mt-1">Create or progress a credit application to see qualifying facilities here.</p>
          </div>
        ) : (
          <div data-testid="exposure-facilities" className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <caption className="sr-only">Facilities contributing to current borrower exposure</caption>
              <thead className="border-b border-fc-outline text-[10px] uppercase tracking-wide text-fc-on-variant">
                <tr><th className="px-2 py-2">Application</th><th className="px-2 py-2">Facility</th><th className="px-2 py-2">State</th><th className="px-2 py-2 text-right">Approved</th><th className="px-2 py-2 text-right">Facility amount</th><th className="px-2 py-2 text-right">MYR equivalent</th><th className="px-2 py-2">Currency</th></tr>
              </thead>
              <tbody>
                {data.facilities.map((facility, index) => (
                  <tr key={`${facility.applicationId}-${facility.facilityType}-${index}`} className="border-b border-fc-outline last:border-0">
                    <td className="px-2 py-3 font-semibold"><Link to={`/credit/applications/${facility.applicationId}`} className="text-fc-primary underline">{facility.applicationNumber ?? facility.applicationId}</Link></td>
                    <td className="px-2 py-3">{FACILITY_TYPE_LABELS[facility.facilityType] ?? formatBorrowerType(facility.facilityType)}</td>
                    <td className="px-2 py-3">{facility.applicationState}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatOriginalCurrency(facility.approvedAmount, facility.currency)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatOriginalCurrency(facility.originalAmount, facility.currency)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatMyr(facility.baseCurrencyAmount)}</td>
                    <td className="px-2 py-3">{facility.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OutlinedCard>

      {data.projection ? (
        <OutlinedCard title="Projected exposure">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-fc-on-variant">Draft requested amount</dt><dd className="font-semibold text-fc-primary">{formatMyr(data.projection.requestedAmount)}</dd></div>
            <div><dt className="text-xs text-fc-on-variant">Projected exposure</dt><dd className="font-semibold text-fc-primary">{formatMyr(data.projection.projectedExposure)}</dd></div>
            <div><dt className="text-xs text-fc-on-variant">Projected utilization</dt><dd className="font-semibold text-fc-primary">{data.projection.projectedUtilizationPct == null ? 'Not configured' : `${data.projection.projectedUtilizationPct.toFixed(1)}%`}</dd></div>
          </dl>
          <Link to={`/credit/applications/${data.projection.applicationId}`} className="mt-3 inline-block text-xs font-bold text-fc-primary underline">Open draft application</Link>
        </OutlinedCard>
      ) : null}

      {data.groupExposure ? (
        <OutlinedCard title="Related group exposure">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-fc-on-variant">Group</dt><dd className="font-semibold text-fc-primary">{data.groupExposure.groupName}</dd></div>
            <div><dt className="text-xs text-fc-on-variant">Group exposure</dt><dd className="font-semibold text-fc-primary">{formatMyr(data.groupExposure.totalExposure)}</dd></div>
            <div><dt className="text-xs text-fc-on-variant">Borrower share</dt><dd className="font-semibold text-fc-primary">{formatMyr(data.groupExposure.borrowerExposure)}</dd></div>
          </dl>
          <Link to={`/credit/group-exposure?groupId=${data.groupExposure.groupId}`} className="mt-3 inline-block text-xs font-bold text-fc-primary underline">Open group exposure</Link>
        </OutlinedCard>
      ) : null}
      {onRetry ? <button type="button" onClick={onRetry} className="text-xs font-bold text-fc-primary underline">Refresh exposure</button> : null}
    </section>
  );
};

export default ExposureFacilitiesTab;
