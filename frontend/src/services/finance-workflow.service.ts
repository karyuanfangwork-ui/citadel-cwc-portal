import api from './api';

const financeWorkflowService = {
    async acknowledge(requestId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/acknowledge`, { notes });
        return response.data;
    },

    async setFinalizedAmountAndRouteCfo(requestId: string, finalizedAmount: number, notes?: string, invoiceFiles?: File[]) {
        if (invoiceFiles && invoiceFiles.length > 0) {
            const formData = new FormData();
            formData.append('finalizedAmount', String(finalizedAmount));
            if (notes) formData.append('notes', notes);
            for (const file of invoiceFiles) {
                formData.append('invoices', file);
            }
            const response = await api.post(
                `/finance-workflow/requests/${requestId}/set-finalized-amount-and-route-cfo`,
                formData,
                { headers: { 'Content-Type': undefined } },
            );
            return response.data;
        }
        const response = await api.post(`/finance-workflow/requests/${requestId}/set-finalized-amount-and-route-cfo`, { finalizedAmount, notes });
        return response.data;
    },

    async routeToCfo(requestId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/route-to-cfo`, { notes });
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

    async groupDceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/group-dceo-decision`, { decision, comments });
        return response.data;
    },

    async reassignGroupDceoApprover(requestId: string, approverId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/reassign-group-dceo-approver`, { approverId, notes });
        return response.data;
    },

    async reassignCeoApprover(requestId: string, approverId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/reassign-ceo-approver`, { approverId, notes });
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

    async updateAndCloseBudget(requestId: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/update-and-close-budget`, { notes });
        return response.data;
    },

    // ─── Expense Reimbursement Workflow ───

    async managerApproveExpense(requestId: string, comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/manager-approve-expense`, { comments });
        return response.data;
    },

    async managerRejectExpense(requestId: string, comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/manager-reject-expense`, { comments });
        return response.data;
    },

    async financeHeadApproveExpense(requestId: string, comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/finance-head-approve-expense`, { comments });
        return response.data;
    },

    async financeHeadRejectExpense(requestId: string, comments?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/finance-head-reject-expense`, { comments });
        return response.data;
    },

    async markExpensePaymentComplete(requestId: string, paymentReference?: string, notes?: string) {
        const response = await api.post(`/finance-workflow/requests/${requestId}/mark-expense-payment-complete`, { paymentReference, notes });
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