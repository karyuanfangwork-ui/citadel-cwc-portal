import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DuplicateExceptionQueue from '../DuplicateExceptionQueue';

const { listPending } = vi.hoisted(() => ({ listPending: vi.fn() }));
vi.mock('@/src/services/credit.service', () => ({
  default: {
    listPendingDuplicateExceptions: listPending,
    decideDuplicateException: vi.fn(),
  },
}));

describe('DuplicateExceptionQueue', () => {
  it('renders masked borrower context and review action', async () => {
    listPending.mockResolvedValueOnce({
      items: [{
        id: 'exception-1', draftId: 'draft-1', requestedById: 'requester-1', decidedById: null,
        matchedBorrowerId: 'borrower-1', segment: 'INDIVIDUAL', category: 'RELATED_PARTY',
        justification: 'The matched record is a distinct legal party after review.', supportingReference: 'CASE-123',
        status: 'PENDING', decisionComment: null, expiresAt: '2026-08-20T00:00:00.000Z',
        createdAt: '2026-08-11T00:00:00.000Z', decidedAt: null, consumedAt: null, updatedAt: '2026-08-11T00:00:00.000Z',
        requester: { id: 'requester-1', name: 'Requester One' },
        matchedBorrower: { id: 'borrower-1', borrowerNumber: 'BRW-000001', name: 'A Borrower', maskedIdentifier: '91••••22' },
      }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });

    render(<DuplicateExceptionQueue />);
    await waitFor(() => expect(screen.getByText('A Borrower')).toBeInTheDocument());
    expect(screen.getByText(/91••••22/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText(/single-use approval/i)).toBeInTheDocument();
  });
});
