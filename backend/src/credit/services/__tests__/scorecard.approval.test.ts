jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScorecardVersion: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../services/platformAuditChain.service', () => ({
  PlatformAuditChainService: {
    appendEvent: jest.fn().mockResolvedValue('audit-1'),
  },
}));

import prisma from '../../../utils/prisma';
import { PlatformAuditChainService } from '../../../services/platformAuditChain.service';
import { scorecardService } from '../scorecard.service';

describe('scorecard version approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  it('returns not found when the version does not exist', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(scorecardService.approveVersion('missing', 'approver-1')).rejects.toThrow(
      /not found/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects approval of an active version', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1', isActive: true, approvedById: 'approver-1',
    });

    await expect(scorecardService.approveVersion('version-1', 'approver-2')).rejects.toThrow(
      /active.*cannot be approved/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects approval when the version is already approved', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1', isActive: false, approvedById: 'approver-1',
    });

    await expect(scorecardService.approveVersion('version-1', 'approver-2')).rejects.toThrow(
      /already approved/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records the authenticated approver and audit event for a draft', async () => {
    const draft = {
      id: 'version-1',
      scorecardId: 'scorecard-1',
      version: 1,
      isActive: false,
      approvedById: null,
      approvedAt: null,
    };
    const approved = { ...draft, approvedById: 'approver-2', approvedAt: new Date() };
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.creditScorecardVersion.update as jest.Mock).mockResolvedValue(approved);

    const result = await scorecardService.approveVersion('version-1', 'approver-2', {
      tenantId: 'tenant-1',
      actorEmail: 'approver@example.test',
    });

    expect(result).toBe(approved);
    expect(prisma.creditScorecardVersion.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'version-1' },
      data: { approvedById: 'approver-2', approvedAt: expect.any(Date) },
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorId: 'approver-2',
        action: 'SCORECARD_VERSION_APPROVED',
        resourceId: 'version-1',
      }),
      prisma,
    );
  });
});
