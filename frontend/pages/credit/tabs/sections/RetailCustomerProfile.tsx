import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  CreditBureauCheck,
  CreditScoreRun,
  bureauCheckApi,
  retailIncomeApi,
} from '../../../../src/services/credit.service';
import creditService from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import { formatCurrency, formatDate } from '../../creditUtils';

type Props = {
  application: CreditApplication;
};

// ── Helper: Info card ────────────────────────────────────────────────────────
function InfoCard({ label, value, icon }: { label: string; value: React.ReactNode; icon?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
        {label}
      </div>
      <div className="text-sm font-bold text-gray-900">{value || '—'}</div>
    </div>
  );
}

function DsrBadge({ dsr }: { dsr: number | null }) {
  if (dsr == null) return <span className="text-sm text-gray-400">—</span>;
  const status = dsr <= 60 ? 'pass' : dsr <= 70 ? 'warning' : 'fail';
  const styles = {
    pass: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    fail: 'bg-red-100 text-red-700 border-red-200',
  };
  const labels = {
    pass: `DSR ${dsr.toFixed(1)}% — Within limit`,
    warning: `DSR ${dsr.toFixed(1)}% — Caution`,
    fail: `DSR ${dsr.toFixed(1)}% — Exceeds limit`,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function RiskRatingBadge({ rating }: { rating: string | null }) {
  if (!rating || rating === 'NR') return <span className="text-sm text-gray-400">Not rated</span>;
  const colors: Record<string, string> = {
    AAA: 'bg-green-100 text-green-700', AA: 'bg-green-100 text-green-700', A: 'bg-green-100 text-green-700',
    BBB: 'bg-blue-100 text-blue-700', BB: 'bg-yellow-100 text-yellow-700',
    B: 'bg-orange-100 text-orange-700', CCC: 'bg-red-100 text-red-700', CC: 'bg-red-100 text-red-700',
    C: 'bg-red-100 text-red-700', D: 'bg-red-100 text-red-700',
  };
  const cls = colors[rating] || 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold ${cls}`}>{rating}</span>;
}

const RetailCustomerProfile: React.FC<Props> = ({ application }) => {
  const bp = application.borrowerProfile;
  const contact = bp?.contact;
  const account = bp?.account;

  const [retailIncome, setRetailIncome] = useState<{
    employmentType: string;
    employerName?: string;
    monthlyGrossIncome: string;
    epfMonthlyAmount?: string;
    hirePurchaseCommitment: string;
    creditCardCommitment: string;
    existingLoanCommitment: string;
    otherCommitments: string;
    proposedInstalment?: string;
    dsrPercent?: string;
    dsrStatus?: 'pass' | 'warning' | 'fail';
  } | null>(null);
  const [bureauChecks, setBureauChecks] = useState<CreditBureauCheck[]>([]);
  const [scoreRun, setScoreRun] = useState<CreditScoreRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!application.id) return;
    setLoading(true);
    Promise.allSettled([
      retailIncomeApi.get(application.id),
      bureauCheckApi.list(application.id),
      creditService.listScoreRuns(application.id),
    ]).then(([incomeRes, bureauRes, scoreRes]) => {
      if (incomeRes.status === 'fulfilled') setRetailIncome(incomeRes.value);
      if (bureauRes.status === 'fulfilled') setBureauChecks(bureauRes.value);
      if (scoreRes.status === 'fulfilled' && scoreRes.value.length > 0) setScoreRun(scoreRes.value[0]);
      setLoading(false);
    });
  }, [application.id]);

  const ccrisCheck = bureauChecks.find(
    (b) => b.provider === 'CCRIS_BORROWER_UPLOAD' || b.provider === 'CCRIS'
  );
  const ctosCheck = bureauChecks.find((b) => b.provider === 'CTOS');

  const monthlyIncome = retailIncome ? Number(retailIncome.monthlyGrossIncome) : null;
  const dsr = retailIncome?.dsrPercent ? Number(retailIncome.dsrPercent) : null;

  const commitments = retailIncome
    ? [
        { label: 'Hire Purchase / Car Loans', amount: Number(retailIncome.hirePurchaseCommitment) || 0 },
        { label: 'Credit Card (min. payment)', amount: Number(retailIncome.creditCardCommitment) || 0 },
        { label: 'Existing Personal Loans', amount: Number(retailIncome.existingLoanCommitment) || 0 },
        { label: 'Other Obligations', amount: Number(retailIncome.otherCommitments) || 0 },
        { label: 'Proposed Instalment', amount: Number(retailIncome.proposedInstalment) || 0 },
      ]
    : [];

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading customer profile…</div>;

  return (
    <div className="space-y-6">
      {/* ── Applicant Information ─────────────────────────────────── */}
      <CaMemoSection title="Applicant Information" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="Full Name" value={contact ? `${contact.firstName} ${contact.lastName}` : null} icon="person" />
          <InfoCard label="IC Number" value={contact?.nricPassport || null} icon="badge" />
          <InfoCard label="Date of Birth" value={formatDate(contact?.dateOfBirth ?? null)} icon="cake" />
          <InfoCard label="Email" value={contact?.email || null} icon="mail" />
          <InfoCard label="Phone" value={contact?.phone || contact?.mobile || null} icon="call" />
          <InfoCard label="Job Title" value={contact?.jobTitle || null} icon="work" />
          <InfoCard label="Credit Risk Rating" value={<RiskRatingBadge rating={bp?.creditRiskRating ?? null} />} />
          <InfoCard label="AML Risk Tier" value={bp?.amlRiskTier || null} icon="shield" />
        </div>
      </CaMemoSection>

      {/* ── Employment Information ─────────────────────────────────── */}
      <CaMemoSection title="Employment Information" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="Employment Type" value={retailIncome?.employmentType || bp?.occupation || null} icon="badge" />
          <InfoCard label="Employer" value={retailIncome?.employerName || bp?.employer || null} icon="business" />
          <InfoCard
            label="Monthly Income"
            value={monthlyIncome != null ? formatCurrency(monthlyIncome) : null}
            icon="payments"
          />
          <InfoCard
            label="Annual Income"
            value={bp?.annualIncome != null ? formatCurrency(bp.annualIncome) : null}
            icon="savings"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">Debt Service Ratio:</span>
          <DsrBadge dsr={dsr} />
        </div>
      </CaMemoSection>

      {/* ── Credit Score ───────────────────────────────────────────── */}
      <CaMemoSection title="Credit Score" phase="S2">
        {scoreRun ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Total Score" value={`${Number(scoreRun.totalScore).toFixed(0)}`} icon="scoreboard" />
            <InfoCard label="Risk Rating" value={<RiskRatingBadge rating={scoreRun.riskRating} />} />
            <InfoCard label="Scored On" value={formatDate(scoreRun.runAt)} icon="event" />
            <InfoCard
              label="Override"
              value={scoreRun.overriddenRating ? `Yes — ${scoreRun.overriddenRating}` : 'No'}
              icon="edit"
            />
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No credit score run yet for this application.
          </div>
        )}
      </CaMemoSection>

      {/* ── CCRIS ──────────────────────────────────────────────────── */}
      <CaMemoSection title="CCRIS" phase="S2">
        {ccrisCheck ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard
                label="Outstanding Facilities"
                value={ccrisCheck.ccrisOutstandingFacilities ?? null}
                icon="credit_card"
              />
              <InfoCard
                label="Total Outstanding Balance"
                value={
                  ccrisCheck.ccrisTotalOutstandingBalance != null
                    ? formatCurrency(Number(ccrisCheck.ccrisTotalOutstandingBalance))
                    : null
                }
                icon="account_balance"
              />
              <InfoCard
                label="Missed Payments (12M)"
                value={ccrisCheck.ccrisMissedPayments12Months ?? null}
                icon="event_busy"
              />
              <InfoCard label="Report Date" value={formatDate(ccrisCheck.ccrisReportDate ?? null)} icon="description" />
            </div>
            <div className="flex flex-wrap gap-2">
              {ccrisCheck.ccrisSaaFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  SAA Flag ({ccrisCheck.ccrisSaaCount ?? 0})
                </span>
              )}
              {ccrisCheck.ccrisBankruptcyFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  Bankruptcy Flag
                </span>
              )}
              {ccrisCheck.ccrisLegalActionFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  Legal Action Flag
                </span>
              )}
              {!ccrisCheck.ccrisSaaFlag && !ccrisCheck.ccrisBankruptcyFlag && !ccrisCheck.ccrisLegalActionFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  No adverse flags
                </span>
              )}
            </div>
            {ccrisCheck.findings && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-2">
                <span className="font-semibold">Findings: </span>
                {ccrisCheck.findings}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No CCRIS report on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── CTOS ───────────────────────────────────────────────────── */}
      <CaMemoSection title="CTOS" phase="S2">
        {ctosCheck ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard label="CTOS Score" value={ctosCheck.ctosScore ?? null} icon="scoreboard" />
              <InfoCard
                label="Directorships"
                value={ctosCheck.ctosDirectorshipsCount ?? null}
                icon="groups"
              />
              <InfoCard label="Report Date" value={formatDate(ctosCheck.ctosReportDate ?? null)} icon="description" />
              <InfoCard label="Has Hits" value={ctosCheck.hasHits ? 'Yes' : 'No'} icon="search" />
            </div>
            <div className="flex flex-wrap gap-2">
              {ctosCheck.ctosAdverseFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Adverse Record
                </span>
              )}
              {ctosCheck.ctosBankruptcyFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  Bankruptcy Flag
                </span>
              )}
              {!ctosCheck.ctosAdverseFlag && !ctosCheck.ctosBankruptcyFlag && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  No adverse flags
                </span>
              )}
            </div>
            {ctosCheck.ctosAdverseDetails && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-2">
                <span className="font-semibold">Adverse Details: </span>
                {ctosCheck.ctosAdverseDetails}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No CTOS report on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── Existing Commitments ───────────────────────────────────── */}
      <CaMemoSection title="Existing Commitments" phase="S2">
        {retailIncome && commitments.some((c) => c.amount > 0) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="text-left py-2 px-3">Commitment</th>
                  <th className="text-right py-2 px-3">Monthly Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {commitments
                  .filter((c) => c.amount > 0)
                  .map((c) => (
                    <tr key={c.label} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-700">{c.label}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-900 font-medium">
                        {c.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-2 px-3 font-bold text-gray-900">Total Monthly Commitments</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-gray-900">
                    {commitments
                      .reduce((sum, c) => sum + c.amount, 0)
                      .toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No existing commitments recorded.
          </div>
        )}
      </CaMemoSection>
    </div>
  );
};

export default RetailCustomerProfile;