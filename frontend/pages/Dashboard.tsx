import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/context/AuthContext';
import { serviceDeskService } from '../src/services/serviceDesk.service';
import { requestService } from '../src/services/request.service';
import announcementService, { DashboardAnnouncement } from '../src/services/announcement.service';
import { STATUS_CONFIG, RESOLVED_STATUSES } from '../constants';
import { RequestStatus } from '../types';
import { friendlyMessage } from '../src/utils/errorMessages';

interface ServiceDesk {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  serviceDesk?: { name: string; code: string };
}

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${period}, ${firstName}.`;
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

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

// ── Desk config ────────────────────────────────────────────────────────────

const DESK_STYLE: Record<string, { colorBar: string; iconBg: string; icon: string }> = {
  IT:      { colorBar: 'var(--color-it-500)',  iconBg: 'var(--color-it-50)',  icon: 'devices' },
  HR:      { colorBar: 'var(--color-hr-500)',  iconBg: 'var(--color-hr-50)',  icon: 'groups'  },
  FINANCE: { colorBar: 'var(--color-fin-500)', iconBg: 'var(--color-fin-50)', icon: 'payments' },
};

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonBox = ({ w, h }: { w: string; h: string }) => (
  <div style={{ width: w, height: h, background: 'var(--color-border)', borderRadius: 'var(--radius-sm)', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

// ── Main component ─────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [serviceDesks, setServiceDesks] = useState<ServiceDesk[]>([]);
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinned, setPinned] = useState<DashboardAnnouncement[]>([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState<DashboardAnnouncement[]>([]);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [desksData, requestsData, dashboardData] = await Promise.all([
          serviceDeskService.getAllServiceDesks(),
          requestService.getAllRequests({ limit: 50, requesterId: user?.id }),
          announcementService.getDashboard().catch(() => ({ pinned: [], latest: [] })),
        ]);
        setServiceDesks(desksData);
        const requests: Request[] = requestsData.requests || [];
        setAllRequests(requests);
        setPinned(dashboardData.pinned ?? []);
        setLatestAnnouncements(dashboardData.latest ?? []);
      } catch (err: any) {
        setError(friendlyMessage(err, 'Unable to load your dashboard. Please refresh the page.'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const open = allRequests.filter(r => !RESOLVED_STATUSES.has(r.status) && r.status !== RequestStatus.ACTION_REQUIRED).length;
    const actionRequired = allRequests.filter(r => r.status === RequestStatus.ACTION_REQUIRED).length;
    const resolved = allRequests.filter(r => RESOLVED_STATUSES.has(r.status)).length;
    return { open, actionRequired, resolved };
  }, [allRequests]);

  const recentRequests = useMemo(() => allRequests.slice(0, 5), [allRequests]);

  const greeting = user
    ? t('dashboard.greeting', { period: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening', name: user.firstName })
    : 'Welcome.';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">

      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-brand-900 via-brand-700 to-[#2a4a7f] rounded-xl py-12 px-4 sm:px-8 relative overflow-hidden mb-6">
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '30%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div className="relative z-10">
          <div className="text-xs font-bold text-white/60 tracking-widest uppercase mb-2">
            {formatDate()}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">
            {greeting}{' '}
            <span className="text-white/65 font-normal">How can<br />we help you today?</span>
          </h1>

          {/* Search */}
          <div className="flex items-center gap-3 bg-white/12 backdrop-blur-sm border border-white/20 rounded-lg py-3 px-4 max-w-[560px] transition-colors duration-200">
            <span className="material-symbols-outlined text-white/50 text-xl">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder={t('dashboard.searchPlaceholder')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#fff', fontSize: 'var(--text-base)', fontFamily: 'var(--font-sans)',
              }}
              onFocus={e => { const bar = e.currentTarget.closest('div') as HTMLDivElement; if (bar) bar.style.borderColor = 'rgba(255,255,255,0.5)'; }}
              onBlur={e => { const bar = e.currentTarget.closest('div') as HTMLDivElement; if (bar) bar.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            />
            <button onClick={handleSearch} className="bg-white text-brand-700 border-none rounded-cwc-md py-2 px-5 text-sm font-extrabold cursor-pointer font-sans whitespace-nowrap">
              Search
            </button>
          </div>

          {/* Quick tags */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="text-xs text-white/45">Common:</span>
            {['VPN Setup', 'Reset Password', 'Payroll Calendar', 'Annual Leave'].map(tag => (
              <span key={tag} onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)} className="text-xs font-bold text-white/75 bg-white/10 rounded-full py-[3px] px-2.5 cursor-pointer hover:bg-white/20 transition-colors">{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5) var(--space-6)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <SkeletonBox w="44px" h="44px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonBox w="48px" h="28px" />
                <SkeletonBox w="90px" h="12px" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: t('dashboard.openRequests'),    value: stats.open,           iconBg: 'var(--color-it-50)',  numColor: 'var(--color-brand-700)', icon: 'inbox' },
            { label: t('dashboard.actionRequired'),  value: stats.actionRequired, iconBg: 'var(--color-fin-50)', numColor: 'var(--color-warning)',    icon: 'warning' },
            { label: t('dashboard.resolvedAllTime'),value: stats.resolved,       iconBg: 'var(--color-hr-50)',  numColor: 'var(--color-success)',    icon: 'task_alt' },
          ].map(stat => (
            <div key={stat.label} className="bg-surface border border-border rounded-cwc-lg p-5 px-6 flex items-center gap-4 shadow-cwc-sm transition-shadow duration-200 cursor-default"
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
            >
              <div className="w-11 h-11 rounded-cwc-md flex items-center justify-center shrink-0" style={{ background: stat.iconBg }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: stat.numColor }}>{stat.icon}</span>
              </div>
              <div>
                <div className="text-3xl font-black leading-none" style={{ color: stat.numColor }}>{stat.value}</div>
                <div className="text-xs font-semibold mt-0.5 text-text-secondary">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SERVICE DESKS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Service Desks</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <SkeletonBox w="48px" h="48px" />
              <SkeletonBox w="60%" h="16px" />
              <SkeletonBox w="90%" h="12px" />
              <SkeletonBox w="75%" h="12px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: 'var(--color-danger)', padding: 'var(--space-4) var(--space-5)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
          <p style={{ fontWeight: 700 }}>Error loading dashboard</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {serviceDesks.map(desk => {
            const style = DESK_STYLE[desk.code] || { colorBar: '#6b7280', iconBg: '#f3f4f6', icon: 'help' };
            return (
              <Link
                key={desk.id}
                to={`/${desk.code.toLowerCase()}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                  transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'var(--shadow-lg)'; el.style.transform = 'translateY(-2px)'; el.style.borderColor = 'transparent'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'var(--shadow-sm)'; el.style.transform = 'translateY(0)'; el.style.borderColor = 'var(--color-border)'; }}
                >
                  {/* top color bar */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: style.colorBar }} />

                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: style.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: style.colorBar }}>{style.icon}</span>
                  </div>

                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>{desk.name}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {desk.description || 'Manage your requests and services'}
                  </div>

                  {/* diagonal arrow */}
                  <div style={{ position: 'absolute', bottom: 'var(--space-5)', right: 'var(--space-5)', fontSize: 18, color: 'var(--color-text-tertiary)', transition: 'transform 0.2s, color 0.2s' }}>↗</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── RECENT REQUESTS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>{t('dashboard.recentActivity')}</h2>
        <Link to="/my-requests" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-brand-700)', textDecoration: 'none' }}>
          {t('dashboard.viewAll')}
        </Link>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 'var(--space-8)' }}>
        <div className="overflow-x-auto">
          {loading ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Reference', 'Summary', 'Service', 'Status', 'Updated'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-6)', textAlign: 'left' }}>
                      <div style={{ height: 10, width: 60, background: 'var(--color-border)', borderRadius: 4 }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map(i => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    {['80px', '200px', '100px', '80px', '60px'].map((w, j) => (
                      <td key={j} style={{ padding: 'var(--space-4) var(--space-6)' }}>
                        <div style={{ height: 12, width: w, background: 'var(--color-border)', borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : recentRequests.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 'var(--space-4)', display: 'block', opacity: 0.3 }}>inbox</span>
              <p style={{ fontWeight: 700, marginBottom: 4 }}>No requests yet</p>
              <p style={{ fontSize: 'var(--text-sm)' }}>Create your first request to get started</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)' }}>
                  {['Reference', 'Summary', 'Service', 'Status', 'Updated'].map(h => (
                    <th key={h} style={{ padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRequests.map(req => {
                  const statusCfg = STATUS_CONFIG[req.status as RequestStatus];
                  return (
                    <tr
                      key={req.id}
                      style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => navigate(`/request/${req.referenceNumber || req.id}`)}
                    >
                      <td style={{ padding: 'var(--space-4) var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-brand-700)' }}>
                        {req.referenceNumber}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-6)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {req.summary}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {req.serviceDesk?.name || 'N/A'}
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-6)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)', fontWeight: 700,
                        }}
                          className={`${statusCfg?.bg || 'bg-gray-100'} ${statusCfg?.color || 'text-gray-600'}`}
                        >
                          {statusCfg?.label || req.status}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4) var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                        {formatRelativeTime(req.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── ANNOUNCEMENTS WIDGET ── */}
      {(pinned.length > 0 || latestAnnouncements.length > 0) && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Announcements
            </h2>
            <Link to="/announcements" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-brand-700)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {[...pinned.slice(0, 3), ...latestAnnouncements.slice(0, 3)].map((a, idx) => {
              const isPin = pinned.includes(a);
              const catColor = CATEGORY_COLOR[a.category] || 'var(--color-brand-700)';
              const pri = PRIORITY_BADGE[a.priority];
              return (
                <Link
                  key={a.id}
                  to={`/announcements?open=${a.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-5)',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                      background: isPin ? '#fffbeb' : 'transparent',
                      borderLeft: !a.isRead ? `3px solid var(--color-brand-700)` : '3px solid transparent',
                      transition: 'background 0.12s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-subtle)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isPin ? '#fffbeb' : 'transparent'; }}
                  >
                    {isPin && (
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
                    )}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: a.isRead ? 500 : 700,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {a.title}
                      </div>
                      {a.excerpt && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.excerpt}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                      {pri && (
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: pri.bg, color: pri.color }}>
                          {pri.label}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        {a.publishedAt ? formatRelativeTime(a.publishedAt) : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FOOTER CTAs ── */}
      {import.meta.env.DEV && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Can't find what you're looking for?</span>
        {[
          { icon: 'menu_book', label: 'Browse Knowledge Base', to: '/kb' },
        ].map(btn => (
          <button key={btn.label} onClick={btn.to ? () => navigate(btn.to) : undefined} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 700,
            color: 'var(--color-text-primary)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--color-brand-700)'; el.style.color = 'var(--color-brand-700)'; el.style.background = 'var(--color-brand-50)'; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--color-border)'; el.style.color = 'var(--color-text-primary)'; el.style.background = 'var(--color-surface)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{btn.icon}</span>
            {btn.label}
          </button>
        ))}
      </div>
      )}

    </div>
  );
};

export default Dashboard;
