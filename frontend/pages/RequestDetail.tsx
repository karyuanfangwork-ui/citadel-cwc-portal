import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import approvalService, { CandidateResume } from '../src/services/approval.service';
import { useAuth } from '../src/context/AuthContext';
import { STATUS_CONFIG } from '../constants';

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

  // Hiring workflow states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showJobPostModal, setShowJobPostModal] = useState(false);
  const [showCEODecisionModal, setShowCEODecisionModal] = useState(false);
  const [showManagerDecisionModal, setShowManagerDecisionModal] = useState(false);
  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

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
    } catch (err: any) {
      console.error('Error fetching request:', err);
      setError(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
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
    if (id && request?.status === 'JOB_POSTED' || request?.status === 'PENDING_MANAGER_REVIEW') {
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
    const allSteps = [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle' },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle' },
    ];

    const statusOrder = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'APPROVED', 'REJECTED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    return allSteps.map((step, idx) => ({
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
                    </>
                  )}

                  <div className="h-px bg-gray-200 my-2"></div>
                </>
              ) : null}

              {/* CEO Actions - Show only for CEO role */}
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

              {/* Hiring Manager Actions - Show only for requester when pending review */}
              {user?.id === request.requester?.id && request.status === 'PENDING_MANAGER_REVIEW' && (
                <>
                  <button
                    onClick={() => setShowManagerDecisionModal(true)}
                    disabled={processingAction}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">rate_review</span>
                    {processingAction ? 'Processing...' : 'Review Candidates'}
                  </button>
                  <div className="h-px bg-gray-200 my-2"></div>
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
    </div>
  );
};

export default RequestDetail;
