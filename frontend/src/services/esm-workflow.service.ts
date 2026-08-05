import api from './api';

const esmWorkflowService = {
    /**
     * Submit a CWC Travel Request for CEO approval.
     * SUBMITTED → PENDING_CEO_APPROVAL
     */
    async submitForCeoApproval(requestId: string, notes?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/submit-for-ceo`, { notes });
        return response.data;
    },

    /**
     * Requester/Admin reassigns the pending CEO/GROUP_DCEO approver.
     */
    async reassignCeoApprover(requestId: string, approverId: string, notes?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/reassign-ceo-approver`, { approverId, notes });
        return response.data;
    },

    /**
     * CEO approves or rejects a travel request.
     * On approval: routes to GROUP_DCEO approval.
     * On rejection: → REJECTED (terminal).
     */
    async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
        return response.data;
    },

    /**
     * GROUP_DCEO approves or rejects a travel request.
     * Approved → FINANCE_ACKNOWLEDGED (assigned to Finance agent).
     * Rejected → REJECTED (terminal).
     */
    async groupDceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/group-dceo-decision`, { decision, comments });
        return response.data;
    },

    /**
     * Finance Agent acknowledges the travel request and routes to CFO.
     * FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN
     */
    async financeAcknowledge(requestId: string, notes?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/finance-acknowledge`, { notes });
        return response.data;
    },

    /**
     * CFO approves or rejects a travel request.
     * Approved → CFO_APPROVED_FIN → COMPLETED (reassigned to requester).
     * Rejected → CFO_REJECTED_FIN → REJECTED (terminal).
     */
    async cfoDecisionTravel(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/cfo-decision`, { decision, comments });
        return response.data;
    },

    /**
     * Admin/Agent closes a completed travel request.
     * COMPLETED → RESOLVED
     */
    async closeTicket(requestId: string, notes?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/close`, { notes });
        return response.data;
    },
};

export default esmWorkflowService;