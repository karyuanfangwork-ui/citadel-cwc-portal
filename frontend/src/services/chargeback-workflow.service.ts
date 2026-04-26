import api from './api';

const chargebackWorkflowService = {
    async submitChargeback(requestId: string, notes?: string) {
        const response = await api.post(`/chargeback-workflow/requests/${requestId}/submit`, { notes });
        return response.data;
    },

    async fromEntityDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/chargeback-workflow/requests/${requestId}/from-entity-decision`, { decision, comments });
        return response.data;
    },

    async toEntityDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/chargeback-workflow/requests/${requestId}/to-entity-decision`, { decision, comments });
        return response.data;
    },

    async markConfirmed(requestId: string, notes?: string) {
        const response = await api.post(`/chargeback-workflow/requests/${requestId}/mark-confirmed`, { notes });
        return response.data;
    },

    async completeChargeback(requestId: string) {
        const response = await api.post(`/chargeback-workflow/requests/${requestId}/complete`, {});
        return response.data;
    },
};

export default chargebackWorkflowService;