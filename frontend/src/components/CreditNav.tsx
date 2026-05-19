import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface CreditNavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
}

const PRIMARY_ITEMS: CreditNavItem[] = [
  { to: '/credit', label: 'Dashboard', icon: 'dashboard' },
  { to: '/credit/borrowers', label: 'Borrowers', icon: 'person' },
  { to: '/credit/applications', label: 'Applications', icon: 'description' },
  { to: '/credit/approvals', label: 'My Approvals', icon: 'approval', permission: 'credit:review' },
];

const SECONDARY_ITEMS: CreditNavItem[] = [
  { to: '/credit/financials', label: 'Financials', icon: 'table_chart', permission: 'credit:read' },
  { to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:read' },
  { to: '/credit/collateral', label: 'Collateral', icon: 'home_work', permission: 'credit:read' },
  { to: '/credit/scorecards', label: 'Scorecards', icon: 'dashboard_customize', permission: 'credit:admin' },
  { to: '/credit/analysis', label: 'Analysis', icon: 'query_stats', permission: 'credit:read' },
];

const CreditNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/credit') return location.pathname === '/credit';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const canSee = (item: CreditNavItem) =>
    !item.permission || hasPermission(user, item.permission);

  const visiblePrimary = PRIMARY_ITEMS.filter(canSee);
  const visibleSecondary = SECONDARY_ITEMS.filter(canSee);
  const secondaryActive = visibleSecondary.some(item => isActive(item.to));

  const linkCls = (active: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
      active
        ? 'text-[#0052cc] border-[#0052cc]'
        : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
    }`;

  return (
    <nav className="sticky top-16 z-[60] bg-white border-b border-[var(--border,#e5e7eb)]">
      <div className="max-w-[1200px] mx-auto flex items-center gap-1 px-4 sm:px-8">
        {visiblePrimary.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={linkCls(isActive(item.to))}
            style={{ textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {visibleSecondary.length > 0 && (
          <div className="relative ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                secondaryActive
                  ? 'text-[#0052cc] border-[#0052cc]'
                  : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              More
              <span className="material-symbols-outlined text-[14px]">
                {open ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[var(--border,#e5e7eb)] rounded-lg shadow-lg py-1 z-[70]">
                {visibleSecondary.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive(item.to)
                        ? 'text-[#0052cc] bg-blue-50'
                        : 'text-text-secondary hover:text-[#0052cc] hover:bg-blue-50/50'
                    }`}
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default CreditNav;
