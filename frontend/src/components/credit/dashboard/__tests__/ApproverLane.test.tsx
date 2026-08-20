import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApproverLane from '../ApproverLane';
import creditService from '../../../../services/credit.service';

vi.mock('../../../../services/credit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../services/credit.service')>();
  return { ...actual, default: { ...actual.default, getApplication: vi.fn(), listRejectionReasonCodes: vi.fn().mockResolvedValue([]), submitApproval: vi.fn() } };
});

const item = (over = {}) => ({ applicationId: 'app-1', applicationNo: 'CA-LEAN-003', borrowerName: 'Lyra Manufacturing Sdn Bhd', productType: 'TERM_LOAN', requestedAmount: 6000000, currency: 'MYR', currentState: 'COMMITTEE_REVIEW', urgency: 'HIGH', submittedAt: '2026-08-15T00:00:00Z', daysWaiting: 5, riskRating: 'BB', _slaBreached: false, ...over });
const inbox = (over = {}) => ({ high: [item()], medium: [], low: [], totalPending: 1, excluded: [], ...over });

const renderLane = (value = inbox(), onDecision = vi.fn()) => render(<MemoryRouter><ApproverLane inbox={value as any} onDecision={onDecision} formatAmount={v => `RM ${v?.toLocaleString() ?? '—'}`} /></MemoryRouter>);

describe('ApproverLane', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows pending and overdue counts', () => {
    renderLane(inbox({ high: [item({ _slaBreached: true }), item({ applicationId: 'app-2', applicationNo: 'CA-2', _slaBreached: true })], medium: [item({ applicationId: 'app-3', applicationNo: 'CA-3' })], totalPending: 3 }));
    expect(screen.getByRole('heading', { name: '3 decisions waiting · 2 overdue' })).toBeInTheDocument();
  });

  it('shows collapsed identity details without fetching application detail', () => {
    renderLane();
    const row = screen.getByRole('listitem', { name: /CA-LEAN-003/ });
    expect(within(row).getByText('Lyra Manufacturing Sdn Bhd')).toBeInTheDocument();
    expect(creditService.getApplication).not.toHaveBeenCalled();
  });

  it('fetches detail only after expansion', async () => {
    vi.mocked(creditService.getApplication).mockResolvedValue({ dscr: 42.5 } as any);
    await renderLane();
    await userEvent.click(screen.getByRole('button', { name: /CA-LEAN-003/ }));
    await waitFor(() => expect(creditService.getApplication).toHaveBeenCalledWith('app-1'));
    expect(await screen.findByText('42.5%')).toBeInTheDocument();
  });

  it('keeps SOD exclusions visible without decision controls', () => {
    renderLane(inbox({ high: [], totalPending: 0, excluded: [{ applicationId: 'app-9', borrowerName: 'Own Deal Sdn Bhd', reason: 'You are the assigned Relationship Manager for this application.' }] }));
    const excluded = screen.getByRole('region', { name: 'Excluded from your queue' });
    expect(within(excluded).getByText(/assigned Relationship Manager/)).toBeInTheDocument();
    expect(within(excluded).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
