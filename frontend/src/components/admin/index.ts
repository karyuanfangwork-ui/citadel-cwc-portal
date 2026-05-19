/**
 * Admin Components Barrel Export
 * All admin-related components exported from a single entry point
 */

// Custom Hook
export { useAdminState } from './useAdminState';

// Constants
export { CATEGORY_ICONS, COLOR_THEMES, ADMIN_TABS } from './adminConstants';

// Tab Components
export { ServiceDesksTab } from './ServiceDesksTab';
export { UserAccountsTab } from './UserAccountsTab';
export { OnboardingTasksTab } from './OnboardingTasksTab';
export { OffboardingTasksTab } from './OffboardingTasksTab';
export { WorkflowTransitionTab } from './WorkflowTransitionTab';
export { BannerConfigTab } from './BannerConfigTab';
export { StatusDefinitionsTab } from './StatusDefinitionsTab';
export { PermissionsTab } from './PermissionsTab';
export { default as SchedulerSettings } from './SchedulerSettings';

// Modal Components
export { CategoryModal } from './CategoryModal';
export { IconPicker } from './IconPicker';
export { ServiceModal } from './ServiceModal';
export { ServiceDeskModal } from './ServiceDeskModal';
export { RoleAssignmentModal } from './RoleAssignmentModal';
export { AgentTeamModal } from './AgentTeamModal';
export { RequestTypeEditModal } from './RequestTypeEditModal';
export { FormBuilderModal } from './FormBuilderModal';

// Existing Components (no changes)
export { default as CreateUserModal } from './CreateUserModal';
export { default as UserEditModal } from './UserEditModal';
export { default as ResetPasswordModal } from './ResetPasswordModal';
