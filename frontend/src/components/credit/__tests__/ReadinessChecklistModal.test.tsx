import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ReadinessChecklistModal from '../ReadinessChecklistModal';

const COMPLETE_PHASES = {
  s1: 'complete',
  s2: 'complete',
  s3: 'complete',
  s4: 'complete',
  s5: 'complete',
  s6: 'optional',
  s7: 'incomplete',
  meta: 'optional',
} as const;

const INCOMPLETE_PHASES = {
  s1: 'incomplete',
  s2: 'complete',
  s3: 'incomplete',
  s4: 'complete',
  s5: 'complete',
  s6: 'optional',
  s7: 'incomplete',
  meta: 'optional',
} as const;

describe('ReadinessChecklistModal', () => {
  it('shows an active submit button when all required sections are complete', () => {
    const onSubmit = vi.fn();

    render(
      <ReadinessChecklistModal
        open
        onClose={vi.fn()}
        phaseCompletion={COMPLETE_PHASES}
        onSubmitAnyway={onSubmit}
        onNavigateToSection={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /submit for review/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables submit when required sections are incomplete', () => {
    const onSubmit = vi.fn();

    render(
      <ReadinessChecklistModal
        open
        onClose={vi.fn()}
        phaseCompletion={INCOMPLETE_PHASES}
        onSubmitAnyway={onSubmit}
        onNavigateToSection={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /complete sections to submit/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Complete 2 required sections before submitting');

    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(
      <ReadinessChecklistModal
        open={false}
        onClose={vi.fn()}
        phaseCompletion={COMPLETE_PHASES}
        onSubmitAnyway={vi.fn()}
        onNavigateToSection={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
