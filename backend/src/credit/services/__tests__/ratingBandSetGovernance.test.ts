jest.mock('../../../utils/prisma', () => {
  const mockPrisma: any = {
    ratingBandSet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ratingBandConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      createManyAndReturn: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
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
import { ratingBandService } from '../ratingBand.service';

const tx = prisma as any;
const context = { tenantId: 'tenant-1', actorId: 'maker-1', actorEmail: 'maker@example.test' };
const bands = [
  { id: 'b1', scoreMin: 0, scoreMax: 19, rating: 'D', riskCategory: 'PROHIBITED' },
  { id: 'b2', scoreMin: 20, scoreMax: 29, rating: 'C', riskCategory: 'HIGH' },
  { id: 'b3', scoreMin: 30, scoreMax: 39, rating: 'CC', riskCategory: 'HIGH' },
  { id: 'b4', scoreMin: 40, scoreMax: 47, rating: 'CCC', riskCategory: 'HIGH' },
  { id: 'b5', scoreMin: 48, scoreMax: 54, rating: 'B', riskCategory: 'MODERATE' },
  { id: 'b6', scoreMin: 55, scoreMax: 61, rating: 'BB', riskCategory: 'MODERATE' },
  { id: 'b7', scoreMin: 62, scoreMax: 69, rating: 'BBB', riskCategory: 'MODERATE' },
  { id: 'b8', scoreMin: 70, scoreMax: 77, rating: 'A', riskCategory: 'LOW' },
  { id: 'b9', scoreMin: 78, scoreMax: 84, rating: 'AA', riskCategory: 'LOW' },
  { id: 'b10', scoreMin: 85, scoreMax: 100, rating: 'AAA', riskCategory: 'LOW' },
];
const makeSet = (overrides: Record<string, unknown> = {}) => ({
  id: 'set-1', name: 'Reviewed Bands', description: null, reason: 'Policy review', version: 1,
  status: 'DRAFT', createdById: 'maker-1', submittedById: null, approvedById: null, activatedById: null,
  bands, ...overrides,
});

describe('rating-band set governance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(tx));
  });

  it('validates complete coverage and rating-category mappings', () => {
    expect(ratingBandService.validateBandSet(bands)).toEqual({ valid: true, errors: [] });
    const incorrect = bands.map((band) => ({ ...band }));
    incorrect[0].riskCategory = 'HIGH';
    expect(ratingBandService.validateBandSet(incorrect)).toMatchObject({ valid: false, errors: [expect.stringContaining('must use risk category PROHIBITED')] });
    const invertedOrder = bands.map((band) => ({ ...band }));
    invertedOrder[8].rating = 'AAA';
    invertedOrder[9].rating = 'AA';
    expect(ratingBandService.validateBandSet(invertedOrder).errors).toEqual(expect.arrayContaining([expect.stringContaining('must rank above')]));
  });

  it('creates a human-owned inactive set with actor and audit provenance', async () => {
    (tx.ratingBandSet.findFirst as jest.Mock).mockResolvedValue({ version: 2 });
    (tx.ratingBandSet.create as jest.Mock).mockResolvedValue({ id: 'set-3', name: 'Reviewed Bands', version: 3, description: null, reason: 'Policy review' });
    (tx.ratingBandConfig.findMany as jest.Mock).mockResolvedValueOnce([]);
    (tx.ratingBandConfig.createManyAndReturn as jest.Mock).mockResolvedValue(bands);

    const result = await ratingBandService.createDraftBandSet({
      name: 'Reviewed Bands', reason: 'Policy review', bands, context,
    });

    expect(result).toMatchObject({ id: 'set-3', version: 3 });
    expect(tx.ratingBandSet.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', createdById: 'maker-1' }) }));
    expect(tx.ratingBandConfig.createManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ status: 'DRAFT', bandSetId: 'set-3' })]),
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1', actorId: 'maker-1', action: 'CREDIT_RATING_BAND_SET_CREATED', resourceId: 'set-3',
    }), tx);
  });

  it('links an exact unattributed candidate set instead of creating duplicate band rows', async () => {
    const candidate = bands.map((band) => ({ ...band, name: 'Draft canonical candidate', version: 1 }));
    (tx.ratingBandConfig.findMany as jest.Mock)
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce(candidate);
    (tx.ratingBandSet.findFirst as jest.Mock).mockResolvedValue(null);
    (tx.ratingBandSet.create as jest.Mock).mockResolvedValue({ id: 'set-import', name: 'Reviewed Bands', version: 1, description: null, reason: 'Policy review' });
    (tx.ratingBandConfig.updateMany as jest.Mock).mockResolvedValue({ count: candidate.length });

    const result = await ratingBandService.createDraftBandSet({ name: 'Reviewed Bands', reason: 'Policy review', bands, context });

    expect(result.bands).toHaveLength(10);
    expect(tx.ratingBandConfig.createManyAndReturn).not.toHaveBeenCalled();
    expect(tx.ratingBandConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: candidate.map((band) => band.id) }, status: 'DRAFT', bandSetId: null },
      data: { bandSetId: 'set-import' },
    }));
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      newValues: expect.objectContaining({ proposalSource: 'exact-matching-unattributed-draft-import' }),
    }), tx);
  });

  it('requires maker submission and transitions every band with the set', async () => {
    (tx.ratingBandSet.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeSet({ createdById: 'other-maker' }))
      .mockResolvedValueOnce(makeSet())
      .mockResolvedValueOnce(makeSet({ status: 'SUBMITTED', submittedById: 'maker-1' }));
    await expect(ratingBandService.submitBandSetForApproval('set-1', context)).rejects.toThrow(/only the set maker/i);

    (tx.ratingBandSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (tx.ratingBandConfig.updateMany as jest.Mock).mockResolvedValue({ count: bands.length });
    const result = await ratingBandService.submitBandSetForApproval('set-1', context);

    expect(result).toMatchObject({ status: 'SUBMITTED' });
    expect(tx.ratingBandSet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'set-1', status: 'DRAFT', createdById: 'maker-1' } }));
    expect(tx.ratingBandConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { bandSetId: 'set-1', status: 'DRAFT' }, data: { status: 'SUBMITTED' } }));
  });

  it('rejects maker self-approval and records the checker transactionally', async () => {
    (tx.ratingBandSet.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeSet({ status: 'SUBMITTED', submittedById: 'maker-1' }))
      .mockResolvedValueOnce(makeSet({ status: 'SUBMITTED', submittedById: 'maker-1' }))
      .mockResolvedValueOnce(makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' }));
    await expect(ratingBandService.approveBandSet('set-1', context)).rejects.toThrow(/different from the maker/i);

    (tx.ratingBandSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (tx.ratingBandConfig.updateMany as jest.Mock).mockResolvedValue({ count: bands.length });
    const result = await ratingBandService.approveBandSet('set-1', { ...context, actorId: 'checker-1', actorEmail: 'checker@example.test' });

    expect(result).toMatchObject({ status: 'APPROVED' });
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'checker-1', action: 'CREDIT_RATING_BAND_SET_APPROVED',
    }), tx);
  });

  it('requires a policy reference and rejects unmanaged active rows before activation', async () => {
    await expect(ratingBandService.activateBandSet('set-1', { ...context, actorId: 'operator-1' }, '')).rejects.toThrow(/approval reference/i);
    (tx.ratingBandSet.findUnique as jest.Mock).mockResolvedValue(makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' }));
    (tx.ratingBandConfig.count as jest.Mock).mockResolvedValue(2);
    await expect(ratingBandService.activateBandSet('set-1', { ...context, actorId: 'operator-1' }, 'POLICY-12345')).rejects.toThrow(/unmanaged rating bands/i);
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('requires complete 0–100 coverage again at activation and leaves state unchanged on invalid proposals', async () => {
    const incompleteSet = makeSet({
      status: 'APPROVED',
      submittedById: 'maker-1',
      approvedById: 'checker-1',
      bands: bands.slice(1),
    });
    (tx.ratingBandSet.findUnique as jest.Mock).mockResolvedValue(incompleteSet);

    await expect(ratingBandService.activateBandSet(
      'set-1',
      { ...context, actorId: 'operator-1' },
      'POLICY-12345',
    )).rejects.toThrow(/must start at score 0/i);

    expect(tx.ratingBandSet.updateMany).not.toHaveBeenCalled();
    expect(tx.ratingBandConfig.updateMany).not.toHaveBeenCalled();
    expect(PlatformAuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('activates exactly one approved complete set with an independent operator and audit', async () => {
    (tx.$queryRaw as jest.Mock).mockResolvedValue([]);
    (tx.ratingBandSet.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeSet({ status: 'APPROVED', submittedById: 'maker-1', approvedById: 'checker-1' }))
      .mockResolvedValueOnce(makeSet({ status: 'ACTIVE', activatedById: 'operator-1' }));
    (tx.ratingBandConfig.count as jest.Mock).mockResolvedValue(0);
    (tx.ratingBandSet.findMany as jest.Mock).mockResolvedValue([]);
    (tx.ratingBandSet.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (tx.ratingBandConfig.updateMany as jest.Mock).mockResolvedValue({ count: bands.length });

    const result = await ratingBandService.activateBandSet('set-1', { ...context, actorId: 'operator-1', actorEmail: 'operator@example.test' }, ' POLICY-12345 ');

    expect(result).toMatchObject({ set: { status: 'ACTIVE' }, activated: 10, superseded: 0 });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(PlatformAuditChainService.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREDIT_RATING_BAND_SET_ACTIVATED',
      newValues: expect.objectContaining({ status: 'ACTIVE', bandCount: 10, policyApprovalReference: 'POLICY-12345' }),
    }), tx);
  });
});
