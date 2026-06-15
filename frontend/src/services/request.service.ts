import apiClient from './api';
import { RequestStatus, RequestPriority } from '../../types';

interface RequestFilters {
    page?: number;
    limit?: number;
    status?: string;  // Single status or comma-separated for multiple
    excludedStatuses?: string;  // Comma-separated statuses to exclude
    serviceDeskId?: string;
    requesterId?: string;
    participantId?: string;
    search?: string;
    requestTypeId?: string;
}

interface CreateRequestData {
    serviceDeskId: string;
    requestTypeId?: string;
    summary: string;
    description?: string;
    priority?: RequestPriority;
    customFields?: Record<string, any>;
    isConfidential?: boolean;
}

export interface RequestParticipant {
    id: string;
    userId: string;
    requestId: string;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string | null;
    };
    addedBy: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export const requestService = {
    async getAllRequests(filters: RequestFilters = {}, signal?: AbortSignal) {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.status) params.append('status', filters.status);
        if (filters.excludedStatuses) params.append('excludedStatuses', filters.excludedStatuses);
        if (filters.serviceDeskId) params.append('serviceDeskId', filters.serviceDeskId);
        if (filters.requesterId) params.append('requesterId', filters.requesterId);
        if (filters.participantId) params.append('participantId', filters.participantId);
        if (filters.search) params.append('search', filters.search);
        if (filters.requestTypeId) params.append('requestTypeId', filters.requestTypeId);

        const response = await apiClient.get(`/requests?${params.toString()}`, { signal });
        return response.data.data;
    },

    async getRequestById(id: string) {
        const response = await apiClient.get(`/requests/${id}`);
        return response.data.data.request;
    },

    async createRequest(data: CreateRequestData) {
        const response = await apiClient.post('/requests', data);
        return response.data.data.request;
    },

    async updateRequest(id: string, data: Partial<CreateRequestData>) {
        const response = await apiClient.put(`/requests/${id}`, data);
        return response.data.data.request;
    },

    async deleteRequest(id: string) {
        await apiClient.delete(`/requests/${id}`);
    },

    async getRequestActivities(id: string) {
        const response = await apiClient.get(`/requests/${id}/activities`);
        return response.data.data.activities;
    },

    async addActivity(requestId: string, message: string, isInternal: boolean = false) {
        const response = await apiClient.post(`/requests/${requestId}/activities`, {
            message,
            isInternal,
        });
        return response.data.data.activity;
    },

    async uploadAttachment(requestId: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post(`/requests/${requestId}/attachments`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.data;
    },

    async downloadAttachment(requestId: string, attachmentId: string) {
        const response = await apiClient.get(`/requests/${requestId}/attachments/${attachmentId}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    async deleteAttachment(requestId: string, attachmentId: string) {
        await apiClient.delete(`/requests/${requestId}/attachments/${attachmentId}`);
    },

    async assignRequest(requestId: string, assignedToId: string) {
        const response = await apiClient.put(`/requests/${requestId}/assign`, {
            assignedToId,
        });
        return response.data.data.request;
    },

    async updateStatus(requestId: string, status: RequestStatus) {
        const response = await apiClient.put(`/requests/${requestId}/status`, {
            status,
        });
        return response.data.data.request;
    },

    async getParticipants(requestId: string): Promise<RequestParticipant[]> {
        const response = await apiClient.get(`/requests/${requestId}/participants`);
        return response.data.data.participants;
    },

    async addParticipant(requestId: string, userId: string): Promise<RequestParticipant> {
        const response = await apiClient.post(`/requests/${requestId}/participants`, { userId });
        return response.data.data.participant;
    },

    async removeParticipant(requestId: string, userId: string): Promise<void> {
        await apiClient.delete(`/requests/${requestId}/participants/${userId}`);
    },

    async getRecentServices(limit: number = 5) {
        const response = await apiClient.get(`/requests/recent-services?limit=${limit}`);
        return response.data.data;
    },

    // ── Export ─────────────────────────────────────────────────────────────
    async exportPdf(id: string): Promise<{ jobId: string }> {
        const response = await apiClient.get(`/requests/${id}/export/pdf`);
        return response.data?.data ?? response.data;
    },

    async exportXlsx(ids: string[]): Promise<Blob> {
        const response = await apiClient.post('/requests/export/xlsx', { ids }, {
            responseType: 'blob',
        });
        return response.data;
    },
};
