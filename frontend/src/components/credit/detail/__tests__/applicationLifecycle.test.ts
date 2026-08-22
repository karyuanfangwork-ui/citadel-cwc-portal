import { describe, expect, it } from 'vitest';
import {
  APPLICATION_LIFECYCLE_STAGES,
  getApplicationLifecycleState,
  getJourneyStage,
} from '../../../../../pages/credit/creditUtils';

describe('application lifecycle presentation', () => {
  it('exposes business-facing lifecycle stages without internal S1-S7 labels', () => {
    expect(APPLICATION_LIFECYCLE_STAGES.map(stage => stage.label)).toEqual([
      'Application',
      'Underwriting',
      'Credit Assessment',
      'Committee Review',
      'Approval',
      'Conditions / Offer',
      'Completion',
    ]);
    expect(APPLICATION_LIFECYCLE_STAGES.every(stage => !/^S\d/.test(stage.label))).toBe(true);
  });

  it.each([
    ['DRAFT', 'application', 'current'],
    ['UNDERWRITING', 'underwriting', 'current'],
    ['CREDIT_ASSESSMENT', 'credit-assessment', 'current'],
    ['COMMITTEE_REVIEW', 'committee-review', 'current'],
    ['APPROVED', 'approval', 'current'],
    ['CONDITION_FULFILMENT', 'conditions-offer', 'current'],
    ['OFFER', 'conditions-offer', 'current'],
    ['ACCEPTED', 'completion', 'current'],
    ['DISBURSED', 'completion', 'current'],
    ['ACTIVE', 'completion', 'current'],
    ['CLOSED', 'completion', 'complete'],
  ] as const)('maps %s to %s with %s status', (state, stage, status) => {
    const result = getApplicationLifecycleState(state);
    expect(result.stage.key).toBe(stage);
    expect(result.status).toBe(status);
  });

  it.each([
    ['COMPLIANCE_HOLD', 'on-hold'],
    ['REFERRED_BACK', 'returned'],
    ['REJECTED', 'rejected'],
    ['WITHDRAWN', 'withdrawn'],
  ] as const)('marks %s as a special lifecycle state', (state, status) => {
    const result = getApplicationLifecycleState(state);
    expect(result.status).toBe(status);
    expect(result.explanation).toBeTruthy();
    expect(result.isException).toBe(true);
  });

  it('keeps the existing journey-index caller contract aligned to the lifecycle model', () => {
    expect(getJourneyStage('CREDIT_ASSESSMENT')).toBe(2);
    expect(getJourneyStage('COMMITTEE_REVIEW')).toBe(3);
    expect(getJourneyStage('ACCEPTED')).toBe(6);
  });
});
