import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import announcementService, { Announcement } from '../src/services/announcement.service';

const PRIORITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: '#f0fdf4', text: '#16a34a', label: 'Low' },
  MEDIUM: { bg: '#fefce8', text: '#ca8a04', label: 'Medium' },
  HIGH: { bg: '#fff7ed', text: '#ea580c', label: 'High' },
  CRITICAL: { bg: '#fef2f2', text: '#dc2626', label: 'Critical' },
};

const CATEGORY_STYLE: Record<string, { color: string; icon: string }> = {
  HR: { color: 'var(--color-hr-500)', icon: 'groups' },
  IT: { color: 'var(--color-it-500)', icon: 'devices' },
  FINANCE: { color: '#059669', icon: 'payments' },
  POLICY: { color: '#7c3aed', icon: 'gavel' },
  MARKETING: { color: '#9333ea', icon: 'campaign' },
  GENERAL: { color: '#6b7280', icon: 'info' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const AnnouncementDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await announcementService.getOne(id);
        setAnnouncement(data);
        // Auto-mark as read
        try { await announcementService.markRead(id); } catch { /* silent */ }
      } catch (err: any) {
        setError('Failed to load announcement.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }} className="px-4 sm:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-border rounded w-1/4" />
          <div className="h-8 bg-border rounded w-3/4" />
          <div className="h-4 bg-border rounded w-full" />
          <div className="h-4 bg-border rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }} className="px-4 sm:px-8 py-8 text-center">
        <span className="material-symbols-outlined text-5xl text-red-400 mb-3 block">error</span>
        <p className="font-bold text-text-primary mb-2">{error || 'Announcement not found'}</p>
        <Link to="/announcements" className="text-sm font-semibold text-brand-700 hover:underline">Back to Announcements</Link>
      </div>
    );
  }

  const prio = PRIORITY_BADGE[announcement.priority] || PRIORITY_BADGE.MEDIUM;
  const catStyle = CATEGORY_STYLE[announcement.category] || CATEGORY_STYLE.GENERAL;
  const readCount = announcement._count?.readBy || announcement.readBy?.length || 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6">
        <Link to="/announcements" className="hover:text-brand-700 transition-colors">Announcements</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-text-primary font-semibold truncate max-w-[300px]">{announcement.title}</span>
      </nav>

      {/* Article card */}
      <article className="bg-surface border border-border rounded-cwc-lg overflow-hidden shadow-cwc-sm">
        {/* Top bar with category + priority */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface-muted">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ color: catStyle.color }}>{catStyle.icon}</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: catStyle.color }}>{announcement.category}</span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: prio.bg, color: prio.text }}>{prio.label}</span>
          {announcement.isPinned && (
            <span className="text-xs font-bold text-brand-700">📌 Pinned</span>
          )}
          {readCount > 0 && (
            <span className="ml-auto text-xs text-text-tertiary flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">visibility</span>
              {readCount} read{readCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Title area */}
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-2xl font-black text-text-primary leading-tight mb-3">{announcement.title}</h1>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            {announcement.author && (
              <span className="font-semibold">{announcement.author.firstName} {announcement.author.lastName}</span>
            )}
            {announcement.publishedAt && (
              <>
                <span>·</span>
                <span>{formatDate(announcement.publishedAt)}</span>
              </>
            )}
            {announcement.targetAudience && (
              <>
                <span>·</span>
                <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-semibold">{announcement.targetAudience}</span>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="tiptap-content px-6 pb-8 text-text-primary leading-relaxed" style={{ fontSize: 'var(--text-sm)' }} dangerouslySetInnerHTML={{ __html: announcement.content }} />

        {/* Footer */}
        {announcement.expiresAt && (
          <div className="px-6 py-3 border-t border-border bg-surface-muted text-xs text-text-tertiary">
            Expires: {formatDate(announcement.expiresAt)}
          </div>
        )}
      </article>

      {/* Back button */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/announcements')}
          className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Announcements
        </button>
      </div>
    </div>
  );
};

export default AnnouncementDetail;