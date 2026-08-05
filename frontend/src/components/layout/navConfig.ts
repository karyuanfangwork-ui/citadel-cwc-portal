import { hasPermission, hasAnyPermission, hasAnyRole, hasDepartment } from '@/src/utils/permissions';
import { isFeatureEnabled } from '@/src/lib/featureFlags';

export type NavLinkConfig = {
  to: string;
  label: string;
  icon: string;
  group: 'primary' | 'service-desks' | 'tools' | 'admin';
  show: boolean;
  /** Task 14: Department IDs required to see this link. Empty = no department restriction. */
  requireDepartmentIds?: string[];
};

export const buildNavLinks = (user: any): NavLinkConfig[] => [
  // ── Main ──────────────────────────────────────────────────────────
  { to: '/',              label: 'Dashboard',     icon: 'space_dashboard', group: 'primary', show: true },
  { to: '/my-requests',   label: 'My Requests',   icon: 'assignment',      group: 'primary', show: true },
  { to: '/announcements', label: 'Announcements', icon: 'campaign',        group: 'primary', show: true },
  { to: '/approvals',     label: 'Approvals',     icon: 'approval',        group: 'primary', show: hasAnyPermission(user, ['request:approve', 'credit:approve']) },
  { to: '/inbox',         label: 'Notifications', icon: 'notifications',   group: 'primary', show: true },
  { to: '/agent',         label: 'Support Queue', icon: 'support_agent',   group: 'primary', show: hasAnyRole(user, ['ADMIN', 'AGENT']) },

  // ── Service Desks ─────────────────────────────────────────────────
  // Task 14: Service desks are visible to all users; department gating
  // is enforced at the route/action level, not at the nav level.
  { to: '/it',      label: 'IT Support',    icon: 'computer',       group: 'service-desks', show: true },
  { to: '/hr',      label: 'Group HR',      icon: 'groups',         group: 'service-desks', show: true },
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
  { to: '/admin/workflows',     label: 'Workflow Designer',     icon: 'account_tree', group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/audit',         label: 'Audit Trail',          icon: 'history',    group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/announcements', label: 'Manage Announcements', icon: 'campaign',   group: 'admin', show: hasPermission(user, 'announcement:write') },
];