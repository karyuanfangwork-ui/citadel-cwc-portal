import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import notificationService, { Notification } from '../services/notification.service';
import { useNotifications } from '../context/NotificationContext';

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const { unreadCount, setUnreadCount, recentNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Prepend real-time notification when dropdown is open
  useEffect(() => {
    if (recentNotification && open) {
      setNotifications(prev => {
        if (prev.some(n => n.id === recentNotification.id)) return prev;
        setTotal(t => t + 1);
        return [{ ...recentNotification, channel: 'IN_APP', status: 'SENT', readAt: null }, ...prev];
      });
    }
  }, [recentNotification, open]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const result = await notificationService.getNotifications(p);
      setNotifications(prev => replace ? result.data : [...prev, ...result.data]);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  function handleToggle() {
    if (!open) {
      fetchPage(1, true);
    }
    setOpen(o => !o);
  }

  async function handleMarkAllRead() {
    await notificationService.markAllAsRead();
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
  }

  async function handleClickNotification(n: Notification) {
    if (!n.readAt) {
      await notificationService.markAsRead(n.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)
      );
    }
    if (n.relatedRequestId) {
      navigate(`/request/${n.relatedRequestId}`);
      setOpen(false);
    }
  }

  async function handleDismiss(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    await notificationService.deleteNotification(n.id);
    if (!n.readAt) setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    setTotal(t => Math.max(0, t - 1));
  }

  const hasMore = page < totalPages;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center h-10 w-10 min-w-0 rounded-full bg-[#e8edf2] hover:bg-[#d0d8e2] transition-colors"
      >
        <span data-testid="notification-icon-wrapper" className="flex h-6 w-6 min-w-0 items-center justify-center overflow-hidden">
          <span className="material-symbols-outlined block whitespace-nowrap text-[#0e141b] text-xl">notifications</span>
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[70] flex flex-col" style={{ maxHeight: 520 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#101418] text-sm">Notifications</h3>
              {total > 0 && (
                <span className="text-xs text-[#44546f] bg-gray-100 rounded-full px-2 py-0.5 font-medium">{total}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[#0052cc] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex flex-col gap-0">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 flex gap-3 items-start animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-gray-200 mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-2 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-12 text-center text-[#44546f]">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-30">notifications_off</span>
                <p className="text-sm font-semibold">All caught up</p>
                <p className="text-xs text-[#8993a4] mt-1">No notifications yet</p>
              </div>
            )}

            {!loading && notifications.map(n => (
              <div
                key={n.id}
                className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-50 transition-colors cursor-pointer ${!n.readAt ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => handleClickNotification(n)}
              >
                {/* Unread dot */}
                <span className={`mt-2 h-2 w-2 rounded-full flex-shrink-0 ${!n.readAt ? 'bg-[#0052cc]' : 'bg-transparent'}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm line-clamp-1 ${!n.readAt ? 'font-semibold text-[#101418]' : 'font-medium text-[#44546f]'}`}>
                    {n.subject ?? 'Notification'}
                  </p>
                  <p className="text-xs text-[#44546f] line-clamp-2 mt-0.5">{stripHtml(n.body)}</p>
                  <p className="text-[11px] text-[#8993a4] mt-1">{formatTime(n.createdAt)}</p>
                </div>

                {/* Dismiss button — appears on hover */}
                <button
                  onClick={e => handleDismiss(e, n)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-[#8993a4] hover:text-[#101418] mt-0.5 p-0.5 rounded"
                  aria-label="Dismiss"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ))}

            {/* Load more */}
            {!loading && hasMore && (
              <button
                onClick={() => fetchPage(page + 1, false)}
                disabled={loadingMore}
                className="w-full py-3 text-sm font-semibold text-[#0052cc] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingMore
                  ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Loading…</>
                  : <><span className="material-symbols-outlined text-sm">expand_more</span> Load more</>
                }
              </button>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 flex-shrink-0 flex items-center justify-between">
              <span className="text-xs text-[#8993a4]">
                Showing {notifications.length} of {total}
              </span>
              {unreadCount === 0 && (
                <span className="text-xs text-[#0052cc] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  All read
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
