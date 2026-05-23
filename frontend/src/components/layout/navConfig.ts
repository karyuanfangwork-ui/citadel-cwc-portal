import { hasPermission, hasAnyPermission, hasAnyRole } from '@/src/utils/permissions';
import { isFeatureEnabled } from '@/src/lib/featureFlags';

export type NavLinkConfig = {
  to: string;
  label: string;
  icon: string;
  group: 'primary' | 'service-desks' | 'tools' | 'admin';
  show: boolean;
};

export const buildNavLinks = (user: any): NavLinkConfig[] => [
  // ── Main ──────────────────────────────────────────────────────────
  { to: '/',              label: 'Dashboard',     icon: 'space_dashboard', group: 'primary', show: true },
  { to: '/my-requests',   label: 'My Requests',   icon: 'assignment',      group: 'primary', show: true },
  { to: '/inbox',         label: 'Inbox',         icon: 'inbox',           group: 'primary', show: true },
  { to: '/announcements', label: 'Announcements', icon: 'campaign',        group: 'primary', show: true },
  { to: '/approvals',     label: 'Approvals',     icon: 'approval',        group: 'primary', show: hasAnyPermission(user, ['request:approve', 'credit:approve']) },
  { to: '/agent',         label: 'Support Queue', icon: 'support_agent',   group: 'primary', show: hasAnyRole(user, ['ADMIN', 'AGENT']) },

  // ── Service Desks ─────────────────────────────────────────────────
  { to: '/it',      label: 'IT Support',    icon: 'computer',       group: 'service-desks', show: true },
  { to: '/hr',      label: 'HR Services',   icon: 'groups',         group: 'service-desks', show: true },
  { to: '/finance', label: 'Group Finance', icon: 'payments',       group: 'service-desks', show: true },

  // ── Tools ─────────────────────────────────────────────────────────
  { to: '/assets', label: 'IT Assets',     icon: 'devices',      group: 'tools', show: hasAnyPermission(user, ['asset:read']) },
  { to: '/crm',    label: 'CRM',           icon: 'group',        group: 'tools', show: hasAnyPermission(user, ['crm:read']) },
  { to: '/credit', label: 'Credit',        icon: 'account_balance', group: 'tools', show: hasAnyPermission(user, ['credit:read']) },
  { to: '/kb',     label: 'Knowledge Base', icon: 'menu_book',   group: 'tools', show: isFeatureEnabled('kb') },

  // ── Admin ─────────────────────────────────────────────────────────
  { to: '/reports',             label: 'Reports',              icon: 'assessment', group: 'admin', show: hasPermission(user, 'report:read') },
  { to: '/insights',            label: 'Insights',             icon: 'insights',   group: 'admin', show: hasPermission(user, 'report:read') },
  { to: '/admin/settings',      label: 'Admin Settings',       icon: 'settings',   group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/audit',         label: 'Audit Trail',          icon: 'history',    group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/announcements', label: 'Manage Announcements', icon: 'campaign',   group: 'admin', show: hasPermission(user, 'announcement:write') },
];