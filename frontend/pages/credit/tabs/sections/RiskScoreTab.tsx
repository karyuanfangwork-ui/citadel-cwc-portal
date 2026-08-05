import React, { useEffect, useState } from 'react';
import QualitativeAssessmentTab from './QualitativeAssessmentTab';
import creditService, {
  CreditApplication,
  CreditScoreRun,
  financialApi,
  retailIncomeApi,
  FinancialRatio,
} from '../../../../src/services/credit.service';
import { useAuth } from '../../../../src/context/AuthContext';
import { hasPermission } from '../../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../../src/utils/errorMessages';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';

// S4 · Risk Score — Scorecard output, internal rating, DSR stress test.
// Bank-only ECL/SICR/ESG/ExternalRatings remain in RiskRatingEclTab (advanced_memo flag).

// ── DSR Stress Test helpers ────────────────────────────────────────
// Stress inputs: rate +200bps, income -20%
const RATE_STRESS_BPS = 200;
const INCOME_STRESS_PCT = 0.20;

interface DsrStress {
  baseDscr: number;
  stressedDscrIncome: number;
  stressedDscrRate: number | null;
}

function computeDsrStress(
  baseDscr: number,
  loanAmount: number,
  tenorMonths: number | null,
  ratePct: number | null,
): DsrStress {
  const stressedDscrIncome = baseDscr * (1 - INCOME_STRESS_PCT);

  let stressedDscrRate: number | null = null;
  if (ratePct != null && ratePct > 0 && tenorMonths && tenorMonths > 0) {
    const annualPrincipal = loanAmount / (tenorMonths / 12);
    const annualInterest = loanAmount * (ratePct / 100);
    const debtService = annualPrincipal + annualInterest;
    if (debtService > 0) {
      const noi = baseDscr * debtService;
      const stressedDebtService = annualPrincipal + loanAmount * (ratePct / 100 + RATE_STRESS_BPS / 10000);
      stressedDscrRate = noi / stressedDebtService;
    }
  }

  return { baseDscr, stressedDscrIncome, stressedDscrRate };
}

function dsrColor(dscr: number): string {
  if (dscr >= 1.5) return 'text-emerald-700';
  if (dscr >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

const RATING_COLORS: Record<string, string> = {
  AAA: 'bg-emerald-100 text-emerald-700', AA: 'bg-emerald-50 text-emerald-600', A: 'bg-green-50 text-green-600',
  BBB: 'bg-yellow-50 text-yellow-700', BB: 'bg-orange-50 text-orange-600', B: 'bg-orange-100 text-orange-700',
  CCC: 'bg-red-50 text-red-600', CC: 'bg-red-100 text-red-700', C: 'bg-red-200 text-red-800', D: 'bg-red-300 text-red-900',
  NR: 'bg-gray-100 text-gray-500',
};

// ── Phase 4: Factor source mapping for drilldown ──────────────────
const FACTOR_SOURCES: Record<string, { fields: string; formula: string }> = {
  financial_performance: { fields: 'ROS, ROA, ROE', formula: 'avg(scoreHigherIsBetter(ros,roa,roe))' },
  leverage: { fields: 'Debt/Equity, Debt/Assets', formula: 'avg(scoreLowerIsBetter(d/e, d/a))' },
  liquidity: { fields: 'Current Ratio, Quick Ratio', formula: 'avg(scoreHigherIsBetter(current, quick))' },
  cashflow: { fields: 'DSCR / DSR', formula: 'scoreHigherIsBetter(dscr) or dsrCashflowScore(dsr)' },
  management: { fields: 'Qualitative Assessment', formula: 'sliderScore(management)' },
  industry: { fields: 'Qualitative Assessment', formula: 'sliderScore(industry)' },
  collateral: { fields: 'Qualitative Assessment', formula: 'sliderScore(collateral)' },
  relationship: { fields: 'Qualitative Assessment', formula: 'sliderScore(relationship)' },
  market_conditions: { fields: 'Placeholder (50)', formula: 'constant(50) — not yet configured' },
};

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRefresh?: () => void;
};

const RiskScoreTab: React.FC<Props> = ({ application, onUpdated, onRefresh }) => {
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'credit:write');
  const [scoreRuns, setScoreRuns] = useState<CreditScoreRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [dsrStress, setDsrStress] = useState<DsrStress | null>(null);

  const fetchRuns = async () => {
    if (!application.id) return;
    setLoading(true);
    try {
      const runs = await creditService.listScoreRuns(application.id);
      setScoreRuns(runs || []);
    } catch { setScoreRuns([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRuns(); }, [application.id]);

  // Fetch base DSCR to power stress test
  // For corporate borrowers: from financial statement ratios
  // For retail (individual/sole-prop) borrowers: from retail income DSR percent
  useEffect(() => {
    const isRetail = application.borrowerProfile?.borrowerType === 'INDIVIDUAL'
      || application.borrowerProfile?.borrowerType === 'SOLE_PROPRIETOR';

    if (isRetail) {
      // Retail path: use retail income DSR
      retailIncomeApi.get(application.id).then(data => {
        if (!data?.dsrPercent) return;
        // dsrPercent is e.g. 40 (meaning 40% debt/income ratio)
        // Convert to DSCR approximation: DSCR ≈ 100 / dsrPercent
        const dsrPct = Number(data.dsrPercent);
        if (isNaN(dsrPct) || dsrPct <= 0) return;
        const baseDscr = 100 / dsrPct;
        const facility = application.facilities?.[0];
        const ratePct = facility?.ratePct != null ? Number(facility.ratePct) : null;
        const tenor = application.requestedTenor ?? facility?.tenorMonths ?? null;
        const amount = Number(application.requestedAmount || 0);
        setDsrStress(computeDsrStress(baseDscr, amount, tenor, ratePct));
      }).catch(() => {});
    } else {
      // Corporate path: use financial statement DSCR ratio
      const bpId = application.borrowerProfileId;
      if (!bpId) return;
      financialApi.listStatements(bpId).then(statements => {
        if (!statements || statements.length === 0) return;
        const allRatios: FinancialRatio[] = statements.flatMap(s => s.ratios || []);
        const dscrRatio = allRatios.find(r => (r.ratioKey || '').toLowerCase().includes('dscr'));
        const baseDscr = dscrRatio ? Number(dscrRatio.value) : null;
        if (baseDscr == null || isNaN(baseDscr) || baseDscr <= 0) return;
        const facility = application.facilities?.[0];
        const ratePct = facility?.ratePct != null ? Number(facility.ratePct) : null;
        const tenor = application.requestedTenor ?? facility?.tenorMonths ?? null;
        const amount = Number(application.requestedAmount || 0);
        setDsrStress(computeDsrStress(baseDscr, amount, tenor, ratePct));
      }).catch(() => {});
    }
  }, [application.borrowerProfileId, application.borrowerProfile?.borrowerType, application.requestedAmount, application.requestedTenor]);

  const handleExecute = async () => {
    if (!application.id) return;
    setExecuting(true);
    try {
      const run = await creditService.executeScore(application.id);
      toast.success('Scorecard executed');
      setScoreRuns(prev => [run, ...prev]);
      // Refresh full application data from server (including updated riskRating)
      // Don't pass empty object — that crashes every downstream component
      if (onRefresh) {
        onRefresh();
      } else {
        onUpdated?.({ ...application, riskRating: run.riskRating } as CreditApplication);
      }
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to execute scorecard'));
    } finally { setExecuting(false); }
  };

  const latestRun = scoreRuns[0];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Scorecard Result ──────────────────── */}
      <CaMemoSection title="Scorecard & Rating" phase="S4"
        actions={
          canWrite && application.state === 'DRAFT' ? (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors"
              style={{ cursor: executing ? 'wait' : 'pointer', border: 'none' }}
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              {executing ? 'Running...' : 'Run Scorecard'}
            </button>
          ) : undefined
        }
      >
        {latestRun ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Total Score</div>
                <div className="text-2xl font-black text-gray-900">{latestRun.totalScore}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Risk Rating</div>
                <div className={`text-lg font-black px-2 py-0.5 rounded inline-block ${RATING_COLORS[latestRun.riskRating] || RATING_COLORS.NR}`}>
                  {latestRun.riskRating || 'NR'}
                </div>
              </div>
              {latestRun.overriddenRating && (
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-amber-600 mb-1">Overridden Rating</div>
                  <div className={`text-lg font-black px-2 py-0.5 rounded inline-block ${RATING_COLORS[latestRun.overriddenRating] || RATING_COLORS.NR}`}>
                    {latestRun.overriddenRating}
                  </div>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Executed</div>
                <div className="text-sm font-semibold text-gray-900">
                  {(latestRun.runAt || latestRun.executedAt) ? new Date(latestRun.runAt || latestRun.executedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
            </div>

            {/* Factor Breakdown — Phase 4 enhanced drilldown */}
            {latestRun.factorBreakdown && latestRun.factorBreakdown.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Score Factor Breakdown</h4>
                <div className="space-y-2">
                  {latestRun.factorBreakdown.map((f, idx) => {
                    const sourceInfo = FACTOR_SOURCES[f.factorKey];
                    const isMissing = application.missingInputs?.some(
                      (mi: any) => mi.factor === f.factorKey
                    );
                    const contribution = latestRun.totalScore > 0
                      ? (f.weightedScore / latestRun.totalScore) * 100
                      : 0;
                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-700">
                                {f.factorLabel || f.factorKey}
                              </span>
                              {isMissing && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                  MISSING
                                </span>
                              )}
                            </div>
                            {sourceInfo && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Source: {sourceInfo.fields} · {sourceInfo.formula}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">Weight: {(f.weight * 100).toFixed(0)}%</div>
                          <div className="text-sm font-bold text-gray-900 w-12 text-right">
                            {typeof f.score === 'number' ? f.score.toFixed(1) : f.score}
                          </div>
                          <div className="text-xs text-gray-400 w-16 text-right">
                            ({f.weightedScore.toFixed(1)})
                          </div>
                        </div>
                        {/* Contribution bar */}
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isMissing ? 'bg-amber-400' : 'bg-brand-500'}`}
                            style={{ width: `${Math.min(contribution, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Source data timestamp */}
                {application.inputSnapshot?.capturedAt && (
                  <div className="text-[10px] text-gray-400 mt-2">
                    Source data captured: {new Date(application.inputSnapshot.capturedAt).toLocaleString('en-MY')}
                    {application.inputSnapshot.bureauFresh === false && (
                      <span className="text-amber-600 ml-2">⚠ Bureau data stale</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">speed</span>
            <p className="text-sm">No scorecard run yet.</p>
            <p className="text-xs mt-1">Click "Run Scorecard" to generate a risk rating.</p>
          </div>
        )}
      </CaMemoSection>

      {/* ── Application Rating ────────────────── */}
      <CaMemoSection title="Application Risk Rating" phase="S4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Current Rating</div>
            <div className={`text-lg font-black px-2 py-0.5 rounded inline-block ${RATING_COLORS[application.riskRating || 'NR'] || RATING_COLORS.NR}`}>
              {application.riskRating || 'NR'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">First Way Out</div>
            <div className="text-sm font-semibold text-gray-900">{application.firstWayOut || '—'}</div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── DSR Stress Test ───────────────────── */}
      <CaMemoSection title="DSR Stress Test" phase="S4">
        {dsrStress ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Stressed DSCR calculated from latest financial statement ratios.
              Rate stress: +{RATE_STRESS_BPS}bps · Income stress: −{INCOME_STRESS_PCT * 100}%.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Base DSCR</div>
                <div className={`text-2xl font-black ${dsrColor(dsrStress.baseDscr)}`}>
                  {dsrStress.baseDscr.toFixed(2)}x
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Reported (unstressed)</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Income Stress (−20%)</div>
                <div className={`text-2xl font-black ${dsrColor(dsrStress.stressedDscrIncome)}`}>
                  {dsrStress.stressedDscrIncome.toFixed(2)}x
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Net income reduced by 20%</div>
              </div>
              {dsrStress.stressedDscrRate != null ? (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Rate Stress (+200bps)</div>
                  <div className={`text-2xl font-black ${dsrColor(dsrStress.stressedDscrRate)}`}>
                    {dsrStress.stressedDscrRate.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Proposed rate +2.00%</div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center">
                  <div className="text-xs text-gray-400 text-center">
                    Rate stress unavailable<br/>
                    <span className="text-[10px]">Set facility rate to enable</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-4 text-[10px] text-gray-400 mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />≥1.5x Pass</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />1.0–1.5x Watch</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;1.0x Fail</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <span className="material-symbols-outlined text-3xl mb-1 block">trending_down</span>
            <p className="text-sm">No DSCR data available.</p>
            {application.borrowerProfile?.borrowerType === 'INDIVIDUAL' || application.borrowerProfile?.borrowerType === 'SOLE_PROPRIETOR'
              ? <p className="text-xs mt-1">Complete retail income assessment (S3) to enable stress testing.</p>
              : <p className="text-xs mt-1">Complete financial statements (S3) to enable stress testing.</p>
            }
          </div>
        )}
      </CaMemoSection>

      {/* ── Score Run History ──────────────────── */}
      {scoreRuns.length > 1 && (
        <CaMemoSection title="Score Run History" phase="S4">
          <div className="space-y-2">
            {scoreRuns.slice(1).map((run, idx) => (
              <div key={run.id || idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span className="font-bold text-gray-900">#{scoreRuns.length - idx}</span>
                <span className={`font-semibold px-1.5 py-0.5 rounded ${RATING_COLORS[run.riskRating] || RATING_COLORS.NR}`}>
                  {run.riskRating}
                </span>
                <span className="text-gray-500">Score: {run.totalScore}</span>
                <span className="ml-auto text-gray-400">
                  {(run.runAt || run.executedAt) ? new Date(run.runAt || run.executedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </CaMemoSection>
      )}

      {/* ── Qualitative Assessment ──────────────── */}
      <CaMemoSection title="Qualitative Factors" phase="S4">
        <QualitativeAssessmentTab
          applicationId={application.id}
          readOnly={!canWrite || application.state !== 'DRAFT'}
        />
      </CaMemoSection>
    </div>
  );
};

export default RiskScoreTab;