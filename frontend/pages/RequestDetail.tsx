import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { useRequestDetail } from '../src/components/request/useRequestDetail';
import OnboardingDashboard from '../src/components/OnboardingDashboard';
import OffboardingDashboard from '../src/components/OffboardingDashboard';
import ActivityFeed from '../src/components/request-detail/ActivityFeed';
import RequestHeader from '../src/components/request/RequestHeader';
import RequestFormFields from '../src/components/request/RequestFormFields';
import HiringWorkflowPanel from '../src/components/request/HiringWorkflowPanel';
import WorkflowCockpit from '../src/components/request-detail/WorkflowCockpit';
import { requestService } from '../src/services/request.service';
import { pollPdfJob } from '../src/services/pdfJob.service';
import ResolutionModal from '../src/components/request/modals/ResolutionModal';
import RejectionModal from '../src/components/request/modals/RejectionModal';
import CompleteOnboardingModal from '../src/components/request/modals/CompleteOnboardingModal';
import ScheduleInterviewModal from '../src/components/request/modals/ScheduleInterviewModal';
import EditInterviewModal from '../src/components/request/modals/EditInterviewModal';
import InterviewFeedbackModal from '../src/components/request/modals/InterviewFeedbackModal';
import LOAApprovalModal from '../src/components/request/modals/LOAApprovalModal';
import CEODecisionModal from '../src/components/request/modals/CEODecisionModal';
import ManagerDecisionModal from '../src/components/request/modals/ManagerDecisionModal';
import BatchUploadModal from '../src/components/request-detail/BatchUploadModal';

const RequestDetailContainer: React.FC = () => {
    const { user } = useAuth();
    const rq = useRequestDetail();

    // Offboarding pre-condition state lifted from OffboardingDashboard for DecisionPanel gating
    const [offboardingPreConditions, setOffboardingPreConditions] = React.useState<{
        isAdvancingToFinalWeek: boolean;
        preConditionsMet: boolean;
    }>({ isAdvancingToFinalWeek: false, preConditionsMet: true });

    const [exportingPdf, setExportingPdf] = React.useState(false);
    const canExport = !!(user?.roles?.some(r => ['ADMIN', 'AGENT'].includes(r)));

    const handleExportPdf = async () => {
        if (!rq.request) return;
        setExportingPdf(true);
        try {
            const { jobId } = await requestService.exportPdf(rq.request.referenceNumber || rq.id!);
            const url = await pollPdfJob(jobId);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${rq.request.referenceNumber || rq.id}.pdf`;
            a.click();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to export PDF');
        } finally {
            setExportingPdf(false);
        }
    };

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

    // Determine if current user can edit custom fields (finance agent or admin on finance desk)
    const serviceDeskCode = request.serviceDesk?.code || '';
    const isFinanceAgent = serviceDeskCode === 'FINANCE' && (
        (user?.roles || []).some(r => ['ADMIN', 'AGENT'].includes(r))
    );

    const handleCustomFieldsSaved = (updatedCustomFields: Record<string, any>) => {
        // Update the request in place so the UI refreshes without a full reload
        rq.setRequest({ ...request, customFields: updatedCustomFields });
    };

    // Derive workflow steps from request type
    const workflowSteps = request.requestType?.workflow?.steps
        ? request.requestType.workflow.steps
              .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
              .map((s: any) => ({ step: s.status, label: s.label, order: s.displayOrder, isFinal: !!s.isFinal }))
        : undefined;

    // Map approvals for cockpit
    const approvals = (request.approvals || []).map((a: any) => ({
        id: a.id,
        approverId: a.approverId,
        approverType: a.approverType,
        status: a.status,
        comments: a.comments ?? null,
        createdAt: a.createdAt ?? '',
        updatedAt: a.updatedAt ?? '',
        approver: a.approver
            ? { id: a.approver.id, firstName: a.approver.firstName, lastName: a.approver.lastName, email: a.approver.email }
            : { id: a.approverId, firstName: '?', lastName: '', email: '' },
        entity: a.entity ?? null,
    }));

    return (
        <div className="max-w-[1440px] mx-auto px-6 py-8">
            <RequestHeader
                request={request}
                user={user}
                onActionClick={() => {}}
                onScheduleInterview={() => rq.setShowScheduleInterviewModal(true)}
                onInterviewFeedback={() => rq.setShowInterviewFeedbackModal(true)}
                onLOAApproval={() => rq.setShowLOAApprovalModal(true)}
                onStartHRScreening={rq.handleStartHRScreening}
                onMarkLOAIssued={rq.handleMarkLOAIssued}
                onManagerDecision={() => rq.setShowManagerDecisionModal(true)}
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

            {/* ─── 2-Pane Cockpit Layout ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">

                {/* ─── LEFT PANE: Content ─── */}
                <div className="space-y-10">
                    <RequestFormFields
                        request={{
                            ...request,
                            requester: request.requester ?? null,
                            assignedTo: request.assignedTo ?? null,
                            assignedTeam: request.assignedTeam ?? null,
                            priority: request.priority ?? undefined,
                            serviceDesk: request.serviceDesk
                                ? { code: request.serviceDesk.code, name: request.serviceDesk.name }
                                : undefined,
                            requestType: request.requestType
                                ? { code: request.requestType.code, name: request.requestType.name, formConfig: request.requestType.formConfig }
                                : undefined,
                        }}
                        activities={activities}
                        canEditCustomFields={isFinanceAgent}
                        canReassign={!!(user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT'))}
                        currentUserId={user?.id}
                        currentUserName={user ? `${user.firstName} ${user.lastName}` : ''}
                        onReassigned={rq.fetchRequestData}
                        onCustomFieldsSaved={handleCustomFieldsSaved}
                    />

                    <HiringWorkflowPanel
                        request={request}
                        resumes={rq.resumes}
                        candidates={rq.candidates}
                        interviewDetails={rq.interviewDetails}
                        screeningDetails={rq.screeningDetails}
                        loaDetails={rq.loaDetails}
                        user={user}
                        onDeleteResume={rq.handleDeleteResume}
                        onEditInterview={() => rq.setShowEditInterviewModal(true)}
                        onDocsChanged={() => { rq.fetchResumes(); rq.fetchCandidates(); }}
                    />

                    {/* Onboarding Workflow */}
                    {request.requestType?.code === 'EMPLOYEE_ONBOARDING' ||
                     ['ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL', 'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1',
                      'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
                      'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE', 'ONBOARDING_MONTH_3_MILESTONE',
                      'ONBOARDING_COMPLETED']
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
                            <OffboardingDashboard requestId={request.id} onComplete={rq.fetchRequestData} onPreConditionsChange={setOffboardingPreConditions} />
                        </section>
                    ) : null}

                    <ActivityFeed
                        requestId={request.id}
                        activities={activities}
                        onSubmitComment={async (text, isInternal) => {
                            const newActivity = await requestService.addActivity(request.id, text, isInternal);
                            rq.setActivities(prev => [...prev, newActivity]);
                        }}
                        onActivityChange={async () => {
                            const updatedActivities = await requestService.getRequestActivities(request.id);
                            rq.setActivities(updatedActivities);
                        }}
                        canPostInternal={!!(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN'))}
                        currentUser={user}
                        currentUserId={user?.id}
                    />
                </div>

                {/* ─── RIGHT PANE: Workflow Cockpit ─── */}
                <WorkflowCockpit
                    request={{
                        id: request.id,
                        status: request.status,
                        slaDueAt: request.slaDueAt,
                        slaPausedAt: (request as any).slaPausedAt ?? null,
                        slaPauseDurationMs: (request as any).slaPauseDurationMs ?? null,
                        createdAt: request.createdAt,
                        resolvedAt: (request as any).resolvedAt ?? null,
                        referenceNumber: request.referenceNumber,
                        priority: request.priority,
                        serviceDeskName: request.serviceDesk?.name,
                        serviceDeskCode,
                        requestTypeName: request.requestType?.name,
                        requestTypeCode: request.requestType?.code,
                        requesterId: request.requesterId || request.requester?.id,
                        requesterName: request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : '',
                        requiresApproval: request.requestType?.requiresApproval ?? true,
                        assignedToId: request.assignedTo?.id,
                        assignedTo: request.assignedTo ?? null,
                        assignedTeam: request.assignedTeam ?? null,
                        isConfidential: request.isConfidential,
                    }}
                    user={{
                        id: user?.id || '',
                        roles: user?.roles || [],
                        name: user ? `${user.firstName} ${user.lastName}` : '',
                        permissions: user?.permissions || [],
                    }}
                    workflowSteps={workflowSteps}
                    approvals={approvals}
                    hasResumes={rq.resumes.length > 0}
                    allCandidatesComplete={
                        rq.candidates.length > 0 &&
                        rq.candidates.every(c => {
                            const types = new Set((c.documents || []).map((d: any) => d.documentType));
                            return ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'].every(t => types.has(t));
                        })
                    }
                    screeningCompleted={rq.screeningDetails?.overallStatus === 'COMPLETED'}
                    hasLOA={!!rq.loaDetails}
                    hasSignedLOA={!!rq.loaDetails?.signedLoaFileUrl}
                    selectedCandidateId={request.customFields?.selectedCandidateId}
                    selectedCandidateIds={request.customFields?.selectedCandidateIds || (request.customFields?.selectedCandidateId ? [request.customFields.selectedCandidateId] : [])}
                    candidateNames={[...new Set(rq.resumes.map(r => r.candidateName?.trim()).filter(Boolean) as string[])]}
                    attachments={(request.attachments || []).map((a: any) => ({
                        id: a.id,
                        fileName: a.fileName,
                        storageUrl: a.storageUrl || a.storagePath || '',
                        mimeType: a.mimeType || '',
                        createdAt: a.createdAt || '',
                    }))}
                    onActionComplete={rq.fetchRequestData}
                    onRouteToManager={rq.handleRouteToManager}
                    onManagerDecision={() => rq.setShowManagerDecisionModal(true)}
                    onLOAApproval={() => rq.setShowLOAApprovalModal(true)}
                    onIssueLOA={rq.handleMarkLOAIssued}
                    onMarkLOAAccepted={rq.handleMarkLOAAccepted}
                    onInterviewFeedback={() => rq.setShowInterviewFeedbackModal(true)}
                    onAdvanceOnboardingPhase={rq.handleAdvanceOnboardingPhase}
                    onCompleteOnboarding={() => rq.setShowCompleteOnboardingConfirm(true)}
                    onAdvanceOffboardingPhase={rq.handleAdvanceOffboardingPhase}
                    onCompleteOffboarding={rq.handleCompleteOffboarding}
                    onResolveRequest={() => rq.handleStatusChange('RESOLVED')}
                    onUploadResume={() => rq.setShowUploadModal(true)}
                    offboardingPreConditionsMet={offboardingPreConditions.preConditionsMet}
                    canExportPdf={canExport}
                    exportingPdf={exportingPdf}
                    onExportPdf={handleExportPdf}
                />
            </div>

            {/* Modals — kept for now (Phase C removes these in favor of config-driven modals) */}
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
                        await rq.updateStatusDirectly(rq.rejectionPendingStatus);
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
                candidates={rq.candidates.map(c => ({
                    id: c.id,
                    candidateName: c.fullName,
                    documentCount: c.documents?.length || 0,
                }))}
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
                candidates={((rq.request?.customFields as any)?.selectedCandidateIds || []).map((id: string, idx: number) => ({
                    id,
                    name: ((rq.request?.customFields as any)?.selectedCandidateNames || [])[idx] || `Candidate ${idx + 1}`
                }))}
                existingFeedbacks={(rq.interviewDetails?.feedbacks || []).map(f => ({
                    candidateId: f.candidateId,
                    decision: f.decision,
                    feedback: f.feedback,
                    overallRating: f.overallRating,
                    technicalSkills: f.technicalSkills,
                    culturalFit: f.culturalFit,
                    communication: f.communication
                }))}
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
                isITRequest={rq.request?.status === 'PENDING_CEO_APPROVAL_IT'}
            />

            <ManagerDecisionModal
                isOpen={rq.showManagerDecisionModal}
                processingAction={rq.processingAction}
                candidates={rq.candidates}
                onClose={() => rq.setShowManagerDecisionModal(false)}
                onSubmit={rq.handleManagerDecision}
            />

            {rq.showUploadModal && (
                <BatchUploadModal
                    requestId={request.id}
                    onClose={() => rq.setShowUploadModal(false)}
                    onSuccess={() => { rq.fetchResumes(); rq.fetchCandidates(); rq.fetchRequestData(); }}
                    existingCandidates={rq.candidates}
                />
            )}
        </div>
    );
};

export default RequestDetailContainer;