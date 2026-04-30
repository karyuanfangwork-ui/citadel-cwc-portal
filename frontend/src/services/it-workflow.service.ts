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
  async markHardwareReceived(requestId: string, data: { receivedDate?: string; notes?: string; assetTag?: string; serialNumber?: string; registerAsAsset?: boolean }) {
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
  async acknowledgeRequest(requestId: string, ceoId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/acknowledge`, { ceoId, notes });
    return response.data;
  },
  async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/ceo-decision`, { decision, comments });
    return response.data;
  },
  async ctoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/cto-decision`, { decision, comments });
    return response.data;
  },
  async routeToCfoApproval(requestId: string, cfoId: string, invoiceFile: File, notes?: string) {
    const formData = new FormData();
    formData.append('cfoId', cfoId);
    formData.append('invoice', invoiceFile);
    if (notes) formData.append('notes', notes);
    const response = await api.post(
      `/it-workflow/requests/${requestId}/route-to-cfo`,
      formData,
      { headers: { 'Content-Type': undefined } }
    );
    return response.data;
  },
  async cfoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/cfo-decision`, { decision, comments });
    return response.data;
  },
  async markPaymentDone(requestId: string, data: { paymentReference: string; amount: number; paymentDate: string; notes?: string }) {
    const response = await api.post(`/it-workflow/requests/${requestId}/payment-done`, data);
    return response.data;
  },
  async completeDelivery(requestId: string, notes?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/complete-delivery`, { notes });
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

export default itWorkflowService;
