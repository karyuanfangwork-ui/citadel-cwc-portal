import api from './api';

const financeWorkflowService = {
    async acknowledge(requestId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/acknowledge`, { notes });
        return response.data;
    },

    async setFinalizedAmountAndRouteCeo(requestId: string, finalizedAmount: number, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/set-finalized-amount-and-route-ceo`, { finalizedAmount, notes });
        return response.data;
    },

    async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
        return response.data;
    },

    async cfoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/cfo-decision`, { decision, comments });
        return response.data;
    },

    async groupCeoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/group-ceo-decision`, { decision, comments });
        return response.data;
    },

    async markPaymentComplete(requestId: string, paymentReference?: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/mark-payment-complete`, { paymentReference, notes });
        return response.data;
    },

    async closeTicket(requestId: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/close`, {});
        return response.data;
    },

    async getUsersByRole(role: string): Promise<{ id: string; firstName: string; lastName: string; email: string }[]> {
        const response = await api.get('/users', { params: { role, limit: 100 } });
        return response.data.data.users.map((u: any) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
        }));
    },
};

export default financeWorkflowService;