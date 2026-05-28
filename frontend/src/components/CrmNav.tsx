import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
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
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'view_kanban' },
  { to: '/crm/accounts', label: 'Accounts', icon: 'business' },
  { to: '/crm/contacts', label: 'Contacts', icon: 'person' },
  { to: '/credit', label: 'Credit', icon: 'account_balance', permission: 'credit:read' },
  { to: '/crm/team', label: 'Team', icon: 'groups', permission: 'crm:admin' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '/crm/guide', label: 'Guide', icon: 'menu_book' },
];

// Bottom nav: 5 key items for mobile
const MOBILE_BOTTOM_ITEMS: CrmNavItem[] = [
  { to: '/crm', label: 'Home', icon: 'dashboard' },
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'view_kanban' },
  { to: '__add__', label: 'Add', icon: 'add_circle' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '__more__', label: 'More', icon: 'menu' },
];

const CrmNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Determine active tab: /crm matches Dashboard, /crm/team matches Team, etc.
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

  const canWrite = hasPermission(user, 'crm:write');

  return (
    <>
      {/* ── Desktop: horizontal tabs (md breakpoint and up) ── */}
      <nav className="hidden md:block sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-[var(--border,#e5e7eb)]">
        <div className="max-w-[1200px] mx-auto flex items-center gap-1 overflow-x-auto px-4 sm:px-8" style={{ scrollbarWidth: 'none' }}>
          {visibleItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                isActive(item.to)
                  ? 'text-brand-700 border-brand-700'
                  : 'text-text-secondary border-transparent hover:text-brand-700 hover:border-brand-700/30'
              }`}
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
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
              // FAB-style Add button
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
              // More button opens drawer
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
            // Regular bottom nav item
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