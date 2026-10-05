import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowActionModal from '../WorkflowActionModal';
import type { WorkflowModalConfig } from '../../../utils/workflowModalConfig';

vi.mock('../../ModalWrapper', () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? <div><h1>{title}</h1>{children}</div> : null,
}));

describe('WorkflowActionModal error reporting', () => {
  it('shows the server message when an API error has no error property', async () => {
    const config: WorkflowModalConfig = {
      title: 'CEO Decision',
      fields: [{
        name: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        defaultValue: 'APPROVE',
        options: [{ value: 'APPROVE', label: 'Approve' }],
      }],
      submitLabel: 'Submit Decision',
      submitColor: 'primary',
      onSubmit: vi.fn().mockRejectedValue({
        response: { data: { message: 'Insufficient permissions' } },
      }),
    };

    render(
      <WorkflowActionModal
        open
        requestId="request-1"
        config={config}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Decision' }));

    expect(await screen.findByText('Insufficient permissions')).toBeTruthy();
  });
});
