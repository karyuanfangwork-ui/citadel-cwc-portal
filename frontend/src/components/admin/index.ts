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

// Modal Components
export { CategoryModal } from './CategoryModal';
export { ServiceModal } from './ServiceModal';
export { RoleAssignmentModal } from './RoleAssignmentModal';
export { AgentTeamModal } from './AgentTeamModal';

// Existing Components (no changes)
export { default as CreateUserModal } from './CreateUserModal';
export { default as UserEditModal } from './UserEditModal';
export { default as ResetPasswordModal } from './ResetPasswordModal';
