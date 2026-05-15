import apiClient from './api';

// ── Interfaces ────────────────────────────────────────────────────

export interface AuditLogEntry {
    id: string;
    userId: string;
    userEmail: string;
    action: string;
    resourceType: string;
    resourceId: string;
    ipAddress: string | null;
    userAgent: string | null;
    oldValues: string | null;
    newValues: string | null;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export interface AuditLogResponse {
    status: string;
    data: {
        logs: AuditLogEntry[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

export interface AuditLogParams {
    page?: number;
    limit?: number;
    action?: string;
    resourceId?: string;
    resourceType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
}

// ── Service ────────────────────────────────────────────────────

export const auditLogService = {
    async getLogs(params: AuditLogParams = {}): Promise<AuditLogResponse> {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.limit) query.set('limit', String(params.limit));
        if (params.action) query.set('action', params.action);
        if (params.resourceId) query.set('resourceId', params.resourceId);
        if (params.resourceType) query.set('resourceType', params.resourceType);
        if (params.userId) query.set('userId', params.userId);
        if (params.startDate) query.set('startDate', params.startDate);
        if (params.endDate) query.set('endDate', params.endDate);
        const res = await apiClient.get(`/admin/audit-logs?${query.toString()}`);
        return res.data;
    },
};