jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditScorecardVersion: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

const context = { tenantId: 'tenant-1', actorId: 'approver-2', actorEmail: 'approver@example.test' };


describe('scorecard version approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  it('returns not found when the version does not exist', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(scorecardService.approveVersion('missing', 'approver-1', context)).rejects.toThrow(
      /not found/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects approval of an active version', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1', isActive: true, approvedById: 'approver-1',
    });

    await expect(scorecardService.approveVersion('version-1', 'approver-2', context)).rejects.toThrow(
      /active.*cannot be approved/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects approval when the version is already approved', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1', isActive: false, approvedById: 'approver-1',
    });

    await expect(scorecardService.approveVersion('version-1', 'approver-2', context)).rejects.toThrow(
      /already approved/i,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects self-approval and blocks legacy versions without maker attribution', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'version-1', isActive: false, approvedById: null, approvedAt: null, createdById: 'approver-2',
    });
    await expect(scorecardService.approveVersion('version-1', 'approver-2', context)).rejects.toThrow(/distinct from its creator/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'legacy-v1', isActive: false, approvedById: null, approvedAt: null, createdById: null,
    });
    await expect(scorecardService.approveVersion('legacy-v1', 'approver-2', context)).rejects.toThrow(/no verified maker/i);
    expect(prisma.creditScorecardVersion.updateMany).not.toHaveBeenCalled();
  });

  it('does not audit when the optimistic approval transition loses a race', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1', scorecardId: 'scorecard-1', version: 2,
      createdById: 'maker-1', isActive: false, approvedById: null, approvedAt: null,
    });
    (prisma.creditScorecardVersion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(scorecardService.approveVersion('version-1', 'approver-2', context)).rejects.toThrow(/changed concurrently/i);
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('records the authenticated approver and audit event for a draft', async () => {
    const draft = {
      id: 'version-1',
      scorecardId: 'scorecard-1',
      version: 1,
      createdById: 'maker-1',
      isActive: false,
      approvedById: null,
      approvedAt: null,
    };
    const approved = { ...draft, approvedById: 'approver-2', approvedAt: new Date() };
    (prisma.creditScorecardVersion.findUnique as jest.Mock)
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(approved);
    (prisma.creditScorecardVersion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await scorecardService.approveVersion('version-1', 'approver-2', context);

    expect(result).toEqual(approved);
    expect(prisma.creditScorecardVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'version-1', approvedById: null, createdById: { not: 'approver-2' } }),
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
