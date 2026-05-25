// frontend/src/components/request-detail/WorkflowCockpit.tsx
// Right pane container for the RequestDetail 2-pane layout.
// Stacks: WorkflowStepper → DecisionPanel → ApprovalChain → SLAIndicator → ParticipantsSection

import React, { useState } from 'react';
import WorkflowStepper from './WorkflowStepper';
import DecisionPanel from './DecisionPanel';
import ApprovalChain from './ApprovalChain';
import SLAIndicator from './SLAIndicator';
import ParticipantsSection from './ParticipantsSection';

interface ApprovalEntry {
  id: string;
  approverId: string;
  approverType: string;
  status: string;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  approver: { id: string; firstName: string; lastName: string; email: string };
  entity: { id: string; name: string; code: string } | null;
}

interface AssignmentInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface WorkflowCockpitProps {
  /** Request data */
  request: {
    id: string;
    status: string;
    slaDueAt?: string | null;
    slaPausedAt?: string | null;
    slaPauseDurationMs?: number | bigint | null;
    createdAt: string;
    resolvedAt?: string | null;
    referenceNumber?: string;
    priority?: string;
    serviceDeskName?: string;
    serviceDeskCode: string;
    requestTypeName?: string;
    requestTypeCode?: string;
    requesterId?: string;
    requesterName?: string;
    requiresApproval?: boolean;
    assignedToId?: string | null;
    assignedTo?: AssignmentInfo | null;
    assignedTeam?: string | null;
    isConfidential?: boolean;
  };

  /** Current user info */
  user: {
    id: string;
    roles: string[];
    name?: string;
    permissions?: string[];
  };

  /** Workflow steps from request type */
  workflowSteps?: { step: string; label: string; order: number }[];

  /** Approval entries */
  approvals?: ApprovalEntry[];

  /** Resume/LOA/screening state flags */
  hasResumes?: boolean;
  screeningCompleted?: boolean;
  hasLOA?: boolean;
  hasSignedLOA?: boolean;
  selectedCandidateId?: string;
  selectedCandidateIds?: string[];
  candidateNames?: string[];

  /** Callback after any action completes (triggers refetch) */
  onActionComplete: () => void;

  /** Direct-action callbacks (non-modal) */
  onRouteToManager?: () => void;
  onManagerDecision?: () => void;
  onLOAApproval?: () => void;
  onIssueLOA?: () => void;
  onMarkLOAAccepted?: () => void;
  onInterviewFeedback?: () => void;
  onAdvanceOnboardingPhase?: () => void;
  onCompleteOnboarding?: () => void;
  onAdvanceOffboardingPhase?: () => void;
  onCompleteOffboarding?: () => void;
  onResolveRequest?: () => void;
}

const WorkflowCockpit: React.FC<WorkflowCockpitProps> = ({
  request,
  user,
  workflowSteps,
  approvals = [],
  hasResumes = false,
  screeningCompleted = false,
  hasLOA = false,
  hasSignedLOA = false,
  selectedCandidateId,
  selectedCandidateIds,
  candidateNames = [],
  onActionComplete,
  onRouteToManager,
  onManagerDecision,
  onLOAApproval,
  onIssueLOA,
  onMarkLOAAccepted,
  onInterviewFeedback,
  onAdvanceOnboardingPhase,
  onCompleteOnboarding,
  onAdvanceOffboardingPhase,
  onCompleteOffboarding,
  onResolveRequest,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <>
      {/* Desktop layout — sticky sidebar */}
      <div className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm divide-y divide-gray-100">
          {/* WorkflowStepper */}
          <div className="p-4">
            <WorkflowStepper
              request={{
                id: request.id,
                status: request.status,
                slaDueAt: request.slaDueAt,
                slaPausedAt: request.slaPausedAt,
                slaPauseDurationMs: request.slaPauseDurationMs,
                createdAt: request.createdAt,
                resolvedAt: request.resolvedAt,
              }}
              workflowSteps={workflowSteps}
              approvals={approvals}
            />
          </div>

          {/* DecisionPanel */}
          <div className="p-4">
            <DecisionPanel
              requestId={request.id}
              status={request.status}
              userRoles={user.roles}
              userId={user.id}
              assignedTo={request.assignedTo}
              assignedTeam={request.assignedTeam}
              approvals={approvals}
              requestTypeName={request.requestTypeName}
              requestTypeCode={request.requestTypeCode}
              serviceDeskCode={request.serviceDeskCode}
              serviceDeskName={request.serviceDeskName}
              referenceNumber={request.referenceNumber}
              priority={request.priority}
              requesterName={request.requesterName}
              createdAt={request.createdAt}
              slaDueAt={request.slaDueAt}
              requesterId={request.requesterId}
              requiresApproval={request.requiresApproval}
              agentTeam={request.assignedTeam ?? undefined}
              hasResumes={hasResumes}
              screeningCompleted={screeningCompleted}
              hasLOA={hasLOA}
              hasSignedLOA={hasSignedLOA}
              selectedCandidateId={selectedCandidateId}
              selectedCandidateIds={selectedCandidateIds}
              candidateNames={candidateNames}
              onActionComplete={onActionComplete}
              onRouteToManager={onRouteToManager}
              onManagerDecision={onManagerDecision}
              onLOAApproval={onLOAApproval}
              onIssueLOA={onIssueLOA}
              onMarkLOAAccepted={onMarkLOAAccepted}
              onInterviewFeedback={onInterviewFeedback}
              onAdvanceOnboardingPhase={onAdvanceOnboardingPhase}
              onCompleteOnboarding={onCompleteOnboarding}
              onAdvanceOffboardingPhase={onAdvanceOffboardingPhase}
              onCompleteOffboarding={onCompleteOffboarding}
              onResolveRequest={onResolveRequest}
            />
          </div>

          {/* ApprovalChain */}
          {approvals.length > 0 && (
            <div className="p-4">
              <ApprovalChain approvals={approvals} />
            </div>
          )}

          {/* SLA Indicator */}
          {request.slaDueAt && (
            <div className="px-4 py-3">
              <SLAIndicator
                slaDueAt={request.slaDueAt}
                status={request.status}
                slaPausedAt={request.slaPausedAt ?? undefined}
                slaPauseDurationMs={request.slaPauseDurationMs ?? undefined}
              />
            </div>
          )}

          {/* Participants */}
          <div className="p-4">
            <ParticipantsSection
              requestId={request.id}
              canEdit={user.roles.includes('ADMIN') || user.roles.includes('AGENT') || user.id === request.requesterId}
            />
          </div>
        </div>
      </div>

      {/* Mobile layout — bottom sheet */}
      <div className="lg:hidden">
        {/* Collapsed bar */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] px-4 py-3 flex items-center justify-between"
          onClick={() => setMobileExpanded(true)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-bold text-gray-900">Workflow Actions</span>
          </div>
          <span className="material-symbols-outlined text-gray-500" style={{ fontSize: '20px' }}>
            expand_less
          </span>
        </div>

        {/* Expanded overlay */}
        {mobileExpanded && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileExpanded(false)}
            />
            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              {/* Close button */}
              <div className="flex justify-between items-center px-4 py-2">
                <span className="text-sm font-bold text-gray-900">Workflow</span>
                <button
                  onClick={() => setMobileExpanded(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>

              {/* WorkflowStepper */}
              <div className="px-4 py-3">
                <WorkflowStepper
                  request={{
                    id: request.id,
                    status: request.status,
                    slaDueAt: request.slaDueAt,
                    slaPausedAt: request.slaPausedAt,
                    slaPauseDurationMs: request.slaPauseDurationMs,
                    createdAt: request.createdAt,
                    resolvedAt: request.resolvedAt,
                  }}
                  workflowSteps={workflowSteps}
                  approvals={approvals}
                />
              </div>

              {/* DecisionPanel */}
              <div className="px-4 py-3">
                <DecisionPanel
                  requestId={request.id}
                  status={request.status}
                  userRoles={user.roles}
                  userId={user.id}
                  assignedTo={request.assignedTo}
                  assignedTeam={request.assignedTeam}
                  approvals={approvals}
                  requestTypeName={request.requestTypeName}
                  requestTypeCode={request.requestTypeCode}
                  serviceDeskCode={request.serviceDeskCode}
                  serviceDeskName={request.serviceDeskName}
                  referenceNumber={request.referenceNumber}
                  priority={request.priority}
                  requesterName={request.requesterName}
                  createdAt={request.createdAt}
                  slaDueAt={request.slaDueAt}
                  requesterId={request.requesterId}
                  requiresApproval={request.requiresApproval}
                  agentTeam={request.assignedTeam ?? undefined}
                  hasResumes={hasResumes}
                  screeningCompleted={screeningCompleted}
                  hasLOA={hasLOA}
                  hasSignedLOA={hasSignedLOA}
                  selectedCandidateId={selectedCandidateId}
                  selectedCandidateIds={selectedCandidateIds}
                  candidateNames={candidateNames}
                  onActionComplete={onActionComplete}
                  onRouteToManager={onRouteToManager}
                  onManagerDecision={onManagerDecision}
                  onLOAApproval={onLOAApproval}
                  onIssueLOA={onIssueLOA}
                  onMarkLOAAccepted={onMarkLOAAccepted}
                  onInterviewFeedback={onInterviewFeedback}
                  onAdvanceOnboardingPhase={onAdvanceOnboardingPhase}
                  onCompleteOnboarding={onCompleteOnboarding}
                  onAdvanceOffboardingPhase={onAdvanceOffboardingPhase}
                  onCompleteOffboarding={onCompleteOffboarding}
                  onResolveRequest={onResolveRequest}
                />
              </div>

              {/* ApprovalChain */}
              {approvals.length > 0 && (
                <div className="px-4 py-3">
                  <ApprovalChain approvals={approvals} />
                </div>
              )}

              {/* SLA Indicator */}
              {request.slaDueAt && (
                <div className="px-4 py-2">
                  <SLAIndicator
                    slaDueAt={request.slaDueAt}
                    status={request.status}
                    slaPausedAt={request.slaPausedAt ?? undefined}
                    slaPauseDurationMs={request.slaPauseDurationMs ?? undefined}
                  />
                </div>
              )}

              {/* Participants */}
              <div className="px-4 py-3">
                <ParticipantsSection
                  requestId={request.id}
                  canEdit={user.roles.includes('ADMIN') || user.roles.includes('AGENT') || user.id === request.requesterId}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default WorkflowCockpit;