const mockPrisma = {
  workflowVersion: { findUnique: jest.fn() },
  workflowNode: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  workflowEdge: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { deleteEdges, deleteNodes, updateNodes, upsertEdges, upsertNodes } from '../workflowGraph.service';

const nodeInput = {
  id: 'n1',
  statusCode: 'NEW',
  positionX: 12,
  positionY: 34,
  isInitial: true,
  isFinal: false,
  slaPause: false,
  icon: 'add',
};

const edgeInput = {
  id: 'e1',
  fromNodeId: 'n1',
  toNodeId: 'n2',
  transitionLabel: 'SUBMIT',
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: ['AGENT'],
  allowedExecutiveRoles: [],
};

describe('draft-only enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['ACTIVE'],
    ['ARCHIVED'],
  ])('rejects node writes to a %s version', async (status) => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status });
    await expect(upsertNodes('v1', [nodeInput])).rejects.toThrow('Only a draft version can be edited');
    expect(mockPrisma.workflowNode.upsert).not.toHaveBeenCalled();
  });

  it('rejects edge writes to an ACTIVE version', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    await expect(upsertEdges('v1', [edgeInput])).rejects.toThrow('Only a draft version can be edited');
  });

  it('rejects node deletion on an ACTIVE version', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    await expect(deleteNodes('v1', ['n1'])).rejects.toThrow('Only a draft version can be edited');
  });

  it('throws when the version does not exist', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(null);
    await expect(upsertNodes('missing', [nodeInput])).rejects.toThrow('not found');
  });
});

describe('upsertNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
    mockPrisma.workflowNode.findMany.mockResolvedValue([]);
    mockPrisma.workflowEdge.findMany.mockResolvedValue([]);
  });

  it('upserts each node scoped to the version', async () => {
    await upsertNodes('v1', [nodeInput]);
    expect(mockPrisma.workflowNode.upsert).toHaveBeenCalledWith({
      where: { id_workflowVersionId: { id: 'n1', workflowVersionId: 'v1' } },
      create: expect.objectContaining({
        id: 'n1',
        workflowVersionId: 'v1',
        statusCode: 'NEW',
        positionX: 12,
      }),
      update: expect.objectContaining({ positionX: 12, positionY: 34, isInitial: true }),
    });
  });

  it('does not let an update reassign a node to another version', async () => {
    await upsertNodes('v1', [nodeInput]);
    const call = mockPrisma.workflowNode.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('workflowVersionId');
  });

  it('handles a batch of position-only moves', async () => {
    await upsertNodes('v1', [nodeInput, { ...nodeInput, id: 'n2', statusCode: 'CLOSED' }]);
    expect(mockPrisma.workflowNode.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects a node id owned by another version', async () => {
    mockPrisma.workflowNode.findMany.mockResolvedValue([{ id: 'n1', workflowVersionId: 'v2' }]);
    await expect(upsertNodes('v1', [nodeInput])).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.workflowNode.upsert).not.toHaveBeenCalled();
  });

  it('rejects duplicate node ids before writing', async () => {
    await expect(upsertNodes('v1', [nodeInput, nodeInput])).rejects.toMatchObject({ statusCode: 422 });
    expect(mockPrisma.workflowNode.upsert).not.toHaveBeenCalled();
  });

  it('keeps node batch deletion behind the transaction boundary', async () => {
    mockPrisma.workflowNode.upsert.mockRejectedValueOnce(new Error('write failed'));
    await expect(updateNodes('v1', [nodeInput], ['n2'])).rejects.toThrow('write failed');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.workflowNode.deleteMany).not.toHaveBeenCalled();
  });
});

describe('upsertEdges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
    mockPrisma.workflowNode.findMany.mockResolvedValue([
      { id: 'n1', workflowVersionId: 'v1' },
      { id: 'n2', workflowVersionId: 'v1' },
    ]);
    mockPrisma.workflowEdge.findMany.mockResolvedValue([]);
  });

  it('upserts each edge scoped to the version', async () => {
    await upsertEdges('v1', [edgeInput]);
    expect(mockPrisma.workflowEdge.upsert).toHaveBeenCalledWith({
      where: { id_workflowVersionId: { id: 'e1', workflowVersionId: 'v1' } },
      create: expect.objectContaining({ id: 'e1', workflowVersionId: 'v1', fromNodeId: 'n1' }),
      update: expect.objectContaining({ transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
    });
  });

  it('rejects a self-loop, which the status machine cannot express', async () => {
    await expect(
      upsertEdges('v1', [{ ...edgeInput, toNodeId: 'n1' }]),
    ).rejects.toThrow('cannot transition to itself');
  });

  it('rejects an edge that references a node from another version', async () => {
    mockPrisma.workflowNode.findMany.mockResolvedValue([
      { id: 'n1', workflowVersionId: 'v1' },
      { id: 'n2', workflowVersionId: 'v2' },
    ]);
    await expect(upsertEdges('v1', [edgeInput])).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.workflowEdge.upsert).not.toHaveBeenCalled();
  });
});

describe('deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
  });

  it('deletes nodes only within the given version', async () => {
    await deleteNodes('v1', ['n1', 'n2']);
    expect(mockPrisma.workflowNode.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] }, workflowVersionId: 'v1' },
    });
  });

  it('deletes edges only within the given version', async () => {
    await deleteEdges('v1', ['e1']);
    expect(mockPrisma.workflowEdge.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] }, workflowVersionId: 'v1' },
    });
  });

  it('is a no-op for an empty id list', async () => {
    await deleteNodes('v1', []);
    expect(mockPrisma.workflowNode.deleteMany).not.toHaveBeenCalled();
  });
});