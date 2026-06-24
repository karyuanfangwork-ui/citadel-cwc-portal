jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScorecardVersion: { findUnique: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { scorecardService } from '../scorecard.service';
import prisma from '../../../utils/prisma';

describe('activateVersion ambiguity guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects activation when a different scorecard is already active', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'v2', scorecardId: 'sc-B',
    });
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue({
      id: 'v1', scorecardId: 'sc-A',
    });
    await expect(scorecardService.activateVersion('v2')).rejects.toThrow(
      /already has an active version/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows activation when the only active version belongs to the same scorecard', async () => {
    // The guard query is `scorecardId: { not: version.scorecardId }`, so an
    // active version of the SAME scorecard does not appear in findFirst.
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'v2', scorecardId: 'sc-A',
    });
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue(null);
    const txResult = { id: 'v2', isActive: true };
    (prisma.$transaction as jest.Mock).mockResolvedValue(txResult);

    await expect(scorecardService.activateVersion('v2')).resolves.toBe(txResult);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('allows activation when no other active version exists', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'v2', scorecardId: 'sc-A',
    });
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue(null);
    const txResult = { id: 'v2', isActive: true };
    (prisma.$transaction as jest.Mock).mockResolvedValue(txResult);

    await expect(scorecardService.activateVersion('v2')).resolves.toBe(txResult);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws 404 when the version is not found', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(scorecardService.activateVersion('missing')).rejects.toThrow(
      /not found/i,
    );
  });
});