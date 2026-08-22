import { describe, expect, it } from 'vitest';
import { resolveWorkspaceLocationFromQuery } from '../applicationWorkspaceAreas';

describe('CreditApplicationDetail Phase 4 area-first destinations', () => {
  it('dispatches Area 5 recommendation before the legacy approvals renderer', () => {
    expect(resolveWorkspaceLocationFromQuery('approvals', 'assessment-recommendation')).toMatchObject({
      area: 'assessment-recommendation',
      tab: 'approvals',
      localTab: 'recommendation',
    });
  });

  it('dispatches Area 6 approvals independently from Area 5 recommendation', () => {
    expect(resolveWorkspaceLocationFromQuery('approvals', 'decision-completion')).toMatchObject({
      area: 'decision-completion',
      tab: 'approvals',
      localTab: 'approvals',
    });
  });

  it('keeps tab-only approvals compatible with the decision area', () => {
    expect(resolveWorkspaceLocationFromQuery('approvals', null).area).toBe('decision-completion');
  });
});
