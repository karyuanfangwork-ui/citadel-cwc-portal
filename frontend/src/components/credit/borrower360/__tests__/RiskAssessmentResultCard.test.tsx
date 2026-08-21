import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RiskAssessmentResultCard from '../RiskAssessmentResultCard';
import type { BorrowerRiskAssessment } from '../../../../services/credit.service';

const assessment: BorrowerRiskAssessment = {
  ratingStatus: 'INCOMPLETE',
  effectiveRating: 'D',
  baseRating: 'B',
  score: 32.5,
  scorecardVersion: 4,
  calculatedAt: '2026-08-21T10:00:00.000Z',
  missingInputs: [{
    code: 'bureau_score',
    title: 'Bureau score missing',
    description: 'A current bureau score is required.',
    target: 'bureau',
    actionLabel: 'Upload bureau report',
  }],
  reasonCodes: [],
  bureauCaps: [],
  nextAction: { target: 'bureau', label: 'Upload bureau report' },
  applicationImpact: 'ALLOWED',
  assessmentImpact: 'INCOMPLETE',
};

describe('RiskAssessmentResultCard', () => {
  it('anchors the rating status and exposes a bureau remediation action', () => {
    const onAction = vi.fn();
    render(<RiskAssessmentResultCard assessment={assessment} canWrite recalculating={false} onRecalculate={vi.fn()} onAction={onAction} />);

    expect(screen.getByRole('heading', { name: 'DIncomplete' })).toBeInTheDocument();
    expect(screen.getAllByText('Incomplete')).toHaveLength(2);
    expect(screen.getByText(/not decision-ready/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload bureau report' })).toBeInTheDocument();
    expect(screen.queryByText('bureau_score')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload bureau report' }));
    expect(onAction).toHaveBeenCalledWith('bureau');
  });

  it('keeps recalculation failures visible and marks the previous result stale', () => {
    render(<RiskAssessmentResultCard assessment={assessment} canWrite recalculating={false} recalculationError="Service unavailable" onRecalculate={vi.fn()} onAction={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent(/previous result remains visible/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
