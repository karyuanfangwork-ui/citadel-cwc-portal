import { describe, expect, it } from 'vitest';
import { STEPS } from '../../../components/credit/new-application/step-config';

describe('application creation wizard contract', () => {
  it('uses the five-step draft creation journey', () => {
    expect(STEPS.map((step) => step.key)).toEqual(['borrower', 'loan-request', 'facility', 'assignment', 'review']);
    expect(STEPS.map((step) => step.title)).toEqual(['Borrower', 'Loan Request', 'Facility', 'Assignment', 'Review']);
  });

  it('keeps later-stage financials and documents outside the creation minimum', () => {
    expect(STEPS.map((step) => step.key)).not.toContain('financial-information');
    expect(STEPS.map((step) => step.key)).not.toContain('documents');
  });
});
