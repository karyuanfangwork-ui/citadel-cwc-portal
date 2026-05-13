import apiClient from './api';

// ============================================================================
// APPROVAL WORKFLOW SERVICES
// ============================================================================

/**
 * Route request to CEO for approval
 */
export const routeToCEO = async (requestId: string, ceoId?: string, comments?: string) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/route-to-ceo`, {
        ceoId,
        comments
    });
    return response.data.data;
};

/**
 * CEO approve or reject request
 */
export const ceoDecision = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string
) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/ceo-decision`, {
        decision,
        comments
    });
    return response.data.data;
};

/**
 * Route HR hiring request to Group CEO for approval
 */
export const routeToGroupCeoHR = async (requestId: string, comments?: string) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/route-to-group-ceo-hr`, {
        comments
    });
    return response.data.data;
};

/**
 * Group CEO approve or reject HR hiring request
 */
export const groupCeoDecisionHR = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string
) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/group-ceo-decision-hr`, {
        decision,
        comments
    });
    return response.data.data;
};

/**
 * Mark request as job posted
 */
export const markJobPosted = async (
    requestId: string,
    jobPostingUrl?: string,
    notes?: string
) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/mark-job-posted`, {
        jobPostingUrl,
        notes
    });
    return response.data.data;
};

/**
 * Route request to hiring manager for review
 */
export const routeToManager = async (requestId: string, comments?: string) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/route-to-manager`, {
        comments
    });
    return response.data.data;
};

/**
 * Hiring manager approve or request changes
 */
export const managerDecision = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    selectedCandidateIds: string[],
    comments?: string
) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/manager-decision`, {
        decision,
        selectedCandidateIds,
        comments
    });
    return response.data.data;
};

// ============================================================================
// RESUME UPLOAD SERVICES
// ============================================================================

export interface CandidateResume {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: string;
    mimeType: string | null;
    candidateName: string | null;
    notes: string | null;
    uploadedBy: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    createdAt: string;
}

/**
 * Upload candidate resume
 */
export const uploadResume = async (
    requestId: string,
    file: File,
    candidateName?: string,
    notes?: string,
    documentType?: string
) => {
    const formData = new FormData();
    formData.append('file', file);
    if (candidateName) formData.append('candidateName', candidateName);
    if (notes) formData.append('notes', notes);
    if (documentType) formData.append('documentType', documentType);

    const response = await apiClient.post(
        `/approvals/requests/${requestId}/upload-resume`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response.data.data.resume;
};

/**
 * Get all candidate resumes for a request
 */
export const getResumes = async (requestId: string): Promise<CandidateResume[]> => {
    const response = await apiClient.get(`/approvals/requests/${requestId}/resumes`);
    return response.data.data.resumes;
};

/**
 * Delete a candidate resume
 */
export const deleteResume = async (requestId: string, resumeId: string) => {
    const response = await apiClient.delete(`/approvals/requests/${requestId}/resumes/${resumeId}`);
    return response.data;
};

// ============================================================================
// APPROVER QUEUE SERVICES
// ============================================================================

/**
 * Get all requests pending current user's approval
 */
export const getPendingApprovals = async (params?: {
    page?: number;
    limit?: number;
    priority?: string;
    serviceDeskCode?: string;
}) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.priority) query.set('priority', params.priority);
    if (params?.serviceDeskCode) query.set('serviceDeskCode', params.serviceDeskCode);
    const { data } = await apiClient.get(`/requests/pending-approvals?${query.toString()}`);
    return data;
};

/**
 * Bulk approve/reject requests
 */
export const bulkAction = async (action: 'approve' | 'reject', requestIds: string[], comment?: string) => {
    const { data } = await apiClient.post('/requests/bulk-action', { action, requestIds, comment });
    return data;
};

const approvalService = {
    routeToCEO,
    ceoDecision,
    routeToGroupCeoHR,
    groupCeoDecisionHR,
    markJobPosted,
    routeToManager,
    managerDecision,
    uploadResume,
    getResumes,
    deleteResume,
    getPendingApprovals,
    bulkAction,
};

export default approvalService;
