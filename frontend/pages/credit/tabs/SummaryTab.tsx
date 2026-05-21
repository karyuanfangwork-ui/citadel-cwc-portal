import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditApplication,
  CreditFacility,
  ApplicationTransition,
  scoringApi,
  CreditScoreRun,
  RiskRating,
} from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import { formatCurrency, formatDate, formatDateTime, PRODUCT_LABELS } from '../creditUtils';

interface SummaryTabProps {
  app: CreditApplication;
  facilities: CreditFacility[];
  transitions: ApplicationTransition[];
  canWrite: boolean;
  canApprove: boolean;
  onTransition: (action: string, reason?: string) => Promise<void>;
  onRefresh: () => void;
}

const RISK_RATINGS: RiskRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  AAA: { bg: '#22c55e20', text: '#16a34a' }, AA: { bg: '#22c55e20', text: '#16a34a' },
  A: { bg: '#22c55e20', text: '#16a34a' }, BBB: { bg: '#3b82f620', text: '#2563eb' },
  BB: { bg: '#f59e0b20', text: '#d97706' }, B: { bg: '#f59e0b20', text: '#d97706' },
  CCC: { bg: '#ef444420', text: '#dc2626' }, CC: { bg: '#ef444420', text: '#dc2626' },
  C: { bg: '#ef444420', text: '#dc2626' }, D: { bg: '#ef444420', text: '#dc2626' },
  NR: { bg: '#6b728020', text: '#6b7280' },
};

const SummaryTab: React.FC<SummaryTabProps> = ({ app, facilities, transitions, canWrite, canApprove, onTransition, onRefresh }) => {
  const { user } = useAuth();
  const appId = app.id;

  // Score Run state
  const [scoreRuns, setScoreRuns] = useState<CreditScoreRun[]>([]);
  const [runningScore, setRunningScore] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState<string | null>(null);
  const [overrideRating, setOverrideRating] = useState<RiskRating>('NR');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideApproverId, setOverrideApproverId] = useState('');
  const [overriding, setOverriding] = useState(false);

  const fetchScoreRuns = useCallback(async () => {
    if (!appId) return;
    try {
      const data = await scoringApi.listScores(appId);
      setScoreRuns(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load score runs')); }
  }, [appId]);

  useEffect(() => { fetchScoreRuns(); }, [fetchScoreRuns]);

  const handleRunScore = async () => {
    if (!appId) return;
    try {
      setRunningScore(true);
      await scoringApi.executeScore(appId);
      toast.success('Credit scoring completed');
      fetchScoreRuns();
      onRefresh();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to run credit score')); }
    finally { setRunningScore(false); }
  };

  const handleOverrideScore = async () => {
    if (!showOverrideDialog) return;
    try {
      setOverriding(true);
      await scoringApi.overrideScore(showOverrideDialog, {
        rating: overrideRating,
        reason: overrideReason,
        approverId: overrideApproverId || user?.id || '',
      });
      toast.success('Risk rating overridden');
      setShowOverrideDialog(null);
      setOverrideRating('NR');
      setOverrideReason('');
      setOverrideApproverId('');
      fetchScoreRuns();
      onRefresh();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to override risk rating')); }
    finally { setOverriding(false); }
  };

  return (
    <>
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
            { label: 'Borrower', value: app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : '—', icon: 'account_circle', sub: app.borrowerProfile?.contact?.email },
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

      {/* Credit Scoring Section */}
      <div className="mt-6 bg-bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Credit Scoring</h3>
          {canWrite && (
            <button onClick={handleRunScore} disabled={runningScore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
              style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined text-base">speed</span>
              {runningScore ? 'Running...' : 'Run Score'}
            </button>
          )}
        </div>

        {scoreRuns.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-4">No score runs yet. Click "Run Score" to execute credit scoring.</p>
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
                    <div className="flex items-center gap-2">
                      {latest.overriddenRating && (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                          Overridden (was {latest.riskRating})
                        </span>
                      )}
                      <button onClick={() => setShowOverrideDialog(latest.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                        style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <span className="material-symbols-outlined text-sm">edit</span> Override
                      </button>
                    </div>
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

      {/* Override Score Dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowOverrideDialog(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Override Risk Rating</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">New Rating *</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {RISK_RATINGS.map(r => (
                    <button key={r} onClick={() => setOverrideRating(r)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        overrideRating === r ? 'ring-2 ring-brand-300 ' : ''
                      }`} style={{
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        background: (RISK_COLORS[r]?.bg || '#6b728020'),
                        color: (RISK_COLORS[r]?.text || '#6b7280'),
                        borderColor: (RISK_COLORS[r]?.text || '#6b7280') + '40',
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Override Reason *</label>
                <textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Provide reason for overriding the risk rating..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Approver ID</label>
                <input type="text" value={overrideApproverId} onChange={e => setOverrideApproverId(e.target.value)}
                  placeholder="Approver user ID (defaults to current user)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowOverrideDialog(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={handleOverrideScore} disabled={!overrideReason || overriding}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {overriding ? 'Overriding...' : 'Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SummaryTab;