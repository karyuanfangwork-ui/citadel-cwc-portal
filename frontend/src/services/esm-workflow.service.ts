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
     * On approval: checks threshold → routes to GROUP_DCEO or ACTION_REQUIRED.
     * On rejection: → REJECTED (terminal).
     */
    async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
        return response.data;
    },

    /**
     * GROUP_DCEO approves or rejects a travel request.
     * Approved → ACTION_REQUIRED (reassigned to requester for booking confirmation).
     * Rejected → REJECTED (terminal).
     */
    async groupDceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/group-dceo-decision`, { decision, comments });
        return response.data;
    },

    /**
     * Requester confirms their booking is completed.
     * ACTION_REQUIRED → COMPLETED
     */
    async confirmBooking(requestId: string, notes?: string) {
        const response = await api.post(`/esm-workflow/requests/${requestId}/confirm-booking`, { notes });
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