import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RequestHeader from './RequestHeader';

vi.mock('../request-detail/ActionBanner', () => ({
  default: () => <div data-testid="action-banner" />,
}));

const request = {
  id: 'request-1',
  referenceNumber: 'HR-00013',
  summary: 'New Hire',
  status: 'INTERVIEW_SCHEDULED',
  createdAt: '2026-11-12T00:00:00.000Z',
  updatedAt: '2026-11-12T00:00:00.000Z',
  requesterId: 'john-user-id',
  serviceDesk: { code: 'HR' },
  requestType: { code: 'NEW_HIRING', name: 'New Hiring Request' },
};

function renderHeader(user: { id: string; roles?: string[]; firstName: string; lastName: string }, requestData = request) {
  return render(
    <MemoryRouter>
      <RequestHeader
        request={requestData}
        user={user}
        onActionClick={vi.fn()}
        onScheduleInterview={vi.fn()}
        onInterviewFeedback={vi.fn()}
        onLOAApproval={vi.fn()}
        onStartHRScreening={vi.fn()}
        onMarkLOAIssued={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('RequestHeader interview handoff', () => {
  it('tells an HR agent the hiring manager must submit interview feedback next', () => {
    renderHeader({ id: 'hr-agent-id', roles: ['AGENT'], firstName: 'Sasha', lastName: 'Nair' });

    expect(screen.getByRole('status')).toHaveTextContent(/hiring manager must submit interview feedback/i);
    expect(screen.queryByTestId('action-banner')).not.toBeInTheDocument();
  });

  it('does not show the waiting notice to the hiring-manager requester', () => {
    renderHeader({ id: 'john-user-id', roles: ['NORMAL_STAFF', 'HIRING_MANAGER'], firstName: 'John', lastName: 'Doe' });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('action-banner')).toBeInTheDocument();
  });

  it('tells HR to wait while the hiring manager reviews the LOA', () => {
    renderHeader(
      { id: 'hr-agent-id', roles: ['AGENT'], firstName: 'Sasha', lastName: 'Nair' },
      { ...request, status: 'LOA_PENDING_APPROVAL' },
    );

    expect(screen.getByRole('status')).toHaveTextContent(/hiring manager must approve or reject.*loa/i);
    expect(screen.queryByTestId('action-banner')).not.toBeInTheDocument();
  });
});
