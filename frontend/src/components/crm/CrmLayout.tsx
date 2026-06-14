import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
  admin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/crm', label: 'Dashboard', icon: 'dashboard' },
  { to: '/crm/leads', label: 'Leads', icon: 'lightbulb' },
  { to: '/crm/opportunities', label: 'Opportunities', icon: 'monetization_on' },
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'trending_up' },
  { to: '/crm/accounts', label: 'Accounts', icon: 'business' },
  { to: '/crm/contacts', label: 'Contacts', icon: 'person' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
  { to: '/crm/quotas', label: 'Quotas', icon: 'flag', permission: 'crm:read' },
  { to: '/crm/team', label: 'Team', icon: 'groups', permission: 'crm:admin', admin: true },
  { to: '/crm/territories', label: 'Territories', icon: 'map', permission: 'crm:admin', admin: true },
  { to: '/crm/workflows', label: 'Workflows', icon: 'account_tree', permission: 'crm:admin', admin: true },
  { to: '/crm/integrations', label: 'Integrations', icon: 'sync', permission: 'crm:read', admin: true },
  { to: '/crm/anomalies', label: 'AI Alerts', icon: 'psychology', permission: 'crm:admin', admin: true },
  { to: '/crm/custom-fields', label: 'Custom Fields', icon: 'tune', permission: 'crm:admin', admin: true },
  { to: '/crm/duplicates', label: 'Duplicates', icon: 'content_copy', permission: 'crm:admin', admin: true },
  { to: '/crm/import-export', label: 'Import / Export', icon: 'swap_horiz', permission: 'crm:admin', admin: true },
  { to: '/crm/guide', label: 'Guide', icon: 'menu_book' },
];

const CrmLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/crm') return location.pathname === '/crm';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));
  const mainItems = visibleItems.filter((item) => !item.admin);
  const adminItems = visibleItems.filter((item) => item.admin);
  const canWrite = hasPermission(user, 'crm:write');
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
    <div className="flex flex-col h-full min-w-0">
      {/* Horizontal top sub-nav */}
      <div className="flex-shrink-0 bg-white border-b border-[var(--border,#e5e7eb)] sticky top-0 z-20">
        <div className="flex items-center gap-1 px-4 h-11">
          {canWrite && (
            <Link
              to="/crm/leads?create=1"
              className="flex-shrink-0 flex items-center gap-1 py-1 px-3 bg-brand-600 text-white text-xs font-semibold rounded-md hover:bg-brand-700 transition-colors mr-2"
              style={{ textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              New Lead
            </Link>
          )}

          {mainItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 h-full text-xs font-semibold border-b-2 transition-colors ${
                isActive(item.to)
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-[var(--text-secondary,#6b7280)] hover:text-[var(--text-primary,#111827)] hover:border-[var(--border,#e5e7eb)]'
              }`}
              style={{ textDecoration: 'none' }}
            >
              {item.label}
            </Link>
          ))}

          {adminItems.length > 0 && (
            <>
              <div className="flex-shrink-0 w-px h-5 bg-[var(--border,#e5e7eb)] mx-1" />
              <div ref={moreRef} className="relative flex-shrink-0 h-full flex items-center">
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`flex items-center gap-1 px-2 h-full text-xs font-semibold border-b-2 transition-colors ${
                    adminActive
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-[var(--text-secondary,#6b7280)] hover:text-[var(--text-primary,#111827)] hover:border-[var(--border,#e5e7eb)]'
                  }`}
                  style={{ background: 'none', cursor: 'pointer' }}
                >
                  More
                  <span className="material-symbols-outlined text-[14px]">{moreOpen ? 'expand_less' : 'expand_more'}</span>
                </button>

                {moreOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-[var(--border,#e5e7eb)] rounded-lg shadow-lg py-1 z-30">
                    {adminItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                          isActive(item.to)
                            ? 'text-brand-700 bg-brand-50'
                            : 'text-[var(--text-secondary,#6b7280)] hover:bg-[var(--bg-subtle,#f3f4f6)] hover:text-[var(--text-primary,#111827)]'
                        }`}
                        style={{ textDecoration: 'none' }}
                      >
                        <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
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

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 bg-white shadow-xl flex flex-col py-4 px-2 overflow-y-auto">
            <div className="flex justify-between items-center px-3 mb-4">
              <span className="text-base font-extrabold text-brand-700">CRM</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle,#f3f4f6)]"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {canWrite && (
              <Link
                to="/crm/leads?create=1"
                className="mx-2 mb-3 py-2 px-3 bg-brand-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:bg-brand-700 transition-colors"
                style={{ textDecoration: 'none' }}
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Lead
              </Link>
            )}
            <nav className="flex flex-col gap-0.5">
              {visibleItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(item.to)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-[var(--text-secondary,#6b7280)] hover:bg-[var(--bg-subtle,#f3f4f6)] hover:text-[var(--text-primary,#111827)]'
                  }`}
                  style={{ textDecoration: 'none' }}
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

      <div className="flex-1 min-w-0 overflow-auto">
        {/* Mobile hamburger — only shown on small screens */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-[var(--border,#e5e7eb)] bg-white sticky top-0 z-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle,#f3f4f6)]"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined text-[var(--text-secondary,#6b7280)]">menu</span>
          </button>
          <span className="text-sm font-bold text-brand-700">CRM</span>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default CrmLayout;
