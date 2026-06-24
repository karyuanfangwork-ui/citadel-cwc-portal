jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { creditScoreRun: { findFirst: jest.fn() } },
}));

import { getApplicationEffectiveRating } from '../applicationRating.service';
import prisma from '../../../utils/prisma';

describe('getApplicationEffectiveRating', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the latest score run rating', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({ riskRating: 'BBB' });
    expect(await getApplicationEffectiveRating('app-1')).toBe('BBB');
  });

  it('returns NR when no score run exists', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue(null);
    expect(await getApplicationEffectiveRating('app-1')).toBe('NR');
  });

  it('queries with orderBy runAt desc to get the most recent run', async () => {
    (prisma.creditScoreRun.findFirst as jest.Mock).mockResolvedValue({ riskRating: 'A' });
    await getApplicationEffectiveRating('app-2');
    const call = (prisma.creditScoreRun.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ applicationId: 'app-2' });
    expect(call.orderBy).toEqual({ runAt: 'desc' });
  });
});