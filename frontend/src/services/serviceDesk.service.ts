import apiClient from './api';

export interface EscalationRule {
    id: string;
    requestTypeId: string;
    triggerHoursAfterBreach: number;
    notifyRoles: string[];
    label: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface EscalationRole {
    id: string;
    name: string;
    description?: string | null;
}

export interface EscalationRuleWithDetails extends EscalationRule {
    requestType: {
        id: string;
        name: string;
        slaHours: number | null;
        serviceCategory: {
            id: string;
            name: string;
            serviceDesk: { id: string; name: string };
        };
    };
}

export const serviceDeskService = {
    async getAllServiceDesks() {
        const response = await apiClient.get('/service-desks');
        return response.data.data.serviceDesks;
    },

    async getServiceDeskById(id: string) {
        const response = await apiClient.get(`/service-desks/${id}`);
        return response.data.data.serviceDesk;
    },

    async getCategories(serviceDeskId: string) {
        const response = await apiClient.get(`/service-desks/${serviceDeskId}/categories`);
        return response.data.data.categories;
    },

    async getRequestTypes(serviceDeskId: string, categoryId?: string) {
        let url = `/service-desks/${serviceDeskId}/request-types`;
        if (categoryId) {
            url += `?categoryId=${categoryId}`;
        }
        const response = await apiClient.get(url);
        return response.data.data.requestTypes;
    },

    async getAllRequestTypesAdmin(deskId: string, categoryId?: string) {
        let url = `/service-desks/${deskId}/request-types/all`;
        if (categoryId) {
            url += `?categoryId=${categoryId}`;
        }
        const response = await apiClient.get(url);
        return response.data.data.requestTypes;
    },

    // --- Admin Service Desk Management ---

    // P2-01: Admin endpoint — returns active + inactive desks for admin management
    async getAllServiceDesksAdmin() {
        const response = await apiClient.get('/service-desks/admin/all');
        return response.data.data.serviceDesks;
    },

    async createServiceDesk(data: { name: string; code: string; description?: string; autoAssignTeam?: string; assignmentStrategy?: string; autoAssignUserId?: string | null }) {
        const response = await apiClient.post('/service-desks', data);
        return response.data.data.serviceDesk;
    },

    async updateServiceDesk(id: string, data: { name?: string; description?: string; isActive?: boolean; autoAssignTeam?: string; assignmentStrategy?: string; autoAssignUserId?: string | null }) {
        const response = await apiClient.put(`/service-desks/${id}`, data);
        return response.data.data.serviceDesk;
    },

    async deleteServiceDesk(id: string) {
        const response = await apiClient.delete(`/service-desks/${id}`);
        return response.data;
    },

    async getServiceDeskAgents(id: string) {
        const response = await apiClient.get(`/service-desks/${id}/agents`);
        return response.data.data;
    },

    async getServiceDeskAgentsByTeam(team: string) {
        const response = await apiClient.get('/service-desks/agents', { params: { team } });
        return response.data.data;
    },

    // --- Admin Category Management ---

    async getAllCategoriesAdmin(serviceDeskId: string) {
        const response = await apiClient.get(`/service-desks/${serviceDeskId}/categories/all`);
        return response.data.data.categories;
    },

    async createCategory(serviceDeskId: string, data: any) {
        const response = await apiClient.post(`/service-desks/${serviceDeskId}/categories`, data);
        return response.data.data.category;
    },

    async updateCategory(serviceDeskId: string, categoryId: string, data: any) {
        const response = await apiClient.put(`/service-desks/${serviceDeskId}/categories/${categoryId}`, data);
        return response.data.data.category;
    },

    async reorderCategories(serviceDeskId: string, categoryIds: string[]) {
        const response = await apiClient.put(`/service-desks/${serviceDeskId}/categories/reorder`, { categoryIds });
        return response.data.data.categories;
    },

    async deleteCategory(serviceDeskId: string, categoryId: string) {
        const response = await apiClient.delete(`/service-desks/${serviceDeskId}/categories/${categoryId}`);
        return response.data;
    },

    // --- Admin Request Type Management ---

    async createRequestType(data: any) {
        const response = await apiClient.post('/service-desks/request-types', data);
        return response.data.data.requestType;
    },

    async updateRequestType(typeId: string, data: any) {
        const response = await apiClient.put(`/service-desks/request-types/${typeId}`, data);
        return response.data.data.requestType;
    },

    async deleteRequestType(typeId: string) {
        const response = await apiClient.delete(`/service-desks/request-types/${typeId}`);
        return response.data;
    },

    // P2-04: Deactivation impact preview
    async getDeskDeactivationImpact(deskId: string) {
        const response = await apiClient.get(`/service-desks/${deskId}/deactivation-impact`);
        return response.data.data.impact;
    },

    async getCategoryDeactivationImpact(deskId: string, categoryId: string) {
        const response = await apiClient.get(`/service-desks/${deskId}/categories/${categoryId}/deactivation-impact`);
        return response.data.data.impact;
    },

    async getRequestTypeDeactivationImpact(typeId: string) {
        const response = await apiClient.get(`/service-desks/request-types/${typeId}/deactivation-impact`);
        return response.data.data.impact;
    },

    // --- Escalation Rules ---

    async getEscalationRules(requestTypeId: string) {
        const response = await apiClient.get(`/sla/request-types/${requestTypeId}/escalation-rules`);
        return response.data.data.rules;
    },

    async getEscalationRulesOverview(params?: { deskId?: string; categoryId?: string; requestTypeId?: string }) {
        const response = await apiClient.get('/sla/escalation-rules/overview', { params });
        return response.data.data.rules as EscalationRuleWithDetails[];
    },

    async createEscalationRule(data: { requestTypeId: string; triggerHoursAfterBreach: number; notifyRoles: string[]; label?: string }) {
        const response = await apiClient.post('/sla/escalation-rules', data);
        return response.data.data.rule;
    },

    async updateEscalationRule(id: string, data: { triggerHoursAfterBreach?: number; notifyRoles?: string[]; label?: string; isActive?: boolean }) {
        const response = await apiClient.put(`/sla/escalation-rules/${id}`, data);
        return response.data.data.rule;
    },

    async deleteEscalationRule(id: string) {
        await apiClient.delete(`/sla/escalation-rules/${id}`);
    },
};