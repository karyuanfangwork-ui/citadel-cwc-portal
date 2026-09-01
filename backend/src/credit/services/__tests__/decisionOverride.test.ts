import { deriveOverride } from '../decisionOverride';

describe('deriveOverride', () => {
  it('matches terminal decisions without override', () => {
    expect(deriveOverride('APPROVE', 'APPROVE')).toEqual({ isOverride: false, reasonRequired: false });
    expect(deriveOverride('REJECT', 'REJECT')).toEqual({ isOverride: false, reasonRequired: false });
    expect(deriveOverride('CONDITIONAL', 'CONDITIONAL')).toEqual({ isOverride: false, reasonRequired: false });
  });

  it('flags terminal decisions that depart from the recommendation', () => {
    expect(deriveOverride('REJECT', 'APPROVE')).toEqual({ isOverride: true, reasonRequired: true });
    expect(deriveOverride('APPROVE', 'REJECT')).toEqual({ isOverride: true, reasonRequired: true });
    expect(deriveOverride('APPROVE', 'CONDITIONAL')).toEqual({ isOverride: true, reasonRequired: true });
    expect(deriveOverride('REJECT', 'CONDITIONAL')).toEqual({ isOverride: true, reasonRequired: true });
  });

  it('never flags routing decisions', () => {
    for (const decision of ['RETURN', 'ESCALATE', 'DEFER'] as const) {
      expect(deriveOverride('REJECT', decision)).toEqual({ isOverride: false, reasonRequired: false });
      expect(deriveOverride('APPROVE', decision)).toEqual({ isOverride: false, reasonRequired: false });
    }
  });

  it('does not assert an override without a known recommendation', () => {
    expect(deriveOverride(null, 'APPROVE')).toEqual({ isOverride: false, reasonRequired: false });
    expect(deriveOverride(undefined, 'REJECT')).toEqual({ isOverride: false, reasonRequired: false });
    expect(deriveOverride('', 'REJECT')).toEqual({ isOverride: false, reasonRequired: false });
    expect(deriveOverride('MAYBE', 'APPROVE')).toEqual({ isOverride: false, reasonRequired: false });
  });

  it('normalises recommendation casing and whitespace', () => {
    expect(deriveOverride(' reject ', 'APPROVE')).toEqual({ isOverride: true, reasonRequired: true });
  });
});
