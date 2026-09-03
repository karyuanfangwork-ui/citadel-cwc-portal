/**
 * Custom hook for Request Detail page state management
 * Encapsulates all useState declarations and handler functions
 * Returns a clean interface for the container component
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { requestService, type AvailableTransition } from '../../services/request.service';
import approvalService, { type Candidate as CandidateType, type CandidateResume as CandidateResumeType } from '../../services/approval.service';
import interviewService from '../../services/interview.service';
import screeningService from '../../services/screening.service';
import loaService from '../../services/loa.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import financeWorkflowService from '../../services/finance-workflow.service';
import itWorkflowService from '../../services/it-workflow.service';
import apiClient from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions (inline - types are not exported from a shared file)
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewSchedule {
    id?: string;
    candidateId?: string;
    candidateResume?: { id: string; candidateName?: string; fileName?: string };
    interviewDate: string;
    interviewTime: string;
    meetingLink?: string;
    location?: string;
    interviewers: string[];
    notes?: string;
}

export interface InterviewFeedback {
    candidateId?: string | null;
    decision: string;
    feedback: string;
    overallRating?: number;
    technicalSkills?: number;
    culturalFit?: number;
    communication?: number;
    strengths?: string;
    weaknesses?: string;
    recommendation?: 'HIRE' | 'NO_HIRE' | 'MAYBE';
    feedbackNotes?: string;
}

export interface HRScreening {
    backgroundCheckStatus: string;
    backgroundCheckNotes?: string;
    referencesCheckStatus: string;
    referencesCheckNotes?: string;
    referencesContacted?: string[];
    overallStatus?: string;
}

export interface LetterOfAcceptance {
    loaFileUrl?: string;
    loaFileName?: string;
    loaFileSize?: number;
    signedLoaFileUrl?: string;
    signedLoaFileName?: string;
    signedLoaFileSize?: number;
    approvalDate?: string;
    acceptedDate?: string;
    approvedBy?: string;
    approvalComments?: string;
}

export type CandidateResume = CandidateResumeType;

export interface InterviewDetails {
    schedule: InterviewSchedule;
    schedules: InterviewSchedule[];
    feedback: InterviewFeedback | null;
    feedbacks: InterviewFeedback[];
}

export interface Attachment {
    id: string;
    fileName: string;
    storageUrl: string;
    mimeType: string | null;
    fileSize: string;  // BigInt serialized as string
}

export interface Activity {
    id: string;
    activityType: string;
    description?: string;
    message: string;
    authorName: string;
    authorRole: string | null;
    isSystemGenerated: boolean;
    isInternal: boolean;
    createdAt: string;
    user?: { firstName: string; lastName: string; email: string };
    attachments?: Attachment[];
}

export interface Request {
    id: string;
    title: string;
    summary: string;
    description?: string | null;
    status: string;
    referenceNumber: string;
    isConfidential?: boolean;
    category: { name: string; icon: string };
    service: { name: string };
    serviceDesk?: { code: string; name: string };
    assignedTo?: { id: string; firstName: string; lastName: string };
    assignedTeam?: string | null;
    requesterId: string;
    requester?: { id: string; firstName: string; lastName: string; email: string };
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string | null;
    completedAt?: string | null;
    slaDueAt?: string | null;
    slaPausedAt?: string | null;
    slaPauseDurationMs?: number | bigint | null;
    priority: string;
    requestType?: {
        code: string;
        name: string;
        requiresApproval?: boolean;
        workflowTypeId?: string;
        workflow?: {
            id: string;
            code: string;
            name: string;
            steps: {
                id: string;
                label: string;
                status: string;
                icon: string;
                displayOrder: number;
                isInitial: boolean;
                isFinal: boolean;
            }[];
        };
        formConfig?: any;
    };
    approvals?: { id: string; approverId: string; approverType: string; status: string }[];
    attachments?: { id: string; fileName: string; storageUrl: string; mimeType: string; createdAt: string }[];
    customFields?: Record<string, any>;
    // P5-04: Form config snapshot preserved at submission time
    formConfigSnapshot?: any[] | null;
    formConfigVersion?: number | null;
    candidateResumes?: CandidateResume[];
    childRequests?: { id: string; referenceNumber: string; summary: string; status: string }[];
    itHardwareRequest?: { serialNumber?: string | null; assetTag?: string | null } | null;
}

interface UseRequestDetailReturn {
    id: string | undefined;
    request: Request | null;
    availableTransitions: AvailableTransition[];
    setRequest: React.Dispatch<React.SetStateAction<Request | null>>;
    activities: Activity[];
    setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
    resumes: CandidateResume[];
    candidates: CandidateType[];
    interviewDetails: InterviewDetails | null;
    screeningDetails: HRScreening | null;
    loaDetails: LetterOfAcceptance | null;
    loading: boolean;
    error: string | null;
    updatingStatus: boolean;
    processingAction: boolean;
    showResolutionModal: boolean;
    showRejectionConfirm: boolean;
    showCompleteOnboardingConfirm: boolean;
    showUploadModal: boolean;
    showJobPostModal: boolean;
    showCEODecisionModal: boolean;
    showManagerDecisionModal: boolean;
    showScheduleInterviewModal: boolean;
    showEditInterviewModal: boolean;
    showInterviewFeedbackModal: boolean;
    showHRScreeningModal: boolean;
    showUploadLOAModal: boolean;
    showLOAApprovalModal: boolean;
    showUploadSignedLOAModal: boolean;
    resolutionComment: string;
    pendingStatus: string | null;
    rejectionPendingStatus: string | null;
    rejectionComment: string;
    setRejectionComment: (value: string) => void;
    setRejectionPendingStatus: React.Dispatch<React.SetStateAction<string | null>>;
    setResolutionComment: (value: string) => void;
    setShowResolutionModal: (value: boolean) => void;
    setShowRejectionConfirm: (value: boolean) => void;
    setShowCompleteOnboardingConfirm: (value: boolean) => void;
    setShowUploadModal: (value: boolean) => void;
    setShowJobPostModal: (value: boolean) => void;
    setShowCEODecisionModal: (value: boolean) => void;
    setShowManagerDecisionModal: (value: boolean) => void;
    setShowScheduleInterviewModal: (value: boolean) => void;
    setShowEditInterviewModal: (value: boolean) => void;
    setShowInterviewFeedbackModal: (value: boolean) => void;
    setShowHRScreeningModal: (value: boolean) => void;
    setShowUploadLOAModal: (value: boolean) => void;
    setShowLOAApprovalModal: (value: boolean) => void;
    setShowUploadSignedLOAModal: (value: boolean) => void;
    fetchRequestData: () => Promise<void>;
    fetchResumes: () => Promise<void>;
    fetchCandidates: () => Promise<void>;
    handleStatusChange: (newStatus: string) => Promise<void>;
    handleResolutionSubmit: () => Promise<void>;
    handleSkipResolution: () => Promise<void>;
    handleDeleteResume: (resumeId: string) => Promise<void>;
    handleScheduleInterview: (interviewData: any) => Promise<void>;
    handleUpdateInterview: (interviewData: any) => Promise<void>;
    handleSubmitInterviewFeedback: (feedbackData: any) => Promise<void>;
    handleStartHRScreening: () => Promise<void>;
    handleRouteLOAForApproval: () => Promise<void>;
    handleLOAApprovalDecision: (decision: 'APPROVE' | 'REJECT', comments?: string) => Promise<void>;
    handleMarkLOAIssued: () => Promise<void>;
    handleMarkLOAAccepted: () => Promise<void>;
    handleCEODecision: (decision: 'APPROVED' | 'REJECTED', comments: string, approverId?: string) => Promise<void>;
    handleManagerDecision: (decision: 'APPROVED' | 'REJECTED', selectedCandidateIds: string[], comments: string) => Promise<void>;
    handleRouteToManager: () => Promise<void>;
    handleAdvanceOnboardingPhase: () => Promise<void>;
    handleCompleteOnboarding: () => Promise<void>;
    confirmCompleteOnboarding: () => Promise<void>;
    handleAdvanceOffboardingPhase: () => Promise<void>;
    handleCompleteOffboarding: () => Promise<void>;
    handleReviseAndResubmit: () => Promise<void>;
    handleReopenForNewCandidates: () => Promise<void>;
    handleUploadResume: (file: File, candidateName: string, candidateEmail: string, candidatePhone: string, notes?: string, documentType?: string) => Promise<void>;
    handleMarkJobPosted: () => Promise<void>;
    updateStatusDirectly: (newStatus: string, comment?: string) => Promise<void>;
}

export const useRequestDetail = (): UseRequestDetailReturn => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const toast = useToast();

    const [request, setRequest] = useState<Request | null>(null);
    const [availableTransitions, setAvailableTransitions] = useState<AvailableTransition[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [resumes, setResumes] = useState<CandidateResume[]>([]);
    const [candidates, setCandidates] = useState<CandidateType[]>([]);
    const [interviewDetails, setInterviewDetails] = useState<InterviewDetails | null>(null);
    const [screeningDetails, setScreeningDetails] = useState<HRScreening | null>(null);
    const [loaDetails, setLoaDetails] = useState<LetterOfAcceptance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);

    const [showResolutionModal, setShowResolutionModal] = useState(false);
    const [showRejectionConfirm, setShowRejectionConfirm] = useState(false);
    const [rejectionComment, setRejectionComment] = useState('');
    const [showCompleteOnboardingConfirm, setShowCompleteOnboardingConfirm] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showJobPostModal, setShowJobPostModal] = useState(false);
    const [showCEODecisionModal, setShowCEODecisionModal] = useState(false);
    const [showManagerDecisionModal, setShowManagerDecisionModal] = useState(false);
    const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
    const [showEditInterviewModal, setShowEditInterviewModal] = useState(false);
    const [showInterviewFeedbackModal, setShowInterviewFeedbackModal] = useState(false);
    const [showHRScreeningModal, setShowHRScreeningModal] = useState(false);
    const [showUploadLOAModal, setShowUploadLOAModal] = useState(false);
    const [showLOAApprovalModal, setShowLOAApprovalModal] = useState(false);
    const [showUploadSignedLOAModal, setShowUploadSignedLOAModal] = useState(false);

    const [resolutionComment, setResolutionComment] = useState('');
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [rejectionPendingStatus, setRejectionPendingStatus] = useState<string | null>(null);

    const fetchRequestData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const [requestData, activitiesData, transitions] = await Promise.all([
                requestService.getRequestById(id),
                requestService.getRequestActivities(id),
                requestService.getAvailableTransitions(id).catch(() => []),
            ]);
            setRequest(requestData);
            setAvailableTransitions(transitions);
            setActivities(activitiesData);
            if (requestData.candidateResumes) setResumes(requestData.candidateResumes);
            if (id) await fetchWorkflowDetails(id, requestData.status);
        } catch (err: any) {
            setError(err.message || 'Failed to load request');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchWorkflowDetails = useCallback(async (requestId: string, status: string) => {
        try {
            const interviewStatuses = ['INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
            if (interviewStatuses.includes(status)) {
                const data = await interviewService.getInterviewDetails(requestId);
                if (data?.schedule && typeof data.schedule.interviewers === 'string') {
                    try { data.schedule.interviewers = JSON.parse(data.schedule.interviewers); } catch (e) { data.schedule.interviewers = []; }
                }
                setInterviewDetails(data);
            }
            const screeningStatuses = ['HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
            if (screeningStatuses.includes(status)) {
                const data = await screeningService.getScreeningDetails(requestId);
                if (data && typeof data.referencesContacted === 'string') {
                    try { data.referencesContacted = JSON.parse(data.referencesContacted); } catch (e) { data.referencesContacted = []; }
                }
                setScreeningDetails(data);
            }
            const loaStatuses = ['LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
            if (loaStatuses.includes(status)) {
                setLoaDetails(await loaService.getLOADetails(requestId));
            }
        } catch (error) {
            console.error('Error fetching workflow details:', error);
        }
    }, []);

    useEffect(() => {
        if (id) fetchRequestData();
    }, [id, fetchRequestData]);

    useEffect(() => {
        const relevantStatuses = ['JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING'];
        if (id && relevantStatuses.includes(request?.status || '')) {
            fetchResumes();
            fetchCandidates();
        }
    }, [id, request?.status]);

    const requireAssigned = useCallback((): boolean => {
        const isAgent = user?.roles?.includes('AGENT') && !user?.roles?.includes('ADMIN');
        if (isAgent && !request?.assignedTo) {
            toast.warning('Assignment Required', 'This ticket must be assigned to an agent before the status can be updated.');
            return false;
        }
        return true;
    }, [user?.roles, request?.assignedTo]);

    const updateStatusDirectly = useCallback(async (newStatus: string, comment?: string) => {
        if (!id) return;
        try {
            setUpdatingStatus(true);
            const updatedRequest = await requestService.updateStatus(id, newStatus as any, comment);
            setRequest(updatedRequest);
            const updatedActivities = await requestService.getRequestActivities(id);
            setActivities(updatedActivities);
        } catch (err: any) {
            toast.error('Status Update Failed', err.message || 'Unknown error');
        } finally {
            setUpdatingStatus(false);
        }
    }, [id]);

    const handleStatusChange = useCallback(async (newStatus: string) => {
        if (!id || !requireAssigned()) return;
        if (newStatus === 'RESOLVED') {
            setPendingStatus(newStatus);
            setShowResolutionModal(true);
            return;
        }
        if (newStatus === 'REJECTED' || newStatus === 'CANCELLED') {
            setRejectionPendingStatus(newStatus);
            setShowRejectionConfirm(true);
            return;
        }
        await updateStatusDirectly(newStatus);
    }, [id, requireAssigned, updateStatusDirectly]);

    const handleResolutionSubmit = useCallback(async () => {
        if (!id || !pendingStatus) return;
        try {
            setUpdatingStatus(true);
            if (resolutionComment.trim()) {
                await requestService.addActivity(id, resolutionComment, false);
            }
            const updatedRequest = await requestService.updateStatus(id, pendingStatus as any);
            setRequest(updatedRequest);
            const updatedActivities = await requestService.getRequestActivities(id);
            setActivities(updatedActivities);
            setShowResolutionModal(false);
            setResolutionComment('');
            setPendingStatus(null);
        } catch (err: any) {
            toast.error('Resolution Failed', err.message || 'Unknown error');
        } finally {
            setUpdatingStatus(false);
        }
    }, [id, pendingStatus, resolutionComment]);

    const handleSkipResolution = useCallback(async () => {
        if (!pendingStatus) return;
        await updateStatusDirectly(pendingStatus);
        setShowResolutionModal(false);
        setResolutionComment('');
        setPendingStatus(null);
    }, [pendingStatus, updateStatusDirectly]);

    const fetchResumes = useCallback(async () => {
        if (!id) return;
        try {
            setResumes(await approvalService.getResumes(id));
        } catch (error) {
            console.error('Error fetching resumes:', error);
        }
    }, [id]);

    const fetchCandidates = useCallback(async () => {
        if (!id) return;
        try {
            setCandidates(await approvalService.getCandidates(id));
        } catch (error) {
            console.error('Error fetching candidates:', error);
        }
    }, [id]);

    const handleDeleteResume = useCallback(async (resumeId: string) => {
        if (!id || !confirm('Are you sure you want to delete this resume?')) return;
        try {
            await approvalService.deleteResume(id, resumeId);
            await fetchResumes();
        } catch (error: any) {
            toast.error('Delete Failed', error.response?.data?.message || 'Failed to delete resume');
        }
    }, [id, fetchResumes]);

    const handleUploadResume = useCallback(async (file: File, candidateName: string, candidateEmail: string, candidatePhone: string, notes?: string, documentType?: string) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await approvalService.uploadResume(id, file, candidateName, notes, documentType);
            await fetchResumes();
            setShowUploadModal(false);
        } catch (error: any) {
            toast.error('Upload Failed', error.response?.data?.message || 'Failed to upload resume');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchResumes]);

    const handleScheduleInterview = useCallback(async (interviewData: any) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await interviewService.scheduleInterview(id, interviewData);
            await fetchRequestData();
            setShowScheduleInterviewModal(false);
        } catch (error: any) {
            toast.error('Schedule Failed', error?.response?.data?.message || error?.message || 'Failed to schedule interview');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleUpdateInterview = useCallback(async (interviewData: any) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await interviewService.updateInterview(id, interviewData);
            await fetchRequestData();
            setShowEditInterviewModal(false);
        } catch (error: any) {
            toast.error('Update Failed', error.message || 'Failed to update interview details');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleSubmitInterviewFeedback = useCallback(async (feedbackData: any) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await interviewService.submitFeedback(id, feedbackData);
            await fetchRequestData();
            setShowInterviewFeedbackModal(false);
        } catch (error: any) {
            toast.error('Feedback Failed', error.message || 'Failed to submit feedback');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleStartHRScreening = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await screeningService.startScreening(id);
            await fetchRequestData();
        } catch (error: any) {
            toast.error('Reference Check Failed', error.message || 'Failed to start reference check');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleRouteLOAForApproval = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await loaService.routeForApproval(id);
            await fetchRequestData();
        } catch (error: any) {
            toast.error('LOA Routing Failed', error.message || 'Failed to route LOA for approval');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleLOAApprovalDecision = useCallback(async (decision: 'APPROVE' | 'REJECT', comments?: string) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await loaService.managerDecision(id, decision, comments);
            await fetchRequestData();
            setShowLOAApprovalModal(false);
        } catch (error: any) {
            toast.error('LOA Decision Failed', error.message || 'Failed to submit LOA decision');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleMarkLOAIssued = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await loaService.markIssued(id);
            await fetchRequestData();
        } catch (error: any) {
            toast.error('LOA Issue Failed', error.message || 'Failed to mark LOA as issued');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleMarkLOAAccepted = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await loaService.markAccepted(id);
            await fetchRequestData();
        } catch (error: any) {
            toast.error('LOA Acceptance Failed', error.message || 'Failed to mark LOA as accepted');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleCEODecision = useCallback(async (decision: 'APPROVED' | 'REJECTED', comments: string, approverId?: string) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            // Route to the correct service based on request status
            const isITRequest = request?.status === 'PENDING_CEO_APPROVAL_IT';
            const isFinanceRequest = request?.status === 'PENDING_CEO_APPROVAL_FIN';
            if (isITRequest) {
                await itWorkflowService.ceoDecision(id, decision, comments, approverId);
            } else if (isFinanceRequest) {
                await financeWorkflowService.ceoDecision(id, decision, comments);
            } else {
                await approvalService.ceoDecision(id, decision, comments);
            }
            await fetchRequestData();
            setShowCEODecisionModal(false);
        } catch (error: any) {
            toast.error('CEO Decision Failed', error.response?.data?.error || error.response?.data?.message || 'Failed to process CEO decision');
        } finally {
            setProcessingAction(false);
        }
    }, [id, request?.status, fetchRequestData]);

    const handleManagerDecision = useCallback(async (decision: 'APPROVED' | 'REJECTED', selectedCandidateIds: string[], comments: string) => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await approvalService.managerDecision(id, decision, selectedCandidateIds, comments);
            await fetchRequestData();
            setShowManagerDecisionModal(false);
        } catch (error: any) {
            toast.error('Manager Decision Failed', error.response?.data?.message || 'Failed to process manager decision');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleRouteToManager = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await approvalService.routeToManager(id);
            await fetchRequestData();
        } catch (error: any) {
            toast.error('Routing Failed', error.response?.data?.message || 'Failed to route to manager');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleMarkJobPosted = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await requestService.updateStatus(id, 'JOB_POSTED' as any);
            await fetchRequestData();
            setShowJobPostModal(false);
        } catch (error: any) {
            toast.error('Job Posting Failed', error.message || 'Failed to mark job as posted');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const ONBOARDING_NEXT_PHASE: Record<string, string> = {
        SUBMITTED: 'PRE_ARRIVAL',
        ONBOARDING_SUBMITTED: 'PRE_ARRIVAL',
        ONBOARDING_PRE_ARRIVAL_SETUP: 'DAY_1_READY',
        ONBOARDING_READY_FOR_DAY_1: 'DAY_1',
        ONBOARDING_DAY_1_ORIENTATION: 'WEEK_1',
    };

    const handleAdvanceOnboardingPhase = useCallback(async () => {
        if (!id || !request) return;
        if (!requireAssigned()) return;
        const nextPhase = ONBOARDING_NEXT_PHASE[request.status];
        if (!nextPhase) return;
        try {
            setProcessingAction(true);
            await apiClient.put(`/onboarding/requests/${id}/onboarding/update-status`, { currentPhase: nextPhase });
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Phase Update Failed', err.response?.data?.message || err.message || 'Failed to advance phase');
        } finally {
            setProcessingAction(false);
        }
    }, [id, request, requireAssigned, fetchRequestData]);

    const handleCompleteOnboarding = useCallback(async () => {
        if (!id) return;
        if (!requireAssigned()) return;
        try {
            const progressRes = await apiClient.get(`/onboarding/requests/${id}/onboarding/progress`);
            if (progressRes.data.tasks?.total > 0 && progressRes.data.tasks?.pending > 0) {
                alert(`Cannot complete onboarding: ${progressRes.data.tasks.pending} task(s) still incomplete.`);
                return;
            }
            setShowCompleteOnboardingConfirm(true);
        } catch (err: any) {
            toast.error('Progress Check Failed', err.response?.data?.message || err.message || 'Failed to check progress');
        }
    }, [id, requireAssigned]);

    const confirmCompleteOnboarding = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            setShowCompleteOnboardingConfirm(false);
            await apiClient.put(`/onboarding/requests/${id}/onboarding/update-status`, { overallStatus: 'COMPLETED' });
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Completion Failed', err.response?.data?.message || err.message || 'Failed to complete onboarding');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const OFFBOARDING_NEXT_PHASE: Record<string, string> = {
        SUBMITTED: 'NOTICE_PERIOD',
        OFFBOARDING_SUBMITTED: 'NOTICE_PERIOD',
        OFFBOARDING_NOTICE_PERIOD: 'KNOWLEDGE_TRANSFER',
        OFFBOARDING_KNOWLEDGE_TRANSFER: 'FINAL_WEEK',
        OFFBOARDING_FINAL_WEEK: 'EXIT_PROCEDURES',
    };

    const handleAdvanceOffboardingPhase = useCallback(async () => {
        if (!id || !request) return;
        if (!requireAssigned()) return;
        const nextPhase = OFFBOARDING_NEXT_PHASE[request.status];
        if (!nextPhase) return;
        try {
            setProcessingAction(true);
            await apiClient.put(`/offboarding/requests/${id}/offboarding/update-status`, { currentPhase: nextPhase });
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Phase Update Failed', err.response?.data?.message || err.message || 'Failed to advance phase');
        } finally {
            setProcessingAction(false);
        }
    }, [id, request, requireAssigned, fetchRequestData]);

    const handleCompleteOffboarding = useCallback(async () => {
        if (!id) return;
        if (!requireAssigned()) return;
        try {
            const progressRes = await apiClient.get(`/offboarding/requests/${id}/offboarding/progress`);
            if (progressRes.data.tasks?.total > 0 && progressRes.data.tasks?.pending > 0) {
                alert(`Cannot complete offboarding: ${progressRes.data.tasks.pending} task(s) still incomplete.`);
                return;
            }
            if (!window.confirm('Mark this offboarding as COMPLETED and close the ticket?')) return;
            setProcessingAction(true);
            await apiClient.put(`/offboarding/requests/${id}/offboarding/update-status`, { overallStatus: 'COMPLETED' });
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Completion Failed', err.response?.data?.message || err.message || 'Failed to complete offboarding');
        } finally {
            setProcessingAction(false);
        }
    }, [id, requireAssigned, fetchRequestData]);

    const handleReviseAndResubmit = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await requestService.updateStatus(id, 'SUBMITTED' as any);
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Reopen Failed', err.message || 'Failed to re-open request');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    const handleReopenForNewCandidates = useCallback(async () => {
        if (!id) return;
        try {
            setProcessingAction(true);
            await requestService.updateStatus(id, 'JOB_POSTED' as any);
            await fetchRequestData();
        } catch (err: any) {
            toast.error('Reopen Failed', err.message || 'Failed to reopen for new candidates');
        } finally {
            setProcessingAction(false);
        }
    }, [id, fetchRequestData]);

    return {
        id, request, availableTransitions, setRequest, activities, setActivities, resumes, candidates, interviewDetails, screeningDetails, loaDetails, loading, error, updatingStatus, processingAction,
        showResolutionModal, showRejectionConfirm, showCompleteOnboardingConfirm, showUploadModal, showJobPostModal, showCEODecisionModal, showManagerDecisionModal, showScheduleInterviewModal, showEditInterviewModal, showInterviewFeedbackModal, showHRScreeningModal, showUploadLOAModal, showLOAApprovalModal, showUploadSignedLOAModal,
        resolutionComment, pendingStatus, rejectionPendingStatus,
        rejectionComment, setRejectionComment,
        setRejectionPendingStatus,
        setResolutionComment, setShowResolutionModal, setShowRejectionConfirm, setShowCompleteOnboardingConfirm, setShowUploadModal, setShowJobPostModal, setShowCEODecisionModal, setShowManagerDecisionModal, setShowScheduleInterviewModal, setShowEditInterviewModal, setShowInterviewFeedbackModal, setShowHRScreeningModal, setShowUploadLOAModal, setShowLOAApprovalModal, setShowUploadSignedLOAModal,
        fetchRequestData, fetchResumes, fetchCandidates, handleStatusChange, handleResolutionSubmit, handleSkipResolution, handleDeleteResume, handleScheduleInterview, handleUpdateInterview, handleSubmitInterviewFeedback, handleStartHRScreening, handleRouteLOAForApproval, handleLOAApprovalDecision, handleMarkLOAIssued, handleMarkLOAAccepted, handleCEODecision, handleManagerDecision, handleRouteToManager, handleAdvanceOnboardingPhase, handleCompleteOnboarding, confirmCompleteOnboarding, handleAdvanceOffboardingPhase, handleCompleteOffboarding, handleReviseAndResubmit, handleReopenForNewCandidates, handleUploadResume, handleMarkJobPosted,
        updateStatusDirectly,
    };
};
