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
export const routeToGroupCeoHR = async (requestId: string, comments?: string, groupCeoId?: string) => {
    const response = await apiClient.post(`/approvals/requests/${requestId}/route-to-group-ceo-hr`, {
        comments,
        groupCeoId,
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
    candidateId: string;
    fileName: string;
    fileUrl: string;
    fileSize: string;
    mimeType: string | null;
    candidateName: string | null;
    documentType: string;
    notes: string | null;
    uploadedBy: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    candidate?: { id: string; fullName: string };
    createdAt: string;
}

export interface Candidate {
    id: string;
    requestId: string;
    fullName: string;
    createdAt: string;
    documents: CandidateResume[];
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

/**
 * Batch upload candidate documents (multiple files per candidate)
 */
export const batchUploadDocs = async (
    requestId: string,
    files: { file: File; documentType: string }[],
    candidateName: string,
    candidateId?: string,
    notes?: string
) => {
    const formData = new FormData();
    files.forEach(({ file }) => {
        formData.append('files', file);
    });
    formData.append('docTypes', JSON.stringify(files.map(f => f.documentType)));
    if (candidateId) formData.append('candidateId', candidateId);
    else formData.append('candidateName', candidateName);
    if (notes) formData.append('notes', notes);

    const response = await apiClient.post(
        `/approvals/requests/${requestId}/upload-candidate-docs`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
};

/**
 * Upload a single doc to an existing candidate
 */
export const uploadDocToCandidate = async (
    requestId: string,
    candidateId: string,
    file: File,
    documentType: string,
    notes?: string
) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('candidateId', candidateId);
    formData.append('documentType', documentType);
    if (notes) formData.append('notes', notes);

    const response = await apiClient.post(
        `/approvals/requests/${requestId}/upload-resume`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.resume;
};

/**
 * Get candidates for a request (with documents)
 */
export const getCandidates = async (requestId: string): Promise<Candidate[]> => {
    const response = await apiClient.get(`/approvals/requests/${requestId}/candidates`);
    return response.data.data;
};

/**
 * Delete a candidate and their documents
 */
export const deleteCandidate = async (requestId: string, candidateId: string) => {
    const response = await apiClient.delete(`/approvals/requests/${requestId}/candidates/${candidateId}`);
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

// ============================================================================
// POLICY EXPLAINER SERVICES
// ============================================================================

export interface ItsmPolicyExplanation {
    type: 'itsm';
    requestId: string;
    referenceNumber: string;
    requestSummary: string;
    currentUserId: string;
    approvals: Array<{
        approvalId: string;
        approverType: string;
        approverId: string | null;
        approverName: string | null;
        entityId: string | null;
        entityName: string | null;
        status: string;
        reason: string;
    }>;
    routingRules: Array<{
        ruleId: string;
        requestTypeName: string;
        routingMode: string;
        customFieldKey: string | null;
        label: string | null;
    }>;
    summary: string;
}

export interface CreditPolicyExplanation {
    type: 'credit';
    applicationId: string;
    applicationNo: string;
    currentUserId: string;
    state: string;
    requestedAmount: string;
    productType: string;
    borrowerRiskRating: string | null;
    borrowerTotalExposure: string | null;
    authorityLevel: string | null;
    requiredApproverCount: number;
    matrixName: string | null;
    decisions: Array<{
        decisionId: string;
        decisionType: string;
        decidedById: string;
        decidedByName: string | null;
        authorityLevel: string | null;
        comments: string | null;
        createdAt: string;
    }>;
    signoffs: Array<{
        signoffId: string;
        role: string;
        signedById: string;
        signedByName: string | null;
        designationSnapshot: string;
        signedAt: string | null;
    }>;
    explanation: string;
}

export type PolicyExplanation = ItsmPolicyExplanation | CreditPolicyExplanation;

/**
 * Fetch a human-readable policy explanation for why an approval is routed to the current user.
 * @param type 'itsm' or 'credit'
 * @param id requestId (for ITSM) or applicationId (for credit)
 */
export const getPolicyExplanation = async (
    type: 'itsm' | 'credit',
    id: string
): Promise<PolicyExplanation> => {
    const response = await apiClient.get(
        `/approvals/policy-explainer?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`
    );
    return response.data.data;
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
    batchUploadDocs,
    uploadDocToCandidate,
    getResumes,
    getCandidates,
    deleteResume,
    deleteCandidate,
    getPendingApprovals,
    bulkAction,
    getPolicyExplanation,
};

export default approvalService;
