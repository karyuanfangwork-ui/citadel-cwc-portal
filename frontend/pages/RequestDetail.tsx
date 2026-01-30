import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import approvalService from '../src/services/approval.service';
import interviewService from '../src/services/interview.service';
import screeningService from '../src/services/screening.service';
import loaService from '../src/services/loa.service';
import { useAuth } from '../src/context/AuthContext';
import { STATUS_CONFIG } from '../constants';
import {
  RequestStatus,
  InterviewSchedule,
  InterviewFeedback,
  HRScreening,
  LetterOfAcceptance,
  CandidateResume
} from '../types';

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
  serviceDesk?: {
    id: string;
    name: string;
    code: string;
  };
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  requesterId: string;
  candidateResumes?: CandidateResume[];
  interviewSchedule?: InterviewSchedule;
  interviewFeedback?: InterviewFeedback;
  hrScreening?: HRScreening;
  letterOfAcceptance?: LetterOfAcceptance;
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
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Hiring workflow states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showJobPostModal, setShowJobPostModal] = useState(false);
  const [showCEODecisionModal, setShowCEODecisionModal] = useState(false);
  const [showManagerDecisionModal, setShowManagerDecisionModal] = useState(false);

  // New Hiring Workflow states
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
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
    if (id) {
      fetchRequestData();
    }
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

      // Sync resumes state if available in requestData
      if (requestData.candidateResumes) {
        setResumes(requestData.candidateResumes);
      }

      // Fetch additional workflow details based on status
      if (id) {
        fetchWorkflowDetails(id, requestData.status);
      }
    } catch (err: any) {
      console.error('Error fetching request:', err);
      setError(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowDetails = async (requestId: string, status: string) => {
    try {
      // Interviews
      if (['INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED', 'RESOLVED'].includes(status)) {
        const data = await interviewService.getInterviewDetails(requestId);

        // Final fallback for interviewers
        if (data?.schedule && typeof data.schedule.interviewers === 'string') {
          try {
            data.schedule.interviewers = JSON.parse(data.schedule.interviewers);
          } catch (e) {
            data.schedule.interviewers = [];
          }
        }

        setInterviewDetails(data);
      }

      // Screening
      if (['HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED'].includes(status)) {
        const data = await screeningService.getScreeningDetails(requestId);

        // Final fallback for referencesContacted
        if (data && typeof data.referencesContacted === 'string') {
          try {
            data.referencesContacted = JSON.parse(data.referencesContacted);
          } catch (e) {
            data.referencesContacted = [];
          }
        }

        setScreeningDetails(data);
      }

      // LOA
      if (['LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED'].includes(status)) {
        const data = await loaService.getLOADetails(requestId);
        setLoaDetails(data);
      }
    } catch (error) {
      console.error('Error fetching workflow details:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !id) return;

    try {
      setSubmitting(true);
      const newActivity = await requestService.addActivity(id, comment, false);

      // Add the new activity to the list
      setActivities([...activities, newActivity]);
      setComment('');
    } catch (err: any) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToSelf = async () => {
    if (!id || !user?.id) return;

    try {
      setAssigning(true);
      const updatedRequest = await requestService.assignRequest(id, user.id);

      // Update the request with the new assignment
      setRequest(updatedRequest);

      // Refresh activities to show the assignment event
      const updatedActivities = await requestService.getRequestActivities(id);
      setActivities(updatedActivities);
    } catch (err: any) {
      console.error('Error assigning request:', err);
      alert('Failed to assign request: ' + (err.message || 'Unknown error'));
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;

    // If changing to RESOLVED, show resolution modal
    if (newStatus === 'RESOLVED') {
      setPendingStatus(newStatus);
      setShowResolutionModal(true);
      return;
    }

    // For other status changes, proceed normally
    await updateStatusDirectly(newStatus);
  };

  const updateStatusDirectly = async (newStatus: string) => {
    if (!id) return;

    try {
      setUpdatingStatus(true);
      const updatedRequest = await requestService.updateStatus(id, newStatus as any);

      // Update the request with the new status
      setRequest(updatedRequest);

      // Refresh activities to show the status change event
      const updatedActivities = await requestService.getRequestActivities(id);
      setActivities(updatedActivities);
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolutionSubmit = async () => {
    if (!id || !pendingStatus) return;

    try {
      setUpdatingStatus(true);

      // Add resolution comment if provided
      if (resolutionComment.trim()) {
        await requestService.addActivity(id, resolutionComment, false);
      }

      // Update status to RESOLVED
      const updatedRequest = await requestService.updateStatus(id, pendingStatus as any);
      setRequest(updatedRequest);

      // Refresh activities
      const updatedActivities = await requestService.getRequestActivities(id);
      setActivities(updatedActivities);

      // Close modal and reset
      setShowResolutionModal(false);
      setResolutionComment('');
      setPendingStatus(null);
    } catch (err: any) {
      console.error('Error resolving request:', err);
      alert('Failed to resolve request: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSkipResolution = async () => {
    if (!pendingStatus) return;

    // Update status without adding comment
    await updateStatusDirectly(pendingStatus);

    // Close modal and reset
    setShowResolutionModal(false);
    setResolutionComment('');
    setPendingStatus(null);
  };

  // ============================================================================
  // HIRING WORKFLOW HANDLERS
  // ============================================================================

  const fetchResumes = async () => {
    if (!id) return;
    try {
      const resumesData = await approvalService.getResumes(id);
      setResumes(resumesData);
    } catch (error) {
      console.error('Error fetching resumes:', error);
    }
  };

  useEffect(() => {
    const relevantStatuses = ['JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING'];
    if (id && relevantStatuses.includes(request?.status || '')) {
      fetchResumes();
    }
  }, [id, request?.status]);

  const handleRouteToCEO = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.routeToCEO(id);
      await fetchRequestData();
      alert('Request routed to CEO for approval');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to route to CEO');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleCEODecision = async (decision: 'APPROVED' | 'REJECTED', comments: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.ceoDecision(id, decision, comments);
      await fetchRequestData();
      setShowCEODecisionModal(false);
      alert(`Request ${decision.toLowerCase()} by CEO`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to process CEO decision');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMarkJobPosted = async (jobPostingUrl: string, notes: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.markJobPosted(id, jobPostingUrl, notes);
      await fetchRequestData();
      setShowJobPostModal(false);
      alert('Job marked as posted');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to mark job as posted');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleUploadResume = async (file: File, candidateName: string, notes: string) => {
    if (!id) return;
    try {
      setUploadingResume(true);
      await approvalService.uploadResume(id, file, candidateName, notes);
      await fetchResumes();
      setShowUploadModal(false);
      alert('Resume uploaded successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!id || !confirm('Are you sure you want to delete this resume?')) return;
    try {
      await approvalService.deleteResume(id, resumeId);
      await fetchResumes();
      alert('Resume deleted successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete resume');
    }
  };

  const handleRouteToManager = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.routeToManager(id);
      await fetchRequestData();
      alert('Request routed to hiring manager for review');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to route to manager');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleManagerDecision = async (decision: 'APPROVED' | 'REJECTED', selectedCandidateId: string, comments: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await approvalService.managerDecision(id, decision, selectedCandidateId, comments);
      await fetchRequestData();
      setShowManagerDecisionModal(false);
      alert(`Candidate selection ${decision.toLowerCase()}`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to process manager decision');
    } finally {
      setProcessingAction(false);
    }
  };

  // Interview Handlers
  const handleScheduleInterview = async (interviewData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await interviewService.scheduleInterview(id, interviewData);
      await fetchRequestData();
      setShowScheduleInterviewModal(false);
      alert('Interview scheduled successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to schedule interview');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSubmitInterviewFeedback = async (feedbackData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await interviewService.submitFeedback(id, feedbackData);
      await fetchRequestData();
      setShowInterviewFeedbackModal(false);
      alert('Interview feedback submitted successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to submit feedback');
    } finally {
      setProcessingAction(false);
    }
  };

  // Screening Handlers
  const handleStartHRScreening = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await screeningService.startScreening(id);
      await fetchRequestData();
      alert('HR screening started');
    } catch (error: any) {
      alert(error.message || 'Failed to start HR screening');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleUpdateScreeningStatus = async (screeningData: any) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await screeningService.updateScreeningStatus(id, screeningData);
      await fetchRequestData();
      setShowHRScreeningModal(false);
      alert('Screening status updated');
    } catch (error: any) {
      alert(error.message || 'Failed to update screening status');
    } finally {
      setProcessingAction(false);
    }
  };

  // LOA Handlers
  const handleUploadLOA = async (file: File) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.uploadLOA(id, file);
      await fetchRequestData();
      setShowUploadLOAModal(false);
      alert('LOA document uploaded successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to upload LOA');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRouteLOAForApproval = async (comments?: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.routeForApproval(id, comments);
      await fetchRequestData();
      alert('LOA routed for manager approval');
    } catch (error: any) {
      alert(error.message || 'Failed to route LOA for approval');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleLOAApprovalDecision = async (decision: 'APPROVE' | 'REJECT', comments?: string) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.managerDecision(id, decision, comments);
      await fetchRequestData();
      setShowLOAApprovalModal(false);
      alert(`LOA ${decision.toLowerCase()}d successfully`);
    } catch (error: any) {
      alert(error.message || 'Failed to submit LOA decision');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMarkLOAIssued = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.markIssued(id);
      await fetchRequestData();
      alert('LOA marked as issued to candidate');
    } catch (error: any) {
      alert(error.message || 'Failed to mark LOA as issued');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleUploadSignedLOA = async (file: File) => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.uploadSignedLOA(id, file);
      await fetchRequestData();
      setShowUploadSignedLOAModal(false);
      alert('Signed LOA uploaded successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to upload signed LOA');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleMarkLOAAccepted = async () => {
    if (!id) return;
    try {
      setProcessingAction(true);
      await loaService.markAccepted(id);
      await fetchRequestData();
      alert('Hiring process complete! LOA marked as accepted.');
    } catch (error: any) {
      alert(error.message || 'Failed to mark LOA as accepted');
    } finally {
      setProcessingAction(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusSteps = (currentStatus: string) => {
    const isHiringWorkflow = request?.serviceDesk?.code === 'HR';

    if (isHiringWorkflow) {
      const allSteps = [
        { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
        { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL', icon: 'verified_user' },
        { label: 'Job Posted', status: 'JOB_POSTED', icon: 'work' },
        { label: 'Manager Review', status: 'PENDING_MANAGER_REVIEW', icon: 'rate_review' },
        { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'event' },
        { label: 'Screening', status: 'HR_SCREENING', icon: 'fact_check' },
        { label: 'LOA', status: 'LOA_PENDING_APPROVAL', icon: 'article' },
        { label: 'Complete', status: 'RESOLVED', icon: 'stars' },
      ];

      const statusOrder = [
        'SUBMITTED',
        'PENDING_CEO_APPROVAL',
        'CEO_APPROVED',
        'JOB_POSTED',
        'PENDING_MANAGER_REVIEW',
        'MANAGER_APPROVED',
        'INTERVIEW_SCHEDULED',
        'INTERVIEW_FEEDBACK_PENDING',
        'HR_SCREENING',
        'LOA_PENDING_APPROVAL',
        'LOA_APPROVED',
        'LOA_ISSUED',
        'LOA_ACCEPTED',
        'RESOLVED'
      ];

      const currentIndex = statusOrder.indexOf(currentStatus);

      return allSteps.map((step) => ({
        ...step,
        active: statusOrder.indexOf(step.status) <= currentIndex,
      }));
    }

    const allSteps = [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
    ];

    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'APPROVED', 'REJECTED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    return allSteps.map((step) => ({
      ...step,
      active: statusOrder.indexOf(step.status) <= currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-semibold">Error loading request</p>
          <p className="text-sm">{error || 'Request not found'}</p>
          <Link to="/my-requests" className="text-sm font-bold underline mt-2 inline-block">
            Back to My Requests
          </Link>
        </div>
      </div>
    );
  }

  const steps = getStatusSteps(request.status);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <nav className="flex items-center gap-2 mb-6 text-sm font-medium text-[#5e718d]">
        <Link to="/" className="hover:text-[#0052cc]">
          Help Center
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/my-requests" className="hover:text-[#0052cc]">
          My Requests
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-[#101418] font-bold">{request.referenceNumber}</span>
      </nav>

      {/* Status Progress */}
      <div className="mb-10 bg-white border border-gray-100 p-8 rounded-xl shadow-sm">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => (
            <React.Fragment key={step.label}>
              <div
                className={`flex flex-col items-center gap-2 z-10 ${step.active ? 'text-[#0052cc]' : 'text-[#8993a4]'
                  }`}
              >
                <span
                  className={`material-symbols-outlined !text-2xl ${!step.active ? 'opacity-30' : ''}`}
                >
                  {step.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-grow mx-4 ${steps[idx + 1].active ? 'bg-[#0052cc]' : 'bg-gray-100'
                    }`}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Resolution Summary - Only show for RESOLVED tickets */}
      {request.status === 'RESOLVED' && (() => {
        // Find the most recent non-system comment before the status was changed to RESOLVED
        const resolutionActivity = activities
          .filter(a => !a.isSystemGenerated && a.activityType === 'COMMENT')
          .reverse()
          .find(a => {
            const activityDate = new Date(a.createdAt);
            const resolvedDate = request.updatedAt ? new Date(request.updatedAt) : new Date();
            return activityDate <= resolvedDate;
          });

        if (resolutionActivity) {
          return (
            <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-white">check_circle</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-green-900">Resolution</h3>
                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                      RESOLVED
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 mb-3 border border-green-200">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {resolutionActivity.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-green-800">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">person</span>
                      <span>Resolved by: <span className="font-bold">{resolutionActivity.authorName}</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>{formatDateTime(resolutionActivity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-10">
          {/* Request Summary */}
          <section>
            <div className="mb-6">
              <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest">
                Case Summary
              </span>
              <h1 className="text-3xl font-bold text-[#101418] mt-1">{request.summary}</h1>
            </div>
            <div className="bg-[#f4f5f7] p-8 rounded-xl border border-gray-100">
              <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest block mb-4">
                Description
              </span>
              <p className="text-[#44546f] leading-relaxed text-lg">
                {request.description || 'No detailed description provided.'}
              </p>
            </div>

            {/* Custom Fields - Main Content Display */}
            {request.customFields && Object.keys(request.customFields).length > 0 && (
              <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
                <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest block mb-6">
                  Additional Information
                </span>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(request.customFields)
                    .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => (
                      <div key={key} className="border-l-4 border-[#0052cc] pl-4">
                        <dt className="text-sm font-bold text-[#5e718d] uppercase tracking-wide mb-2">
                          {key.replace(/([A-Z_])/g, ' $1').trim().replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-lg font-semibold text-[#101418]">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            {/* Candidate Resumes Section - Show when resumes exist */}
            {resumes.length > 0 && (
              <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold text-[#5e718d] uppercase tracking-widest">
                    Candidate Resumes ({resumes.length})
                  </span>
                  {request.status === 'JOB_POSTED' && (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="text-sm font-bold text-[#0052cc] hover:text-blue-700 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                      Add Resume
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {resumes.map((resume) => (
                    <div key={resume.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="material-symbols-outlined text-[#0052cc] text-2xl">description</span>
                          <div className="flex-1">
                            <h4 className="font-bold text-[#101418]">
                              {resume.candidateName || 'Unnamed Candidate'}
                            </h4>
                            <p className="text-sm text-[#5e718d] mt-1">{resume.fileName}</p>
                            {resume.notes && (
                              <p className="text-sm text-[#44546f] mt-2 italic">{resume.notes}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-[#5e718d]">
                              <span>Uploaded by {resume.uploadedBy.firstName} {resume.uploadedBy.lastName}</span>
                              <span>•</span>
                              <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>{(parseInt(resume.fileSize) / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`http://localhost:3000${resume.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm font-semibold text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Download
                          </a>
                          {request.status === 'JOB_POSTED' && (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && (
                            <button
                              onClick={() => handleDeleteResume(resume.id)}
                              className="px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NEW WORKFLOW DISPLAY SECTIONS */}

            {/* Selection Information Section */}
            {request.customFields?.selectedCandidateId && (
              <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm mt-6 bg-gradient-to-r from-blue-50/50 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md">
                    <span className="material-symbols-outlined text-2xl">person_check</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900">Selected Candidate</h3>
                    <p className="text-sm text-blue-700 font-medium">
                      {request.customFields.selectedCandidateName} has been approved for hire.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Interview Details Section */}
            {interviewDetails?.schedule && (
              <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6 overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <span className="material-symbols-outlined">calendar_month</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#101418]">Interview Information</h3>
                    <p className="text-xs text-[#5e718d] uppercase tracking-wider font-semibold">Scheduled Stage</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-gray-400 text-xl">event</span>
                      <div>
                        <p className="text-xs font-bold text-[#5e718d] uppercase">Date & Time</p>
                        <p className="font-semibold text-[#101418]">
                          {new Date(interviewDetails.schedule.interviewDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {interviewDetails.schedule.interviewTime}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-gray-400 text-xl">location_on</span>
                      <div>
                        <p className="text-xs font-bold text-[#5e718d] uppercase">Location / Link</p>
                        {interviewDetails.schedule.meetingLink ? (
                          <a href={interviewDetails.schedule.meetingLink} target="_blank" rel="noreferrer" className="text-[#0052cc] font-semibold hover:underline flex items-center gap-1">
                            Join Meeting <span className="material-symbols-outlined text-xs">open_in_new</span>
                          </a>
                        ) : (
                          <p className="font-semibold text-[#101418]">{interviewDetails.schedule.location || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-gray-400 text-xl">group</span>
                      <div>
                        <p className="text-xs font-bold text-[#5e718d] uppercase">Interviewers</p>
                        <p className="font-semibold text-[#101418]">
                          {Array.isArray(interviewDetails.schedule.interviewers)
                            ? interviewDetails.schedule.interviewers.join(', ')
                            : String(interviewDetails.schedule.interviewers)}
                        </p>
                      </div>
                    </div>
                    {interviewDetails.schedule.notes && (
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">notes</span>
                        <div>
                          <p className="text-xs font-bold text-[#5e718d] uppercase">Pre-interview Notes</p>
                          <p className="text-sm text-[#44546f]">{interviewDetails.schedule.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interview Feedback Display */}
                {interviewDetails.feedback && (
                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-[#101418]">Interview Outcome</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${interviewDetails.feedback.decision === 'PROCEED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {interviewDetails.feedback.decision}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <p className="text-[#44546f] italic mb-4">"{interviewDetails.feedback.feedback}"</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-[#5e718d] uppercase mb-1">Overall</p>
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className="material-symbols-outlined text-xs">
                                {i < (interviewDetails.feedback?.overallRating || 0) ? 'star' : 'star_outline'}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#5e718d] uppercase mb-1">Technical</p>
                          <p className="font-bold text-sm">{interviewDetails.feedback.technicalSkills}/5</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#5e718d] uppercase mb-1">Culture</p>
                          <p className="font-bold text-sm">{interviewDetails.feedback.culturalFit}/5</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#5e718d] uppercase mb-1">Comm.</p>
                          <p className="font-bold text-sm">{interviewDetails.feedback.communication}/5</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HR Screening Details Section */}
            {screeningDetails && (
              <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <span className="material-symbols-outlined">fact_check</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#101418]">HR Screening Status</h3>
                    <p className="text-xs text-[#5e718d] uppercase tracking-wider font-semibold">Verification Stage</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[#5e718d] uppercase">Background Check</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${screeningDetails.backgroundCheckStatus === 'PASSED' ? 'bg-green-100 text-green-700' :
                          screeningDetails.backgroundCheckStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {screeningDetails.backgroundCheckStatus}
                        </span>
                      </div>
                      <p className="text-sm text-[#44546f] bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {screeningDetails.backgroundCheckNotes || 'No notes available.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[#5e718d] uppercase">References Check</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${screeningDetails.referencesCheckStatus === 'PASSED' ? 'bg-green-100 text-green-700' :
                          screeningDetails.referencesCheckStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {screeningDetails.referencesCheckStatus}
                        </span>
                      </div>
                      <p className="text-sm text-[#44546f] bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
                        {screeningDetails.referencesCheckNotes || 'No notes available.'}
                      </p>
                      {Array.isArray(screeningDetails.referencesContacted) && screeningDetails.referencesContacted.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-[#5e718d] uppercase mb-1">Contacted</p>
                          <div className="flex flex-wrap gap-2">
                            {screeningDetails.referencesContacted.map((ref, idx) => (
                              <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-medium text-[#101418]">
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LOA Documents Section */}
            {loaDetails && (
              <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <span className="material-symbols-outlined">article</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#101418]">Letter of Acceptance (LOA)</h3>
                    <p className="text-xs text-[#5e718d] uppercase tracking-wider font-semibold">Final Stage</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Draft LOA */}
                  <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                    <div className="flex items-center gap-4">
                      <div className="size-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-[#0052cc]">
                        <span className="material-symbols-outlined">description</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#101418]">Draft / Issued LOA</p>
                        <p className="text-xs text-[#5e718d]">{loaDetails.loaFileName} • {(loaDetails.loaFileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {loaDetails.approvalDate && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">APPROVED</span>
                      )}
                      <a
                        href={`http://localhost:3000${loaDetails.loaFileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#0052cc] hover:bg-gray-50 transition-colors"
                      >
                        View
                      </a>
                    </div>
                  </div>

                  {/* Signed LOA */}
                  {loaDetails.signedLoaFileUrl && (
                    <div className="flex items-center justify-between p-4 border border-emerald-100 rounded-xl bg-emerald-50/30">
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-600 border border-emerald-100">
                          <span className="material-symbols-outlined">ink_pen</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-900">Signed LOA</p>
                          <p className="text-xs text-emerald-700">{loaDetails.signedLoaFileName} • {(loaDetails.signedLoaFileSize ? loaDetails.signedLoaFileSize / 1024 : 0).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {loaDetails.acceptedDate && (
                          <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-0.5 rounded">ACCEPTED</span>
                        )}
                        <a
                          href={`http://localhost:3000${loaDetails.signedLoaFileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Approval Comments */}
                {loaDetails.approvalComments && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-amber-600 text-sm">comment</span>
                      <p className="text-xs font-bold text-amber-800 uppercase">Approval Comments</p>
                    </div>
                    <p className="text-sm text-amber-900 italic">"{loaDetails.approvalComments}"</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Communication Timeline */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="material-symbols-outlined text-[#0052cc]">encrypted</span>
              <h3 className="font-bold text-xl">Secure Communication</h3>
            </div>

            <div className="space-y-8">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-[#5e718d]">
                  <p>No activities yet</p>
                </div>
              ) : (
                activities.map((activity, idx) => {
                  const isUser = activity.authorName === `${user?.firstName} ${user?.lastName}`;
                  return (
                    <div key={activity.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div
                        className={`size-10 rounded-full flex items-center justify-center shrink-0 ${isUser
                          ? 'bg-[#0052cc]/10 text-[#0052cc]'
                          : 'bg-gray-100 text-[#5e718d]'
                          }`}
                      >
                        <span className="material-symbols-outlined">
                          {isUser ? 'person' : 'shield_person'}
                        </span>
                      </div>
                      <div className={`flex-1 max-w-xl ${isUser ? 'text-right' : ''}`}>
                        <div
                          className={`p-5 rounded-2xl shadow-sm border ${isUser
                            ? 'bg-blue-50 border-blue-100 rounded-tr-none'
                            : 'bg-white border-gray-100 rounded-tl-none'
                            }`}
                        >
                          <div className="flex justify-between items-center mb-2 gap-4">
                            <span className="text-xs font-bold text-[#0052cc]">
                              {activity.authorName}
                              {activity.authorRole && ` (${activity.authorRole})`}
                            </span>
                            <span className="text-[11px] text-[#5e718d]">
                              {formatDateTime(activity.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-[#44546f] leading-relaxed text-left">
                            {activity.message}
                          </p>
                          {activity.isSystemGenerated && (
                            <span className="text-[10px] text-[#5e718d] italic mt-2 block">
                              System generated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="mt-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <label className="block text-sm font-bold text-[#101418] mb-3">Add a comment</label>
                <textarea
                  className="w-full p-4 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none resize-none"
                  rows={4}
                  placeholder="Type your message here..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                ></textarea>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    className="px-6 py-2 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setComment('')}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!comment.trim() || submitting}
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 space-y-6">
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold mb-6">Request Details</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[#5e718d] mb-1">Reference Number</dt>
                <dd className="font-mono font-bold text-[#0052cc]">{request.referenceNumber}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${STATUS_CONFIG[request.status]?.bg || 'bg-gray-100'
                      } ${STATUS_CONFIG[request.status]?.color || 'text-gray-600'}`}
                  >
                    {STATUS_CONFIG[request.status]?.label || request.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Priority</dt>
                <dd className="font-semibold">{request.priority}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Service Desk</dt>
                <dd className="font-semibold">{request.serviceDesk?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Requester</dt>
                <dd className="font-semibold">
                  {request.requester
                    ? `${request.requester.firstName} ${request.requester.lastName}`
                    : 'N/A'}
                </dd>
              </div>
              {request.assignedTo && (
                <div>
                  <dt className="text-[#5e718d] mb-1">Assigned To</dt>
                  <dd className="font-semibold">
                    {request.assignedTo.firstName} {request.assignedTo.lastName}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[#5e718d] mb-1">Created</dt>
                <dd className="font-semibold">{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[#5e718d] mb-1">Last Updated</dt>
                <dd className="font-semibold">{formatDateTime(request.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold mb-4">Actions</h3>
            <div className="space-y-2">
              {/* Agent Actions - Show only if user is an agent/admin AND not the requester */}
              {(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) &&
                user?.id !== request.requester?.id ? (
                <>
                  {/* Assign to Me button - Show only if not assigned */}
                  {!request.assignedTo && (
                    <button
                      onClick={handleAssignToSelf}
                      disabled={assigning}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">person_add</span>
                      {assigning ? 'Assigning...' : 'Assign to Me'}
                    </button>
                  )}

                  {/* Update Status dropdown */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-[#5e718d] mb-2">Update Status</label>
                    <select
                      value={request.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="w-full px-4 py-2.5 text-sm font-semibold text-[#44546f] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="SUBMITTED">Submitted</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="ACTION_REQUIRED">Action Required</option>
                      <option value="WAITING">Waiting</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>

                  {/* Hiring Workflow Actions for HR Agents */}
                  {request.serviceDesk?.code === 'HR' && (
                    <>
                      {/* Route to CEO - Show when status is SUBMITTED or IN_REVIEW */}
                      {(request.status === 'SUBMITTED' || request.status === 'IN_REVIEW') && (
                        <button
                          onClick={handleRouteToCEO}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">send</span>
                          {processingAction ? 'Routing...' : 'Route to CEO'}
                        </button>
                      )}

                      {/* Mark Job Posted - Show when status is CEO_APPROVED */}
                      {request.status === 'CEO_APPROVED' && (
                        <button
                          onClick={() => setShowJobPostModal(true)}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">work</span>
                          Mark as Job Posted
                        </button>
                      )}

                      {/* Upload Resume - Show when status is JOB_POSTED */}
                      {request.status === 'JOB_POSTED' && (
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">upload_file</span>
                          Upload Candidate Resume
                        </button>
                      )}

                      {/* Route to Manager - Show when status is JOB_POSTED and has resumes */}
                      {request.status === 'JOB_POSTED' && resumes.length > 0 && (
                        <button
                          onClick={handleRouteToManager}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
                          {processingAction ? 'Routing...' : 'Route to Hiring Manager'}
                        </button>
                      )}

                      {/* NEW WORKFLOW ACTIONS FOR AGENTS */}

                      {/* Schedule Interview - Show when status is MANAGER_APPROVED */}
                      {request.status === 'MANAGER_APPROVED' && (
                        <button
                          onClick={() => setShowScheduleInterviewModal(true)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">calendar_month</span>
                          Schedule Interview
                        </button>
                      )}

                      {/* Start HR Screening - Show when status is INTERVIEW_FEEDBACK_PENDING and decision is PROCEED */}
                      {request.status === 'INTERVIEW_FEEDBACK_PENDING' && interviewDetails?.feedback?.decision === 'PROCEED' && (
                        <button
                          onClick={handleStartHRScreening}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                          {processingAction ? 'Processing...' : 'Start HR Screening'}
                        </button>
                      )}

                      {/* Update Screening - Show when status is HR_SCREENING */}
                      {request.status === 'HR_SCREENING' && (
                        <button
                          onClick={() => setShowHRScreeningModal(true)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">edit_note</span>
                          Update Screening Status
                        </button>
                      )}

                      {/* Upload LOA - Show when status is HR_SCREENING and screening is completed */}
                      {(request.status === 'HR_SCREENING' || request.status === 'LOA_PENDING_APPROVAL') && screeningDetails?.overallStatus === 'COMPLETED' && !loaDetails && (
                        <button
                          onClick={() => setShowUploadLOAModal(true)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">upload_file</span>
                          Upload LOA Document
                        </button>
                      )}

                      {/* Route LOA for Approval - Show when status is HR_SCREENING and LOA is uploaded */}
                      {(request.status === 'HR_SCREENING' || request.status === 'LOA_PENDING_APPROVAL') && loaDetails && !loaDetails.approvedBy && (
                        <button
                          onClick={() => handleRouteLOAForApproval()}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">send</span>
                          {processingAction ? 'Routing...' : 'Route LOA for Approval'}
                        </button>
                      )}

                      {/* Issue LOA - Show when status is LOA_APPROVED */}
                      {request.status === 'LOA_APPROVED' && (
                        <button
                          onClick={handleMarkLOAIssued}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">mail</span>
                          {processingAction ? 'Processing...' : 'Issue LOA to Candidate'}
                        </button>
                      )}

                      {/* Upload Signed LOA - Show when status is LOA_ISSUED */}
                      {request.status === 'LOA_ISSUED' && !loaDetails?.signedLoaFileUrl && (
                        <button
                          onClick={() => setShowUploadSignedLOAModal(true)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">upload</span>
                          Upload Signed LOA
                        </button>
                      )}

                      {/* Mark LOA Accepted - Show when status is LOA_ISSUED and signed LOA is uploaded */}
                      {request.status === 'LOA_ISSUED' && loaDetails?.signedLoaFileUrl && (
                        <button
                          onClick={handleMarkLOAAccepted}
                          disabled={processingAction}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">verified</span>
                          {processingAction ? 'Processing...' : 'Mark LOA Accepted'}
                        </button>
                      )}
                    </>
                  )}

                  <div className="h-px bg-gray-200 my-2"></div>
                </>
              ) : null}

              {/* CEO Actions */}
              {user?.roles?.includes('CEO') && request.status === 'PENDING_CEO_APPROVAL' && (
                <>
                  <button
                    onClick={() => setShowCEODecisionModal(true)}
                    disabled={processingAction}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    {processingAction ? 'Processing...' : 'Review Request'}
                  </button>
                  <div className="h-px bg-gray-200 my-2"></div>
                </>
              )}

              {/* Hiring Manager Actions (Requester) */}
              {user?.id === request.requester?.id && (
                <>
                  {/* Candidate Selection Review */}
                  {request.status === 'PENDING_MANAGER_REVIEW' && (
                    <button
                      onClick={() => setShowManagerDecisionModal(true)}
                      disabled={processingAction}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">rate_review</span>
                      {processingAction ? 'Processing...' : 'Review Candidates'}
                    </button>
                  )}

                  {/* Submit Interview Feedback */}
                  {request.status === 'INTERVIEW_SCHEDULED' && (
                    <button
                      onClick={() => setShowInterviewFeedbackModal(true)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">feedback</span>
                      Submit Interview Feedback
                    </button>
                  )}

                  {/* LOA Approval Decision */}
                  {request.status === 'LOA_PENDING_APPROVAL' && loaDetails && (
                    <button
                      onClick={() => setShowLOAApprovalModal(true)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">fact_check</span>
                      Approve/Reject LOA
                    </button>
                  )}

                  {request.status !== 'SUBMITTED' && <div className="h-px bg-gray-200 my-2"></div>}
                </>
              )}

              {/* Common Actions */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">attach_file</span>
                Add Attachment
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">share</span>
                Share Request
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#44546f] hover:bg-gray-50 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">print</span>
                Print Details
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="size-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-green-600">check_circle</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-[#101418] mb-2">Add Resolution Comment</h2>
                  <p className="text-sm text-[#5e718d]">
                    You're about to mark this request as <span className="font-bold text-green-600">RESOLVED</span>.
                    Please document what was done to resolve this issue.
                  </p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">info</span>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Why add a resolution comment?</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Helps the requester understand what was done</li>
                      <li>Creates a record for future reference</li>
                      <li>Improves knowledge base for similar issues</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Resolution Comment Textarea */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#101418] mb-3">
                  Resolution Details <span className="text-[#5e718d] font-normal">(Recommended)</span>
                </label>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none"
                  rows={6}
                  placeholder="Example: Installed Adobe Creative Cloud on user's workstation. License activated successfully. User can now access all Adobe applications. Tested Photoshop and Illustrator - both working correctly."
                  value={resolutionComment}
                  onChange={(e) => setResolutionComment(e.target.value)}
                  disabled={updatingStatus}
                ></textarea>
                <p className="text-xs text-[#5e718d] mt-2">
                  Include: What was done, outcome, next steps (if any), and reference numbers
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={handleSkipResolution}
                  disabled={updatingStatus}
                >
                  Skip & Resolve Anyway
                </button>
                <button
                  type="button"
                  className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={handleResolutionSubmit}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                      Resolving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">check</span>
                      Add Comment & Resolve
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Resume Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Upload Candidate Resume</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const file = formData.get('file') as File;
                const candidateName = formData.get('candidateName') as string;
                const notes = formData.get('notes') as string;
                if (file) {
                  handleUploadResume(file, candidateName, notes);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Resume File (PDF, DOC, DOCX) *
                    </label>
                    <input
                      type="file"
                      name="file"
                      accept=".pdf,.doc,.docx"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      name="candidateName"
                      placeholder="e.g., John Doe"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="Additional notes about the candidate..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingResume}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploadingResume ? 'Uploading...' : 'Upload Resume'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mark Job Posted Modal */}
      {showJobPostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Mark Job as Posted</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const jobPostingUrl = formData.get('jobPostingUrl') as string;
                const notes = formData.get('notes') as string;
                handleMarkJobPosted(jobPostingUrl, notes);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Job Posting URL
                    </label>
                    <input
                      type="url"
                      name="jobPostingUrl"
                      placeholder="https://careers.company.com/job/123"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="Where was the job posted?"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowJobPostModal(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processingAction ? 'Processing...' : 'Mark as Posted'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CEO Decision Modal */}
      {showCEODecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">CEO Approval Decision</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const decision = formData.get('decision') as 'APPROVED' | 'REJECTED';
                const comments = formData.get('comments') as string;
                handleCEODecision(decision, comments);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Decision *
                    </label>
                    <select
                      name="decision"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    >
                      <option value="">Select decision...</option>
                      <option value="APPROVED">Approve</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Comments
                    </label>
                    <textarea
                      name="comments"
                      rows={4}
                      placeholder="Add your comments..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCEODecisionModal(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processingAction ? 'Processing...' : 'Submit Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manager Decision Modal */}
      {showManagerDecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Review Candidates</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const decision = formData.get('decision') as 'APPROVED' | 'REJECTED';
                const selectedCandidateId = formData.get('selectedCandidate') as string;
                const comments = formData.get('comments') as string;
                handleManagerDecision(decision, selectedCandidateId, comments);
              }}>
                <div className="space-y-4">
                  {resumes.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">
                        Select Candidate (if approving)
                      </label>
                      <select
                        name="selectedCandidate"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="">-- Select a candidate --</option>
                        {resumes.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resume.candidateName || resume.fileName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Decision *
                    </label>
                    <select
                      name="decision"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    >
                      <option value="">Select decision...</option>
                      <option value="APPROVED">Approve Selection</option>
                      <option value="REJECTED">Request More Candidates</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">
                      Comments
                    </label>
                    <textarea
                      name="comments"
                      rows={4}
                      placeholder="Add your feedback..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowManagerDecisionModal(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processingAction ? 'Processing...' : 'Submit Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* NEW HIRING WORKFLOW MODALS */}

      {/* Schedule Interview Modal */}
      {showScheduleInterviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Schedule Interview</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const interviewData = {
                  candidateId: formData.get('candidateId'),
                  interviewDate: formData.get('interviewDate'),
                  interviewTime: formData.get('interviewTime'),
                  location: formData.get('location'),
                  meetingLink: formData.get('meetingLink'),
                  interviewers: (formData.get('interviewers') as string).split(',').map(i => i.trim()),
                  notes: formData.get('notes'),
                };
                handleScheduleInterview(interviewData);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Select Candidate *</label>
                    <select
                      name="candidateId"
                      required
                      defaultValue={request.customFields?.selectedCandidateId || ""}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Select --</option>
                      {resumes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.candidateName} {r.id === request.customFields?.selectedCandidateId ? ' (Selected)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">Date *</label>
                      <input type="date" name="interviewDate" required className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">Time *</label>
                      <input type="time" name="interviewTime" required className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Interviewers (comma separated) *</label>
                    <input type="text" name="interviewers" placeholder="e.g. Jane Smith, Robert Brown" required className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Meeting Link / Location</label>
                    <input type="text" name="meetingLink" placeholder="Zoom Link or Meeting Room" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowScheduleInterviewModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg">{processingAction ? 'Scheduling...' : 'Schedule'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Interview Feedback Modal */}
      {showInterviewFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Interview Feedback</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const feedbackData = {
                  decision: formData.get('decision'),
                  feedback: formData.get('feedback'),
                  overallRating: parseInt(formData.get('overallRating') as string) || 3,
                  technicalSkills: parseInt(formData.get('technicalSkills') as string) || 3,
                  culturalFit: parseInt(formData.get('culturalFit') as string) || 3,
                  communication: parseInt(formData.get('communication') as string) || 3,
                };
                handleSubmitInterviewFeedback(feedbackData);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Final Decision *</label>
                    <select name="decision" required className="w-full px-4 py-2 border border-gray-200 rounded-lg">
                      <option value="PROCEED">Proceed to Screening</option>
                      <option value="REJECT">Reject Candidate</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">Technical Skills (1-5)</label>
                      <input type="number" name="technicalSkills" min="1" max="5" defaultValue="3" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">Cultural Fit (1-5)</label>
                      <input type="number" name="culturalFit" min="1" max="5" defaultValue="3" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Overall Feedback *</label>
                    <textarea name="feedback" required rows={4} className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowInterviewFeedbackModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg">Submit Feedback</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* HR Screening Modal */}
      {showHRScreeningModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">HR Screening</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const refContactedRaw = formData.get('refContacted') as string;
                const screeningData = {
                  backgroundCheckStatus: formData.get('bgStatus'),
                  backgroundCheckNotes: formData.get('bgNotes'),
                  referencesCheckStatus: formData.get('refStatus'),
                  referencesCheckNotes: formData.get('refNotes'),
                  referencesContacted: refContactedRaw ? refContactedRaw.split(',').map(r => r.trim()).filter(Boolean) : [],
                  overallStatus: formData.get('overallStatus'),
                };
                handleUpdateScreeningStatus(screeningData);
              }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">BG Check Status</label>
                      <select name="bgStatus" defaultValue={screeningDetails?.backgroundCheckStatus || "PENDING"} className="w-full px-4 py-2 border border-gray-200 rounded-lg">
                        <option value="PENDING">Pending</option>
                        <option value="PASSED">Passed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#5e718d] mb-2">Ref Check Status</label>
                      <select name="refStatus" defaultValue={screeningDetails?.referencesCheckStatus || "PENDING"} className="w-full px-4 py-2 border border-gray-200 rounded-lg">
                        <option value="PENDING">Pending</option>
                        <option value="PASSED">Passed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Background Check Notes</label>
                    <textarea name="bgNotes" rows={2} defaultValue={screeningDetails?.backgroundCheckNotes || ""} placeholder="Observations from BG check..." className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">References Check Notes</label>
                    <textarea name="refNotes" rows={2} defaultValue={screeningDetails?.referencesCheckNotes || ""} placeholder="Feedback from references..." className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">References Contacted (comma separated)</label>
                    <input type="text" name="refContacted" defaultValue={Array.isArray(screeningDetails?.referencesContacted) ? screeningDetails.referencesContacted.join(', ') : ""} placeholder="e.g. Michael Scott, Jim Halpert" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Overall Screening Status *</label>
                    <select name="overallStatus" required defaultValue={screeningDetails?.overallStatus || "IN_PROGRESS"} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed (Proceed to LOA)</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowHRScreeningModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
                    {processingAction ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload LOA Modal */}
      {showUploadLOAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Upload LOA Document</h2>
              <p className="text-sm text-gray-600 mb-6">Upload the draft Letter of Acceptance prepared for the candidate.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
                if (file) handleUploadLOA(file);
              }}>
                <div className="mb-6">
                  <input type="file" name="file" required accept=".pdf,.doc,.docx" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowUploadLOAModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-emerald-600 rounded-lg">{processingAction ? 'Uploading...' : 'Upload & Prepare'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LOA Approval Modal */}
      {showLOAApprovalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">LOA Approval</h2>
              <p className="text-sm text-gray-600 mb-6">Review the draft LOA and provide your decision.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const decision = formData.get('decision') as 'APPROVE' | 'REJECT';
                const comments = formData.get('comments') as string;
                handleLOAApprovalDecision(decision, comments);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Decision *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 font-semibold">
                        <input type="radio" name="decision" value="APPROVE" required /> Approve
                      </label>
                      <label className="flex items-center gap-2 font-semibold">
                        <input type="radio" name="decision" value="REJECT" required /> Reject
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5e718d] mb-2">Comments</label>
                    <textarea name="comments" rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" placeholder="Feedback for HR..." />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowLOAApprovalModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-emerald-600 rounded-lg">Submit Decision</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload Signed LOA Modal */}
      {showUploadSignedLOAModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">Upload Signed LOA</h2>
              <p className="text-sm text-gray-600 mb-6">Upload the finalized and signed document received from the candidate.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
                if (file) handleUploadSignedLOA(file);
              }}>
                <div className="mb-6">
                  <input type="file" name="file" required accept=".pdf" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowUploadSignedLOAModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg">{processingAction ? 'Uploading...' : 'Upload Signed Copy'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetail;
