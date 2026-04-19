import { useState, useEffect, useRef } from 'react';
import notificationService, { Notification } from '../services/notification.service';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchUnreadCount() {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail — non-critical
    }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const result = await notificationService.getNotifications();
      setNotifications(result.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  }

  async function handleMarkAllRead() {
    await notificationService.markAllAsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  async function handleClickNotification(notification: Notification) {
    if (!notification.readAt) {
      await notificationService.markAsRead(notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }
    if (notification.relatedRequestId) {
      window.location.hash = `#/request/${notification.relatedRequestId}`;
      setOpen(false);
    }
  }

  function formatTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-[#e8edf2] hover:bg-[#d0d8e2] transition-colors"
      >
        <span className="material-symbols-outlined text-[#0e141b] text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[480px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-[#101418]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-[#0052cc] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-8 text-center text-[#44546f]">Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="p-8 text-center text-[#44546f]">
                <span className="material-symbols-outlined text-4xl mb-2 block">notifications_off</span>
                No notifications
              </div>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.readAt ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-[#0052cc] flex-shrink-0" />
                    )}
                    <div className={!n.readAt ? '' : 'ml-5'}>
                      <p className="text-sm font-medium text-[#101418] line-clamp-1">
                        {n.subject ?? 'Notification'}
                      </p>
                      <p className="text-xs text-[#44546f] line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-xs text-[#8899aa] mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
