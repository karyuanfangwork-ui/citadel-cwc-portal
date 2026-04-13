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
  async markHardwareOrdered(requestId: string, data: { orderNumber?: string; vendor?: string; trackingNumber?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-hardware-ordered`, data);
    return response.data;
  },
  async markHardwareReceived(requestId: string, data: { receivedDate?: string; notes?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-hardware-received`, data);
    return response.data;
  },
  async markSoftwareProvisioned(requestId: string, data: { provisioningNotes?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/mark-software-provisioned`, data);
    return response.data;
  },
  async vpDecision(requestId: string, data: { decision: 'APPROVED' | 'REJECTED'; comments?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/vp-decision`, data);
    return response.data;
  },
  async getSuggestedManager(requestId: string): Promise<{ suggestedManager: { id: string; firstName: string; lastName: string; email: string } | null }> {
    const response = await api.get(`/it-workflow/requests/${requestId}/suggested-manager`);
    return response.data;
  },
  async resubmitRequest(requestId: string, data: {
    hardwareName?: string;
    hardwareModel?: string;
    estimatedPrice?: number;
    preferredVendor?: string;
    productUrl?: string;
    businessJustification?: string;
    resubmitNotes?: string;
  }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/resubmit`, data);
    return response.data;
  },
};

export default itWorkflowService;
