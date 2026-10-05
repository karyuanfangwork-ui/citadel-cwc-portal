jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    creditScorecard: { findUnique: jest.fn() },
    creditScorecardVersion: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  mockPrisma.$transaction = jest.fn(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../../../services/platformAuditChain.service', () => ({
  PlatformAuditChainService: { appendEvent: jest.fn().mockResolvedValue('audit-1') },
}));

import prisma from '../../../utils/prisma';
import { PlatformAuditChainService } from '../../../services/platformAuditChain.service';
import { scorecardService } from '../scorecard.service';

const weights = {
  financial_performance: 100,
  leverage: 0,
  liquidity: 0,
  cashflow: 0,
  management: 0,
  industry: 0,
  collateral: 0,
  relationship: 0,
  market_conditions: 0,
};
const context = {
  tenantId: 'tenant-1',
  actorId: 'maker-1',
  actorEmail: 'maker@example.test',
  correlationId: 'corr-1',
};
const proposal = {
  factorWeights: weights,
  retailFactorWeights: weights,
  changeReason: 'Policy review proposal',
};

describe('scorecard version creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  it('requires valid maps, a human actor, and a change reason before creating a draft', async () => {
    await expect(scorecardService.createVersion('scorecard-1', {
      ...proposal,
      changeReason: '   ',
    }, context)).rejects.toThrow(/change reason/i);
    await expect(scorecardService.createVersion('scorecard-1', {
      ...proposal,
      factorWeights: { ...weights, unexpected: 1 } as any,
    }, context)).rejects.toThrow(/unsupported factor weight keys/i);
    await expect(scorecardService.createVersion('scorecard-1', proposal, {
      tenantId: 'tenant-1', actorId: '', actorEmail: '',
    })).rejects.toThrow(/authenticated actor context/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a human-attributed DRAFT and audit event in the same transaction', async () => {
    (prisma.creditScorecard.findUnique as jest.Mock).mockResolvedValue({ id: 'scorecard-1', productType: null });
    (prisma.creditScorecardVersion.findFirst as jest.Mock).mockResolvedValue({ version: 4 });
    const created = {
      id: 'version-5', scorecardId: 'scorecard-1', version: 5,
      createdById: 'maker-1', changeReason: proposal.changeReason,
      isActive: false, approvedById: null,
    };
    (prisma.creditScorecardVersion.create as jest.Mock).mockResolvedValue(created);

    const result = await scorecardService.createVersion('scorecard-1', proposal, context);

    expect(result).toEqual(created);
    expect(prisma.creditScorecardVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: 5,
        createdById: 'maker-1',
        changeReason: 'Policy review proposal',
      }),
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      actorId: 'maker-1',
      action: 'SCORECARD_VERSION_CREATED',
      resourceId: 'version-5',
      newValues: expect.objectContaining({ factorWeights: weights, retailFactorWeights: weights }),
    }), prisma);
  });
});
