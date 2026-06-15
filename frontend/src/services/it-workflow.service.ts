import api from './api';

const itWorkflowService = {
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
  async acknowledgeRequest(requestId: string, notes?: string, ceoId?: string) {
    const payload: Record<string, string | undefined> = {};
    if (notes) payload.notes = notes;
    if (ceoId) payload.ceoId = ceoId;
    const response = await api.post(`/it-workflow/requests/${requestId}/acknowledge`, payload);
    return response.data;
  },
  async ceoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string, ctoId?: string) {
    const payload: Record<string, string | undefined> = { decision };
    if (comments) payload.comments = comments;
    if (ctoId) payload.ctoId = ctoId;
    const response = await api.post(`/it-workflow/requests/${requestId}/ceo-decision`, payload);
    return response.data;
  },
  async ctoDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const response = await api.post(`/it-workflow/requests/${requestId}/cto-decision`, { decision, comments });
    return response.data;
  },
  async routeToCfoApproval(requestId: string, cfoId: string, invoiceFiles: File[], notes?: string) {
    const formData = new FormData();
    formData.append('cfoId', cfoId);
    for (const file of invoiceFiles) {
      formData.append('invoices', file);
    }
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
