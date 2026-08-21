import { describe, expect, it } from '@jest/globals';
import { getExposureStatus } from '../services/borrowerExposurePresentation.service';

describe('borrower exposure presentation status', () => {
  it('distinguishes zero exposure from an unconfigured limit', () => {
    expect(getExposureStatus(0, null, null)).toBe('NO_EXPOSURE');
    expect(getExposureStatus(100, null, null)).toBe('LIMIT_NOT_CONFIGURED');
  });

  it('maps configured utilization to within, approaching, and breached states', () => {
    expect(getExposureStatus(100, 200, 50)).toBe('WITHIN_LIMIT');
    expect(getExposureStatus(160, 200, 80)).toBe('APPROACHING_LIMIT');
    expect(getExposureStatus(201, 200, 100.5)).toBe('LIMIT_BREACHED');
  });
});
