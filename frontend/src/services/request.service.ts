import apiClient from './api';
import { RequestStatus, RequestPriority } from '../../types';

interface RequestFilters {
    page?: number;
    limit?: number;
    status?: RequestStatus;
    serviceDeskId?: string;
    search?: string;
}

interface CreateRequestData {
    serviceDeskId: string;
    requestTypeId?: string;
    summary: string;
    description?: string;
    priority?: RequestPriority;
    customFields?: Record<string, any>;
}

export const requestService = {
    async getAllRequests(filters: RequestFilters = {}) {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.status) params.append('status', filters.status);
        if (filters.serviceDeskId) params.append('serviceDeskId', filters.serviceDeskId);
        if (filters.search) params.append('search', filters.search);

        const response = await apiClient.get(`/requests?${params.toString()}`);
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
        return response.data.data.attachment;
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
};
