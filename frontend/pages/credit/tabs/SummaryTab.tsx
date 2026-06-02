import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditApplication,
  CreditFacility,
  scoringApi,
  CreditScoreRun,
  RiskRating,
} from '../../../src/services/credit.service';
import { formatCurrency, formatDate, formatDateTime, PRODUCT_LABELS } from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

interface SummaryTabProps {
  app: CreditApplication;
  facilities: CreditFacility[];
  onRefresh: () => void;
}

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  AAA: { bg: '#22c55e20', text: '#16a34a' }, AA: { bg: '#22c55e20', text: '#16a34a' },
  A: { bg: '#22c55e20', text: '#16a34a' }, BBB: { bg: '#3b82f620', text: '#2563eb' },
  BB: { bg: '#f59e0b20', text: '#d97706' }, B: { bg: '#f59e0b20', text: '#d97706' },
  CCC: { bg: '#ef444420', text: '#dc2626' }, CC: { bg: '#ef444420', text: '#dc2626' },
  C: { bg: '#ef444420', text: '#dc2626' }, D: { bg: '#ef444420', text: '#dc2626' },
  NR: { bg: '#6b728020', text: '#6b7280' },
};

const STRATEGY_COLORS: Record<string, { bg: string; text: string }> = {
  GROW: { bg: '#22c55e20', text: '#16a34a' },
  MAINTAIN: { bg: '#f59e0b20', text: '#d97706' },
  EXIT: { bg: '#ef444420', text: '#dc2626' },
};

const SummaryTab: React.FC<SummaryTabProps> = ({ app, facilities, onRefresh }) => {
  const appId = app.id;

  // Score Run state (read-only — no Run Score / Override actions)
  const [scoreRuns, setScoreRuns] = useState<CreditScoreRun[]>([]);

  const fetchScoreRuns = useCallback(async () => {
    if (!appId) return;
    try {
      const data = await scoringApi.listScores(appId);
      setScoreRuns(data);
    } catch (e) { console.error(e); }
  }, [appId]);

  useEffect(() => { fetchScoreRuns(); }, [fetchScoreRuns]);

  return (
    <CaMemoSection title="Summary" phase="Phase 6" readOnly={true}>
      {/* Application Details + People */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Application Details</h3>
          {[
            { label: 'Product Type', value: PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName, icon: 'category' },
            { label: 'Requested Amount', value: formatCurrency(app.requestedAmount, app.currency), icon: 'payments' },
            { label: 'Approved Amount', value: facilities.length > 0 && facilities.some(f => f.approvedAmount != null) ? formatCurrency(Number(facilities.reduce((s, f) => s + Number(f.approvedAmount || 0), 0)), app.currency) : '—', icon: 'check_circle' },
            { label: 'Interest Rate', value: facilities.length > 0 && facilities[0].ratePct != null ? `${Number(facilities[0].ratePct)}% p.a.` : '—', icon: 'percent' },
            { label: 'Tenure', value: app.requestedTenor != null ? `${app.requestedTenor} months` : '—', icon: 'schedule' },
            { label: 'Currency', value: app.currency, icon: 'currency_exchange' },
            { label: 'Risk Rating', value: app.riskRating || '—', icon: 'speed' },
            { label: 'Purpose', value: app.purpose || '—', icon: 'topic' },
            { label: 'Submitted', value: formatDate(app.submittedAt ?? null), icon: 'send' },
            { label: 'Decided', value: formatDate(app.decisionedAt ?? null), icon: 'gavel' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
              <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
              <span className="text-sm text-text-primary">{f.value}</span>
            </div>
          ))}
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">People</h3>
          {[
            { label: 'Relationship Manager', value: app.rm ? `${app.rm.firstName} ${app.rm.lastName}` : '—', icon: 'person', sub: app.rm?.email },
            { label: 'Credit Analyst', value: app.analyst ? `${app.analyst.firstName} ${app.analyst.lastName}` : '—', icon: 'analytics', sub: app.analyst?.email },
            { label: 'Borrower', value: app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : app.borrowerProfile.name) || 'Unnamed Borrower') : '—', icon: 'account_circle', sub: app.borrowerProfile?.contact?.email },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text-secondary block">{f.label}</span>
                <span className="text-sm text-text-primary font-medium">{f.value}</span>
                {f.sub && <span className="text-xs text-text-secondary block truncate">{f.sub}</span>}
              </div>
            </div>
          ))}
          {app.rejectionReason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-xs font-bold text-red-700">Rejection Reason</span>
              <p className="text-sm text-red-800 mt-0.5">{app.rejectionReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Credit Scoring Section — read-only */}
      <div className="mt-6 bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Credit Scoring</h3>

        {scoreRuns.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-4">No score runs yet. Use the S4 Risk Score tab to run credit scoring.</p>
        ) : (
          <div>
            {/* Latest Score Run */}
            {(() => {
              const latest = scoreRuns[0];
              const rating = latest.overriddenRating || latest.riskRating;
              const ratingColor = RISK_COLORS[rating] || RISK_COLORS.NR;
              return (
                <div className="bg-bg-subtle border border-border rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black" style={{ background: ratingColor.bg, color: ratingColor.text }}>
                        {rating}
                      </div>
                      <div>
                        <p className="text-2xl font-black text-text-primary">{latest.totalScore}</p>
                        <p className="text-xs text-text-secondary">Total Score</p>
                      </div>
                    </div>
                    {latest.overriddenRating && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                        Overridden (was {latest.riskRating})
                      </span>
                    )}
                  </div>

                  {/* Factor Breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    {latest.factorBreakdown?.map(fb => (
                      <div key={fb.factorKey} className="bg-bg-surface border border-border rounded-lg p-2.5">
                        <p className="text-xs text-text-secondary truncate">{fb.factorLabel}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-text-primary">{fb.weightedScore.toFixed(1)}</span>
                          <span className="text-[10px] text-text-secondary">w:{fb.weight}% s:{fb.score.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Score History */}
            {scoreRuns.length > 1 && (
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Score History</h4>
                <div className="space-y-2">
                  {scoreRuns.slice(1).map(sr => {
                    const r = sr.overriddenRating || sr.riskRating;
                    const rc = RISK_COLORS[r] || RISK_COLORS.NR;
                    return (
                      <div key={sr.id} className="flex items-center gap-3 px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.text }}>{r}</span>
                        <span className="font-semibold text-text-primary">{sr.totalScore}</span>
                        <span className="text-xs text-text-secondary">{formatDateTime(sr.executedAt)}</span>
                        {sr.overriddenRating && <span className="text-xs text-amber-600 font-bold">Overridden</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CA Memo Summary — read-only narrative fields */}
      <div className="mt-6 bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">CA Memo Summary</h3>
        <div className="space-y-4">
          {[
            { label: 'Preamble', value: (app as any).preambleText, icon: 'article' },
            { label: 'Matters to Highlight', value: (app as any).mattersToHighlight, icon: 'priority_high' },
            { label: 'Transaction Details', value: (app as any).transactionDetailsText, icon: 'receipt_long' },
            { label: 'First Way Out', value: (app as any).firstWayOut, icon: 'exit_to_app' },
            { label: 'Second Way Out', value: (app as any).secondWayOut, icon: 'exit_to_app' },
            { label: 'Other Way Out', value: (app as any).otherWayOut, icon: 'exit_to_app' },
            { label: 'Cross-Selling Initiatives', value: (app as any).crossSellingInitiatives, icon: 'group' },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="border-b border-border last:border-0 pb-3 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-sm text-text-secondary">{f.icon}</span>
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{f.label}</span>
              </div>
              <p className="text-sm text-text-primary pl-6 whitespace-pre-wrap">{f.value}</p>
            </div>
          ))}

          {/* Account Strategy — badge/pill, not paragraph */}
          <div className="border-b border-border last:border-0 pb-3 last:pb-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-sm text-text-secondary">strategy</span>
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Account Strategy</span>
            </div>
            {(app as any).accountStrategy ? (
              <span
                className="inline-block ml-6 px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  background: STRATEGY_COLORS[(app as any).accountStrategy]?.bg || '#6b728020',
                  color: STRATEGY_COLORS[(app as any).accountStrategy]?.text || '#6b7280',
                  borderColor: (STRATEGY_COLORS[(app as any).accountStrategy]?.text || '#6b7280') + '40',
                }}
              >
                {(app as any).accountStrategy}
              </span>
            ) : (
              <p className="text-sm text-text-tertiary pl-6">Not provided</p>
            )}
          </div>

          {/* Show "Not provided" placeholder if ALL narrative fields are empty */}
          {!(app as any).preambleText &&
           !(app as any).mattersToHighlight &&
           !(app as any).transactionDetailsText &&
           !(app as any).firstWayOut &&
           !(app as any).secondWayOut &&
           !(app as any).otherWayOut &&
           !(app as any).crossSellingInitiatives &&
           !(app as any).accountStrategy && (
            <p className="text-sm text-text-tertiary text-center py-4">No CA Memo narrative fields have been completed yet.</p>
          )}
        </div>
      </div>
    </CaMemoSection>
  );
};

export default SummaryTab;