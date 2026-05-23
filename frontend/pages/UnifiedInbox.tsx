import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import approvalService from '../src/services/approval.service';
import creditService, { CreditApplication, ApplicationState } from '../src/services/credit.service';
import notificationService, { Notification } from '../src/services/notification.service';
import StateBadge from '../src/components/ui/StateBadge';
import RiskBadge from '../src/components/credit/RiskBadge';
import { formatDate as fmtDate, formatCurrency as fmtCurrency } from './credit/creditUtils';

// ── Types ─────────────────────────────────────────────────────────

interface ItsmItem {
  kind: 'itsm';
  id: string;
  referenceNumber: string;
  summary: string;
  priority: string;
  status: string;
  createdAt: string;
  slaDueAt?: string | null;
  slaPaused?: boolean;
  serviceDesk?: { code: string; name: string };
  requestType?: { name: string };
  requester?: { firstName: string; lastName: string };
}

interface CreditItem {
  kind: 'credit';
  id: string;
  borrowerName: string;
  amount: number | null;
  currency: string;
  productType: string;
  state: string;
  riskRating?: string | null;
  createdAt: string;
  requestedTenor?: number | null;
}

interface NotificationItem {
  kind: 'notification';
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  status: string;
  readAt: string | null;
  createdAt: string;
  relatedRequestId: string | null;
}

type InboxItem = ItsmItem | CreditItem | NotificationItem;

// ── Helpers ────────────────────────────────────────────────────────

function getSlaStatus(item: ItsmItem) {
  if (item.slaPaused) return { label: 'Paused', color: 'blue' };
  if (item.slaDueAt) {
    const due = new Date(item.slaDueAt).getTime();
    const now = Date.now();
    if (due < now) return { label: 'Overdue', color: 'red' };
    if (due - now < 24 * 60 * 60 * 1000) return { label: 'At Risk', color: 'orange' };
    return { label: 'On Track', color: 'green' };
  }
  return { label: 'N/A', color: 'gray' };
}

const TIME_FRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

function withinTimeFrame(dateStr: string, tf: string): boolean {
  if (tf === 'all') return true;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const oneDay = 86400000;
  if (tf === 'today') return now - d < oneDay;
  if (tf === 'week') return now - d < 7 * oneDay;
  if (tf === 'month') return now - d < 30 * oneDay;
  return true;
}

// ── Component ──────────────────────────────────────────────────────

const UnifiedInbox: React.FC = () => {
  const { user } = useAuth();
  const canApproveITSM = hasPermission(user, 'request:approve');
  const canApproveCredit = hasPermission(user, 'credit:approve');

  const [activeTab, setActiveTab] = useState<'approvals' | 'notifications' | 'all'>('all');
  const [timeFrame, setTimeFrame] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // ITSM approvals
  const [itsmItems, setItsmItems] = useState<ItsmItem[]>([]);
  // Credit approvals
  const [creditItems, setCreditItems] = useState<CreditItem[]>([]);
  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<void>[] = [];

      if (canApproveITSM) {
        promises.push(
          approvalService.getPendingApprovals({ page: 1, limit: 50 })
            .then(data => {
              const reqs = data?.requests || data?.data?.requests || [];
              setItsmItems(reqs.map((r: any) => ({
                kind: 'itsm' as const, id: r.id, referenceNumber: r.referenceNumber,
                summary: r.summary, priority: r.priority, status: r.status,
                createdAt: r.createdAt, slaDueAt: r.slaDueAt, slaPaused: r.slaPaused,
                serviceDesk: r.serviceDesk, requestType: r.requestType, requester: r.requester,
              })));
            })
            .catch(() => setItsmItems([]))
        );
      }

      if (canApproveCredit) {
        const creditStates: ApplicationState[] = ['KYC_REVIEW', 'COMMITTEE_REVIEW', 'CREDIT_ASSESSMENT'];
        promises.push(
          Promise.all(creditStates.map(s => creditService.listApplications({ state: s, limit: 100 }).then(d => d.applications).catch(() => [])))
            .then(results => {
              const all = results.flat();
              const seen = new Set<string>();
              const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
              setCreditItems(unique.map((a: CreditApplication) => ({
                kind: 'credit' as const, id: a.id,
                borrowerName: a.borrowerProfile
                  ? (a.borrowerProfile.account?.name || (a.borrowerProfile.contact ? `${a.borrowerProfile.contact.firstName} ${a.borrowerProfile.contact.lastName}` : 'Borrower'))
                  : a.id.slice(0, 8),
                amount: a.requestedAmount, currency: a.currency || 'MYR',
                productType: a.productType, state: a.state || a.status || '',
                riskRating: a.riskRating, createdAt: a.createdAt, requestedTenor: a.requestedTenor,
              })));
            })
            .catch(() => setCreditItems([]))
        );
      }

      // Notifications
      promises.push(
        notificationService.getNotifications(1, 50)
          .then(data => {
            const notifs = data?.data || [];
            setNotifications(notifs.map((n: Notification) => ({
              kind: 'notification' as const, id: n.id, subject: n.subject, body: n.body,
              channel: n.channel, status: n.status, readAt: n.readAt,
              createdAt: n.createdAt, relatedRequestId: n.relatedRequestId,
            })));
          })
          .catch(() => setNotifications([]))
      );

      await Promise.all(promises);
    } finally {
      setLoading(false);
    }
  }, [canApproveITSM, canApproveCredit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mark notification as read
  const markRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch { /* ignore */ }
  };

  // Filter by time
  const filterByTime = <T extends { createdAt: string }>(items: T[]): T[] => items.filter(i => withinTimeFrame(i.createdAt, timeFrame));

  const filteredItsm = filterByTime(itsmItems);
  const filteredCredit = filterByTime(creditItems);
  const filteredNotifs = filterByTime(notifications);

  // Merge into single timeline
  const allItems: InboxItem[] = [
    ...filteredItsm,
    ...filteredCredit,
    ...filteredNotifs,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Count totals
  const approvalCount = filteredItsm.length + filteredCredit.length;
  const notifCount = filteredNotifs.length;
  const unreadCount = filteredNotifs.filter(n => !n.readAt).length;
  const totalCount = approvalCount + notifCount;

  // ── Render item ──────────────────────────────────────────

  const renderItem = (item: InboxItem) => {
    if (item.kind === 'itsm') {
      const sla = getSlaStatus(item);
      const slaColors: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-700',
        red: 'bg-red-100 text-red-700',
        orange: 'bg-orange-100 text-orange-700',
        green: 'bg-green-100 text-green-700',
        gray: 'bg-gray-100 text-gray-500',
      };
      return (
        <Link key={item.id} to={`/request/${item.referenceNumber || item.id}`}
          className="flex items-start gap-3 px-4 py-3 bg-surface border border-cwc-border rounded-lg hover:bg-surface-subtle transition-colors group"
        >
          <span className="material-symbols-outlined text-brand-700 mt-0.5">support_agent</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-brand-700 group-hover:underline">{item.referenceNumber}</span>
              <StateBadge state={item.priority} size="sm" />
              <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${slaColors[sla.color]}`}>{sla.label}</span>
              {sla.label === 'Overdue' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>priority_high</span>Escalated
                </span>
              )}
            </div>
            <p className="text-sm text-text-primary truncate mt-0.5">{item.summary}</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {item.requestType?.name || 'Request'}
              {item.requester ? ` · ${item.requester.firstName} ${item.requester.lastName}` : ''}
              {' · '}{new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className="material-symbols-outlined text-text-tertiary text-lg">chevron_right</span>
        </Link>
      );
    }

    if (item.kind === 'credit') {
      const urgencyColor = (['KYC_REVIEW', 'COMMITTEE_REVIEW', 'CREDIT_ASSESSMENT'].includes(item.state) && (() => {
        const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
        if (days > 5) return 'text-red-600';
        if (days > 2) return 'text-orange-600';
        return 'text-green-600';
      })()) || 'text-text-secondary';

      return (
        <Link key={item.id} to={`/credit/applications/${item.id}?tab=approvals`}
          className="flex items-start gap-3 px-4 py-3 bg-surface border border-cwc-border rounded-lg hover:bg-surface-subtle transition-colors group"
        >
          <span className="material-symbols-outlined text-brand-700 mt-0.5">account_balance</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-brand-700 group-hover:underline">{item.borrowerName}</span>
              <StateBadge state={item.state} size="sm" />
              {item.riskRating && <RiskBadge rating={item.riskRating} size="sm" />}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {fmtCurrency(item.amount, item.currency)} · {item.requestedTenor != null ? `${item.requestedTenor} mo` : '—'} · {item.productType.replace(/_/g, ' ')}
            </p>
            <p className={`text-xs mt-0.5 ${urgencyColor}`}>
              {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className="material-symbols-outlined text-text-tertiary text-lg">chevron_right</span>
        </Link>
      );
    }

    // Notification
    return (
      <div key={item.id}
        className={`flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors cursor-pointer ${
          item.readAt ? 'bg-surface border-cwc-border' : 'bg-brand-50 border-brand-200 hover:bg-brand-100'
        }`}
        onClick={() => { if (!item.readAt) markRead(item.id); }}
      >
        <span className={`material-symbols-outlined mt-0.5 ${item.readAt ? 'text-text-tertiary' : 'text-brand-700'}`}>
          {item.readAt ? 'notifications' : 'notifications_active'}
        </span>
        <div className="flex-1 min-w-0">
          {item.subject && <p className={`text-sm font-semibold ${item.readAt ? 'text-text-primary' : 'text-brand-900'}`}>{item.subject}</p>}
          <p className="text-sm text-text-secondary line-clamp-2">{item.body}</p>
          <p className="text-xs text-text-tertiary mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
        </div>
        {item.relatedRequestId && (
          <Link to={`/request/${item.relatedRequestId}`}
            className="flex items-center gap-1 text-xs text-brand-700 font-semibold hover:underline"
            onClick={e => e.stopPropagation()}
          >
            View <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
          </Link>
        )}
        <span className="material-symbols-outlined text-text-tertiary text-lg mt-0.5">chevron_right</span>
      </div>
    );
  };

  // ── Tabs ──────────────────────────────────────────────────
  const tabs: { key: 'approvals' | 'notifications' | 'all'; label: string; icon: string; count: number; unread?: number }[] = [
    { key: 'all', label: 'All', icon: 'layers', count: totalCount },
    { key: 'approvals', label: 'Approvals', icon: 'approval', count: approvalCount },
    { key: 'notifications', label: 'Notifications', icon: 'notifications', count: notifCount, unread: unreadCount },
  ];

  const displayedItems = activeTab === 'approvals'
    ? [...filteredItsm, ...filteredCredit].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : activeTab === 'notifications'
    ? filteredNotifs
    : allItems;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Inbox' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Inbox</h1>
          <p className="text-sm text-text-secondary mt-1">{totalCount} item{totalCount !== 1 ? 's' : ''} · {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 border border-cwc-border px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-subtle transition-colors bg-surface"
            >
              <span className="material-symbols-outlined text-base">done_all</span> Mark All Read
            </button>
          )}
          <button onClick={fetchData}
            className="flex items-center gap-1.5 border border-cwc-border px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-subtle transition-colors bg-surface"
          >
            <span className="material-symbols-outlined text-base">refresh</span> Refresh
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-cwc-border">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-text-secondary'
            }`}>{tab.count}</span>
            {tab.unread ? (
              <span className="ml-0.5 text-xs px-1.5 py-0.5 bg-red-600 text-white rounded-full font-bold">{tab.unread}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Time Filter */}
      <div className="flex items-center gap-2 mb-6">
        {TIME_FRAMES.map(tf => (
          <button key={tf.value} onClick={() => setTimeFrame(tf.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              timeFrame === tf.value ? 'bg-brand-700 text-white' : 'bg-surface border border-cwc-border text-text-secondary hover:bg-surface-subtle'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-surface-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="text-center py-16 text-text-secondary bg-surface border border-cwc-border rounded-xl">
          <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">inbox</span>
          <p className="font-bold text-lg">Nothing here</p>
          <p className="text-sm mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedItems.map(renderItem)}
        </div>
      )}
    </div>
  );
};

export default UnifiedInbox;