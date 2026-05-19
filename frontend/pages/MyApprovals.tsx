import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditApproval, ApplicationState,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null, currency = 'MYR') =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency as any, maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED: { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

function getUrgency(createdAt: string, state: ApplicationState): { level: 'overdue' | 'urgent' | 'normal'; text: string; color: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const slaMap: Partial<Record<ApplicationState, number>> = {
    COMMITTEE_REVIEW: 2, KYC_REVIEW: 3, UNDERWRITING: 5, CREDIT_ASSESSMENT: 5,
    SUBMITTED: 3, OFFER: 5,
  };
  const limit = slaMap[state];
  if (!limit) return { level: 'normal', text: `${days}d`, color: '#6b7280' };
  const remaining = limit - days;
  if (remaining <= 0) return { level: 'overdue', text: 'Overdue', color: '#dc2626' };
  if (remaining <= 1) return { level: 'urgent', text: 'Due today', color: '#ea580c' };
  if (remaining <= 2) return { level: 'urgent', text: `${remaining}d left`, color: '#ea580c' };
  return { level: 'normal', text: `${remaining}d left`, color: '#16a34a' };
}

const APPROVAL_STATES: ApplicationState[] = ['KYC_REVIEW', 'COMMITTEE_REVIEW', 'CREDIT_ASSESSMENT'];

const MyApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const canApprove = hasPermission(user, 'credit:approve');

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch apps in approval-required states
      const results = await Promise.all(
        APPROVAL_STATES.map(state =>
          creditService.listApplications({ state, limit: 100 }).then(d => d.applications).catch(() => [] as CreditApplication[])
        )
      );
      const all = results.flat();
      // Deduplicate
      const seen = new Set<string>();
      const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
      setApplications(unique);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canApprove) fetchPending(); }, [canApprove, fetchPending]);

  // Group by urgency
  const overdue = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state).level === 'overdue';
  });
  const urgent = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state).level === 'urgent';
  });
  const normal = applications.filter(a => {
    const state = (a.state || a.status) as ApplicationState;
    return getUrgency(a.createdAt, state).level === 'normal';
  });

  const renderCard = (app: CreditApplication) => {
    const state = (app.state || app.status) as ApplicationState;
    const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
    const urgency = getUrgency(app.createdAt, state);
    return (
      <div key={app.id}
        onClick={() => navigate(`/credit/applications/${app.id}?tab=approvals`)}
        className="bg-bg-surface border border-border rounded-xl p-4 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
        style={{ borderLeft: `3px solid ${urgency.color}` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
            {state.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px] font-bold ml-auto" style={{ color: urgency.color }}>{urgency.text}</span>
        </div>
        <p className="text-sm font-bold text-text-primary mb-0.5">
          {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : app.id.slice(0, 8)}
        </p>
        <p className="text-xs text-text-secondary">
          {formatCurrency(app.requestedAmount, app.currency)} · {app.tenureMonths} mo
        </p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-xs text-text-secondary">{formatDate(app.createdAt)}</span>
          <span className="flex items-center gap-1 text-xs text-brand-700 font-semibold">
            Review <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </span>
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, items: CreditApplication[], icon: string, iconColor: string) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-lg" style={{ color: iconColor }}>{icon}</span>
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
      <CreditNav />
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
      </div>
    </>
  );
};

export default MyApprovals;