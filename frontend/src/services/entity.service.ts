import apiClient from './api';

// ── Interfaces ────────────────────────────────────────────────────

export interface Entity {
    id: string;
    name: string;
    code: string;
    description: string | null;
    approverId: string;
    isActive: boolean;
    approver: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface RoutingRule {
    id: string;
    requestTypeId: string;
    routingMode: 'REQUESTER_ENTITY' | 'CUSTOM_FIELD';
    customFieldKey: string | null;
    label: string | null;
    isActive: boolean;
    createdAt: string;
}

// ── Entity Service ────────────────────────────────────────────────

export const entityService = {
    async listActiveEntities() {
        const res = await apiClient.get('/admin/entities/active');
        return res.data.data.entities;
    },

    async listEntities() {
        const res = await apiClient.get('/admin/entities');
        return res.data.data.entities;
    },

    async createEntity(data: Partial<Omit<Entity, 'id' | 'approver' | 'createdAt' | 'updatedAt'>>) {
        const res = await apiClient.post('/admin/entities', data);
        return res.data.data.entity;
    },

    async updateEntity(id: string, data: Partial<Omit<Entity, 'id' | 'approver' | 'createdAt' | 'updatedAt'>>) {
        const res = await apiClient.put(`/admin/entities/${id}`, data);
        return res.data.data.entity;
    },

    async listRoutingRules(requestTypeId: string) {
        const res = await apiClient.get(`/admin/entities/routing-rules/${requestTypeId}`);
        return res.data.data.rules;
    },

    async createRoutingRule(requestTypeId: string, data: Partial<Omit<RoutingRule, 'id' | 'createdAt'>>) {
        const res = await apiClient.post(`/admin/entities/routing-rules/${requestTypeId}`, data);
        return res.data.data.rule;
    },

    async deleteRoutingRule(requestTypeId: string, ruleId: string) {
        const res = await apiClient.delete(`/admin/entities/routing-rules/${requestTypeId}/${ruleId}`);
        return res.data;
    },
};