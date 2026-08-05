import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenericTransitionModal from '../GenericTransitionModal';
import type { AvailableTransition } from '../../../services/request.service';

vi.mock('../../ModalWrapper', () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? <div><h1>{title}</h1>{children}</div> : null,
}));

const transition: AvailableTransition = {
  id: 'transition-1',
  fromStatus: 'IN_PROGRESS',
  toStatus: 'REJECTED',
  transitionLabel: 'REJECT',
  requiresComment: true,
  allowedRoles: [],
  allowedExecutiveRoles: [],
};

describe('GenericTransitionModal', () => {
  it('requires a comment before submitting a comment-required transition', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <GenericTransitionModal
        open
        transition={transition}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'REJECT' }));

    expect(await screen.findByText('A comment is required for this transition.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits an optional comment for a non-required transition', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <GenericTransitionModal
        open
        transition={{ ...transition, requiresComment: false, toStatus: 'WAITING', transitionLabel: 'HOLD' }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: 'Waiting for requester' } });
    fireEvent.click(screen.getByRole('button', { name: 'HOLD' }));

    expect(onSubmit).toHaveBeenCalledWith('Waiting for requester');
  });
});
