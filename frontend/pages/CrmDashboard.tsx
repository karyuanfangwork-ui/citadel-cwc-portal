import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import crmService, { DashboardStats, CrmActivity } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import axios from 'axios';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);
const formatRelative = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`; };

const ACTIVITY_ICONS: Record<string, string> = { CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'check_circle', FOLLOW_UP: 'update' };

import StateBadge from '../src/components/ui/StateBadge';

const SkeletonBox = ({ w, h }: { w: string; h: string }) => (
  <div style={{ width: w, height: h, background: 'var(--color-border)', borderRadius: 'var(--radius-sm)', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

const BRIEFING_KEY = 'crm_daily_briefing_v1';

const CrmDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeals, setMyDeals] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof crmService.globalSearch>> | null>(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // ── AI Daily Briefing (Task 10) ────────────────────────────────────────────
  const [briefing, setBriefing] = useState<{
    headline: string;
    bullets: string[];
    topPriority: string;
  } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(BRIEFING_KEY) || 'null'); }
    catch { return null; }
  });
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const handleGetBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingError(null);
    try {
      const result = await crmService.getDailyBriefing();
      setBriefing(result);
      sessionStorage.setItem(BRIEFING_KEY, JSON.stringify(result));
    } catch {
      setBriefingError('AI briefing is temporarily unavailable. Please try again later.');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults(null);
      setShowResults(false);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    (async () => {
      try {
        const results = await crmService.globalSearch(debouncedQuery, controller.signal);
        setSearchResults(results);
        setShowResults(true);
      } catch (err: any) {
        if (axios.isCancel?.(err) || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        /* other errors silent — matches prior behavior */
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-crm-search]')) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try { setLoading(true); setError(null); const data = await crmService.getDashboard(myDeals); setStats(data); }
      catch (e: any) { setError(e.message || 'Failed to load CRM dashboard'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [myDeals]);

  const didAutoLoad = React.useRef(false);
  useEffect(() => {
    if (!didAutoLoad.current) {
      didAutoLoad.current = true;
      // Read directly from sessionStorage to decide whether to auto-load
      const cached = sessionStorage.getItem(BRIEFING_KEY);
      if (!cached) {
        handleGetBriefing();
      }
    }
  }, [handleGetBriefing]);

  // ── My Performance (Task 5 — Self-Service Rep Stats) ─────────────────────────────────────
  const [myStats, setMyStats] = useState<{
    leads: number; opportunities: number; pipelineValue: number;
    wonThisMonth: number; staleLeads: number; activitiesThisWeek: number;
  } | null>(null);
  const [myStatsLoading, setMyStatsLoading] = useState(true);

  useEffect(() => {
    crmService.getMyStats()
      .then(setMyStats)
      .catch(() => { /* fail silently */ })
      .finally(() => setMyStatsLoading(false));
  }, []);

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] rounded-xl py-10 px-4 sm:px-8 relative overflow-hidden mb-6">
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '30%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-bold text-white/60 tracking-widest uppercase mb-2">CRM Dashboard</div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Sales Pipeline <span className="text-white/65 font-normal">Overview</span>
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMyDeals(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!myDeals ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>All Deals</button>
              <button onClick={() => setMyDeals(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${myDeals ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>My Deals</button>
            </div>
          </div>
          {/* Global Search */}
          <div data-crm-search="" style={{ position: 'relative', maxWidth: 520, margin: '1.5rem auto 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '0.5rem 1rem', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>search</span>
              <input
                type="text"
                placeholder="Search accounts, contacts, leads, deals…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchResults && setShowResults(true)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14 }}
              />
              {searching && <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
              {searchQuery && !searching && (
                <button onClick={() => { setSearchQuery(''); setShowResults(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', lineHeight: 1 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {showResults && searchResults && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 100, overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
                {searchResults.accounts.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Accounts</div>
                    {searchResults.accounts.map(a => (
                      <div key={a.id} onClick={() => { navigate(`/crm/accounts/${a.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        className="hover:bg-gray-50">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>business</span>
                        <span style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{a.name}</span>
                        {a.industry && <span style={{ fontSize: 12, color: '#9ca3af' }}>{a.industry}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.contacts.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Contacts</div>
                    {searchResults.contacts.map(c => (
                      <div key={c.id} onClick={() => { navigate(`/crm/contacts/${c.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        className="hover:bg-gray-50">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#22c55e' }}>person</span>
                        <div>
                          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                          {c.email && <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.email}</div>}
                        </div>
                        {c.account && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{c.account.name}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.leads.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Leads</div>
                    {searchResults.leads.map(l => (
                      <div key={l.id} onClick={() => { navigate(`/crm/leads/${l.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        className="hover:bg-gray-50">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>leaderboard</span>
                        <span style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{l.title}</span>
                        {l.companyName && <span style={{ fontSize: 12, color: '#9ca3af' }}>{l.companyName}</span>}
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.opportunities.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Deals</div>
                    {searchResults.opportunities.map(o => (
                      <div key={o.id} onClick={() => { navigate(`/crm/opportunities/${o.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        className="hover:bg-gray-50">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#8b5cf6' }}>monetization_on</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{o.name}</div>
                          {o.account && <div style={{ fontSize: 12, color: '#9ca3af' }}>{o.account.name}</div>}
                        </div>
                        {o.stage && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: `${o.stage.color}20`, color: o.stage.color }}>{o.stage.name}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.accounts.length === 0 && searchResults.contacts.length === 0 && searchResults.leads.length === 0 && searchResults.opportunities.length === 0 && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          <p className="font-bold">Error loading CRM dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Today's Priorities */}
      {!error && (
        <div className="mb-6">
          <h2 className="text-sm font-extrabold text-text-secondary uppercase tracking-wider mb-3">Today's Priorities</h2>
          <div className="grid grid-cols-3 gap-4">
            {loading ? [0,1,2].map(i => (
              <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
                <SkeletonBox w="40px" h="40px" /><div><SkeletonBox w="36px" h="24px" /><div className="mt-1"><SkeletonBox w="80px" h="10px" /></div></div>
              </div>
            )) : stats && [
              { label: 'Follow-ups Due Today', value: stats.followUpDueToday ?? 0, icon: '📋', bg: '#fffbeb', color: '#b45309', link: '/crm/leads?filter=followup' },
              { label: 'Stale Leads', value: stats.staleLeads ?? 0, icon: '⚠️', bg: '#fff1f2', color: '#be123c', link: '/crm/leads?filter=stale' },
              { label: 'Overdue Deals', value: stats.overdueDeals ?? 0, icon: '🔔', bg: '#fef2f2', color: '#dc2626', link: '/crm/opportunities?filter=overdue' },
            ].map(p => (
              <div
                key={p.label}
                onClick={() => navigate(p.link)}
                className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: p.bg }}>
                  {p.icon}
                </div>
                <div>
                  <div className="text-2xl font-black leading-none" style={{ color: p.color }}>{p.value}</div>
                  <div className="text-xs font-semibold mt-0.5 text-text-secondary">{p.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Daily Briefing (Task 10) */}
      <div className="mb-6">
        <h2 className="text-sm font-extrabold text-text-secondary uppercase tracking-wider mb-3">AI Daily Briefing</h2>
        <AiInsightCard
          title="Your Sales Briefing"
          loading={briefingLoading}
          error={briefingError}
          onRefresh={handleGetBriefing}
          className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50"
        >
          {!briefing ? (
            briefingLoading ? null : (
              <div>
                <p className="text-sm text-text-secondary italic">
                  {briefingError ? briefingError : 'Briefing unavailable.'}
                </p>
                {briefingError && (
                  <button
                    onClick={handleGetBriefing}
                    className="mt-2 text-sm text-brand-700 hover:underline font-semibold"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="font-semibold text-gray-800">{briefing.headline}</p>
              <ul className="space-y-1">
                {briefing.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="material-symbols-outlined text-sm text-violet-500 mt-0.5">chevron_right</span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-violet-300 bg-white px-3 py-2">
                <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-0.5">Top Priority Today</p>
                <p className="text-sm font-semibold text-gray-800">{briefing.topPriority}</p>
              </div>
            </div>
          )}
        </AiInsightCard>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? [0,1,2,3].map(i => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
            <SkeletonBox w="44px" h="44px" /><div><SkeletonBox w="48px" h="28px" /><div className="mt-1"><SkeletonBox w="80px" h="12px" /></div></div>
          </div>
        )) : stats && [
          { label: 'Accounts', value: stats.totalAccounts, icon: 'business', bg: '#eff6ff', color: '#1d4ed8' },
          { label: 'Open Leads', value: stats.totalLeads, icon: 'lightbulb', bg: '#fef3c7', color: '#92400e' },
          { label: 'Pipeline Value', value: formatCurrency(Number(stats.pipelineValue)), icon: 'payments', bg: '#ecfdf5', color: '#065f46' },
          { label: 'Win Rate', value: `${stats.winRate}%`, icon: 'trending_up', bg: '#f0fdf4', color: '#166534' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-semibold mt-0.5 text-text-secondary">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Won/Lost Summary */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-emerald-600">emoji_events</span>
              <span className="font-bold text-text-primary">Won Deals</span>
            </div>
            <div className="text-3xl font-black text-emerald-600">{formatCurrency(Number(stats.wonDeals.value))}</div>
            <div className="text-sm text-text-secondary mt-1">{stats.wonDeals.count} deals closed</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-red-500">trending_down</span>
              <span className="font-bold text-text-primary">Lost Deals</span>
            </div>
            <div className="text-3xl font-black text-red-500">{formatCurrency(Number(stats.lostDeals.value))}</div>
            <div className="text-sm text-text-secondary mt-1">{stats.lostDeals.count} deals lost</div>
          </div>
        </div>
      )}

      {/* My Performance */}
      {!myStatsLoading && myStats && (
        <div className="mb-6">
          <h2 className="text-sm font-extrabold text-text-secondary uppercase tracking-wider mb-3">My Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'My Leads', value: myStats.leads, icon: 'lightbulb', bg: '#fef3c7', color: '#92400e' },
              { label: 'My Open Deals', value: myStats.opportunities, icon: 'monetization_on', bg: '#eff6ff', color: '#1d4ed8' },
              { label: 'My Pipeline', value: formatCurrency(myStats.pipelineValue), icon: 'payments', bg: '#ecfdf5', color: '#065f46' },
              { label: 'Won This Month', value: myStats.wonThisMonth, icon: 'emoji_events', bg: '#f0fdf4', color: '#166534' },
              { label: 'Stale Leads', value: myStats.staleLeads, icon: 'warning', bg: '#fff1f2', color: '#be123c' },
              { label: 'Activities This Week', value: myStats.activitiesThisWeek, icon: 'event_note', bg: '#f5f3ff', color: '#6d28d9' },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <span className="material-symbols-outlined text-[22px]" style={{ color: s.color }}>{s.icon}</span>
                </div>
                <div>
                  <div className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs font-semibold mt-0.5 text-text-secondary">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead Status Breakdown */}
      {stats && stats.leadsByStatus.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-extrabold text-text-primary mb-4">Leads by Status</h2>
          <div className="flex flex-wrap gap-3">
            {stats.leadsByStatus.map(ls => (
                <div key={ls.status} className="flex items-center gap-2 rounded-full px-4 py-2">
                  <span className="text-2xl font-black"><StateBadge state={ls.status} size="sm" /></span>
                  <span className="text-xs font-bold">{ls._count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-extrabold text-text-primary">Recent Activity</h2>
          <Link to="/crm/accounts" className="text-sm font-bold text-brand-700" style={{ textDecoration: 'none' }}>View all →</Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-4">{[0,1,2,3,4].map(i => <div key={i} className="flex gap-3"><SkeletonBox w="36px" h="36px" /><div className="flex-1"><SkeletonBox w="60%" h="14px" /><div className="mt-2"><SkeletonBox w="40%" h="10px" /></div></div></div>)}</div>
        ) : stats && stats.recentActivities.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">event_note</span>
            <p className="font-bold">No recent activities</p>
            <p className="text-sm mt-1">Start logging calls, emails, and meetings</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats?.recentActivities.map((act: CrmActivity) => (
              <div key={act.id} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => act.accountId && navigate(`/crm/accounts/${act.accountId}`)}>
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-indigo-600 text-lg">{ACTIVITY_ICONS[act.activityType] || 'note'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary truncate">{act.subject}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {act.user && <span className="text-xs text-text-secondary">{act.user.firstName} {act.user.lastName}</span>}
                    {act.account && <><span className="text-text-tertiary">·</span><span className="text-xs text-brand-700 font-medium">{act.account.name}</span></>}
                  </div>
                </div>
                <span className="text-xs text-text-tertiary whitespace-nowrap">{formatRelative(act.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CrmDashboard;
