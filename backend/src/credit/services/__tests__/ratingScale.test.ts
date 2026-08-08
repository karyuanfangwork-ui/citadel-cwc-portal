/**
 * One rating scale for the whole credit module.
 *
 * Before this module there were two: a 20-notch scale with modifiers in
 * scoreOverride.service.ts (missing CC, C and NR entirely) and the 11-value
 * RATING_ORDER in approvalMatrix.service.ts that matches the RiskRating enum.
 * They disagreed about what a "2 notch" override was.
 */
import {
  RATING_ORDINALS,
  UNKNOWN_RATING_ORDINAL,
  ratingOrdinal,
  notchDelta,
  isKnownRating,
  MATERIAL_OVERRIDE_NOTCHES,
} from '../ratingScale';
import { RiskRating } from '@prisma/client';

describe('RATING_ORDINALS', () => {
  it('covers every RiskRating enum member', () => {
    for (const member of Object.values(RiskRating)) {
      expect(RATING_ORDINALS[member]).toBeDefined();
    }
  });

  it('orders best to worst ascending', () => {
    expect(RATING_ORDINALS.AAA).toBeLessThan(RATING_ORDINALS.BBB);
    expect(RATING_ORDINALS.BBB).toBeLessThan(RATING_ORDINALS.CC);
    expect(RATING_ORDINALS.CC).toBeLessThan(RATING_ORDINALS.C);
    expect(RATING_ORDINALS.C).toBeLessThan(RATING_ORDINALS.D);
  });

  it('matches the canonical ordering used by the approval matrix', () => {
    expect(RATING_ORDINALS).toMatchObject({
      AAA: 1, AA: 2, A: 3, BBB: 4, BB: 5, B: 6, CCC: 7, CC: 8, C: 9, D: 10, NR: 11,
    });
  });
});

describe('ratingOrdinal', () => {
  it('returns the ordinal for a known rating', () => {
    expect(ratingOrdinal('CC')).toBe(8);
  });

  it.each([null, undefined, '', 'AA+', 'BOGUS'])('returns the unknown sentinel for %s', (input) => {
    expect(ratingOrdinal(input as string)).toBe(UNKNOWN_RATING_ORDINAL);
  });
});

describe('notchDelta', () => {
  it('is one notch between adjacent grades', () => {
    expect(notchDelta('AAA', 'AA')).toBe(1);
    expect(notchDelta('CC', 'C')).toBe(1);
  });

  it('is symmetric', () => {
    expect(notchDelta('BBB', 'B')).toBe(notchDelta('B', 'BBB'));
  });

  it('is zero for the same rating', () => {
    expect(notchDelta('BBB', 'BBB')).toBe(0);
  });

  it('treats an unknown rating as material rather than trivial', () => {
    expect(notchDelta('BOGUS', 'AAA')).toBeGreaterThanOrEqual(MATERIAL_OVERRIDE_NOTCHES);
  });
});

describe('isKnownRating', () => {
  it('accepts enum members and rejects modifier notation', () => {
    expect(isKnownRating('CCC')).toBe(true);
    expect(isKnownRating('CCC+')).toBe(false);
  });
});