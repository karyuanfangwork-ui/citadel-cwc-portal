import React from 'react';
import { KpiCell } from './primitives';
import type { Borrower360Summary } from '../../../services/credit.service';

const MYR = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const formatMyR = (value: number | null | undefined) => (value == null ? '—' : MYR.format(value));

const compactExposure = (value: number | null | undefined) => {
  if (value == null) return '—';
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `RM ${(value / 1_000).toFixed(0)}k`;
  return formatMyR(value);
};

export const BorrowerKpiBand: React.FC<{ summary: Borrower360Summary | null; isRetail: boolean }> = ({ summary, isRetail }) => {
  const scoreTone = summary?.scoreBand === 'Excellent'
    ? 'pos'
    : summary?.scoreBand === 'Good'
      ? 'info'
      : summary?.scoreBand === 'Fair'
        ? 'warn'
        : summary?.scoreBand
          ? 'neg'
          : 'default';

  const docTone = summary ? (summary.docCompletionPct >= 80 ? 'pos' : summary.docCompletionPct >= 50 ? 'warn' : 'neg') : 'default';
  const dsrTone = summary ? (summary.dsrPercent != null && summary.dsrPercent <= 35 ? 'pos' : 'warn') : 'default';
  const netDsrTone = summary ? (summary.netDsrPercent != null && summary.netDsrPercent <= 35 ? 'pos' : 'warn') : 'default';
  const bureauTone = summary?.bureau.stale ? 'neg' : summary ? 'pos' : 'default';

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
      <KpiCell
        label={isRetail ? 'Credit Score' : 'Risk Grade'}
        value={isRetail ? (summary?.creditScore ?? '—') : (summary?.riskGrade ?? '—')}
        tone={scoreTone}
        sub={isRetail ? summary?.scoreBand ?? undefined : summary?.scoreBand ?? undefined}
      />
      <KpiCell
        label="Gross DSR"
        value={summary?.dsrPercent != null ? `${Math.round(summary.dsrPercent)}%` : '—'}
        tone={dsrTone}
      />
      <KpiCell
        label="Net DSR"
        value={summary?.netDsrPercent != null ? `${Math.round(summary.netDsrPercent)}%` : '—'}
        tone={netDsrTone}
      />
      <KpiCell
        label="Total Exposure"
        value={compactExposure(summary?.totalExposure)}
        tone="default"
      />
      <KpiCell
        label="Active Apps"
        value={summary ? String(summary.activeApps).padStart(2, '0') : '—'}
        tone="default"
      />
      <KpiCell
        label="Doc Completion"
        value={summary ? `${summary.docCompletionPct}%` : '—'}
        tone={docTone}
      />
      <KpiCell
        label="Facilities"
        value={summary ? String(summary.facilityCount).padStart(2, '0') : '—'}
        tone="default"
      />
      <KpiCell
        label="Bureau"
        value={summary?.bureau.daysOld != null ? `${summary.bureau.daysOld}d` : '—'}
        tone={bureauTone}
        sub={summary?.bureau.source ?? undefined}
      />
    </div>
  );
};

export default BorrowerKpiBand;
