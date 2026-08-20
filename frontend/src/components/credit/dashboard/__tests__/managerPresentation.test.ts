import { describe, expect, it } from 'vitest';
import { buildPipelineStages, formatPipelineState } from '../managerPresentation';

describe('manager dashboard presentation', () => {
  it('maps workflow states to user-facing labels', () => {
    expect(formatPipelineState('KYC_REVIEW')).toBe('Verification review');
    expect(formatPipelineState('CREDIT_ASSESSMENT')).toBe('Credit assessment');
    expect(formatPipelineState('REFERRED_BACK')).toBe('Returned for updates');
  });

  it('groups pipeline states into compact display stages', () => {
    const result = buildPipelineStages([
      { state: 'SUBMITTED', count: 2, avgDaysInState: 1 },
      { state: 'KYC_REVIEW', count: 1, avgDaysInState: 3 },
      { state: 'APPROVED', count: 3, avgDaysInState: 2 },
    ]);

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Submitted', count: 3 }),
      expect.objectContaining({ label: 'Approved', count: 3 }),
    ]));
  });
});
