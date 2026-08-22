import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ApplicationJourneyStepper from '../ApplicationJourneyStepper';
import { getApplicationLifecycleState } from '../../../../../pages/credit/creditUtils';

describe('ApplicationJourneyStepper', () => {
  it('renders business lifecycle labels as status rather than S1-S7 navigation', () => {
    render(<ApplicationJourneyStepper lifecycleState={getApplicationLifecycleState('CREDIT_ASSESSMENT')} />);

    expect(screen.getByRole('region', { name: 'Application progress' })).toBeInTheDocument();
    expect(screen.getByText('Application')).toBeInTheDocument();
    expect(screen.getByText('Credit Assessment')).toBeInTheDocument();
    expect(screen.getByText('Conditions / Offer')).toBeInTheDocument();
    expect(screen.queryByText(/^S\d/)).not.toBeInTheDocument();
  });

  it('does not navigate when a lifecycle stage is clicked', () => {
    const onStageClick = vi.fn();
    render(<ApplicationJourneyStepper lifecycleState={getApplicationLifecycleState('CREDIT_ASSESSMENT')} onStageClick={onStageClick} />);

    fireEvent.click(screen.getByText('Application'));
    fireEvent.click(screen.getByText('Committee Review'));
    expect(onStageClick).not.toHaveBeenCalled();
  });

  it('marks the current stage programmatically and explains special states', () => {
    render(<ApplicationJourneyStepper lifecycleState={getApplicationLifecycleState('REFERRED_BACK')} />);

    expect(screen.getByRole('listitem', { name: /Credit Assessment.*returned for rework/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('status')).toHaveTextContent(/Returned for rework/i);
  });
});
