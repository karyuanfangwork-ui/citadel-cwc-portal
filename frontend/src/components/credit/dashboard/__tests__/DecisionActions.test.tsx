import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DecisionActions from '../DecisionActions';

describe('DecisionActions', () => {
  it('offers approve, return and decline', () => {
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('submits an approval directly', async () => {
    const onSubmit = vi.fn();
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onSubmit).toHaveBeenCalledWith('APPROVE', expect.objectContaining({ decision: 'APPROVE' }));
  });

  it('blocks a decline until a reason code and comment are supplied', async () => {
    const onSubmit = vi.fn();
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting={false} rejectionReasonCodes={[{ value: 'AFFORDABILITY', label: 'Affordability' }]} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const confirm = screen.getByRole('button', { name: 'Confirm decline' });
    expect(confirm).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rejection reason code' }), 'AFFORDABILITY');
    await userEvent.type(screen.getByRole('textbox', { name: 'Comments' }), 'Affordability policy threshold exceeded');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onSubmit).toHaveBeenCalledWith('REJECT', expect.objectContaining({ rejectionReasonCode: 'AFFORDABILITY' }));
  });

  it('replaces the actions with the exclusion reason when SOD blocks the user', () => {
    render(<DecisionActions applicationId="a1" sodBlocked sodReason="You are the assigned Relationship Manager for this application." submitting={false} onSubmit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByText(/assigned Relationship Manager/)).toBeInTheDocument();
  });

  it('disables the actions while a decision is in flight', () => {
    render(<DecisionActions applicationId="a1" sodBlocked={false} submitting onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });
});
