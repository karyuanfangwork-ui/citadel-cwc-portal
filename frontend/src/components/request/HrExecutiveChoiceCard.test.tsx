import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HrExecutiveChoiceCard from './HrExecutiveChoiceCard';
import type { Request } from './useRequestDetail';
import { hrExecutiveChoiceService } from '../../services/hrExecutiveChoice.service';

vi.mock('../../services/hrExecutiveChoice.service', () => ({
  hrExecutiveChoiceService: { list: vi.fn(), save: vi.fn() },
  executiveLabel: (u: { firstName: string; lastName: string; executiveApproverRole: string }) => `${u.firstName} ${u.lastName} (${u.executiveApproverRole})`,
}));

const request = { id: 'request-1', requesterId: 'requester-1', status: 'SUBMITTED', version: 3, approvals: [] } as unknown as Request;
const executive = { id: 'ceo-1', firstName: 'Ada', lastName: 'Lovelace', executiveApproverRole: 'CEO' as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hrExecutiveChoiceService.list).mockResolvedValue([executive]);
  vi.mocked(hrExecutiveChoiceService.save).mockResolvedValue({});
});

describe('legacy hiring executive choice', () => {
  it('lets only the requester save a named choice with the current version', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<HrExecutiveChoiceCard request={request} currentUserId="requester-1" onSaved={onSaved} />);
    fireEvent.change(await screen.findByLabelText(/executive approver/i), { target: { value: 'CEO:ceo-1' } });
    fireEvent.click(screen.getByRole('button', { name: /save executive choice/i }));
    await waitFor(() => expect(hrExecutiveChoiceService.save).toHaveBeenCalledWith('request-1', {
      executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO', version: 3,
    }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('does not offer the chooser to HR agents or after routing', () => {
    const { rerender } = render(<HrExecutiveChoiceCard request={request} currentUserId="agent-1" onSaved={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /save executive choice/i })).not.toBeInTheDocument();
    rerender(<HrExecutiveChoiceCard request={{ ...request, status: 'PENDING_CEO_APPROVAL' }} currentUserId="requester-1" onSaved={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /save executive choice/i })).not.toBeInTheDocument();
  });

  it('keeps saved choice visible without allowing editing', async () => {
    render(<HrExecutiveChoiceCard request={{ ...request, executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO' }} currentUserId="requester-1" onSaved={vi.fn()} />);
    expect(await screen.findByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save executive choice/i })).not.toBeInTheDocument();
  });
});
