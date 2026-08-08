import {
  validateRecommendationDraft,
  canEditRecommendation,
  canSubmitRecommendation,
  RATIONALE_MIN_LENGTH,
} from '../recommendationRules';
import type { CreditRecommendation } from '@/src/services/credit.service';

const AUTHOR = 'author-1';
const OTHER = 'other-1';
const LONG_RATIONALE = 'DSCR of 1.8x and stable three-year revenue support the facility.';

function rec(overrides: Partial<CreditRecommendation> = {}): CreditRecommendation {
  return {
    id: 'r1',
    applicationId: 'a1',
    authorId: AUTHOR,
    recommendationType: 'APPROVE',
    status: 'DRAFT',
    createdAt: '2026-08-08T00:00:00Z',
    updatedAt: '2026-08-08T00:00:00Z',
    ...overrides,
  } as CreditRecommendation;
}

describe('validateRecommendationDraft', () => {
  it('requires a recommendation type', () => {
    expect(validateRecommendationDraft({ rationale: LONG_RATIONALE } as never)).toMatch(/type/i);
  });

  it('requires a rationale of at least RATIONALE_MIN_LENGTH characters', () => {
    const msg = validateRecommendationDraft({ recommendationType: 'APPROVE', rationale: 'too short' });
    expect(msg).toMatch(new RegExp(String(RATIONALE_MIN_LENGTH)));
  });

  it('requires conditions text for a CONDITIONAL recommendation', () => {
    expect(
      validateRecommendationDraft({ recommendationType: 'CONDITIONAL', rationale: LONG_RATIONALE }),
    ).toMatch(/condition/i);
  });

  it('rejects a non-positive recommended amount', () => {
    expect(
      validateRecommendationDraft({ recommendationType: 'APPROVE', rationale: LONG_RATIONALE, recommendedAmount: 0 }),
    ).toMatch(/amount/i);
  });

  it('accepts a complete APPROVE draft', () => {
    expect(
      validateRecommendationDraft({ recommendationType: 'APPROVE', rationale: LONG_RATIONALE, recommendedAmount: 250000 }),
    ).toBeNull();
  });

  it('accepts a complete CONDITIONAL draft', () => {
    expect(
      validateRecommendationDraft({
        recommendationType: 'CONDITIONAL',
        rationale: LONG_RATIONALE,
        conditions: 'Valuation report to be provided before drawdown.',
      }),
    ).toBeNull();
  });
});

describe('canEditRecommendation / canSubmitRecommendation', () => {
  it('lets the author edit and submit their own draft', () => {
    expect(canEditRecommendation(rec(), AUTHOR)).toBe(true);
    expect(canSubmitRecommendation(rec(), AUTHOR)).toBe(true);
  });

  it('does not let a non-author edit or submit a draft', () => {
    expect(canEditRecommendation(rec(), OTHER)).toBe(false);
    expect(canSubmitRecommendation(rec(), OTHER)).toBe(false);
  });

  it.each(['SUBMITTED', 'ACKNOWLEDGED', 'SUPERSEDED'] as const)(
    'treats a %s recommendation as immutable',
    (status) => {
      expect(canEditRecommendation(rec({ status }), AUTHOR)).toBe(false);
      expect(canSubmitRecommendation(rec({ status }), AUTHOR)).toBe(false);
    },
  );

  it('handles the no-recommendation-yet case', () => {
    expect(canEditRecommendation(null, AUTHOR)).toBe(false);
    expect(canSubmitRecommendation(null, AUTHOR)).toBe(false);
  });
});