import { describe, expect, it } from 'vitest';
import { getApplicationStatusPresentation } from '../statusPresentation';

describe('getApplicationStatusPresentation', () => {
  it.each([
    ['DRAFT', 'Draft', 'neutral'],
    ['SUBMITTED', 'Submitted', 'info'],
    ['KYC_REVIEW', 'Under Review', 'info'],
    ['COMPLIANCE_HOLD', 'Information Required', 'warning'],
    ['KYC_APPROVED', 'Ready for Assessment', 'info'],
    ['KYC_REJECTED', 'Returned for Revision', 'warning'],
    ['REFERRED_BACK', 'Returned for Revision', 'warning'],
    ['RETURNED_FOR_REVISION', 'Returned for Revision', 'warning'],
    ['UNDERWRITING', 'Under Assessment', 'info'],
    ['COMMITTEE_REVIEW', 'Pending Approval', 'warning'],
    ['APPROVED', 'Approved', 'success'],
    ['REJECTED', 'Declined', 'danger'],
    ['WITHDRAWN', 'Cancelled', 'neutral'],
    ['CLOSED', 'Closed', 'neutral'],
  ] as const)('maps %s to the approved display vocabulary', (state, label, tone) => {
    expect(getApplicationStatusPresentation(state)).toMatchObject({ label, tone });
    expect(getApplicationStatusPresentation(state).icon).toEqual(expect.any(String));
  });

  it('uses a safe fallback for unknown states', () => {
    expect(getApplicationStatusPresentation('UNKNOWN_STATE')).toMatchObject({
      label: 'Open',
      tone: 'neutral',
    });
  });
});
