import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReadinessChecklistModal from '../../ReadinessChecklistModal';

const phaseCompletion = {
  s1: 'complete' as const,
  s2: 'complete' as const,
  s3: 'complete' as const,
  s4: 'complete' as const,
  s5: 'complete' as const,
};

describe('ReadinessChecklistModal', () => {
  it('fails closed when the server readiness response is unavailable', () => {
    render(
      <ReadinessChecklistModal
        open
        onClose={vi.fn()}
        phaseCompletion={phaseCompletion}
        onSubmitAnyway={vi.fn()}
        onNavigateToSection={vi.fn()}
      />,
    );

    expect(screen.getByText(/checking server submission readiness/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve submission requirements/i })).toBeDisabled();
  });

  it('uses server blockers and navigates to the blocker destination', () => {
    const onNavigateToSection = vi.fn();
    const onSubmitAnyway = vi.fn();

    render(
      <ReadinessChecklistModal
        open
        onClose={vi.fn()}
        phaseCompletion={phaseCompletion}
        onSubmitAnyway={onSubmitAnyway}
        onNavigateToSection={onNavigateToSection}
        readiness={{
          ready: false,
          errors: [{ field: 'purpose', message: 'Loan purpose is required before submission', severity: 'error', tab: 'application-details' }],
          warnings: [{ field: 'documents', message: 'Document review may be delayed', severity: 'warning', tab: 'documents' }],
          satisfied: [{ field: 'borrower', message: 'Borrower is present', severity: 'info' }],
        }}
      />,
    );

    expect(screen.getByText(/1 server requirement blocking submission/i)).toBeInTheDocument();
    expect(screen.getByText(/loan purpose is required/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to section/i }));
    expect(onNavigateToSection).toHaveBeenCalledWith('application-details');
    expect(screen.getByRole('button', { name: /resolve submission requirements/i })).toBeDisabled();
    expect(onSubmitAnyway).not.toHaveBeenCalled();
  });

  it('allows submission only when the server reports ready', () => {
    const onSubmitAnyway = vi.fn();

    render(
      <ReadinessChecklistModal
        open
        onClose={vi.fn()}
        phaseCompletion={{}}
        onSubmitAnyway={onSubmitAnyway}
        onNavigateToSection={vi.fn()}
        readiness={{ ready: true, errors: [], warnings: [{ field: 'documents', message: 'Review may be delayed', severity: 'warning' }], satisfied: [] }}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /submit for review/i });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);
    expect(onSubmitAnyway).toHaveBeenCalledTimes(1);
  });
});
