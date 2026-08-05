const mockTx = {
  workflowVersion: {
    findUnique: jest.fn(), findFirst: jest.fn(), aggregate: jest.fn(),
    updateMany: jest.fn(), update: jest.fn(), create: jest.fn(),
  },
  workflowNode: { createMany: jest.fn() },
  workflowEdge: { createMany: jest.fn() },
};
const mockPrisma = {
  workflowVersion: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockValidateGraph = jest.fn();
jest.mock('../workflowValidator.service', () => ({
  validateGraph: (...args: unknown[]) => mockValidateGraph(...args),
}));

const mockCompileVersion = jest.fn();
const mockCompileVersionInTransaction = jest.fn();
const mockLoadGraph = jest.fn();
jest.mock('../workflowCompiler.service', () => ({
  compileVersion: (...args: unknown[]) => mockCompileVersion(...args),
  compileVersionInTransaction: (...args: unknown[]) => mockCompileVersionInTransaction(...args),
  loadGraph: (...args: unknown[]) => mockLoadGraph(...args),
}));

import {
  createDraft,
  discardDraft,
  publishVersion,
  rollbackToVersion,
} from '../workflowVersion.service';

const emptyGraph = { nodes: [], edges: [] };

describe('createDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.workflowVersion.findFirst.mockResolvedValue(null);
    mockTx.workflowVersion.aggregate.mockResolvedValue({ _max: { version: 3 } });
    mockTx.workflowVersion.create.mockResolvedValue({ id: 'v4', version: 4 });
  });

  it('rejects a second draft for the same workflow', async () => {
    mockTx.workflowVersion.findFirst.mockResolvedValue({ id: 'existing-draft' });
    await expect(createDraft('wf1')).rejects.toThrow('already has an open draft');
  });

  it('numbers the new draft one above the highest existing version', async () => {
    mockTx.workflowVersion.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    await createDraft('wf1');
    expect(mockTx.workflowVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4, status: 'DRAFT' }) }),
    );
  });

  it('clones the active version\'s nodes and edges into the draft', async () => {
    mockTx.workflowVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'v3' });
    mockLoadGraph.mockResolvedValue({
      workflowTypeId: 'wf1',
      graph: {
        nodes: [
          {
            id: 'n1',
            type: 'STATUS',
            statusCode: 'NEW',
            positionX: 5,
            positionY: 6,
            isInitial: true,
            isFinal: false,
            slaPause: false,
            icon: 'add',
          },
        ],
        edges: [],
      },
    });

    await createDraft('wf1');
    expect(mockTx.workflowNode.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ statusCode: 'NEW', positionX: 5, isInitial: true })],
    });
  });

  it('maps a database draft uniqueness race to a conflict', async () => {
    mockTx.workflowVersion.create.mockRejectedValue({ code: 'P2002' });
    await expect(createDraft('wf1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('publishVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v4',
      version: 4,
      status: 'DRAFT',
      workflowTypeId: 'wf1',
    });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
    mockCompileVersion.mockResolvedValue({ transitionCount: 2, stepCount: 3 });
    mockCompileVersionInTransaction.mockResolvedValue({ transitionCount: 2, stepCount: 3 });
    mockTx.workflowVersion.findUnique.mockResolvedValue({ id: 'v4', version: 4, status: 'DRAFT', workflowTypeId: 'wf1' });
  });

  it('refuses to publish when validation reports a blocking finding', async () => {
    mockValidateGraph.mockResolvedValue({
      blocking: [{ code: 'MISSING_INITIAL', message: 'Workflow needs exactly one starting status (found 0)' }],
      warnings: [],
    });
    await expect(publishVersion('v4', 'u1')).rejects.toThrow('starting status');
    expect(mockCompileVersionInTransaction).not.toHaveBeenCalled();
  });

  it('archives the previously active version', async () => {
    await publishVersion('v4', 'u1');
    expect(mockTx.workflowVersion.updateMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1', status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
  });

  it('marks the target version active and records the publisher', async () => {
    await publishVersion('v4', 'u1');
    expect(mockTx.workflowVersion.update).toHaveBeenCalledWith({
      where: { id: 'v4' },
      data: expect.objectContaining({ status: 'ACTIVE', publishedById: 'u1' }),
    });
  });

  it('compiles after activating, and returns the compile counts', async () => {
    const result = await publishVersion('v4', 'u1');
    expect(mockCompileVersionInTransaction).toHaveBeenCalledWith(mockTx, 'v4');
    expect(result).toEqual({ version: 4, transitionCount: 2, stepCount: 3 });
  });

  it('propagates compiler failure through the publish transaction', async () => {
    mockCompileVersionInTransaction.mockRejectedValueOnce(new Error('compile failed'));
    await expect(publishVersion('v4', 'u1')).rejects.toThrow('compile failed');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses to publish a version that is already active', async () => {
    mockTx.workflowVersion.findUnique.mockResolvedValue({
      id: 'v3',
      version: 3,
      status: 'ACTIVE',
      workflowTypeId: 'wf1',
    });
    await expect(publishVersion('v3', 'u1')).rejects.toThrow('already active');
  });
});

describe('rollbackToVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v2',
      version: 2,
      status: 'ARCHIVED',
      workflowTypeId: 'wf1',
    });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
    mockCompileVersion.mockResolvedValue({ transitionCount: 1, stepCount: 2 });
    mockCompileVersionInTransaction.mockResolvedValue({ transitionCount: 1, stepCount: 2 });
    mockTx.workflowVersion.findUnique.mockResolvedValue({ id: 'v2', version: 2, status: 'ARCHIVED', workflowTypeId: 'wf1' });
  });

  it('re-validates before re-activating, because live requests have moved since', async () => {
    await rollbackToVersion('v2', 'u1');
    expect(mockValidateGraph).toHaveBeenCalledWith({ workflowTypeId: 'wf1', graph: emptyGraph }, mockTx);
  });

  it('refuses a rollback that would strand in-flight requests', async () => {
    mockValidateGraph.mockResolvedValue({
      blocking: [{ code: 'OCCUPIED_STATUS_NO_EXIT', message: '8 requests are in UNDER_REVIEW, which would have no available transitions' }],
      warnings: [],
    });
    await expect(rollbackToVersion('v2', 'u1')).rejects.toThrow('UNDER_REVIEW');
    expect(mockCompileVersionInTransaction).not.toHaveBeenCalled();
  });

  it('rejects rolling back to a draft', async () => {
    mockTx.workflowVersion.findUnique.mockResolvedValue({
      id: 'v5',
      version: 5,
      status: 'DRAFT',
      workflowTypeId: 'wf1',
    });
    await expect(rollbackToVersion('v5', 'u1')).rejects.toThrow('archived');
  });
});

describe('discardDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a draft', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v4', status: 'DRAFT' });
    await discardDraft('v4');
    expect(mockPrisma.workflowVersion.delete).toHaveBeenCalledWith({ where: { id: 'v4' } });
  });

  it('refuses to delete a version that is not a draft', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v3', status: 'ACTIVE' });
    await expect(discardDraft('v3')).rejects.toThrow('Only a draft');
    expect(mockPrisma.workflowVersion.delete).not.toHaveBeenCalled();
  });
});