import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import announcementService, { Announcement, AnnouncementCategory, AnnouncementPriority } from '../src/services/announcement.service';
import { useToast } from '../src/context/ToastContext';
import RichTextEditor from '../src/components/RichTextEditor';


const CATEGORIES: AnnouncementCategory[] = ['HR', 'IT', 'FINANCE', 'POLICY', 'MARKETING', 'GENERAL'];
const PRIORITIES: AnnouncementPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const EMPTY_FORM = {
  title: '',
  content: '',
  excerpt: '',
  category: 'GENERAL' as AnnouncementCategory,
  priority: 'MEDIUM' as AnnouncementPriority,
  isPinned: false,
  isPublished: false,
  expiresAt: '',
  attachmentUrl: null as string | null,
  attachmentName: '',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnnouncementsManage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission guard
  useEffect(() => {
    if (user && !hasPermission(user, 'announcement:write')) {
      toast.error('Permission Denied', 'You do not have permission to manage announcements');
      navigate('/');
    }
  }, [user]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await announcementService.adminList({
        limit: 50,
        isPublished: filterStatus === 'all' ? undefined : filterStatus === 'published',
      });
      setAnnouncements(result.announcements);
    } catch {
      toast.error('Error', 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSlideOverOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      excerpt: a.excerpt ?? '',
      category: a.category,
      priority: a.priority,
      isPinned: a.isPinned,
      isPublished: a.isPublished,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
      attachmentUrl: a.attachmentUrl,
      attachmentName: a.attachmentUrl ? 'Existing attachment' : '',
    });
    setSlideOverOpen(true);
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const result = await announcementService.parseDocument(file);
      const text = result.text || form.content;
      // Convert plain text to HTML paragraphs for the rich editor
      const htmlContent = text.split('\n').filter(line => line.trim()).map(line => `<p>${line}</p>`).join('');
      setForm(f => ({
        ...f,
        content: htmlContent,
        attachmentUrl: result.s3Key,
        attachmentName: result.filename,
      }));
      if (result.warning) toast.warning('Document Warning', result.warning);
      else toast.success('Uploaded', 'Document uploaded and text extracted');
    } catch {
      toast.error('Upload Failed', 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave(publishNow: boolean) {
    if (!form.title.trim() || form.content.replace(/<[^>]*>/g, '').trim().length === 0) {
      toast.error('Validation', 'Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        content: form.content.trim(),
        excerpt: form.excerpt.trim() || undefined,
        category: form.category,
        priority: form.priority,
        isPinned: form.isPinned,
        isPublished: publishNow,
        expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : null,
        attachmentUrl: form.attachmentUrl,
      };
      if (editingId) {
        await announcementService.update(editingId, data);
      } else {
        await announcementService.create(data);
      }
      toast.success(publishNow ? 'Published' : 'Draft Saved', publishNow ? 'Announcement published' : 'Draft saved');
      setSlideOverOpen(false);
      fetchAll();
    } catch {
      toast.error('Error', 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    try {
      await announcementService.publish(id);
      toast.success('Published', 'Announcement is now live');
      fetchAll();
    } catch {
      toast.error('Error', 'Failed to publish');
    }
  }

  async function handleDelete(id: string) {
    try {
      await announcementService.remove(id);
      toast.success('Deleted', 'Announcement has been deleted');
      setDeleteConfirmId(null);
      fetchAll();
    } catch {
      toast.error('Error', 'Failed to delete');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Manage Announcements</h1>
        <button
          onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-5)', background: 'var(--color-brand-700)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          New Announcement
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
        {(['all', 'draft', 'published'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: 'var(--space-1) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', background: filterStatus === s ? 'var(--color-brand-700)' : 'var(--color-surface)', color: filterStatus === s ? '#fff' : 'var(--color-text-primary)' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', opacity: .3, marginBottom: 'var(--space-3)' }}>campaign</span>
            <p style={{ fontWeight: 700 }}>No announcements yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Title', 'Category', 'Priority', 'Status', 'Pinned', 'Expiry', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {announcements.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{a.category}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{a.priority}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: a.isPublished ? '#f0fdf4' : '#f8fafc', color: a.isPublished ? '#16a34a' : '#64748b' }}>
                        {a.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center', fontSize: 14 }}>{a.isPinned ? '📌' : '—'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{a.expiresAt ? formatDate(a.expiresAt) : '—'}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button onClick={() => openEdit(a)} style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Edit</button>
                        {!a.isPublished && (
                          <button onClick={() => handlePublish(a.id)} style={{ padding: '4px 10px', border: '1px solid #16a34a', borderRadius: 'var(--radius-md)', background: '#f0fdf4', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#16a34a', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Publish</button>
                        )}
                        <button onClick={() => setDeleteConfirmId(a.id)} style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', background: '#fef2f2', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over */}
      {slideOverOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSlideOverOpen(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 560, background: 'var(--color-surface)', height: '100%', overflow: 'auto', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
              <button onClick={() => setSlideOverOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>✕</button>
            </div>

            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Title *</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" />
            </div>

            {/* Category + Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AnnouncementCategory }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Priority</label>
                <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as AnnouncementPriority }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Excerpt (optional preview text)</label>
              <input style={inputStyle} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown in dashboard widget" />
            </div>

            {/* Document Upload */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Upload Document (PDF or DOCX)</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleDocUpload} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                  style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-muted)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: uploadingDoc ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: uploadingDoc ? .6 : 1 }}
                >
                  {uploadingDoc ? 'Uploading...' : 'Choose file'}
                </button>
                {form.attachmentName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                    {form.attachmentName}
                    <button onClick={() => setForm(f => ({ ...f, attachmentUrl: null, attachmentName: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 14, lineHeight: 1 }}>✕</button>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>Text will be extracted into the body below. Original file stored as attachment.</p>
            </div>

            {/* Body */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Body *</label>
              <RichTextEditor
                content={form.content}
                onChange={html => setForm(f => ({ ...f, content: html }))}
                placeholder="Write your announcement content..."
              />
            </div>

            {/* Options row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Expiry Date</label>
                <input type="date" style={inputStyle} value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  📌 Pin to top
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{ flex: 1, padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}
              >
                Save Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{ flex: 1, padding: 'var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand-700)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}
              >
                {saving ? 'Saving...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-xl)' }}>
            <h3 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Delete Announcement</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)' }}>This will permanently remove the announcement. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ flex: 1, padding: 'var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}