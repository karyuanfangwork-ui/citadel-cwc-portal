import api from './api';

const itWorkflowService = {
  async submitForApproval(requestId: string, managerId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/submit-for-approval`, { managerId, notes });
    return response.data;
  },
  async managerDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/manager-decision`, { decision, comments });
    return response.data;
  },
  async markProcurement(requestId: string, data: { orderNumber?: string; vendor?: string; estimatedDelivery?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-procurement`, data);
    return response.data;
  },
  async markFulfilled(requestId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-fulfilled`, { notes });
    return response.data;
  },
};

export default itWorkflowService;
