import apiClient from './api';
import { LetterOfAcceptance } from '../../types';

export const loaService = {
    /**
     * Upload LOA document
     */
    async uploadLOA(requestId: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post(`/loa/requests/${requestId}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Route LOA for manager approval
     */
    async routeForApproval(requestId: string, comments?: string) {
        const response = await apiClient.post(`/loa/requests/${requestId}/route-for-approval`, { comments });
        return response.data;
    },

    /**
     * Manager approve/reject LOA
     */
    async managerDecision(requestId: string, decision: 'APPROVE' | 'REJECT', comments?: string) {
        const response = await apiClient.post(`/loa/requests/${requestId}/manager-approve`, { decision, comments });
        return response.data;
    },

    /**
     * Mark LOA as issued to candidate
     */
    async markIssued(requestId: string) {
        const response = await apiClient.post(`/loa/requests/${requestId}/mark-issued`);
        return response.data;
    },

    /**
     * Upload signed LOA from candidate
     */
    async uploadSignedLOA(requestId: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post(`/loa/requests/${requestId}/upload-signed`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Mark LOA as accepted (final step)
     */
    async markAccepted(requestId: string) {
        const response = await apiClient.post(`/loa/requests/${requestId}/mark-accepted`);
        return response.data;
    },

    /**
     * Get LOA details
     */
    async getLOADetails(requestId: string): Promise<LetterOfAcceptance | null> {
        const response = await apiClient.get(`/loa/requests/${requestId}`);
        return response.data.data;
    }
};

export default loaService;
