import apiClient from './api';

export interface CategoryData {
    name: string;
    description?: string;
    icon: string;
    colorClass: string;
    displayOrder: number;
    isActive?: boolean;
}

export const adminService = {
    // ── User Management ──────────────────────────────────────────

    async listUsers(params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: boolean }) {
        const query = new URLSearchParams();
        if (params?.page) query.set('page', String(params.page));
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.search) query.set('search', params.search);
        if (params?.role) query.set('role', params.role);
        if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
        const response = await apiClient.get(`/users?${query.toString()}`);
        return response.data.data as { users: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },

    async updateUser(userId: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; department: string; jobTitle: string; isActive: boolean; managerId: string; agentTeam: string; entityId: string | null }>) {
        const response = await apiClient.put(`/users/${userId}`, data);
        return response.data.data.user;
    },

    async assignUserRoles(userId: string, roles: string[]) {
        const response = await apiClient.post(`/users/${userId}/roles`, { roles });
        return response.data.data.user;
    },

    async listRoles() {
        const response = await apiClient.get(`/users/roles/all`);
        return response.data.data.roles as { id: string; name: string; description: string }[];
    },

    async listPermissions() {
        const response = await apiClient.get(`/users/permissions/all`);
        return response.data.data as {
            permissions: { id: string; name: string; resource: string; action: string; description: string | null; roles: { roleId: string }[] }[];
            roles: { id: string; name: string; description: string | null }[];
        };
    },

    async updateRolePermissions(roleId: string, permissionIds: string[]) {
        const response = await apiClient.put(`/users/roles/${roleId}/permissions`, { permissionIds });
        return response.data.data;
    },

    async createRole(data: { name: string; description?: string }) {
        const response = await apiClient.post('/users/roles', data);
        return response.data.data.role as { id: string; name: string; description: string | null };
    },

    async updateRole(roleId: string, data: { name?: string; description?: string }) {
        const response = await apiClient.put(`/users/roles/${roleId}`, data);
        return response.data.data.role as { id: string; name: string; description: string | null };
    },

    async deleteRole(roleId: string) {
        const response = await apiClient.delete(`/users/roles/${roleId}`);
        return response.data;
    },

    async createPermission(data: { name: string; resource: string; action: string; description?: string }) {
        const response = await apiClient.post('/users/permissions', data);
        return response.data.data.permission as { id: string; name: string; resource: string; action: string; description: string | null };
    },

    async deletePermission(permissionId: string) {
        const response = await apiClient.delete(`/users/permissions/${permissionId}`);
        return response.data;
    },

    async createUser(data: { firstName: string; lastName: string; email: string; department?: string; jobTitle?: string; entityId?: string; executiveRole?: string; agentTeam?: string }): Promise<{ user: { id: string; firstName: string; lastName: string; email: string; department: string | null; jobTitle: string | null; entityId: string | null; executiveRole: string | null; agentTeam: string | null; roles: string[] }; tempPassword: string }> {
        const response = await apiClient.post('/users', data);
        return response.data.data;
    },

    async resetUserPassword(userId: string): Promise<{ tempPassword: string }> {
        const response = await apiClient.post(`/users/${userId}/reset-password`);
        return response.data.data;
    },

    // ── Bulk Import ──────────────────────────────────────────────────

    async importStaff(file: File): Promise<{
        summary: { total: number; created: number; updated: number; skipped: number; errors: number };
        details: { email: string; displayName: string; action: 'created' | 'updated' | 'skipped' | 'error'; message: string }[];
    }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/users/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000, // 2 minutes for large imports
        });
        return response.data.data;
    },

    // ── Workflow Transitions ────────────────────────────────────────

    async listWorkflowTransitions() {
        const response = await apiClient.get('/admin/workflow-transitions');
        return response.data.data.transitions as WorkflowTransition[];
    },

    async createWorkflowTransition(data: WorkflowTransitionInput) {
        const response = await apiClient.post('/admin/workflow-transitions', data);
        return response.data.data.transition as WorkflowTransition;
    },

    async updateWorkflowTransition(id: string, data: Partial<WorkflowTransitionInput>) {
        const response = await apiClient.put(`/admin/workflow-transitions/${id}`, data);
        return response.data.data.transition as WorkflowTransition;
    },

    async deleteWorkflowTransition(id: string) {
        const response = await apiClient.delete(`/admin/workflow-transitions/${id}`);
        return response.data;
    },

    async listWorkflowStatuses() {
        const response = await apiClient.get('/admin/workflow-transitions/statuses');
        return response.data.data.statuses as string[];
    },

    // ── Notification Templates ──────────────────────────────────────

    async listNotificationTemplates() {
        const response = await apiClient.get('/admin/notification-templates');
        return response.data.data.templates as NotificationTemplate[];
    },

    async listEventTypes() {
        const response = await apiClient.get('/admin/notification-templates/event-types');
        return response.data.data.eventTypes as EventTypeInfo[];
    },

    async getNotificationTemplate(id: string) {
        const response = await apiClient.get(`/admin/notification-templates/${id}`);
        return response.data.data.template as NotificationTemplate;
    },

    async createNotificationTemplate(data: NotificationTemplateInput) {
        const response = await apiClient.post('/admin/notification-templates', data);
        return response.data.data.template as NotificationTemplate;
    },

    async updateNotificationTemplate(id: string, data: Partial<NotificationTemplateInput>) {
        const response = await apiClient.put(`/admin/notification-templates/${id}`, data);
        return response.data.data.template as NotificationTemplate;
    },

    async deleteNotificationTemplate(id: string) {
        const response = await apiClient.delete(`/admin/notification-templates/${id}`);
        return response.data;
    },

    async sendTestEmail(templateId: string) {
        const response = await apiClient.post(`/admin/notification-templates/${templateId}/test`);
        return response.data;
    },

    async getEmailNotificationsEnabled(): Promise<boolean> {
        const response = await apiClient.get('/admin/system-settings/email-notifications-enabled');
        return response.data.data.enabled as boolean;
    },

    async setEmailNotificationsEnabled(enabled: boolean): Promise<boolean> {
        const response = await apiClient.put('/admin/system-settings/email-notifications-enabled', { enabled });
        return response.data.data.enabled as boolean;
    },

    async getOnboardingItAgent(): Promise<{ id: string; firstName: string; lastName: string; email: string; agentTeam: string } | null> {
        const response = await apiClient.get('/admin/system-settings/onboarding-it-agent');
        return response.data.data.agent;
    },

    async setOnboardingItAgent(userId: string): Promise<{ id: string; firstName: string; lastName: string; email: string; agentTeam: string }> {
        const response = await apiClient.put('/admin/system-settings/onboarding-it-agent', { userId });
        return response.data.data.agent;
    },
};

// ── Shared Types ────────────────────────────────────────────────────

export interface WorkflowTransition {
    id: string;
    fromStatus: string;
    toStatus: string;
    transitionLabel: string | null;
    requiresComment: boolean;
    autoAssignRole: string | null;
    autoAssignUserId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowTransitionInput {
    fromStatus: string;
    toStatus: string;
    transitionLabel?: string;
    requiresComment?: boolean;
    autoAssignRole?: string;
    autoAssignUserId?: string;
    isActive?: boolean;
}

export interface NotificationTemplate {
    id: string;
    name: string;
    eventType: string;
    emailSubject: string | null;
    emailBody: string | null;
    smsBody: string | null;
    pushTitle: string | null;
    pushBody: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationTemplateInput {
    name: string;
    eventType: string;
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
    pushTitle?: string;
    pushBody?: string;
    isActive?: boolean;
}

export interface EventTypeInfo {
    eventType: string;
    label: string;
    category: string;
    recipientDescription: string;
    availableVariables: string[];
}
