jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    ratingBandConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createMany: jest.fn().mockResolvedValue({ count: 10 }),
    },
  },
}));

import { getActiveRatingBands, mapScoreToRatingFromBands, seedDefaultRatingBands } from '../ratingBand.service';
import { mapTotalScoreToRiskRating } from '../scoring.service';
import prisma from '../../../utils/prisma';

describe('RatingBandConfig fallback parity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('falls back to hardcoded bands when no DB bands exist', async () => {
    (prisma.ratingBandConfig.findMany as jest.Mock).mockResolvedValue([]);
    const bands = await getActiveRatingBands();
    expect(bands.length).toBe(10);
    expect(bands[0]).toMatchObject({ scoreMin: 85, rating: 'AAA' });
  });

  it.each([
    [90, 'AAA'], [85, 'AAA'], [80, 'AA'], [78, 'AA'], [75, 'A'], [70, 'A'],
    [62, 'BBB'], [55, 'BB'], [48, 'B'], [40, 'CCC'], [30, 'CC'], [20, 'C'], [10, 'D'], [0, 'D'],
  ])('returns null on empty config (caller falls back) for score %i', async (score, expected) => {
    (prisma.ratingBandConfig.findMany as jest.Mock).mockResolvedValue([]);
    expect(await mapScoreToRatingFromBands(score)).toBeNull();
    // Caller falls back to the hardcoded map
    expect(mapTotalScoreToRiskRating(score)).toBe(expected);
  });

  it('uses DB bands when they exist', async () => {
    (prisma.ratingBandConfig.findMany as jest.Mock).mockResolvedValue([
      { scoreMin: 90, scoreMax: 100, rating: 'AAA', riskCategory: 'LOW', version: 1 },
      { scoreMin: 80, scoreMax: 89, rating: 'AA', riskCategory: 'LOW', version: 1 },
      { scoreMin: 0, scoreMax: 79, rating: 'BBB', riskCategory: 'MODERATE', version: 1 },
    ]);
    expect(await mapScoreToRatingFromBands(95)).toBe('AAA');
    expect(await mapScoreToRatingFromBands(85)).toBe('AA');
    expect(await mapScoreToRatingFromBands(50)).toBe('BBB');
  });
});

describe('seedDefaultRatingBands', () => {
  beforeEach(() => jest.clearAllMocks());

  it('seeds 10 bands when none exist', async () => {
    (prisma.ratingBandConfig.count as jest.Mock).mockResolvedValue(0);
    await seedDefaultRatingBands('u-1');
    expect(prisma.ratingBandConfig.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ scoreMin: 85, rating: 'AAA' }),
          expect.objectContaining({ scoreMin: 0, rating: 'D' }),
        ]),
      }),
    );
  });

  it('skips seeding when bands already exist', async () => {
    (prisma.ratingBandConfig.count as jest.Mock).mockResolvedValue(10);
    await seedDefaultRatingBands();
    expect(prisma.ratingBandConfig.createMany).not.toHaveBeenCalled();
  });
});