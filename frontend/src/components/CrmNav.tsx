import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import { useCrmUpdate } from '../hooks/useCrmUpdate';
import Drawer from './ui/Drawer';

interface CrmNavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
}

const CRM_NAV_ITEMS: CrmNavItem[] = [
  { to: '/crm', label: 'Dashboard', icon: 'dashboard' },
  { to: '/crm/leads', label: 'Leads', icon: 'lightbulb' },
  { to: '/crm/opportunities', label: 'Opportunities', icon: 'monetization_on' },
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'trending_up' },
  { to: '/crm/accounts', label: 'Accounts', icon: 'business' },
  { to: '/crm/contacts', label: 'Contacts', icon: 'person' },
  { to: '/crm/team', label: 'Team', icon: 'groups', permission: 'crm:admin' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '/crm/guide', label: 'Guide', icon: 'menu_book' },
  { to: '/crm/import-export', label: 'Import/Export', icon: 'swap_horiz', permission: 'crm:admin' },
  { to: '/crm/territories', label: 'Territories', icon: 'map', permission: 'crm:admin' },
  { to: '/crm/quotas', label: 'Quotas', icon: 'flag', permission: 'crm:read' },
  { to: '/crm/workflows', label: 'Workflows', icon: 'account_tree', permission: 'crm:admin' },
  { to: '/crm/integrations', label: 'Integrations', icon: 'sync', permission: 'crm:read' },
  { to: '/crm/anomalies', label: 'AI Alerts', icon: 'psychology', permission: 'crm:admin' },
  { to: '/crm/custom-fields', label: 'Custom Fields', icon: 'tune', permission: 'crm:admin' },
  { to: '/crm/duplicates', label: 'Duplicates', icon: 'content_copy', permission: 'crm:admin' },
];

// Primary items always shown as tabs; secondary items go into "More" dropdown
const PRIMARY_ITEMS = [
  '/crm', '/crm/leads', '/crm/opportunities', '/crm/pipeline',
  '/crm/accounts', '/crm/contacts', '/crm/team', '/crm/reports',
];

// Bottom nav: 5 key items for mobile
const MOBILE_BOTTOM_ITEMS: CrmNavItem[] = [
  { to: '/crm', label: 'Home', icon: 'dashboard' },
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'trending_up' },
  { to: '__add__', label: 'Add', icon: 'add_circle' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '__more__', label: 'More', icon: 'menu' },
];

const CrmNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Tracks which entity tabs have unseen remote changes
  const [changedTabs, setChangedTabs] = useState<Set<string>>(new Set());

  // Determine active tab
  const isActive = (path: string) => {
    if (path === '/crm') return location.pathname === '/crm';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Filter items by permission
  const visibleItems = CRM_NAV_ITEMS.filter(item => {
    if (item.permission) {
      return hasPermission(user, item.permission);
    }
    return true;
  });

  const primaryVisible = visibleItems.filter(item => PRIMARY_ITEMS.includes(item.to));
  const secondaryVisible = visibleItems.filter(item => !PRIMARY_ITEMS.includes(item.to));
  // Check if a secondary item is currently active
  const secondaryActive = secondaryVisible.find(item => isActive(item.to));

  const canWrite = hasPermission(user, 'crm:write');

  // Mark a tab as changed when a remote CRM update arrives for another user
  useCrmUpdate([], (event) => {
    if (event.changedBy === user?.id) return; // own mutations don't badge
    const tabMap: Record<string, string> = {
      lead: '/crm/leads',
      opportunity: '/crm/opportunities',
      account: '/crm/accounts',
      contact: '/crm/contacts',
    };
    const tab = tabMap[event.entityType];
    if (tab) {
      setChangedTabs((prev) => new Set([...prev, tab]));
    }
  });

  // Close "More" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [moreOpen]);

  // Close More on navigation + clear badge for current path
  useEffect(() => {
    setMoreOpen(false);
    setChangedTabs((prev) => {
      const next = new Set(prev);
      next.delete(location.pathname);
      // Also clear for sub-paths (e.g. /crm/leads/123 clears /crm/leads)
      prev.forEach((tab) => { if (location.pathname.startsWith(tab)) next.delete(tab); });
      return next;
    });
  }, [location.pathname]);

  return (
    <>
      {/* ── Desktop: horizontal tabs + "More" dropdown ── */}
      <nav className="hidden md:block sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-[var(--border,#e5e7eb)]">
        <div className="max-w-[1200px] mx-auto flex items-center px-4 sm:px-8">
          {/* Primary tabs — always visible */}
          {primaryVisible.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                isActive(item.to)
                  ? 'text-brand-700 border-brand-700'
                  : 'text-text-secondary border-transparent hover:text-brand-700 hover:border-brand-700/30'
              }`}
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
              {changedTabs.has(item.to) && (
                <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-brand-500" aria-label="new changes" />
              )}
            </Link>
          ))}

          {/* "More" dropdown — only if there are secondary items */}
          {secondaryVisible.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(prev => !prev)}
                className={`flex items-center gap-1 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  secondaryActive
                    ? 'text-brand-700 border-brand-700'
                    : 'text-text-secondary border-transparent hover:text-brand-700 hover:border-brand-700/30'
                }`}
                style={{ background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', cursor: 'pointer' }}
              >
                More
                <span className="material-symbols-outlined text-[18px]">
                  {moreOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full mt-1 min-w-[200px] bg-surface rounded-xl shadow-lg border border-[var(--border,#e5e7eb)] py-1 z-50"
                >
                  {secondaryVisible.map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive(item.to)
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                      }`}
                      style={{ textDecoration: 'none' }}
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── Mobile: top bar with hamburger (below md) ── */}
      <nav className="md:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-[var(--border,#e5e7eb)]">
        <div className="flex items-center justify-between px-4 py-2">
          <Link to="/crm" className="text-base font-extrabold text-brand-700" style={{ textDecoration:'none' }}>CRM</Link>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg hover:bg-bg-subtle transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Open navigation"
          >
            <span className="material-symbols-outlined text-text-primary">menu</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile: navigation drawer ── */}
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="CRM Navigation" side="left" width="md">
        <div className="space-y-1">
          {visibleItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                isActive(item.to)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
              }`}
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </Drawer>

      {/* ── Mobile: Quick Add menu drawer ── */}
      <Drawer isOpen={quickAddOpen} onClose={() => setQuickAddOpen(false)} title="Quick Create" side="right" width="sm">
        <div className="space-y-1">
          {canWrite && [
            { to: '/crm/leads?create=1', label: 'New Lead', icon: 'lightbulb' },
            { to: '/crm/opportunities?create=1', label: 'New Opportunity', icon: 'monetization_on' },
            { to: '/crm/accounts?create=1', label: 'New Account', icon: 'business' },
            { to: '/crm/contacts?create=1', label: 'New Contact', icon: 'person' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setQuickAddOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors"
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </Drawer>

      {/* ── Mobile: bottom navigation bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-[var(--border,#e5e7eb)] safe-area-inset-bottom">
        <div className="flex items-center justify-around h-14">
          {MOBILE_BOTTOM_ITEMS.map(item => {
            if (item.to === '__add__') {
              return (
                <button
                  key={item.to}
                  onClick={() => {
                    if (canWrite) setQuickAddOpen(true);
                  }}
                  disabled={!canWrite}
                  className="flex flex-col items-center justify-center -mt-4 rounded-full bg-brand-600 text-white w-12 h-12 shadow-lg hover:bg-brand-700 transition-colors disabled:opacity-40"
                  style={{ border: 'none', cursor: 'pointer' }}
                  aria-label="Quick create"
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </button>
              );
            }
            if (item.to === '__more__') {
              return (
                <button
                  key={item.to}
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-text-secondary hover:text-brand-700 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors"
                style={{ textDecoration: 'none' }}
              >
                <span className={`material-symbols-outlined text-xl ${isActive(item.to) ? 'text-brand-700' : 'text-text-secondary'}`}>{item.icon}</span>
                <span className={`text-[10px] font-medium ${isActive(item.to) ? 'text-brand-700' : 'text-text-secondary'}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile: bottom spacer so page content isn't hidden behind bottom nav ── */}
      <div className="md:hidden h-20" />
    </>
  );
};

export default CrmNav;