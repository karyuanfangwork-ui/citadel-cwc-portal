/**
 * Shared constants for Admin Settings components
 * Used across AdminSettings.tsx and extracted tab/modal components
 */

export const CATEGORY_ICONS = [
    { name: 'laptop', label: 'Laptop/Hardware' },
    { name: 'apps', label: 'Applications' },
    { name: 'key', label: 'Access/Security' },
    { name: 'mail', label: 'Email' },
    { name: 'wifi', label: 'Network' },
    { name: 'dns', label: 'Servers' },
    { name: 'terminal', label: 'Development' },
    { name: 'groups', label: 'People/HR' },
    { name: 'payments', label: 'Finance' },
    { name: 'event_available', label: 'Calendar/Leave' },
    { name: 'health_and_safety', label: 'Benefits/Health' },
    { name: 'school', label: 'Training' },
    { name: 'receipt_long', label: 'Expenses' },
    { name: 'shopping_cart', label: 'Procurement' },
    { name: 'business', label: 'Vendors' },
    { name: 'help', label: 'General Help' },
];

export const COLOR_THEMES = [
    { name: 'Blue', class: 'bg-blue-50 text-blue-600' },
    { name: 'Indigo', class: 'bg-indigo-50 text-indigo-600' },
    { name: 'Purple', class: 'bg-purple-50 text-purple-600' },
    { name: 'Emerald', class: 'bg-emerald-50 text-emerald-600' },
    { name: 'Amber', class: 'bg-amber-50 text-amber-600' },
    { name: 'Red', class: 'bg-red-50 text-red-600' },
    { name: 'Cyan', class: 'bg-cyan-50 text-cyan-600' },
    { name: 'Pink', class: 'bg-pink-50 text-pink-600' },
];

export const ADMIN_TABS = [
    { id: 'service-desks',    label: 'Service Desks',     icon: 'support_agent',  group: 'Configuration' },
    { id: 'users',            label: 'User Accounts',     icon: 'manage_accounts', group: 'Configuration' },
    { id: 'permissions',      label: 'Permissions',       icon: 'shield_lock',    group: 'Configuration' },
    { id: 'entities',         label: 'Entities',          icon: 'corporate_fare', group: 'Configuration' },
    { id: 'email-notifications', label: 'Email Notifications', icon: 'mail', group: 'Configuration' },
    { id: 'onboarding-tasks', label: 'Onboarding Tasks',  icon: 'checklist',      group: 'Workflows' },
    { id: 'offboarding-tasks',label: 'Offboarding Tasks', icon: 'checklist_rtl',  group: 'Workflows' },
    { id: 'workflow-config',  label: 'Workflow Config',   icon: 'account_tree',   group: 'Workflows' },
    { id: 'status-definitions',label:'Request Statuses',  icon: 'fact_check',     group: 'Workflows' },
    { id: 'sla-escalation',  label: 'SLA Escalation',    icon: 'timer',          group: 'Workflows' },
    { id: 'audit-logs',      label: 'Audit Logs',        icon: 'visibility',    group: 'Configuration' },
    { id: 'scheduler',       label: 'Scheduler',         icon: 'schedule',       group: 'Configuration' },
    { id: 'banner-config',    label: 'Banner & Branding', icon: 'campaign',       group: 'Appearance' },
] as const;

export type AdminTabId = typeof ADMIN_TABS[number]['id'];
export type AdminTabGroup = 'Configuration' | 'Workflows' | 'Appearance';
