import React from 'react';
import { CreditApplication } from '../../../src/services/credit.service';

/**
 * FinancialProfileSummaryStrip
 *
 * Top-level summary cards for the Financial Profile tab.
 * Shows 5 key indicators at a glance:
 *   1. Borrower type / segmentation
 *   2. DSR (retail) or DSCR (business)
 *   3. Affordability status
 *   4. Document completeness
 *   5. Verification state
 *
 * Design follows credit-module tokens (inline style with var(--cr-*)).
 */

interface SummaryStripProps {
  application: CreditApplication;
  /** DSR percentage for retail borrowers (null if not applicable) */
  dsr: number | null;
  /** DSCR ratio for business borrowers (null if not applicable) */
  dscr: number | null;
  /** Number of documents uploaded */
  docCount: number;
  /** Number of verified documents */
  verifiedDocCount: number;
  /** Whether income/financial data has been verified */
  financialsVerified: boolean;
}

interface CardProps {
  icon: string;
  label: string;
  value: string;
  sublabel?: string;
  tone: 'neutral' | 'pass' | 'warn' | 'fail' | 'info';
}

const toneStyles: Record<string, { bg: string; border: string; iconColor: string; valueColor: string }> = {
  neutral: { bg: '#f7f9fb', border: '#c6c6cd', iconColor: '#45464d', valueColor: '#191c1e' },
  pass:    { bg: '#f0fdf4', border: '#86efac', iconColor: '#16a34a', valueColor: '#14532d' },
  warn:    { bg: '#fefce8', border: '#fde047', iconColor: '#ca8a04', valueColor: '#713f12' },
  fail:    { bg: '#fef2f2', border: '#fca5a5', iconColor: '#dc2626', valueColor: '#7f1d1d' },
  info:    { bg: '#eff6ff', border: '#93c5fd', iconColor: '#2563eb', valueColor: '#1e3a5f' },
};

const SummaryCard: React.FC<CardProps> = ({ icon, label, value, sublabel, tone }) => {
  const s = toneStyles[tone];
  return (
    <div
      className="rounded-lg p-4 flex items-start gap-3"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="material-symbols-outlined text-2xl" style={{ color: s.iconColor }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-lg font-bold mt-0.5" style={{ color: s.valueColor }}>{value}</p>
        {sublabel && <p className="text-[10px] text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
};

/** Borrower type display mapping */
const BORROWER_TYPE_DISPLAY: Record<string, { label: string; icon: string }> = {
  INDIVIDUAL:       { label: 'Retail / Individual',  icon: 'person' },
  SOLE_PROPRIETOR:  { label: 'SME / Sole Proprietor', icon: 'storefront' },
  CORPORATE:        { label: 'Corporate',            icon: 'domain' },
};

const FinancialProfileSummaryStrip: React.FC<SummaryStripProps> = ({
  application,
  dsr,
  dscr,
  docCount,
  verifiedDocCount,
  financialsVerified,
}) => {
  const borrowerType = application.borrowerProfile?.borrowerType ?? 'INDIVIDUAL';
  const typeDisplay = BORROWER_TYPE_DISPLAY[borrowerType] ?? { label: borrowerType, icon: 'person' };

  // DSR / DSCR card
  let ratioLabel: string;
  let ratioValue: string;
  let ratioTone: 'neutral' | 'pass' | 'warn' | 'fail';
  let ratioSub: string;

  if (dsr !== null) {
    ratioLabel = 'DSR';
    ratioValue = `${dsr.toFixed(1)}%`;
    ratioTone = dsr <= 60 ? 'pass' : dsr <= 70 ? 'warn' : 'fail';
    ratioSub = dsr <= 60 ? 'Within limit (≤60%)' : dsr <= 70 ? 'Caution (60–70%)' : 'Exceeds 70% limit';
  } else if (dscr !== null) {
    ratioLabel = 'DSCR';
    ratioValue = `${dscr.toFixed(2)}x`;
    ratioTone = dscr >= 1.25 ? 'pass' : dscr >= 1.10 ? 'warn' : 'fail';
    ratioSub = dscr >= 1.25 ? 'Passing (≥1.25x)' : dscr >= 1.10 ? 'Watch (1.10–1.24x)' : 'Failing (<1.10x)';
  } else {
    ratioLabel = 'DSR / DSCR';
    ratioValue = '—';
    ratioTone = 'neutral';
    ratioSub = 'No ratio data';
  }

  // Affordability card
  const affordabilityTone = ratioTone === 'pass' ? 'pass' : ratioTone === 'fail' ? 'fail' : 'warn';
  const affordabilityLabel = ratioTone === 'pass' ? 'Affordable' : ratioTone === 'fail' ? 'Not Affordable' : 'Borderline';
  const affordabilitySub = dsr !== null
    ? `Based on DSR ${dsr.toFixed(1)}%`
    : dscr !== null
      ? `Based on DSCR ${dscr.toFixed(2)}x`
      : 'Awaiting financial data';

  // Document completeness card
  const docTone = docCount === 0 ? 'fail' : verifiedDocCount === docCount ? 'pass' : 'warn';
  const docValue = `${verifiedDocCount}/${docCount}`;
  const docSub = docCount === 0 ? 'No documents uploaded' : verifiedDocCount === docCount ? 'All verified' : `${docCount - verifiedDocCount} pending verification`;

  // Verification state card
  const verifyTone = financialsVerified ? 'pass' : 'warn';
  const verifyValue = financialsVerified ? 'Verified' : 'Unverified';
  const verifySub = financialsVerified ? 'Cross-checked against sources' : 'Pending document verification';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <SummaryCard
        icon={typeDisplay.icon}
        label="Borrower Type"
        value={typeDisplay.label}
        tone="info"
      />
      <SummaryCard
        icon="percent"
        label={ratioLabel}
        value={ratioValue}
        sublabel={ratioSub}
        tone={ratioTone}
      />
      <SummaryCard
        icon="savings"
        label="Affordability"
        value={affordabilityLabel}
        sublabel={affordabilitySub}
        tone={affordabilityTone}
      />
      <SummaryCard
        icon="folder_shared"
        label="Documents"
        value={docValue}
        sublabel={docSub}
        tone={docTone}
      />
      <SummaryCard
        icon={financialsVerified ? 'verified' : 'pending_actions'}
        label="Verification"
        value={verifyValue}
        sublabel={verifySub}
        tone={verifyTone}
      />
    </div>
  );
};

export default FinancialProfileSummaryStrip;