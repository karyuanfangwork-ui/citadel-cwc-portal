import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface CreditNavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
}

const CREDIT_NAV_ITEMS: CreditNavItem[] = [
  { to: '/credit', label: 'Dashboard', icon: 'dashboard' },
  { to: '/credit/borrowers', label: 'Borrowers', icon: 'person' },
  { to: '/credit/applications', label: 'Applications', icon: 'description' },
  { to: '/credit/financials', label: 'Financials', icon: 'spreadsheet', permission: 'credit:read' },
  { to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:read' },
  { to: '/credit/collateral', label: 'Collateral', icon: 'real_estate_agent', permission: 'credit:read' },
  { to: '/credit/approvals', label: 'My Approvals', icon: 'approval', permission: 'credit:review' },
  { to: '/credit/reviews', label: 'Reviews', icon: 'rate_review', permission: 'credit:review' },
  { to: '/credit/disbursements', label: 'Disbursements', icon: 'payments', permission: 'credit:disburse' },
  { to: '/credit/scorecards', label: 'Scorecards', icon: 'dashboard_customize', permission: 'credit:admin' },
  { to: '/credit/reports', label: 'Reports', icon: 'bar_chart' },
];

const CreditNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/credit') return location.pathname === '/credit';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const visibleItems = CREDIT_NAV_ITEMS.filter(item => {
    if (item.permission) {
      return hasPermission(user, item.permission);
    }
    return true;
  });

  return (
    <nav className="sticky top-16 z-30 bg-surface/95 backdrop-blur-sm border-b border-[var(--border,#e5e7eb)]">
      <div className="max-w-[1200px] mx-auto flex items-center gap-1 overflow-x-auto px-4 sm:px-8" style={{ scrollbarWidth: 'none' }}>
        {visibleItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              isActive(item.to)
                ? 'text-[#0052cc] border-[#0052cc]'
                : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
            }`}
            style={{ textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default CreditNav;