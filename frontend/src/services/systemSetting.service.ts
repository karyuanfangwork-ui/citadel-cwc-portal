import api from './api';

const systemSettingService = {
    /**
     * Get the GROUP_DCEO approval threshold for ESM Travel Requests.
     * Returns the threshold amount (default: 50000).
     */
    async getEsmDceoThreshold(): Promise<number> {
        const response = await api.get('/admin/system-settings/esm-dceo-threshold');
        return response.data?.data?.threshold ?? 50000;
    },

    /**
     * Set the GROUP_DCEO approval threshold for ESM Travel Requests.
     * Requests with totalAmount > threshold will be routed to GROUP_DCEO for approval.
     */
    async setEsmDceoThreshold(threshold: number): Promise<number> {
        const response = await api.put('/admin/system-settings/esm-dceo-threshold', { threshold });
        return response.data?.data?.threshold ?? threshold;
    },
};

export default systemSettingService;