/**
 * The override paths and the approval matrix must agree on notch distance.
 */
import { calculateNotchDelta } from '../scoreOverride.service';
import { ratingToOrdinal } from '../approvalMatrix.service';
import { notchDelta, ratingOrdinal, MATERIAL_OVERRIDE_NOTCHES } from '../ratingScale';
import { RiskRating } from '@prisma/client';

const ALL = Object.values(RiskRating) as string[];

describe('notch delta consistency', () => {
  it('calculateNotchDelta agrees with the canonical scale for every rating pair', () => {
    for (const a of ALL) {
      for (const b of ALL) {
        expect(calculateNotchDelta(a, b)).toBe(notchDelta(a, b));
      }
    }
  });

  it('ratingToOrdinal agrees with the canonical scale', () => {
    for (const r of ALL) {
      expect(ratingToOrdinal(r)).toBe(ratingOrdinal(r));
    }
  });

  it('treats adjacent real grades as one notch, not two', () => {
    // The old 20-notch scale made AAA->AA a Delta2 (dual approval) because it
    // reserved ordinals for modifier grades the system never issues.
    expect(calculateNotchDelta('AAA', 'AA')).toBe(1);
  });

  it('computes a real delta for grades the old scale did not know', () => {
    // CC, C and NR were absent from the old RATING_SCALE, so every comparison
    // involving them silently returned exactly the dual-approval threshold.
    expect(calculateNotchDelta('CC', 'C')).toBe(1);
    expect(calculateNotchDelta('CC', 'D')).toBe(2);
  });

  it('still fails safe for an unparseable rating', () => {
    expect(calculateNotchDelta('AA+', 'AAA')).toBeGreaterThanOrEqual(MATERIAL_OVERRIDE_NOTCHES);
  });
});