jest.mock('../../../config', () => ({ config: { env: 'production' } }));
jest.mock('../ratingBand.service', () => ({
  resolveScoreToRatingWithVersion: jest.fn(),
}));

import { RatingBandsUnconfiguredError, resolveRatingOrFail } from '../ratingResolution.service';
import { resolveScoreToRatingWithVersion } from '../ratingBand.service';

describe('score rating resolution governance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fails closed in production when no active rating-band set exists', async () => {
    (resolveScoreToRatingWithVersion as jest.Mock).mockResolvedValue({ rating: null, version: null });

    await expect(resolveRatingOrFail(75, { scope: 'APPLICATION', subjectId: 'app-1' }))
      .rejects.toMatchObject({
        name: 'RatingBandsUnconfiguredError',
        scope: 'APPLICATION',
        subjectId: 'app-1',
      } satisfies Partial<RatingBandsUnconfiguredError>);
  });

  it('returns the exact rating-band version used without a static fallback', async () => {
    (resolveScoreToRatingWithVersion as jest.Mock).mockResolvedValue({ rating: 'BBB', version: 7 });

    await expect(resolveRatingOrFail(68, { scope: 'BORROWER', subjectId: 'borrower-1' })).resolves.toEqual({
      rating: 'BBB',
      ratingBandVersion: 7,
      usedFallback: false,
    });
  });
});
