import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import approvalService from '../src/services/approval.service';
import interviewService from '../src/services/interview.service';
import screeningService from '../src/services/screening.service';
import loaService from '../src/services/loa.service';
import { useAuth } from '../src/context/AuthContext';
import financeWorkflowService from '../src/services/finance-workflow.service';
import apiClient from '../src/services/api';
import OnboardingDashboard from '../src/components/OnboardingDashboard';
import OffboardingDashboard from '../src/components/OffboardingDashboard';
import ActionSidebar from '../src/components/request-detail/ActionSidebar';
import ActivityFeed from '../src/components/request-detail/ActivityFeed';
import {
  RequestStatus,
  InterviewSchedule,
  InterviewFeedback,
  HRScreening,
  LetterOfAcceptance,
  CandidateResume
} from '../types';

// Extracted components
import RequestHeader from '../src/components/request/RequestHeader';
import RequestFormFields from '../src/components/request/RequestFormFields';
import HiringWorkflowPanel from '../src/components/request/HiringWorkflowPanel';
import ApprovalActions from '../src/components/request/ApprovalActions';
import ResolutionModal from '../src/components/request/modals/ResolutionModal';
import RejectionModal from '../src/components/request/modals/RejectionModal';
import CompleteOnboardingModal from '../src/components/request/modals/CompleteOnboardingModal';
import ScheduleInterviewModal from '../src/components/request/modals/ScheduleInterviewModal';
import EditInterviewModal from '../src/components/request/modals/EditInterviewModal';
import InterviewFeedbackModal from '../src/components/request/modals/InterviewFeedbackModal';
import LOAApprovalModal from '../src/components/request/modals/LOAApprovalModal';
import CEODecisionModal from '../src/components/request/modals/CEODecisionModal';
import ManagerDecisionModal from '../src/components/request/modals/ManagerDecisionModal';

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customFields?: Record<string, any>;
  serviceDesk?: { id: string; name: string; code: string };
  requestType?: { id: string; code?: string; name: string; formConfig?: any[]; requiresApproval?: boolean };
  requester?: { id: string; firstName: string; lastName: string; email: string };
  assignedTo?: { id: string; firstName: string; lastName: string; email: string };
  requesterId: string;
  slaDueAt?: string | null;
  approvals?: { id: string; approverId: string; approverType: string; status: string }[];
  candidateResumes?: CandidateResume[];
  interviewSchedule?: InterviewSchedule;
  interviewFeedback?: InterviewFeedback;
  hrScreening?: HRScreening;
  letterOfAcceptance?: LetterOfAcceptance;
  parentRequestId?: string;
  parentRequest?: { id: string; referenceNumber: string; summary: string; status: string };
  childRequests?: { id: string; referenceNumber: string; summary: string; status: string }[];
}

interface Activity {
  id: string;
  activityType: string;
  message: string;
  authorName: string;
  authorRole: string | null;
  isSystemGenerated: boolean;
  isInternal: boolean;
  createdAt: string;
}

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showRejectionConfirm, setShowRejectionConfirm] = useState(false);
  const [rejectionPendingStatus, setRejectionPendingStatus] = useState<string | null>(null);
  const [showCompleteOnboardingConfirm, setShowCompleteOnboardingConfirm] = useState(false);

  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Hiring workflow modals
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

  const [interviewDetails, setInterviewDetails] = useState<{
    schedule: InterviewSchedule | null;
    feedback: InterviewFeedback | null;
  } | null>(null);
  const [screeningDetails, setScreeningDetails] = useState<HRScreening | null>(null);
  const [loaDetails, setLoaDetails] = useState<LetterOfAcceptance | null>(null);

  useEffect(() => {
    if (id) fetchRequestData();
  }, [id]);

  const fetchRequestData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [requestData, activitiesData] = await Promise.all([
        requestService.getRequestById(id!),
        requestService.getRequestActivities(id!),
      ]);
      setRequest(requestData);
      setActivities(activitiesData);
      if (requestData.candidateResumes) setResumes(requestData.candidateResumes);
      if (id) await fetchWorkflowDetails(id, requestData.status);
    } catch (err: any) {
      setError(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowDetails = async (requestId: string, status: string) => {
    try {
      const interviewStatuses = ['INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
      if (interviewStatuses.includes(status)) {
        const data = await interviewService.getInterviewDetails(requestId);
        if (data?.schedule && typeof data.schedule.interviewers === 'string') {
          try { data.schedule.interviewers = JSON.parse(data.schedule.interviewers); }
          catch (e) { data.schedule.interviewers = []; }
        }
        setInterviewDetails(data);
      }
      const screeningStatuses = ['HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
      if (screeningStatuses.includes(status)) {
        const data = await screeningService.getScreeningDetails(requestId);
        if (data && typeof data.referencesContacted === 'string') {
          try { data.referencesContacted = JSON.parse(data.referencesContacted); }
          catch (e) { data.referencesContacted = []; }
        }
        setScreeningDetails(data);
      }
      const loaStatuses = ['LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_COMPLETED'];
      if (loaStatuses.includes(status)) {
        setLoaDetails(await loaService.getLOADetails(requestId));
      }
    } catch (error) { console.error('Error fetching workflow details:', error); }
  };

  const requireAssigned = (): boolean => {
    const isAgent = user?.roles?.includes('AGENT') && !user?.roles?.includes('ADMIN');
    if (isAgent && !request?.assignedTo) {
      alert('This ticket must be assigned to an agent before the status can be updated.');
      return false;
    }
    return true;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !requireAssigned()) return;
    if (newStatus === 'RESOLVED') { setPendingStatus(newStatus); setShowResolutionModal(true); return; }
    if (newStatus === 'REJECTED') { setRejectionPendingStatus(newStatus); setShowRejectionConfirm(true); return; }
    await updateStatusDirectly(newStatus);
  };

  const updateStatusDirectly = async (newStatus: string) => {
    if (!id) return;
    try {
      setUpdatingStatus(true);
      const updatedRequest = await requestService.updateStatus(id, newStatus as any);
      setRequest(updatedRequest);
      const updatedActivities = await requestService.getRequestActivities(id);
      setActivities(updatedActivities);
    } catch (err: any) { alert('Failed to update status: ' + (err.message || 'Unknown error')); }
    finally { setUpdatingStatus(false); }
  };

  const handleResolutionSubmit = async () => {
    if (!id || !pendingStatus) return;
    try {
      setUpdatingStatus(true);
      if (resolutionComment.trim()) await requestService.addActivity(id, resolutionComment, false);
      const updatedRequest = await requestService.updateStatus(id, pendingStatus as any);
      setRequest(updatedRequest);
      const updatedActivities = await requestService.getRequestActivities(id);
      setActivities(updatedActivities);
      setShowResolutionModal(false);
      setResolutionComment('');
      setPendingStatus(null);
    } catch (err: any) { alert('Failed to resolve request: ' + (err.message || 'Unknown error')); }
    finally { setUpdatingStatus(false); }
  };

  const handleSkipResolution = async () => {
    if (!pendingStatus) return;
    await updateStatusDirectly(pendingStatus);
    setShowResolutionModal(false);
    setResolutionComment('');
    setPendingStatus(null);
  };

  // Resume handlers
  const fetchResumes = async () => {
    if (!id) return;
    try { setResumes(await approvalService.getResumes(id)); }
    catch (error) { console.error('Error fetching resumes:', error); }
  };

  useEffect(() => {
    const relevantStatuses = ['JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING'];
    if (id && relevantStatuses.includes(request?.status || '')) fetchResumes();
  }, [id, request?.status]);

  const handleDeleteResume = async (resumeId: string) => {
    if (!id || !confirm('Are you sure you want to delete this resume?')) return;
    try { await approvalService.deleteResume(id, resumeId); await fetchResumes(); }
    catch (error: any) { alert(error.response?.data?.message || 'Failed to delete resume'); }
  };

  // Interview handlers
  const handleScheduleInterview = async (interviewData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await interviewService.scheduleInterview(id, interviewData);
      await fetchRequestData();
      setShowScheduleInterviewModal(false);
    } catch (error: any) { alert(error.message || 'Failed to schedule interview'); }
    finally { setProcessingAction(false); }
  };

  const handleUpdateInterview = async (interviewData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await interviewService.updateInterview(id, interviewData);
      await fetchRequestData();
      setShowEditInterviewModal(false);
    } catch (error: any) { alert(error.message || 'Failed to update interview details'); }
    finally { setProcessingAction(false); }
  };

  const handleSubmitInterviewFeedback = async (feedbackData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await interviewService.submitFeedback(id, feedbackData);
      await fetchRequestData();
      setShowInterviewFeedbackModal(false);
    } catch (error: any) { alert(error.message || 'Failed to submit feedback'); }
    finally { setProcessingAction(false); }
  };

  // Screening handlers
  const handleStartHRScreening = async () => {
    if (!id) return;
    try { setProcessingAction(true); await screeningService.startScreening(id); await fetchRequestData(); }
    catch (error: any) { alert(error.message || 'Failed to start HR screening'); }
    finally { setProcessingAction(false); }
  };

  // LOA handlers
  const handleRouteLOAForApproval = async () => {
    if (!id) return;
    try { setProcessingAction(true); await loaService.routeForApproval(id); await fetchRequestData(); }
    catch (error: any) { alert(error.message || 'Failed to route LOA for approval'); }
    finally { setProcessingAction(false); }
  };

  const handleLOAApprovalDecision = async (decision: 'APPROVE' | 'REJECT', comments?: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.managerDecision(id, decision, comments);
      await fetchRequestData();
      setShowLOAApprovalModal(false);
    } catch (error: any) { alert(error.message || 'Failed to submit LOA decision'); }
    finally { setProcessingAction(false); }
  };

  const handleMarkLOAIssued = async () => {
    if (!id) return;
    try { setProcessingAction(true); await loaService.markIssued(id); await fetchRequestData(); }
    catch (error: any) { alert(error.message || 'Failed to mark LOA as issued'); }
    finally { setProcessingAction(false); }
  };

  const handleMarkLOAAccepted = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.markAccepted(id);
      await fetchRequestData();
    } catch (error: any) { alert(error.message || 'Failed to mark LOA as accepted'); }
    finally { setProcessingAction(false); }
  };

  // CEO & Manager decisions
  const handleCEODecision = async (decision: 'APPROVED' | 'REJECTED', comments: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.ceoDecision(id, decision, comments);
      await fetchRequestData();
      setShowCEODecisionModal(false);
    } catch (error: any) { alert(error.response?.data?.message || 'Failed to process CEO decision'); }
    finally { setProcessingAction(false); }
  };

  const handleManagerDecision = async (decision: 'APPROVED' | 'REJECTED', selectedCandidateId: string, comments: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.managerDecision(id, decision, selectedCandidateId, comments);
      await fetchRequestData();
      setShowManagerDecisionModal(false);
    } catch (error: any) { alert(error.response?.data?.message || 'Failed to process manager decision'); }
    finally { setProcessingAction(false); }
  };

  const handleRouteToManager = async () => {
    if (!id) return;
    try { setProcessingAction(true); await approvalService.routeToManager(id); await fetchRequestData(); }
    catch (error: any) { alert(error.response?.data?.message || 'Failed to route to manager'); }
    finally { setProcessingAction(false); }
  };

  // Onboarding handlers
  const ONBOARDING_NEXT_PHASE: Record<string, string> = {
    SUBMITTED: 'PRE_ARRIVAL', ONBOARDING_SUBMITTED: 'PRE_ARRIVAL',
    ONBOARDING_PRE_ARRIVAL_SETUP: 'DAY_1_READY', ONBOARDING_READY_FOR_DAY_1: 'DAY_1',
    ONBOARDING_DAY_1_ORIENTATION: 'WEEK_1',
  };

  const handleAdvanceOnboardingPhase = async () => {
    if (!id || !request) return;
    if (!requireAssigned()) return;
    const nextPhase = ONBOARDING_NEXT_PHASE[request.status];
    if (!nextPhase) return;
    try { setProcessingAction(true); await apiClient.put(`/onboarding/requests/${id}/onboarding/update-status`, { currentPhase: nextPhase }); await fetchRequestData(); }
    catch (err: any) { alert(err.response?.data?.message || err.message || 'Failed to advance phase'); }
    finally { setProcessingAction(false); }
  };

  const handleCompleteOnboarding = async () => {
    if (!id) return;
    if (!requireAssigned()) return;
    try {
      const progressRes = await apiClient.get(`/onboarding/requests/${id}/onboarding/progress`);
      if (progressRes.data.tasks?.total > 0 && progressRes.data.tasks?.pending > 0) {
        alert(`Cannot complete onboarding: ${progressRes.data.tasks.pending} task(s) still incomplete.`); return;
      }
      setShowCompleteOnboardingConfirm(true);
    } catch (err: any) { alert(err.response?.data?.message || err.message || 'Failed to check progress'); }
  };

  const confirmCompleteOnboarding = async () => {
    if (!id) return;
    try { setProcessingAction(true); setShowCompleteOnboardingConfirm(false); await apiClient.put(`/onboarding/requests/${id}/onboarding/update-status`, { overallStatus: 'COMPLETED' }); await fetchRequestData(); }
    catch (err: any) { alert(err.response?.data?.message || err.message || 'Failed to complete onboarding'); }
    finally { setProcessingAction(false); }
  };

  // Offboarding handlers
  const OFFBOARDING_NEXT_PHASE: Record<string, string> = {
    SUBMITTED: 'NOTICE_PERIOD', OFFBOARDING_SUBMITTED: 'NOTICE_PERIOD',
    OFFBOARDING_NOTICE_PERIOD: 'KNOWLEDGE_TRANSFER', OFFBOARDING_KNOWLEDGE_TRANSFER: 'FINAL_WEEK',
    OFFBOARDING_FINAL_WEEK: 'EXIT_PROCEDURES',
  };

  const handleAdvanceOffboardingPhase = async () => {
    if (!id || !request) return;
    if (!requireAssigned()) return;
    const nextPhase = OFFBOARDING_NEXT_PHASE[request.status];
    if (!nextPhase) return;
    try { setProcessingAction(true); await apiClient.put(`/offboarding/requests/${id}/offboarding/update-status`, { currentPhase: nextPhase }); await fetchRequestData(); }
    catch (err: any) { alert(err.response?.data?.message || err.message || 'Failed to advance phase'); }
    finally { setProcessingAction(false); }
  };

  const handleCompleteOffboarding = async () => {
    if (!id) return;
    if (!requireAssigned()) return;
    try {
      const progressRes = await apiClient.get(`/offboarding/requests/${id}/offboarding/progress`);
      if (progressRes.data.tasks?.total > 0 && progressRes.data.tasks?.pending > 0) {
        alert(`Cannot complete offboarding: ${progressRes.data.tasks.pending} task(s) still incomplete.`); return;
      }
      if (!window.confirm('Mark this offboarding as COMPLETED and close the ticket?')) return;
      setProcessingAction(true);
      await apiClient.put(`/offboarding/requests/${id}/offboarding/update-status`, { overallStatus: 'COMPLETED' });
      await fetchRequestData();
    } catch (err: any) { alert(err.response?.data?.message || err.message || 'Failed to complete offboarding'); }
    finally { setProcessingAction(false); }
  };

  const handleReviseAndResubmit = async () => {
    if (!id) return;
    try { setProcessingAction(true); await requestService.updateStatus(id, 'SUBMITTED' as any); await fetchRequestData(); }
    catch (err: any) { alert(err.message || 'Failed to re-open request'); }
    finally { setProcessingAction(false); }
  };

  const handleReopenForNewCandidates = async () => {
    if (!id) return;
    try { setProcessingAction(true); await requestService.updateStatus(id, 'JOB_POSTED' as any); await fetchRequestData(); }
    catch (err: any) { alert(err.message || 'Failed'); }
    finally { setProcessingAction(false); }
  };

  // Loading / error states
  if (loading) return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
      </div>
    </div>
  );

  if (error || !request) return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        <p className="font-semibold">Error loading request</p>
        <p className="text-sm">{error || 'Request not found'}</p>
        <Link to="/my-requests" className="text-sm font-bold underline mt-2 inline-block">Back to My Requests</Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <RequestHeader
        request={request}
        activities={activities}
        user={user}
        onActionClick={() => {}}
        onScheduleInterview={() => setShowScheduleInterviewModal(true)}
        onInterviewFeedback={() => setShowInterviewFeedbackModal(true)}
        onLOAApproval={() => setShowLOAApprovalModal(true)}
        onStartHRScreening={handleStartHRScreening}
        onMarkLOAIssued={handleMarkLOAIssued}
      />

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-10">
          <RequestFormFields request={request} activities={activities} />

          <HiringWorkflowPanel
            request={request}
            resumes={resumes}
            interviewDetails={interviewDetails}
            screeningDetails={screeningDetails}
            loaDetails={loaDetails}
            user={user}
            onDeleteResume={handleDeleteResume}
            onEditInterview={() => setShowEditInterviewModal(true)}
            onShowUploadModal={() => setShowUploadModal(true)}
          />

          {/* Onboarding Workflow */}
          {request.requestType?.code === 'EMPLOYEE_ONBOARDING' || ['ONBOARDING_SUBMITTED', 'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1', 'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION', 'ONBOARDING_COMPLETED'].includes(request.status) ? (
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <span className="material-symbols-outlined text-[#0052cc]">badge</span>
                <h3 className="font-bold text-xl">Onboarding Workflow</h3>
              </div>
              <OnboardingDashboard requestId={request.id} />
            </section>
          ) : null}

          {/* Offboarding Workflow */}
          {request.requestType?.code === 'EMPLOYEE_OFFBOARDING' || ['OFFBOARDING_SUBMITTED', 'OFFBOARDING_NOTICE_PERIOD', 'OFFBOARDING_KNOWLEDGE_TRANSFER', 'OFFBOARDING_FINAL_WEEK', 'OFFBOARDING_EXIT_PROCEDURES', 'OFFBOARDING_COMPLETED'].includes(request.status) ? (
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <span className="material-symbols-outlined text-amber-600">person_remove</span>
                <h3 className="font-bold text-xl">Offboarding Workflow</h3>
              </div>
              <OffboardingDashboard requestId={request.id} onComplete={fetchRequestData} />
            </section>
          ) : null}

          {/* Finance Workflow */}
          {request.serviceDesk?.code === 'FINANCE' && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <span className="material-symbols-outlined text-[#0052cc]">payments</span>
                <h3 className="font-bold text-xl">Finance Workflow</h3>
              </div>
              {request.status === 'SUBMITTED' && user?.roles?.includes('ADMIN') && (
                <button onClick={async () => { const mgrId = prompt('Enter manager UUID:'); if (mgrId) { await financeWorkflowService.submitForManager(request.id, mgrId); window.location.reload(); } }} className="px-4 py-2 bg-[#0052cc] text-white rounded-lg hover:bg-blue-700">Submit for Manager Approval</button>
              )}
              {request.status === 'PENDING_MANAGER_APPROVAL_FIN' && (
                <div className="flex gap-3">
                  <button onClick={async () => { await financeWorkflowService.managerDecision(request.id, 'APPROVED'); window.location.reload(); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                  <button onClick={async () => { const c = prompt('Reason:'); if (c) { await financeWorkflowService.managerDecision(request.id, 'REJECTED', c); window.location.reload(); } }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                </div>
              )}
              {request.status === 'MANAGER_APPROVED_FIN' && user?.roles?.includes('ADMIN') && (
                <button onClick={async () => { const fid = prompt('Enter Finance Head ID:'); if (fid) { await financeWorkflowService.submitForFinanceHead(request.id, fid); window.location.reload(); } }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Submit for Finance Head</button>
              )}
              {request.status === 'PENDING_FINANCE_HEAD_APPROVAL' && (
                <div className="flex gap-3">
                  <button onClick={async () => { await financeWorkflowService.financeHeadDecision(request.id, 'APPROVED'); window.location.reload(); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                  <button onClick={async () => { const c = prompt('Reason:'); if (c) { await financeWorkflowService.financeHeadDecision(request.id, 'REJECTED', c); window.location.reload(); } }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                </div>
              )}
              {request.status === 'FINANCE_HEAD_APPROVED' && user?.roles?.includes('ADMIN') && (
                <button onClick={async () => { const ref = prompt('Payment reference (optional):'); await financeWorkflowService.markPayment(request.id, { paymentStatus: 'PROCESSING', paymentReference: ref || undefined }); window.location.reload(); }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Start Payment</button>
              )}
              {request.status === 'PAYMENT_PROCESSING' && user?.roles?.includes('ADMIN') && (
                <button onClick={async () => { const ref = prompt('Reference:'); await financeWorkflowService.markPayment(request.id, { paymentStatus: 'COMPLETED', paymentReference: ref || undefined }); window.location.reload(); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Mark Payment Done</button>
              )}
            </section>
          )}

          <ActivityFeed
            activities={activities}
            onSubmitComment={async (text, isInternal) => {
              const newActivity = await requestService.addActivity(id!, text, isInternal);
              setActivities(prev => [...prev, newActivity]);
            }}
            canPostInternal={!!(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN'))}
          />
        </div>

        <div data-actions-sidebar className="w-80 shrink-0 flex flex-col gap-3 self-start sticky top-6">
          <ApprovalActions
            request={request}
            interviewDetails={interviewDetails}
            user={user}
            processingAction={processingAction}
            hasLOA={!!loaDetails}
            onStartHRScreening={handleStartHRScreening}
            onRouteLOAForApproval={handleRouteLOAForApproval}
            onReviseAndResubmit={handleReviseAndResubmit}
            onReopenForNewCandidates={handleReopenForNewCandidates}
          />
          <ActionSidebar
            requestId={request.id}
            status={request.status}
            userRoles={user?.roles || []}
            userId={user?.id || ''}
            userName={user ? `${user.firstName} ${user.lastName}` : ''}
            assignedTo={request.assignedTo || null}
            approvals={request.approvals || []}
            requestTypeName={request.requestType?.name || ''}
            requestTypeCode={request.requestType?.code || ''}
            referenceNumber={request.referenceNumber}
            priority={request.priority}
            serviceDeskName={request.serviceDesk?.name || ''}
            requesterName={request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : ''}
            requesterId={request.requesterId || request.requester?.id || ''}
            createdAt={request.createdAt}
            slaDueAt={request.slaDueAt}
            serviceDeskCode={request.serviceDesk?.code || ''}
            requiresApproval={request.requestType?.requiresApproval ?? true}
            attachments={[]}
            hasResumes={resumes.length > 0}
            screeningCompleted={screeningDetails?.overallStatus === 'COMPLETED'}
            hasLOA={!!loaDetails}
            hasSignedLOA={!!loaDetails?.signedLoaFileUrl}
            selectedCandidateId={request.customFields?.selectedCandidateId}
            onActionSuccess={fetchRequestData}
            onLOAApproval={() => setShowLOAApprovalModal(true)}
            onRouteToManager={handleRouteToManager}
            onIssueLOA={handleMarkLOAIssued}
            onMarkLOAAccepted={handleMarkLOAAccepted}
            onAdvanceOnboardingPhase={handleAdvanceOnboardingPhase}
            onCompleteOnboarding={handleCompleteOnboarding}
            onAdvanceOffboardingPhase={handleAdvanceOffboardingPhase}
            onCompleteOffboarding={handleCompleteOffboarding}
          />
        </div>
      </div>

      {/* Modals */}
      <ResolutionModal
        isOpen={showResolutionModal}
        resolutionComment={resolutionComment}
        updatingStatus={updatingStatus}
        onClose={() => { setShowResolutionModal(false); setResolutionComment(''); }}
        onCommentChange={setResolutionComment}
        onSkipResolution={handleSkipResolution}
        onSubmitResolution={handleResolutionSubmit}
      />

      <RejectionModal
        isOpen={showRejectionConfirm}
        updatingStatus={updatingStatus}
        onClose={() => { setShowRejectionConfirm(false); setRejectionPendingStatus(null); }}
        onConfirmReject={async () => { if (rejectionPendingStatus) { await updateStatusDirectly(rejectionPendingStatus); setShowRejectionConfirm(false); setRejectionPendingStatus(null); } }}
      />

      <CompleteOnboardingModal
        isOpen={showCompleteOnboardingConfirm}
        processingAction={processingAction}
        onClose={() => setShowCompleteOnboardingConfirm(false)}
        onConfirm={confirmCompleteOnboarding}
      />

      <ScheduleInterviewModal
        isOpen={showScheduleInterviewModal}
        processingAction={processingAction}
        requestId={request.id}
        onClose={() => setShowScheduleInterviewModal(false)}
        onSubmit={handleScheduleInterview}
      />

      <EditInterviewModal
        isOpen={showEditInterviewModal}
        processingAction={processingAction}
        interviewDetails={interviewDetails}
        onClose={() => setShowEditInterviewModal(false)}
        onSubmit={handleUpdateInterview}
      />

      <InterviewFeedbackModal
        isOpen={showInterviewFeedbackModal}
        processingAction={processingAction}
        onClose={() => setShowInterviewFeedbackModal(false)}
        onSubmit={handleSubmitInterviewFeedback}
      />

      <LOAApprovalModal
        isOpen={showLOAApprovalModal}
        processingAction={processingAction}
        onClose={() => setShowLOAApprovalModal(false)}
        onSubmit={handleLOAApprovalDecision}
      />

      <CEODecisionModal
        isOpen={showCEODecisionModal}
        processingAction={processingAction}
        onClose={() => setShowCEODecisionModal(false)}
        onSubmit={handleCEODecision}
      />

      <ManagerDecisionModal
        isOpen={showManagerDecisionModal}
        processingAction={processingAction}
        resumes={resumes}
        onClose={() => setShowManagerDecisionModal(false)}
        onSubmit={handleManagerDecision}
      />
    </div>
  );
};

export default RequestDetail;
