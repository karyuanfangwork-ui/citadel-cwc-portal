import apiClient from './api';
import { HRScreening } from '../../types';

export const screeningService = {
    /**
     * Start HR screening for a request
     */
    async startScreening(requestId: string) {
        const response = await apiClient.post(`/screening/requests/${requestId}/start`);
        return response.data;
    },

    /**
     * Update HR screening status
     */
    async updateScreeningStatus(requestId: string, screeningData: {
        backgroundCheckStatus: string;
        backgroundCheckNotes?: string;
        referencesCheckStatus: string;
        referencesCheckNotes?: string;
        referencesContacted?: string[];
    }) {
        const response = await apiClient.put(`/screening/requests/${requestId}`, screeningData);
        return response.data;
    },

    /**
     * Get HR screening details
     */
    async getScreeningDetails(requestId: string): Promise<HRScreening | null> {
        const response = await apiClient.get(`/screening/requests/${requestId}`);
        return response.data.data;
    }
};

export default screeningService;
