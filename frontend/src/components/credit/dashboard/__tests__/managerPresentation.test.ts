import { describe, expect, it } from 'vitest';
import { buildPipelineStages, formatActivityAction, formatPipelineState } from '../managerPresentation';

describe('manager dashboard presentation', () => {
  it('maps workflow states to user-facing labels', () => {
    expect(formatPipelineState('KYC_REVIEW')).toBe('Verification review');
    expect(formatPipelineState('CREDIT_ASSESSMENT')).toBe('Credit assessment');
    expect(formatPipelineState('REFERRED_BACK')).toBe('Returned for updates');
  });

  it('formats backend activity actions as readable past-tense labels', () => {
    expect(formatActivityAction('start_condition_fulfilment')).toBe('Started condition fulfilment');
    expect(formatActivityAction('submit_to_committee')).toBe('Submitted to committee');
    expect(formatActivityAction('approve_kyc')).toBe('Approved KYC');
    expect(formatActivityAction('Advance')).toBe('Advanced application');
  });

  it('builds exactly the five manager stages plus Other with weighted ages', () => {
    const result = buildPipelineStages([
      { state: 'DRAFT', count: 2, avgDaysInState: 2 },
      { state: 'SUBMITTED', count: 3, avgDaysInState: 4 },
      { state: 'KYC_REVIEW', count: 4, avgDaysInState: 1 },
      { state: 'KYC_APPROVED', count: 1 },
      { state: 'COMPLIANCE_HOLD', count: 2, avgDaysInState: 4 },
      { state: 'UNDERWRITING', count: 1, avgDaysInState: 10 },
      { state: 'CREDIT_ASSESSMENT', count: 3, avgDaysInState: 2 },
      { state: 'COMMITTEE_REVIEW', count: 2 },
      { state: 'APPROVED', count: 5, avgDaysInState: 5 },
      { state: 'OFFER', count: 2, avgDaysInState: 1 },
      { state: 'ACCEPTED', count: 1 },
      { state: 'REFERRED_BACK', count: 1, avgDaysInState: 3 },
      { state: 'REJECTED', count: 1 },
      { state: 'WITHDRAWN', count: 2, avgDaysInState: 2 },
      { state: 'DISBURSED', count: 1, avgDaysInState: 8 },
      { state: 'ACTIVE', count: 3, avgDaysInState: 2 },
      { state: 'CLOSED', count: 4 },
      { state: 'MANUAL_REVIEW', count: 4, avgDaysInState: 6 },
      { state: 'UNTRACKED', count: 2 },
    ]);

    expect(result).toEqual([
      { key: 'intake', label: 'Intake', count: 5, avgDaysInState: 3.2 },
      { key: 'verification', label: 'Verification', count: 7, avgDaysInState: 2 },
      { key: 'assessment', label: 'Assessment', count: 6, avgDaysInState: 4 },
      { key: 'decision', label: 'Decision', count: 12, avgDaysInState: 3.4 },
      { key: 'portfolio', label: 'Portfolio', count: 8, avgDaysInState: 3.5 },
      { key: 'other', label: 'Other', count: 6, avgDaysInState: 6 },
    ]);
  });
});
