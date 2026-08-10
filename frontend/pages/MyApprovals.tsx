import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditApproval, ApplicationState, ApprovalDecision,
} from '../src/services/credit.service';
import { dashboardApi } from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import { formatCurrency, formatDate } from './credit/creditUtils';
import StateBadge from '../src/components/credit/StateBadge';
import RiskBadge from '../src/components/credit/RiskBadge';
import ApprovalQuickView from '../src/components/credit/ApprovalQuickView';
import { getBorrowerDisplayName } from '../src/components/credit/BorrowerSummaryCard';
import { useIsMobile } from '../src/hooks/useIsMobile';

function getUrgency(createdAt: string, state: ApplicationState, slaBreached?: boolean): { level: 'overdue' | 'urgent' | 'normal'; text: string; color: string; icon: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  // SLA breach comes from the API (creditSlaBreach table) — no more hardcoded map
  if (slaBreached) return { level: 'overdue', text: 'Overdue', color: '#dc2626', icon: 'error' };
  // Fallback heuristic for states without a breach record yet
  const fallbackDays: Partial<Record<ApplicationState, number>> = {
    COMMITTEE_REVIEW: 2, KYC_REVIEW: 3, UNDERWRITING: 5, CREDIT_ASSESSMENT: 5,
    SUBMITTED: 3, OFFER: 5,
  };
  const limit = fallbackDays[state];
  if (!limit) return { level: 'normal', text: `${days}d`, color: '#6b7280', icon: 'schedule' };
  const remaining = limit - days;
  if (remaining <= 0) return { level: 'overdue', text: 'Overdue', color: '#dc2626', icon: 'error' };
  if (remaining <= 1) return { level: 'urgent', text: 'Due today', color: '#ea580c', icon: 'priority_high' };
  if (remaining <= 2) return { level: 'urgent', text: `${remaining}d left`, color: '#ea580c', icon: 'priority_high' };
  return { level: 'normal', text: `${remaining}d left`, color: '#16a34a', icon: 'check_circle' };
}

/**
 * The approval-inbox endpoint returns its own summary DTO, not a
 * `CreditApplication`. The field names differ in three places that matter:
 * `applicationId` not `id`, `applicationNo` not `applicationNumber`,
 * `currentState` not `state`, and `borrowerName` is a flat string rather than a
 * nested profile.
 *
 * When LOS-020 repointed this page at the inbox, the rows were fed to the card
 * renderer unmapped. `app.state` was therefore `undefined`, and `StateBadge`
 * threw on `state.replace(...)` — crashing the whole page into its error
 * boundary for every user, including admin. The endpoint was untyped (`any`),
 * so nothing flagged it at compile time.
 */
interface ApprovalInboxItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  productType: string;
  requestedAmount: number;
  currency: string;
  currentState: ApplicationState;
  urgency: string;
  submittedAt: string;
  daysWaiting: number;
  riskRating?: string;
  requestedTenor?: number;
  _slaBreached?: boolean;
}

function toApplication(item: ApprovalInboxItem): CreditApplication {
  return {
    ...item,
    id: item.applicationId,
    applicationNumber: item.applicationNo,
    state: item.currentState,
    // The cards date off createdAt; the inbox only knows when it was submitted.
    createdAt: item.submittedAt,
    // getBorrowerDisplayName reads a profile object. The inbox has already
    // resolved the display name, so carry it through in the shape the helper
    // expects rather than reaching back to the API for the full profile.
    borrowerProfile: { name: item.borrowerName } as CreditApplication['borrowerProfile'],
  } as unknown as CreditApplication;
}

const MyApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const hasRedirected = useRef(false);

  // Sprint 4: Mobile redirect to dedicated mobile approval inbox
  useEffect(() => {
    if (isMobile && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/credit/m/approvals', { replace: true });
    }
  }, [isMobile, navigate]);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickViewApp, setQuickViewApp] = useState<CreditApplication | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [excluded, setExcluded] = useState<{ applicationId: string; borrowerName: string; reason: string }[]>([]);

  const canApprove = hasPermission(user, 'credit:approve');

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      // LOS-020 — the dashboard inbox is the single source of truth for what
      // this user may actually act on: it applies authority level, SOD and
      // already-decided filtering server-side. The old state fan-out showed
      // cases the user could not approve, producing failed actions.
      const res = await dashboardApi.getApprovalInbox();
      const inbox = res.data.data;
      setApplications(
        [...inbox.high, ...inbox.medium, ...inbox.low].map(toApplication),
      );
      setExcluded(inbox.excluded ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canApprove) fetchPending(); }, [canApprove, fetchPending]);

  // Remove app from list after a decision
  const handleDecision = useCallback((applicationId: string, _decision: ApprovalDecision) => {
    setApplications(prev => prev.filter(a => a.id !== applicationId));
  }, []);

  // Group by urgency — _slaBreached comes from the API (creditSlaBreach table)
  const overdue = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state, (a as any)._slaBreached).level === 'overdue';
  });
  const urgent = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state, (a as any)._slaBreached).level === 'urgent';
  });
  const normal = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state, (a as any)._slaBreached).level === 'normal';
  });

  const openQuickView = (app: CreditApplication) => {
    setQuickViewApp(app);
    setQuickViewOpen(true);
  };

  const renderCard = (app: CreditApplication) => {
    const state = (app.state || app.status) as ApplicationState;
    const urgency = getUrgency(app.createdAt, state, (app as any)._slaBreached);
    const borrowerName = getBorrowerDisplayName(app.borrowerProfile);
    const analystName = app.analyst
      ? `${app.analyst.firstName} ${app.analyst.lastName}`
      : null;
    const rmName = app.rm
      ? `${app.rm.firstName} ${app.rm.lastName}`
      : null;

    return (
      <div key={app.id}
        className="bg-bg-surface border border-border rounded-xl transition-all hover:shadow-md hover:border-brand-300"
        style={{ borderLeft: `3px solid ${urgency.color}` }}
      >
        {/* Top: State + Urgency + Quick View button */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <StateBadge state={state} size="sm" />
          <RiskBadge rating={app.riskRating} size="sm" />
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold ml-auto" style={{ color: urgency.color }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden="true">{urgency.icon}</span>
            {urgency.text}
          </span>
        </div>

        {/* Borrower name */}
        <div className="px-4 pb-1">
          <p className="text-sm font-bold text-text-primary">{borrowerName}</p>
        </div>

        {/* Amount + Tenor */}
        <div className="px-4 pb-2">
          <p className="text-xs text-text-secondary">
            {formatCurrency(app.requestedAmount, app.currency)} · {app.requestedTenor != null ? `${app.requestedTenor} mo` : '—'} · {app.productType.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Decision Context: Analyst, RM, Exposure */}
        {(analystName || rmName || app.borrowerProfile?.totalExposure != null) && (
          <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-1">
            {analystName && (
              <span className="text-[11px] text-text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: -2 }} aria-hidden="true">person</span>
                {' '}{analystName}
              </span>
            )}
            {rmName && (
              <span className="text-[11px] text-text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: -2 }} aria-hidden="true">handshake</span>
                {' '}{rmName}
              </span>
            )}
            {app.borrowerProfile?.totalExposure != null && (
              <span className="text-[11px] text-text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: -2 }} aria-hidden="true">account_balance</span>
                {' '}Exposure: {formatCurrency(app.borrowerProfile.totalExposure, app.currency)}
              </span>
            )}
          </div>
        )}

        {/* Bottom: Date + Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          <span className="text-xs text-text-tertiary">{formatDate(app.createdAt)}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); openQuickView(app); }}
              className="flex items-center gap-1 text-xs text-brand-700 font-semibold hover:text-brand-800 transition-colors px-2 py-1 rounded-md hover:bg-brand-50"
              aria-label={`Quick view ${borrowerName}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">visibility</span>
              Quick View
            </button>
            <button
              onClick={() => navigate(`/credit/applications/${app.id}?tab=approvals`)}
              className="flex items-center gap-1 text-xs text-text-secondary font-semibold hover:text-text-primary transition-colors"
              aria-label={`Open full detail for ${borrowerName}`}
            >
              Detail <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, items: CreditApplication[], icon: string, iconColor: string) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-lg" style={{ color: iconColor }} aria-hidden="true">{icon}</span>
        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">{title}</h2>
        <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary py-2">No items in this group</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(renderCard)}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/credit" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span><span className="font-semibold text-text-primary">My Approvals</span>
            </div>
            <h1 className="text-2xl font-black text-text-primary">My Approvals</h1>
            <p className="text-sm text-text-secondary mt-1">Applications pending your review and decision</p>
          </div>
          <button onClick={fetchPending}
            className="flex items-center gap-1.5 border border-border px-3 py-2 rounded-lg text-sm font-semibold hover:bg-bg-subtle transition-colors"
            style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            <span className="material-symbols-outlined text-base">refresh</span> Refresh
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-red-600">error</span>
            <span className="font-bold text-red-700">{overdue.length}</span>
            <span className="text-red-600">Overdue</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-amber-600">schedule</span>
            <span className="font-bold text-amber-700">{urgent.length}</span>
            <span className="text-amber-600">Urgent</span>
          </div>
          <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
            <span className="material-symbols-outlined text-base text-text-secondary">inbox</span>
            <span className="font-bold text-text-primary">{normal.length}</span>
            <span className="text-text-secondary">Normal</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-surface border border-border rounded-xl p-4" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ height: 12, width: '60%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 12, width: '40%', background: 'var(--color-border)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-16 text-text-secondary bg-bg-surface border border-border rounded-xl">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">check_circle</span>
            <p className="font-bold text-lg">All caught up!</p>
            <p className="text-sm mt-1">No applications pending your approval</p>
          </div>
        ) : (
          <>
            {renderGroup('Overdue', overdue, 'error', '#dc2626')}
            {renderGroup('Urgent', urgent, 'schedule', '#ea580c')}
            {renderGroup('Pending Review', normal, 'inbox', '#6b7280')}
          </>
        )}

        {excluded.length > 0 && (
          <details style={{ marginTop: 24, fontSize: 13, color: '#6b7280' }}>
            <summary style={{ cursor: 'pointer' }}>
              {excluded.length} application{excluded.length === 1 ? '' : 's'} not shown
            </summary>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {excluded.map((x) => (
                <li key={x.applicationId} style={{ marginBottom: 4 }}>
                  <strong>{x.borrowerName}</strong> — {x.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Quick View Slide-Over */}
      <ApprovalQuickView
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        application={quickViewApp}
        onDecision={handleDecision}
      />
    </>
  );
};

export default MyApprovals;