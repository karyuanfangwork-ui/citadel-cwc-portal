import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, mockUseAuth, toast } = vi.hoisted(() => ({
  api: {
    listBands: vi.fn(), listBandSets: vi.fn(), listRiskFactors: vi.fn(),
    createDraftBandSet: vi.fn(), submitBandSet: vi.fn(), approveBandSet: vi.fn(), activateBandSet: vi.fn(),
    seedDefaults: vi.fn(), createBand: vi.fn(), updateBand: vi.fn(), upsertRiskFactor: vi.fn(),
  },
  mockUseAuth: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../src/context/AuthContext', () => ({ useAuth: mockUseAuth }));
vi.mock('../../../src/services/ratingBandAdmin.service', () => ({ ratingBandAdminApi: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import RatingBandAdmin from '../../../pages/RatingBandAdmin';

const approvedSet = {
  id: 'set-1', name: 'Reviewed bands', version: 2, description: null, reason: 'Policy review', status: 'APPROVED',
  createdById: 'maker-1', submittedById: 'maker-1', approvedById: 'checker-1', activatedById: null,
  policyApprovalReference: null, createdAt: '', submittedAt: '', approvedAt: '', activatedAt: null,
  effectiveFrom: '', effectiveTo: null,
  bands: [{ id: 'band-1', scoreMin: 0, scoreMax: 100, rating: 'D', riskCategory: 'PROHIBITED', effectiveFrom: '', effectiveTo: null, version: 2, bandSetId: 'set-1' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'operator-1' } });
  api.listBands.mockResolvedValue([]);
  api.listBandSets.mockResolvedValue([]);
  api.listRiskFactors.mockResolvedValue([]);
  api.activateBandSet.mockResolvedValue({ ...approvedSet, status: 'ACTIVE' });
});

describe('RatingBandAdmin', () => {
  it('does not prefill or expose the old seed/direct-create path', async () => {
    render(<RatingBandAdmin />);
    expect(await screen.findByText('Create a complete draft set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seed Defaults' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Band' })).not.toBeInTheDocument();
    expect(api.seedDefaults).not.toHaveBeenCalled();
    expect(screen.getByText(/No canonical thresholds are prefilled/)).toBeInTheDocument();
  });

  it('requires an approval reference and explicit confirmation before activation', async () => {
    api.listBandSets.mockResolvedValue([approvedSet]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RatingBandAdmin />);

    const reference = await screen.findByLabelText('Credit-policy approval reference');
    fireEvent.change(reference, { target: { value: 'POLICY-12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(api.activateBandSet).toHaveBeenCalledWith('set-1', 'POLICY-12345'));
    expect(window.confirm).toHaveBeenCalled();
  });
});
