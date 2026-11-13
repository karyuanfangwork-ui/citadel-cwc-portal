import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DecisionPanel from './DecisionPanel';

const props = {
  requestId: 'request-1', status: 'SUBMITTED', userRoles: ['AGENT'], userId: 'agent-1',
  agentTeam: 'HR', serviceDeskCode: 'HR', requestTypeCode: 'NEW_HIRING',
  requesterId: 'requester-1', onActionComplete: vi.fn(),
};

describe('HR decision panel restrictions', () => {
  it('shows a waiting message rather than an agent approver picker for a legacy unselected request', () => {
    render(<DecisionPanel {...props} />);
    expect(screen.getByText(/waiting for requester to select an executive/i)).toBeInTheDocument();
    expect(screen.queryByText('Route to Executive Approval')).not.toBeInTheDocument();
  });

  it('offers routing only when a requester selection exists', () => {
    render(<DecisionPanel {...props} executiveApproverId="ceo-1" executiveApproverRole="CEO" />);
    expect(screen.getByText('Route to Executive Approval')).toBeInTheDocument();
    expect(screen.queryByText(/Route to Group Deputy CEO for Approval/i)).not.toBeInTheDocument();
  });

  it('hides executive decisions from an undesignated executive', () => {
    render(<DecisionPanel {...props} status="PENDING_CEO_APPROVAL" userRoles={['CEO']} userId="other-ceo" executiveApproverId="ceo-1" executiveApproverRole="CEO" approvals={[{ id: 'approval-1', approverId: 'ceo-1', approverType: 'CEO', status: 'PENDING' }]} />);
    expect(screen.queryByText('CEO Approval Decision')).not.toBeInTheDocument();
  });
  it('hides a saved CEO route when the successfully loaded graph has no outgoing edge', () => {
    render(<DecisionPanel {...props} executiveApproverId="ceo-1" executiveApproverRole="CEO" availableTransitions={[]} />);
    expect(screen.queryByText('Route to Executive Approval')).not.toBeInTheDocument();
  });
  it('retains a saved Group DCEO route only when that graph edge is available', () => {
    const edge = { id: 'edge', fromStatus: 'SUBMITTED', toStatus: 'PENDING_GROUP_DCEO_APPROVAL', transitionLabel: 'ROUTE_DCEO', requiresComment: false, allowedRoles: ['AGENT'], allowedExecutiveRoles: [] };
    render(<DecisionPanel {...props} executiveApproverId="dceo-1" executiveApproverRole="GROUP_DCEO" availableTransitions={[edge]} />);
    expect(screen.getByText('Route to Executive Approval')).toBeInTheDocument();
  });
  it('shows the designated CEO decision when the decision edge is available', () => {
    const edge = { id: 'edge', fromStatus: 'PENDING_CEO_APPROVAL', toStatus: 'CEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false, allowedRoles: ['CEO'], allowedExecutiveRoles: [] };
    render(<DecisionPanel {...props} status="PENDING_CEO_APPROVAL" userRoles={['CEO']} userId="ceo-1" executiveApproverId="ceo-1" executiveApproverRole="CEO" approvals={[{ id: 'approval-1', approverId: 'ceo-1', approverType: 'CEO', status: 'PENDING' }]} availableTransitions={[edge]} />);
    expect(screen.getByText('CEO Decision')).toBeInTheDocument();
  });

  it('shows a pending manager decision to the requester even if a previous partial attempt marked approval approved', () => {
    const managerId = 'john-user-id';
    render(<DecisionPanel
      {...props}
      status="PENDING_MANAGER_REVIEW"
      userRoles={['NORMAL_STAFF', 'HIRING_MANAGER']}
      userId={managerId}
      requesterId={managerId}
      approvals={[{ id: 'manager-approval', approverId: managerId, approverType: 'HIRING_MANAGER', status: 'APPROVED' }]}
      availableTransitions={[
        { id: 'approve', fromStatus: 'PENDING_MANAGER_REVIEW', toStatus: 'MANAGER_APPROVED', transitionLabel: 'APPROVE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
        { id: 'return', fromStatus: 'PENDING_MANAGER_REVIEW', toStatus: 'IN_REVIEW', transitionLabel: 'RETURN', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onManagerDecision={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: /Review & Select Candidates/ })).toBeInTheDocument();
  });

  it('shows interview feedback to the hiring-manager requester only when the published graph permits an outcome', () => {
    const managerId = 'john-user-id';
    const { rerender } = render(<DecisionPanel
      {...props}
      status="INTERVIEW_SCHEDULED"
      userRoles={['NORMAL_STAFF', 'HIRING_MANAGER']}
      userId={managerId}
      requesterId={managerId}
      availableTransitions={[
        { id: 'proceed', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_FEEDBACK_PENDING', transitionLabel: 'ADVANCE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
        { id: 'reject', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'CANDIDATE_REJECTED_INTERVIEW', transitionLabel: 'REJECT', requiresComment: true, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onInterviewFeedback={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: /Submit Interview Feedback/ })).toBeInTheDocument();

    rerender(<DecisionPanel
      {...props}
      status="INTERVIEW_SCHEDULED"
      userRoles={['NORMAL_STAFF', 'HIRING_MANAGER']}
      userId={managerId}
      requesterId={managerId}
      availableTransitions={[
        { id: 'proceed', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_FEEDBACK_PENDING', transitionLabel: 'ADVANCE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onInterviewFeedback={vi.fn()}
    />);
    expect(screen.queryByRole('button', { name: /Submit Interview Feedback/ })).not.toBeInTheDocument();
  });

  it('does not offer interview feedback to an ordinary requester or HR agent', () => {
    const managerId = 'john-user-id';
    const transitions = [
      { id: 'proceed', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_FEEDBACK_PENDING', transitionLabel: 'ADVANCE', requiresComment: false, allowedRoles: ['AGENT', 'ADMIN'], allowedExecutiveRoles: [] },
      { id: 'reject', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'CANDIDATE_REJECTED_INTERVIEW', transitionLabel: 'REJECT', requiresComment: true, allowedRoles: ['AGENT', 'ADMIN'], allowedExecutiveRoles: [] },
    ];

    const { rerender } = render(<DecisionPanel
      {...props}
      status="INTERVIEW_SCHEDULED"
      userRoles={['NORMAL_STAFF']}
      userId={managerId}
      requesterId={managerId}
      availableTransitions={transitions}
    />);
    expect(screen.queryByRole('button', { name: /Submit Interview Feedback/ })).not.toBeInTheDocument();

    rerender(<DecisionPanel
      {...props}
      status="INTERVIEW_SCHEDULED"
      userRoles={['AGENT', 'NORMAL_STAFF']}
      userId="hr-agent-id"
      requesterId={managerId}
      workflowCode="HR_RECRUITMENT"
      availableTransitions={transitions}
    />);
    expect(screen.queryByRole('button', { name: /Submit Interview Feedback/ })).not.toBeInTheDocument();
  });

  it('shows LOA approval only to the hiring-manager requester when both graph outcomes are available', () => {
    const managerId = 'john-user-id';
    const { rerender } = render(<DecisionPanel
      {...props}
      status="LOA_PENDING_APPROVAL"
      userRoles={['NORMAL_STAFF', 'HIRING_MANAGER']}
      userId={managerId}
      requesterId={managerId}
      hasLOA
      availableTransitions={[
        { id: 'approve', fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'LOA_APPROVED', transitionLabel: 'APPROVE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
        { id: 'return', fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'HR_SCREENING', transitionLabel: 'RETURN', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onLOAApproval={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: /Approve \/ Reject LOA/ })).toBeInTheDocument();

    rerender(<DecisionPanel
      {...props}
      status="LOA_PENDING_APPROVAL"
      userRoles={['AGENT', 'NORMAL_STAFF']}
      userId="hr-agent-id"
      requesterId={managerId}
      hasLOA
      availableTransitions={[
        { id: 'approve', fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'LOA_APPROVED', transitionLabel: 'APPROVE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
        { id: 'return', fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'HR_SCREENING', transitionLabel: 'RETURN', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onLOAApproval={vi.fn()}
    />);
    expect(screen.queryByRole('button', { name: /Approve \/ Reject LOA/ })).not.toBeInTheDocument();

    rerender(<DecisionPanel
      {...props}
      status="LOA_PENDING_APPROVAL"
      userRoles={['NORMAL_STAFF', 'HIRING_MANAGER']}
      userId={managerId}
      requesterId={managerId}
      hasLOA
      availableTransitions={[
        { id: 'approve', fromStatus: 'LOA_PENDING_APPROVAL', toStatus: 'LOA_APPROVED', transitionLabel: 'APPROVE', requiresComment: false, allowedRoles: ['HIRING_MANAGER'], allowedExecutiveRoles: [] },
      ]}
      onLOAApproval={vi.fn()}
    />);
    expect(screen.queryByRole('button', { name: /Approve \/ Reject LOA/ })).not.toBeInTheDocument();
  });
});
