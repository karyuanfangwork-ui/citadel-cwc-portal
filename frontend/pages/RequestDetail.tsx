import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { useRequestDetail } from '../src/components/request/useRequestDetail';
import OnboardingDashboard from '../src/components/OnboardingDashboard';
import OffboardingDashboard from '../src/components/OffboardingDashboard';
import ActionSidebar from '../src/components/request-detail/ActionSidebar';
import ActivityFeed from '../src/components/request-detail/ActivityFeed';
import RequestHeader from '../src/components/request/RequestHeader';
import RequestFormFields from '../src/components/request/RequestFormFields';
import HiringWorkflowPanel from '../src/components/request/HiringWorkflowPanel';
import ApprovalActions from '../src/components/request/ApprovalActions';
import { EntityApprovalsPanel } from '../src/components/EntityApprovalsPanel';
import ResolutionModal from '../src/components/request/modals/ResolutionModal';
import RejectionModal from '../src/components/request/modals/RejectionModal';
import CompleteOnboardingModal from '../src/components/request/modals/CompleteOnboardingModal';
import ScheduleInterviewModal from '../src/components/request/modals/ScheduleInterviewModal';
import EditInterviewModal from '../src/components/request/modals/EditInterviewModal';
import InterviewFeedbackModal from '../src/components/request/modals/InterviewFeedbackModal';
import LOAApprovalModal from '../src/components/request/modals/LOAApprovalModal';
import CEODecisionModal from '../src/components/request/modals/CEODecisionModal';
import ManagerDecisionModal from '../src/components/request/modals/ManagerDecisionModal';

const RequestDetailContainer: React.FC = () => {
    const { user } = useAuth();
    const rq = useRequestDetail();

    if (!rq.request || !rq.id) {
        if (rq.loading) {
            return (
                <div className="max-w-[1440px] mx-auto px-6 py-8">
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
                    </div>
                </div>
            );
        }
        return (
            <div className="max-w-[1440px] mx-auto px-6 py-8">
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                    <p className="font-semibold">Error loading request</p>
                    <p className="text-sm">{rq.error || 'Request not found'}</p>
                    <Link to="/my-requests" className="text-sm font-bold underline mt-2 inline-block">Back to My Requests</Link>
                </div>
            </div>
        );
    }

    const { request, activities } = rq;

    return (
        <div className="max-w-[1440px] mx-auto px-6 py-8">
            <RequestHeader
                request={request}
                activities={activities}
                user={user}
                onActionClick={() => {}}
                onScheduleInterview={() => rq.setShowScheduleInterviewModal(true)}
                onInterviewFeedback={() => rq.setShowInterviewFeedbackModal(true)}
                onLOAApproval={() => rq.setShowLOAApprovalModal(true)}
                onStartHRScreening={rq.handleStartHRScreening}
                onMarkLOAIssued={rq.handleMarkLOAIssued}
            />

            {/* Confidentiality Notice */}
            {request.isConfidential && (
                <div className="flex items-center gap-3 p-4 mb-6 bg-amber-50 border border-amber-300 rounded-xl">
                    <span className="material-symbols-outlined text-amber-600 text-xl">lock</span>
                    <div>
                        <p className="text-sm font-bold text-amber-800">Confidential Request</p>
                        <p className="text-xs text-amber-700">This request contains sensitive information. Access is restricted to the requester, designated approvers, and authorized personnel.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1 space-y-10">
                    <RequestFormFields request={request} activities={activities} />

                    <HiringWorkflowPanel
                        request={request}
                        resumes={rq.resumes}
                        interviewDetails={rq.interviewDetails}
                        screeningDetails={rq.screeningDetails}
                        loaDetails={rq.loaDetails}
                        user={user}
                        onDeleteResume={rq.handleDeleteResume}
                        onEditInterview={() => rq.setShowEditInterviewModal(true)}
                        onShowUploadModal={() => rq.setShowUploadModal(true)}
                    />

                    {/* Onboarding Workflow */}
                    {request.requestType?.code === 'EMPLOYEE_ONBOARDING' ||
                     ['ONBOARDING_SUBMITTED', 'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1',
                      'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION', 'ONBOARDING_COMPLETED']
                         .includes(request.status) ? (
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                <span className="material-symbols-outlined text-[#0052cc]">badge</span>
                                <h3 className="font-bold text-xl">Onboarding Workflow</h3>
                            </div>
                            <OnboardingDashboard requestId={request.id} />
                        </section>
                    ) : null}

                    {/* Offboarding Workflow */}
                    {request.requestType?.code === 'EMPLOYEE_OFFBOARDING' ||
                     ['OFFBOARDING_SUBMITTED', 'OFFBOARDING_NOTICE_PERIOD', 'OFFBOARDING_KNOWLEDGE_TRANSFER',
                      'OFFBOARDING_FINAL_WEEK', 'OFFBOARDING_EXIT_PROCEDURES', 'OFFBOARDING_COMPLETED']
                         .includes(request.status) ? (
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                <span className="material-symbols-outlined text-amber-600">person_remove</span>
                                <h3 className="font-bold text-xl">Offboarding Workflow</h3>
                            </div>
                            <OffboardingDashboard requestId={request.id} onComplete={rq.fetchRequestData} />
                        </section>
                    ) : null}

                    <ActivityFeed
                        activities={activities}
                        onSubmitComment={async (text, isInternal) => {
                            const newActivity = await rq.requestService.addActivity(request.id, text, isInternal);
                            rq.setActivities(prev => [...prev, newActivity]);
                        }}
                        canPostInternal={!!(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN'))}
                    />
                </div>

                <div data-actions-sidebar className="w-80 shrink-0 flex flex-col gap-3 self-start sticky top-6">
                    <ApprovalActions
                        request={request}
                        interviewDetails={rq.interviewDetails}
                        user={user}
                        processingAction={rq.processingAction}
                        hasLOA={!!rq.loaDetails}
                        onStartHRScreening={rq.handleStartHRScreening}
                        onRouteLOAForApproval={rq.handleRouteLOAForApproval}
                        onReviseAndResubmit={rq.handleReviseAndResubmit}
                        onReopenForNewCandidates={rq.handleReopenForNewCandidates}
                    />
                    <EntityApprovalsPanel approvals={request.approvals || []} />
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
                        hasResumes={rq.resumes.length > 0}
                        screeningCompleted={rq.screeningDetails?.overallStatus === 'COMPLETED'}
                        hasLOA={!!rq.loaDetails}
                        hasSignedLOA={!!rq.loaDetails?.signedLoaFileUrl}
                        selectedCandidateId={request.customFields?.selectedCandidateId}
                        onActionSuccess={rq.fetchRequestData}
                        onLOAApproval={() => rq.setShowLOAApprovalModal(true)}
                        onRouteToManager={rq.handleRouteToManager}
                        onIssueLOA={rq.handleMarkLOAIssued}
                        onMarkLOAAccepted={rq.handleMarkLOAAccepted}
                        onAdvanceOnboardingPhase={rq.handleAdvanceOnboardingPhase}
                        onCompleteOnboarding={rq.handleCompleteOnboarding}
                        onAdvanceOffboardingPhase={rq.handleAdvanceOffboardingPhase}
                        onCompleteOffboarding={rq.handleCompleteOffboarding}
                        onResolveRequest={() => rq.handleStatusChange('RESOLVED')}
                    />
                </div>
            </div>

            {/* Modals */}
            <ResolutionModal
                isOpen={rq.showResolutionModal}
                resolutionComment={rq.resolutionComment}
                updatingStatus={rq.updatingStatus}
                onClose={() => { rq.setShowResolutionModal(false); rq.setResolutionComment(''); }}
                onCommentChange={rq.setResolutionComment}
                onSkipResolution={rq.handleSkipResolution}
                onSubmitResolution={rq.handleResolutionSubmit}
            />

            <RejectionModal
                isOpen={rq.showRejectionConfirm}
                updatingStatus={rq.updatingStatus}
                onClose={() => { rq.setShowRejectionConfirm(false); rq.setRejectionPendingStatus(null); }}
                onConfirmReject={async () => {
                    if (rq.rejectionPendingStatus) {
                        await (rq as any).updateStatusDirectly(rq.rejectionPendingStatus);
                        rq.setShowRejectionConfirm(false);
                        rq.setRejectionPendingStatus(null);
                    }
                }}
            />

            <CompleteOnboardingModal
                isOpen={rq.showCompleteOnboardingConfirm}
                processingAction={rq.processingAction}
                onClose={() => rq.setShowCompleteOnboardingConfirm(false)}
                onConfirm={rq.confirmCompleteOnboarding}
            />

            <ScheduleInterviewModal
                isOpen={rq.showScheduleInterviewModal}
                processingAction={rq.processingAction}
                requestId={request.id}
                onClose={() => rq.setShowScheduleInterviewModal(false)}
                onSubmit={rq.handleScheduleInterview}
            />

            <EditInterviewModal
                isOpen={rq.showEditInterviewModal}
                processingAction={rq.processingAction}
                interviewDetails={rq.interviewDetails}
                onClose={() => rq.setShowEditInterviewModal(false)}
                onSubmit={rq.handleUpdateInterview}
            />

            <InterviewFeedbackModal
                isOpen={rq.showInterviewFeedbackModal}
                processingAction={rq.processingAction}
                onClose={() => rq.setShowInterviewFeedbackModal(false)}
                onSubmit={rq.handleSubmitInterviewFeedback}
            />

            <LOAApprovalModal
                isOpen={rq.showLOAApprovalModal}
                processingAction={rq.processingAction}
                onClose={() => rq.setShowLOAApprovalModal(false)}
                onSubmit={rq.handleLOAApprovalDecision}
            />

            <CEODecisionModal
                isOpen={rq.showCEODecisionModal}
                processingAction={rq.processingAction}
                onClose={() => rq.setShowCEODecisionModal(false)}
                onSubmit={rq.handleCEODecision}
            />

            <ManagerDecisionModal
                isOpen={rq.showManagerDecisionModal}
                processingAction={rq.processingAction}
                resumes={rq.resumes}
                onClose={() => rq.setShowManagerDecisionModal(false)}
                onSubmit={rq.handleManagerDecision}
            />
        </div>
    );
};

export default RequestDetailContainer;
