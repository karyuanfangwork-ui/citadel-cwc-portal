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
    /**
     * Create a new category for a service desk
     */
    async createCategory(serviceDeskId: string, data: CategoryData) {
        const response = await apiClient.post(`/service-desks/${serviceDeskId}/categories`, data);
        return response.data.data.category;
    },

    /**
     * Update an existing category
     */
    async updateCategory(serviceDeskId: string, categoryId: string, data: Partial<CategoryData>) {
        const response = await apiClient.put(`/service-desks/${serviceDeskId}/categories/${categoryId}`, data);
        return response.data.data.category;
    },

    /**
     * Delete (soft delete) a category
     */
    async deleteCategory(serviceDeskId: string, categoryId: string) {
        const response = await apiClient.delete(`/service-desks/${serviceDeskId}/categories/${categoryId}`);
        return response.data;
    },

    /**
     * Get ALL categories for a service desk (including inactive) — admin only
     */
    async getAllCategoriesAdmin(serviceDeskId: string) {
        const response = await apiClient.get(`/service-desks/${serviceDeskId}/categories/all`);
        return response.data.data.categories;
    },

    async createService(data: { categoryId: string; name: string; description?: string; icon?: string; requiresApproval?: boolean; slaHours?: number | null }) {
        const response = await apiClient.post(`/service-desks/request-types`, data);
        return response.data.data.requestType;
    },

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

    async updateUserStatus(userId: string, isActive: boolean) {
        const response = await apiClient.put(`/users/${userId}`, { isActive });
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

    async createUser(data: { firstName: string; lastName: string; email: string; department?: string }): Promise<{ user: { id: string; firstName: string; lastName: string; email: string; department: string | null; roles: string[] }; tempPassword: string }> {
        const response = await apiClient.post('/users', data);
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
