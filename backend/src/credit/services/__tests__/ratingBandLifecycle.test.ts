/**
 * LOS-010 — only an ACTIVE band set may affect scoring, and only a DRAFT band
 * may be edited directly.
 */
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { ratingBandConfig: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() } },
}));

import prisma from '../../../utils/prisma';
import {
  ratingBandService,
  EFFECTIVE_BAND_STATUSES,
  MUTABLE_BAND_STATUSES,
} from '../ratingBand.service';

const mocked = prisma as unknown as { ratingBandConfig: { findMany: jest.Mock } };

describe('EFFECTIVE_BAND_STATUSES', () => {
  it('is ACTIVE only', () => {
    expect(EFFECTIVE_BAND_STATUSES).toEqual(['ACTIVE']);
  });

  it('does not include APPROVED', () => {
    // An APPROVED-but-not-yet-activated set must not affect live scoring:
    // activation is the deliberate step that makes a methodology effective.
    expect(EFFECTIVE_BAND_STATUSES).not.toContain('APPROVED');
  });
});

describe('MUTABLE_BAND_STATUSES', () => {
  it('is DRAFT only', () => {
    expect(MUTABLE_BAND_STATUSES).toEqual(['DRAFT']);
  });
});

describe('getActiveRatingBands', () => {
  it('queries only effective statuses', async () => {
    mocked.ratingBandConfig.findMany.mockResolvedValue([]);
    await ratingBandService.getActiveRatingBands();

    const where = mocked.ratingBandConfig.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: EFFECTIVE_BAND_STATUSES });
  });
});