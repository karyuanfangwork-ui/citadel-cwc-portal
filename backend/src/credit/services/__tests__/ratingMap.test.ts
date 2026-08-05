import { mapTotalScoreToRiskRating } from '../scoring.service';
import { scoreToRating } from '../../types/credit.types';

describe('canonical rating map', () => {
  it.each([
    [90, 'AAA'], [85, 'AAA'], [80, 'AA'], [78, 'AA'], [75, 'A'], [70, 'A'],
    [62, 'BBB'], [55, 'BB'], [48, 'B'], [40, 'CCC'], [30, 'CC'], [20, 'C'], [10, 'D'], [0, 'D'],
  ])('score %i maps to %s', (score, rating) => {
    expect(mapTotalScoreToRiskRating(score)).toBe(rating);
  });

  it('credit.types scoreToRating delegates to the canonical map (no divergence)', () => {
    for (let s = 0; s <= 100; s++) {
      expect(scoreToRating(s)).toBe(mapTotalScoreToRiskRating(s));
    }
  });
});