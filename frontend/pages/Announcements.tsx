import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import announcementService, { Announcement, AnnouncementCategory, AnnouncementPriority } from '../src/services/announcement.service';
import { useToast } from '../src/context/ToastContext';

const CATEGORY_COLOR: Record<string, string> = {
  HR: 'var(--color-hr-500)',
  IT: 'var(--color-it-500)',
  FINANCE: 'var(--color-fin-500)',
  POLICY: '#8b5cf6',
  MARKETING: '#f59e0b',
  GENERAL: 'var(--color-brand-700)',
};

const PRIORITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  CRITICAL: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
  HIGH:     { bg: '#fff7ed', color: '#ea580c', label: 'High' },
  MEDIUM:   { bg: '#eff6ff', color: '#2563eb', label: 'Medium' },
  LOW:      { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'HR', label: 'HR' },
  { value: 'IT', label: 'IT' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'GENERAL', label: 'General' },
];

export default function Announcements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AnnouncementCategory | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('open'));
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const result = await announcementService.list({
        page,
        limit: 20,
        category: category as AnnouncementCategory || undefined,
      });
      setAnnouncements(result.announcements);
      setTotalPages(result.pagination.totalPages);
    } catch {
      toast.error('Error', 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    setModalLoading(true);
    announcementService.getOne(selectedId)
      .then(a => setSelected(a))
      .catch(() => toast.error('Error', 'Failed to load announcement'))
      .finally(() => setModalLoading(false));
  }, [selectedId]);

  const pinned = announcements.filter(a => a.isPinned);
  const rest = announcements.filter(a => !a.isPinned);

  const AnnouncementCard = ({ a }: { a: Announcement }) => {
    const catColor = CATEGORY_COLOR[a.category] || 'var(--color-brand-700)';
    const pri = PRIORITY_BADGE[a.priority];
    return (
      <div
        onClick={() => { setSelectedId(a.id); setSearchParams({ open: a.id }); }}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderLeft: `4px solid ${catColor}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'var(--shadow-md)'; el.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = ''; el.style.transform = ''; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
          {a.isPinned && <span style={{ fontSize: 12 }}>📌</span>}
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: '.05em' }}>{a.category}</span>
          {pri && (
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: pri.bg, color: pri.color }}>{pri.label}</span>
          )}
          {!a.isRead && (
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}>New</span>
          )}
        </div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: a.isRead ? 600 : 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {a.title}
        </div>
        {a.excerpt && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
            {a.excerpt}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {a.author && <span>{a.author.firstName} {a.author.lastName}</span>}
          {a.publishedAt && <span>{formatDate(a.publishedAt)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Announcements</h1>
        <select
          value={category}
          onChange={e => { setCategory(e.target.value as AnnouncementCategory | ''); setPage(1); }}
          style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ height: 12, width: '30%', background: 'var(--color-border)', borderRadius: 4 }} />
              <div style={{ height: 18, width: '70%', background: 'var(--color-border)', borderRadius: 4 }} />
              <div style={{ height: 12, width: '50%', background: 'var(--color-border)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', opacity: .3, marginBottom: 'var(--space-3)' }}>campaign</span>
          <p style={{ fontWeight: 700 }}>No announcements at this time</p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 'var(--space-3)' }}>📌 Pinned</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {pinned.map(a => <AnnouncementCard key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {rest.map(a => <AnnouncementCard key={a.id} a={a} />)}
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? .4 : 1, fontFamily: 'var(--font-sans)' }}>← Prev</button>
              <span style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? .4 : 1, fontFamily: 'var(--font-sans)' }}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setSearchParams({}); } }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', maxWidth: 680, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow-xl)' }}>
            {modalLoading || !selected ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
            ) : (
              <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: CATEGORY_COLOR[selected.category] || 'var(--color-brand-700)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{selected.category}</span>
                      {PRIORITY_BADGE[selected.priority] && (
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: PRIORITY_BADGE[selected.priority].bg, color: PRIORITY_BADGE[selected.priority].color }}>{PRIORITY_BADGE[selected.priority].label}</span>
                      )}
                    </div>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>{selected.title}</h2>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {selected.author && `${selected.author.firstName} ${selected.author.lastName}`}
                      {selected.publishedAt && ` · ${formatDate(selected.publishedAt)}`}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedId(null); setSearchParams({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                </div>
                <div className="tiptap-content" style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }} dangerouslySetInnerHTML={{ __html: selected.content }} />
                {selected.attachmentUrl && (
                  <a
                    href={selected.attachmentUrl.startsWith('http') ? selected.attachmentUrl : `/api/v1/files/download/${selected.attachmentUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'none' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                    Download original document
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}