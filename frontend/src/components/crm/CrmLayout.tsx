import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
  anyPermission?: string[];
  admin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/crm', label: 'Dashboard', icon: 'dashboard' },
  { to: '/crm/leads', label: 'Leads', icon: 'lightbulb' },
  { to: '/crm/opportunities', label: 'Opportunities', icon: 'monetization_on' },
  { to: '/crm/customers', label: 'Clients', icon: 'group' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '/crm/quotas', label: 'Quotas', icon: 'flag', permission: 'crm:read' },
  { to: '/crm/team', label: 'Team', icon: 'groups', permission: 'crm:admin', admin: true },
  { to: '/crm/sales-hierarchy', label: 'Sales Hierarchy', icon: 'account_tree', permission: 'crm:admin', admin: true },
  { to: '/crm/territories', label: 'Territories', icon: 'map', permission: 'crm:admin', admin: true },
  { to: '/crm/workflows', label: 'Workflows', icon: 'account_tree', permission: 'crm:admin', admin: true },
  { to: '/crm/anomalies', label: 'AI Alerts', icon: 'psychology', permission: 'crm:admin', admin: true },
  { to: '/crm/custom-fields', label: 'Custom Fields', icon: 'tune', permission: 'crm:admin', admin: true },
  { to: '/crm/duplicates', label: 'Duplicates', icon: 'content_copy', permission: 'crm:admin', admin: true },
  { to: '/crm/industry-options', label: 'Industry Options', icon: 'business', permission: 'crm:admin', admin: true },
  { to: '/crm/import-export', label: 'Import / Export', icon: 'swap_horiz', anyPermission: ['crm:import', 'crm:export', 'crm:admin'], admin: true },
  { to: '/crm/guide', label: 'Guide', icon: 'menu_book' },
];

/* ── Kinetic Enterprise design tokens ─────────────────────────────── */
const TOKENS = {
  teal:          '#006a61',
  tealLight:     '#86f2e4',
  tealDark:      '#006f66',
  surface:       '#f8f9ff',
  white:         '#ffffff',
  border:        '#e2e8f0',
  borderSubtle:  '#f1f5f9',
  textPrimary:   '#0b1c30',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  shadow:       '0px 4px 12px rgba(15, 23, 42, 0.08)',
} as const;

const CrmLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/crm') return location.pathname === '/crm';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const visibleItems = NAV_ITEMS.filter((item) =>
    (!item.permission || hasPermission(user, item.permission)) &&
    (!item.anyPermission || item.anyPermission.some((permission) => hasPermission(user, permission)))
  );
  const mainItems = visibleItems.filter((item) => !item.admin);
  const adminItems = visibleItems.filter((item) => item.admin);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const adminActive = adminItems.some((item) => isActive(item.to));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex min-h-full min-w-0 flex-col" style={{ background: TOKENS.surface }}>
      {/* ── Horizontal Sub-Nav (Kinetic Enterprise) ──────────────── */}
      <div
        data-testid="crm-nav-track"
        className="flex-shrink-0 sticky top-0 z-20"
        style={{
          background: TOKENS.white,
          borderBottom: `1px solid ${TOKENS.border}`,
          boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
        }}
      >
        <div className="flex h-12 items-center gap-1 overflow-visible px-4 lg:px-6 max-w-[1440px] mx-auto w-full">
          {/* ── Primary tabs ── */}
          {mainItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex h-full flex-shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] font-semibold transition-colors"
              style={{
                textDecoration: 'none',
                borderBottomColor: isActive(item.to) ? TOKENS.teal : 'transparent',
                color: isActive(item.to) ? TOKENS.teal : TOKENS.textSecondary,
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.to)) {
                  (e.currentTarget as HTMLElement).style.borderBottomColor = `${TOKENS.teal}30`;
                  (e.currentTarget as HTMLElement).style.color = TOKENS.teal;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.to)) {
                  (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = TOKENS.textSecondary;
                }
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {/* ── "More" dropdown for admin items ── */}
          {adminItems.length > 0 && (
            <>
              <div className="mx-1 h-6 w-px flex-shrink-0" style={{ background: TOKENS.border }} />
              <div ref={moreRef} className="relative flex h-full flex-shrink-0 items-center">
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className="flex h-full items-center gap-1 border-b-2 px-3 text-[13px] font-semibold transition-colors"
                  style={{
                    background: 'none',
                    cursor: 'pointer',
                    borderBottomColor: adminActive ? TOKENS.teal : 'transparent',
                    color: adminActive ? TOKENS.teal : TOKENS.textSecondary,
                  }}
                  onMouseEnter={(e) => {
                    if (!adminActive) {
                      (e.currentTarget as HTMLElement).style.color = TOKENS.teal;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!adminActive) {
                      (e.currentTarget as HTMLElement).style.color = TOKENS.textSecondary;
                    }
                  }}
                >
                  More
                  <span className="material-symbols-outlined text-[14px]">{moreOpen ? 'expand_less' : 'expand_more'}</span>
                </button>

                {moreOpen && (
                  <div
                    className="absolute left-0 top-full z-30 mt-1.5 w-56 p-1.5"
                    style={{
                      background: TOKENS.white,
                      borderRadius: '8px',
                      border: `1px solid ${TOKENS.border}`,
                      boxShadow: TOKENS.shadow,
                    }}
                  >
                    {adminItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold transition-colors"
                        style={{
                          textDecoration: 'none',
                          borderRadius: '6px',
                          background: isActive(item.to) ? TOKENS.tealLight : 'transparent',
                          color: isActive(item.to) ? TOKENS.tealDark : TOKENS.textSecondary,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive(item.to)) {
                            (e.currentTarget as HTMLElement).style.background = TOKENS.borderSubtle;
                            (e.currentTarget as HTMLElement).style.color = TOKENS.textPrimary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive(item.to)) {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = TOKENS.textSecondary;
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile nav drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="flex w-64 flex-col overflow-y-auto px-2 py-4"
            style={{
              background: TOKENS.white,
              boxShadow: TOKENS.shadow,
            }}
          >
            <div className="flex justify-between items-center px-3 mb-4">
              <span className="text-base font-extrabold" style={{ color: TOKENS.teal }}>CRM</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKENS.textSecondary }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {visibleItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold transition-colors"
                  style={{
                    textDecoration: 'none',
                    borderRadius: '6px',
                    background: isActive(item.to) ? TOKENS.tealLight : 'transparent',
                    color: isActive(item.to) ? TOKENS.tealDark : TOKENS.textSecondary,
                    borderRight: isActive(item.to) ? `3px solid ${TOKENS.teal}` : '3px solid transparent',
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* ── Content area ── */}
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Mobile hamburger bar */}
        <div
          className="sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-3 md:hidden"
          style={{
            background: TOKENS.white,
            borderBottomColor: TOKENS.border,
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKENS.textSecondary }}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-sm font-bold" style={{ color: TOKENS.teal }}>CRM</span>
        </div>

        <div
          data-testid="crm-content-shell"
          className="min-h-full"
          style={{ background: TOKENS.surface }}
        >
          <div className="mx-auto min-h-full w-full max-w-[1680px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrmLayout;