import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { useAuth } from '../src/context/AuthContext';
import notificationService, { Notification } from '../src/services/notification.service';

// ── Types ─────────────────────────────────────────────────────────

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

type InboxItem = NotificationItem;

// ── Helpers ────────────────────────────────────────────────────────

const TIME_FRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

/** Strip HTML tags so raw HTML bodies display as readable plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
  const navigate = useNavigate();

  const [timeFrame, setTimeFrame] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(1, 50);
      const notifs = data?.data || [];
      setNotifications(notifs.map((n: Notification) => ({
        kind: 'notification' as const, id: n.id, subject: n.subject, body: n.body,
        channel: n.channel, status: n.status, readAt: n.readAt,
        createdAt: n.createdAt, relatedRequestId: n.relatedRequestId,
      })));
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredNotifs = filterByTime(notifications);
  const displayedItems = filteredNotifs;

  // Count totals
  const unreadCount = filteredNotifs.filter(n => !n.readAt).length;

  // ── Render item ──────────────────────────────────────────

  const renderItem = (item: NotificationItem) => {
    const handleClick = () => {
      if (!item.readAt) markRead(item.id);
      if (item.relatedRequestId) navigate(`/request/${item.relatedRequestId}`);
    };

    return (
    <div key={item.id}
      className={`flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors cursor-pointer ${
        item.readAt ? 'bg-surface border-cwc-border' : 'bg-brand-50 border-brand-200 hover:bg-brand-100'
      }`}
      onClick={handleClick}
      role={item.relatedRequestId ? 'button' : undefined}
      tabIndex={item.relatedRequestId ? 0 : undefined}
      onKeyDown={item.relatedRequestId ? (e => { if (e.key === 'Enter') handleClick(); }) : undefined}
    >
      <span className={`material-symbols-outlined mt-0.5 ${item.readAt ? 'text-text-tertiary' : 'text-brand-700'}`}>
        {item.readAt ? 'notifications' : 'notifications_active'}
      </span>
      <div className="flex-1 min-w-0">
        {item.subject && <p className={`text-sm font-semibold ${item.readAt ? 'text-text-primary' : 'text-brand-900'}`}>{item.subject}</p>}
        <p className="text-sm text-text-secondary line-clamp-2">{stripHtml(item.body)}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
      </div>
      {item.relatedRequestId && (
        <span className="flex items-center gap-1 text-xs text-brand-700 font-semibold">
          View <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
        </span>
      )}
      <span className="material-symbols-outlined text-text-tertiary text-lg mt-0.5">chevron_right</span>
    </div>
  );}

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Notifications</h1>
          <p className="text-sm text-text-secondary mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
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
          <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">notifications_off</span>
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