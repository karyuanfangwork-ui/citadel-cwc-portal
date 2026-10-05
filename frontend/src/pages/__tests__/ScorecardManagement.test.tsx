import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scorecardApi, mockUseAuth, toast } = vi.hoisted(() => ({
  scorecardApi: {
    list: vi.fn(),
    listVersions: vi.fn(),
    create: vi.fn(),
    createVersion: vi.fn(),
    approveVersion: vi.fn(),
    activateVersion: vi.fn(),
  },
  mockUseAuth: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('../../../src/services/credit.service', () => ({ scorecardApi }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import ScorecardManagement from '../../../pages/ScorecardManagement';

const approvedVersion = {
  id: 'version-2',
  scorecardId: 'scorecard-1',
  versionNumber: 2,
  isActive: false,
  factors: [],
  retailFactors: [],
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  effectiveTo: null,
  changeReason: 'Reviewed proposal',
  policyApprovalReference: null,
  marketConditionsAcknowledged: false,
  activatedById: null,
  activatedAt: null,
  createdById: 'maker-1',
  createdBy: { id: 'maker-1', firstName: 'Maya', lastName: 'Maker', email: 'maker@example.test' },
  approvedById: 'checker-1',
  approvedAt: '2026-10-01T01:00:00.000Z',
  approvedBy: { id: 'checker-1', firstName: 'Chris', lastName: 'Checker', email: 'checker@example.test' },
  lifecycleStatus: 'APPROVED' as const,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T01:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'operator-1', permissions: ['credit:admin'] } });
  scorecardApi.list.mockResolvedValue([{
    id: 'scorecard-1',
    name: 'Term Loan Scorecard',
    description: null,
    productType: 'TERM_LOAN',
    activeVersionId: null,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    _count: { versions: 1 },
  }]);
  scorecardApi.listVersions.mockResolvedValue([approvedVersion]);
  scorecardApi.activateVersion.mockResolvedValue({ ...approvedVersion, isActive: true, lifecycleStatus: 'ACTIVE' });
});

describe('ScorecardManagement policy approval UX', () => {
  it('requires a policy reference and market_conditions acknowledgment before activation', async () => {
    render(<MemoryRouter><ScorecardManagement /></MemoryRouter>);

    fireEvent.click(await screen.findByText('Term Loan Scorecard'));
    fireEvent.click(await screen.findByRole('button', { name: /Activate/ }));

    const reference = await screen.findByLabelText('Policy-owner approval reference *');
    const acknowledgement = screen.getByRole('checkbox');
    const activate = screen.getByRole('button', { name: 'Record Approval & Activate' });
    expect(screen.getByText(/unsupported market_conditions factor/i)).toBeInTheDocument();
    expect(activate).toBeDisabled();

    fireEvent.change(reference, { target: { value: 'POLICY-12345' } });
    expect(activate).toBeDisabled();
    fireEvent.click(acknowledgement);
    expect(activate).toBeEnabled();
    fireEvent.click(activate);

    await waitFor(() => expect(scorecardApi.activateVersion).toHaveBeenCalledWith('version-2', {
      policyApprovalReference: 'POLICY-12345',
      marketConditionsAcknowledged: true,
    }));
  });
});
