/**
 * ApplicationKpiRow — 8-card horizontally scrollable KPI row for Application 360 Workspace.
 *
 * Cards 1-6 are common; cards 7-8 are segment-gated with traffic-light colouring.
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';
import { CreditApplication } from '../../../services/credit.service';
import { BorrowerSegment, SEGMENT_LABELS, formatCurrency } from '../../../../pages/credit/creditUtils';

interface ApplicationKpiRowProps {
  app: CreditApplication;
  segment: BorrowerSegment;
}

// ── Traffic-light helpers ──────────────────────────────────────────

type TrafficLight = 'green' | 'amber' | 'red';

const TRAFFIC_COLORS: Record<string, string> = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
};

function dsrTraffic(dsr: number): TrafficLight {
  if (dsr <= 60) return 'green';
  if (dsr <= 80) return 'amber';
  return 'red';
}

function dscrTraffic(dscr: number): TrafficLight {
  if (dscr >= 1.5) return 'green';
  if (dscr >= 1.25) return 'amber';
  return 'red';
}

function creditScoreTraffic(score: number): TrafficLight {
  if (score >= 700) return 'green';
  if (score >= 500) return 'amber';
  return 'red';
}

function currentRatioTraffic(ratio: number): TrafficLight {
  if (ratio >= 2) return 'green';
  if (ratio >= 1) return 'amber';
  return 'red';
}

function probDefaultTraffic(pct: number): TrafficLight {
  if (pct <= 1) return 'green';
  if (pct <= 5) return 'amber';
  return 'red';
}

// ── Card component ────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  benchmark?: string;
  trafficLight?: TrafficLight;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, benchmark, trafficLight }) => {
  const activeColor = trafficLight ? TRAFFIC_COLORS[trafficLight] : undefined;
  const valueColor = activeColor ?? 'var(--cr-on-surface)';
  const bgTint = activeColor
    ? `${activeColor}1a` // 10% opacity hex suffix
    : undefined;

  return (
    <div
      style={{
        minWidth: 140,
        height: 64,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: bgTint ?? 'var(--cr-surface-container-lowest)',
        border: '1px solid var(--cr-outline-variant)',
        borderRadius: 'var(--cr-radius)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--cr-outline)',
          fontFamily: 'var(--cr-font-body)',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: valueColor,
          fontFamily: 'var(--cr-font-display)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {benchmark !== undefined && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--cr-outline)',
            fontFamily: 'var(--cr-font-body)',
            lineHeight: 1,
          }}
        >
          {benchmark}
        </span>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────

const ApplicationKpiRow: React.FC<ApplicationKpiRowProps> = ({ app, segment }) => {
  const _app = app as any; // cast to access dynamic segment-specific fields

  // Card 7 — segment-gated
  let card7Label: string;
  let card7Value: string;
  let card7Traffic: TrafficLight | undefined;
  let card7Benchmark: string | undefined;

  switch (segment) {
    case 'retail': {
      const dsr = _app.dsr as number | undefined;
      card7Label = 'DSR';
      card7Value = dsr != null ? `${dsr}%` : '—';
      card7Traffic = dsr != null ? dsrTraffic(dsr) : undefined;
      card7Benchmark = dsr != null ? '≤60% ideal' : undefined;
      break;
    }
    case 'sme': {
      const dscr = _app.dscr as number | undefined;
      card7Label = 'DSCR';
      card7Value = dscr != null ? `${dscr}x` : '—';
      card7Traffic = dscr != null ? dscrTraffic(dscr) : undefined;
      card7Benchmark = dscr != null ? '≥1.5x ideal' : undefined;
      break;
    }
    case 'corporate':
    default: {
      const groupExposure = _app.groupExposure as number | undefined;
      card7Label = 'Group Exposure';
      card7Value = groupExposure != null ? formatCurrency(groupExposure) : '—';
      card7Benchmark = undefined;
      break;
    }
  }

  // Card 8 — segment-gated
  let card8Label: string;
  let card8Value: string;
  let card8Traffic: TrafficLight | undefined;
  let card8Benchmark: string | undefined;

  switch (segment) {
    case 'retail': {
      const score = _app.creditScore as number | null | undefined;
      card8Label = 'Credit Score';
      card8Value = score != null ? String(score) : '—';
      card8Traffic = score != null ? creditScoreTraffic(score) : undefined;
      card8Benchmark = score != null ? '≥700 ideal' : undefined;
      break;
    }
    case 'sme': {
      const cr = _app.currentRatio as number | undefined;
      card8Label = 'Current Ratio';
      card8Value = cr != null ? `${cr}x` : '—';
      card8Traffic = cr != null ? currentRatioTraffic(cr) : undefined;
      card8Benchmark = cr != null ? '≥2x ideal' : undefined;
      break;
    }
    case 'corporate':
    default: {
      const pd = _app.probabilityOfDefault as number | undefined;
      card8Label = 'Prob. of Default';
      card8Value = pd != null ? `${pd}%` : '—';
      card8Traffic = pd != null ? probDefaultTraffic(pd) : undefined;
      card8Benchmark = pd != null ? '≤1% ideal' : undefined;
      break;
    }
  }

  const cards: KpiCardProps[] = [
    {
      label: 'Customer Type',
      value: SEGMENT_LABELS[segment],
    },
    {
      label: 'Product',
      value: _app.productType ?? _app.productName ?? '—',
    },
    {
      label: 'Requested Amount',
      value: formatCurrency(app.requestedAmount, app.currency),
    },
    {
      label: 'Recommended Amount',
      value: _app.recommendedAmount != null
        ? formatCurrency(_app.recommendedAmount, app.currency)
        : '—',
    },
    {
      label: 'Tenure',
      value: app.requestedTenor ? `${app.requestedTenor} months` : '—',
    },
    {
      label: 'Interest Rate',
      value: _app.interestRate != null ? `${_app.interestRate}%` : '—',
    },
    {
      label: card7Label,
      value: card7Value,
      trafficLight: card7Traffic,
      benchmark: card7Benchmark,
    },
    {
      label: card8Label,
      value: card8Value,
      trafficLight: card8Traffic,
      benchmark: card8Benchmark,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        /* no-scrollbar utility — hide scrollbar across browsers */
        scrollbarWidth: 'none', // Firefox
      } as React.CSSProperties}
      className="no-scrollbar"
    >
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
};

export default ApplicationKpiRow;