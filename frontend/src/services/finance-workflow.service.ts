import api from './api';

const financeWorkflowService = {
  async submitForManager(requestId: string, managerId: string, notes?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/submit-for-manager`, { managerId, notes });
    return response.data;
  },
  async managerDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/manager-decision`, { decision, comments });
    return response.data;
  },
  async submitForFinanceHead(requestId: string, financeHeadId: string, notes?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/submit-for-finance-head`, { financeHeadId, notes });
    return response.data;
  },
  async financeHeadDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/finance-head-decision`, { decision, comments });
    return response.data;
  },
  async markPayment(requestId: string, data: { paymentStatus: 'PROCESSING' | 'COMPLETED'; paymentReference?: string; notes?: string }) {
    const response = await api.post(`/finance-workflow/requests/${requestId}/mark-payment`, data);
    return response.data;
  },
};

export default financeWorkflowService;
