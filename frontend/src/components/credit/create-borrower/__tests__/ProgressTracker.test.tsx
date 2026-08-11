import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressTracker, { STEPS } from '../ProgressTracker';

describe('borrower creation six-stage journey', () => {
  it('exposes the approved six stage labels', () => {
    render(<ProgressTracker currentStep={0} completedSteps={new Set()} onStepClick={() => undefined} />);
    expect(STEPS).toHaveLength(6);
    expect(screen.getByText('Identity Check')).toBeInTheDocument();
    expect(screen.getByText('Borrower Details')).toBeInTheDocument();
    expect(screen.getByText('Contact & Address')).toBeInTheDocument();
    expect(screen.getByText('Financial Profile')).toBeInTheDocument();
    expect(screen.getByText('KYC & Compliance')).toBeInTheDocument();
    expect(screen.getByText('Review & Create')).toBeInTheDocument();
    expect(screen.queryByText('Skip & Proceed')).not.toBeInTheDocument();
  });
});
