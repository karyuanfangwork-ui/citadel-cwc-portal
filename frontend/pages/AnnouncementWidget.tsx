import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import announcementService, { DashboardAnnouncement as Announcement } from '../src/services/announcement.service';

const PRIORITY_ICON: Record<string, { icon: string; color: string }> = {
  LOW:     { icon: 'info',        color: 'text-gray-400' },
  MEDIUM:  { icon: 'info',        color: 'text-blue-500' },
  HIGH:    { icon: 'warning',     color: 'text-amber-500' },
  CRITICAL:{ icon: 'error',       color: 'text-red-500' },
};

export default function AnnouncementWidget() {
  const [pinned, setPinned] = useState<Announcement[]>([]);
  const [latest, setLatest] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await announcementService.getDashboard();
      setPinned(data.pinned);
      setLatest(data.latest);
    } catch (err) {
      console.error('Failed to load announcement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const allItems = [...pinned, ...latest].filter(
    (item, idx, arr) => arr.findIndex((a) => a.id === item.id) === idx
  ).slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-brand-600">campaign</span>
          <h3 className="font-semibold text-sm text-text-primary">Announcements</h3>
        </div>
        <div className="flex justify-center py-4">
          <span className="material-symbols-outlined animate-spin text-gray-300">progress_activity</span>
        </div>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-brand-600">campaign</span>
          <h3 className="font-semibold text-sm text-text-primary">Announcements</h3>
        </div>
        <p className="text-xs text-text-secondary text-center py-4">No announcements</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-600">campaign</span>
          <h3 className="font-semibold text-sm text-text-primary">Announcements</h3>
        </div>
        <Link to="/announcements" className="text-xs text-brand-600 hover:underline font-medium">
          View all
        </Link>
      </div>
      <div className="space-y-2.5">
        {allItems.map((ann) => {
          const pri = PRIORITY_ICON[ann.priority] || PRIORITY_ICON.MEDIUM;
          return (
            <Link
              key={ann.id}
              to={`/announcements/${ann.id}`}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className={`material-symbols-outlined text-base mt-0.5 flex-shrink-0 ${pri.color}`}>
                {pri.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {!ann.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 flex-shrink-0" />
                  )}
                  <p className={`text-xs font-medium truncate ${!ann.isRead ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {ann.title}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {formatRelativeTime(ann.publishedAt || ann.createdAt)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}