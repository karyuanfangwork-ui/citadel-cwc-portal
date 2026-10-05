jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    creditScorecardVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    creditScorecard: { update: jest.fn() },
    $queryRaw: jest.fn(),
  };
  mockPrisma.$transaction = jest.fn(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../../../services/platformAuditChain.service', () => ({
  PlatformAuditChainService: { appendEvent: jest.fn().mockResolvedValue('audit-1') },
}));

import { scorecardService } from '../scorecard.service';
import prisma from '../../../utils/prisma';
import { PlatformAuditChainService } from '../../../services/platformAuditChain.service';

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
const context = { tenantId: 'tenant-1', actorId: 'operator-1', actorEmail: 'operator@example.test' };
const policyApproval = { policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: true as const };
const makeVersion = (overrides: Record<string, unknown> = {}) => ({
  id: 'version-2',
  scorecardId: 'scorecard-a',
  version: 2,
  createdById: 'maker-1',
  approvedById: 'checker-1',
  approvedAt: new Date(Date.now() - 60_000),
  factorWeights: weights,
  retailFactorWeights: weights,
  isActive: false,
  effectiveFrom: new Date(Date.now() - 60_000),
  effectiveTo: null,
  scorecard: { id: 'scorecard-a', name: 'Term Loan', productType: 'TERM_LOAN', isActive: true },
  ...overrides,
});

describe('scorecard version activation governance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditScorecardVersion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.creditScorecard.update as jest.Mock).mockResolvedValue({ id: 'scorecard-a', isActive: true });
  });

  it('requires a policy reference and explicit market_conditions acknowledgment', async () => {
    await expect(scorecardService.activateVersion('version-2', context, {
      policyApprovalReference: '', marketConditionsAcknowledged: true,
    })).rejects.toThrow(/policy-owner approval reference/i);
    await expect(scorecardService.activateVersion('version-2', context, {
      policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: false as true,
    })).rejects.toThrow(/market_conditions treatment/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects legacy, unapproved, self-approved, and non-independent operator attempts', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ createdById: null }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/no verified maker/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ approvedById: null, approvedAt: null }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/must be approved/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ approvedById: 'maker-1' }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/self-approved/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeVersion())
      .mockResolvedValueOnce(makeVersion());
    await expect(scorecardService.activateVersion('version-2', { ...context, actorId: 'maker-1' }, policyApproval)).rejects.toThrow(/distinct from the maker and checker/i);
    await expect(scorecardService.activateVersion('version-2', { ...context, actorId: 'checker-1' }, policyApproval)).rejects.toThrow(/distinct from the maker and checker/i);
  });

  it('rejects future-effective and expired versions', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ effectiveFrom: new Date(Date.now() + 60_000) }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/outside its effective period/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ effectiveTo: new Date(Date.now() - 60_000) }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/outside its effective period/i);
  });

  it('blocks invalid or missing corporate and retail maps before mutation', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ retailFactorWeights: null }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/retail factor map/i);

    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion({ factorWeights: { ...weights, invalid_factor: 5 } }));
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/unsupported factor weight keys/i);
    expect(prisma.creditScorecardVersion.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed on a second active scorecard in the same product scope', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion());
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([{ id: 'active-v1', scorecardId: 'scorecard-other' }]);

    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/active version for this product scope/i);
    expect(prisma.creditScorecardVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        scorecard: { is: { isActive: true, productType: 'TERM_LOAN' } },
      }),
    }));
    expect(prisma.creditScorecardVersion.updateMany).not.toHaveBeenCalled();
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('allows generic and product-specific scopes to have independent active versions', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeVersion())
      .mockResolvedValueOnce(makeVersion({ isActive: true, activatedById: 'operator-1' }));
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await scorecardService.activateVersion('version-2', context, policyApproval);

    expect(result).toMatchObject({ id: 'version-2', isActive: true });
    expect(prisma.creditScorecardVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'version-2', isActive: false, approvedById: 'checker-1' }),
      data: expect.objectContaining({
        isActive: true,
        activatedById: 'operator-1',
        policyApprovalReference: 'POLICY-12345',
        marketConditionsAcknowledged: true,
      }),
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SCORECARD_VERSION_ACTIVATED',
      actorId: 'operator-1',
      newValues: expect.objectContaining({ policyApprovalReference: 'POLICY-12345' }),
    }), prisma);
  });

  it('rejects activation if more than one version in the target scope is already active', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(makeVersion());
    (prisma.creditScorecardVersion.findMany as jest.Mock).mockResolvedValue([
      { id: 'active-v1', scorecardId: 'scorecard-a' },
      { id: 'active-v1b', scorecardId: 'scorecard-a' },
    ]);
    await expect(scorecardService.activateVersion('version-2', context, policyApproval)).rejects.toThrow(/multiple active versions/i);
    expect(prisma.creditScorecardVersion.updateMany).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown version', async () => {
    (prisma.creditScorecardVersion.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(scorecardService.activateVersion('missing', context, policyApproval)).rejects.toThrow(/not found/i);
  });
});
