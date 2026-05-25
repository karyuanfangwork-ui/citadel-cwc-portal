import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

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

const CrmNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

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

  return (
    <nav className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-[var(--border,#e5e7eb)]">
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
  );
};

export default CrmNav;