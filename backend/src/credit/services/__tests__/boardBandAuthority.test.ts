/**
 * LOS-002 — "CC or worse" must require committee/board authority.
 *
 * RATING_ORDER is best-to-worst ascending: AAA=1 ... CC=8, C=9, D=10, NR=11.
 * A higher ordinal is a worse credit, so the board band is `ordinal >= CC`.
 */
import { requiresBoardBandAuthority } from '../approvalAction.service';

const BELOW_THRESHOLD = 1_000_000;   // under the RM5m exposure trigger
const AT_THRESHOLD = 5_000_000;

describe('requiresBoardBandAuthority', () => {
  describe('rating trigger (exposure below threshold)', () => {
    it.each([
      ['AAA', false], ['AA', false], ['A', false], ['BBB', false],
      ['BB', false], ['B', false], ['CCC', false],
      ['CC', true], ['C', true], ['D', true], ['NR', true],
    ])('rating %s -> %s', (rating, expected) => {
      expect(requiresBoardBandAuthority(BELOW_THRESHOLD, rating)).toBe(expected);
    });

    it('treats an unknown rating conservatively as board band', () => {
      expect(requiresBoardBandAuthority(BELOW_THRESHOLD, 'BOGUS')).toBe(true);
    });

    it('treats a null rating conservatively as board band', () => {
      expect(requiresBoardBandAuthority(BELOW_THRESHOLD, null)).toBe(true);
    });
  });

  describe('exposure trigger', () => {
    it('triggers at exactly the RM5m threshold even for the best rating', () => {
      expect(requiresBoardBandAuthority(AT_THRESHOLD, 'AAA')).toBe(true);
    });

    it('does not trigger one ringgit below the threshold for a good rating', () => {
      expect(requiresBoardBandAuthority(AT_THRESHOLD - 1, 'AAA')).toBe(false);
    });

    it('still triggers below the threshold when the rating is adverse', () => {
      expect(requiresBoardBandAuthority(AT_THRESHOLD - 1, 'D')).toBe(true);
    });
  });
});