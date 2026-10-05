import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, mockUseAuth, toast } = vi.hoisted(() => ({
  api: {
    list: vi.fn(),
    create: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    activate: vi.fn(),
  },
  mockUseAuth: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../src/context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('../../../src/services/creditRuleConfigSet.service', () => ({ creditRuleConfigSetApi: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import CreditRequiredFieldAdmin from '../../../pages/CreditRequiredFieldAdmin';

const draftSet = {
  id: 'draft-1', name: 'Credit Required Fields', version: 1, status: 'DRAFT', reason: 'Policy review change',
  createdById: 'maker-1', submittedById: null, approvedById: null, activatedById: null,
  policyApprovalReference: null, createdAt: '', submittedAt: null, approvedAt: null, activatedAt: null,
  effectiveFrom: '', effectiveTo: null,
  rules: [{ id: 'rule-1', fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 10, isActive: false }],
};

const approvedSet = {
  ...draftSet,
  id: 'approved-1', version: 2, status: 'APPROVED',
  createdById: 'maker-1', submittedById: 'maker-1', approvedById: 'checker-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'maker-1' } });
  api.list.mockResolvedValue([]);
  api.create.mockResolvedValue(draftSet);
  api.submit.mockResolvedValue({ ...draftSet, status: 'SUBMITTED' });
  api.approve.mockResolvedValue({ ...draftSet, status: 'APPROVED' });
  api.activate.mockResolvedValue({ ...approvedSet, status: 'ACTIVE' });
});

describe('CreditRequiredFieldAdmin', () => {
  it('shows lifecycle controls only for the current maker on a draft', async () => {
    api.list.mockResolvedValue([draftSet]);
    render(<CreditRequiredFieldAdmin />);

    expect(await screen.findByText('Credit Required Fields v1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    expect(screen.getByText(/Draft and submitted sets do not affect/)).toBeInTheDocument();
  });

  it('requires a policy reference and activates only after explicit confirmation', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'operator-1' } });
    api.list.mockResolvedValue([approvedSet]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreditRequiredFieldAdmin />);

    const input = await screen.findByLabelText('Policy-owner approval reference');
    fireEvent.change(input, { target: { value: 'POLICY-12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(api.activate).toHaveBeenCalledWith('approved-1', 'POLICY-12345'));
    expect(window.confirm).toHaveBeenCalled();
  });
});
