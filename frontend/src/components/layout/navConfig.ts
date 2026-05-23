import { hasPermission, hasAnyPermission, hasAnyRole } from '@/src/utils/permissions';
import { isFeatureEnabled } from '@/src/lib/featureFlags';

export type NavLinkConfig = {
  to: string;
  label: string;
  icon: string;
  group: 'primary' | 'secondary' | 'admin';
  show: boolean;
};

export const buildNavLinks = (user: any): NavLinkConfig[] => [
  { to: '/', label: 'Dashboard', icon: 'space_dashboard', group: 'primary', show: true },
  { to: '/my-requests', label: 'My Requests', icon: 'assignment', group: 'primary', show: true },
  { to: '/inbox', label: 'Inbox', icon: 'inbox', group: 'primary', show: true },
  { to: '/announcements', label: 'Announcements', icon: 'campaign', group: 'primary', show: true },
  { to: '/agent', label: 'Agent', icon: 'support_agent', group: 'primary', show: hasAnyRole(user, ['ADMIN', 'AGENT']) },
  { to: '/approvals', label: 'Approvals', icon: 'approval', group: 'primary', show: hasAnyPermission(user, ['request:approve', 'credit:approve']) },
  { to: '/assets', label: 'IT Assets', icon: 'devices', group: 'secondary', show: hasAnyPermission(user, ['asset:read']) },
  { to: '/crm', label: 'CRM', icon: 'group', group: 'secondary', show: hasAnyPermission(user, ['crm:read']) },
  { to: '/credit', label: 'Credit', icon: 'account_balance', group: 'secondary', show: hasAnyPermission(user, ['credit:read']) },
  { to: '/kb', label: 'Knowledge Base', icon: 'menu_book', group: 'secondary', show: isFeatureEnabled('kb') },
  { to: '/reports', label: 'Reports', icon: 'assessment', group: 'secondary', show: hasPermission(user, 'report:read') },
  { to: '/admin/announcements', label: 'Announcements', icon: 'campaign', group: 'admin', show: hasPermission(user, 'announcement:write') },
  { to: '/admin/settings', label: 'Admin', icon: 'settings', group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/audit', label: 'Audit Trail', icon: 'history', group: 'admin', show: hasPermission(user, 'admin:access') },
];