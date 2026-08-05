const mockPrisma = {
  requestType: { findMany: jest.fn() },
  request: { groupBy: jest.fn() },
  workflowVersion: { findFirst: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockLoadGraph = jest.fn();
jest.mock('../workflowCompiler.service', () => ({
  loadGraph: (...args: unknown[]) => mockLoadGraph(...args),
}));

const mockExecuteWorkflowCommandInTransaction = jest.fn().mockResolvedValue({ version: 5, historyId: 'h1' });
jest.mock('../workflowCommand.service', () => ({
  executeWorkflowCommandInTransaction: (...args: unknown[]) => mockExecuteWorkflowCommandInTransaction(...args),
}));

import { applyStatusRemap, planStatusRemap } from '../statusRemap.service';
import { GraphEdge, GraphNode, WorkflowGraph } from '../workflowGraph.types';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: 'STATUS',
  statusCode: id,
  positionX: 0,
  positionY: 0,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  icon: 'radio_button_checked',
  ...over,
});

const edge = (from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  id: `${from}->${to}`,
  fromNodeId: from,
  toNodeId: to,
  transitionLabel: null,
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
  ...over,
});

/** ACTIVE version: NEW → REVIEW → ACTION → PROGRESS → DONE */
const activeGraph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('REVIEW'),
    node('ACTION', { slaPause: true }),
    node('PROGRESS'),
    node('DONE', { isFinal: true }),
  ],
  edges: [edge('NEW', 'REVIEW'), edge('REVIEW', 'ACTION'), edge('ACTION', 'PROGRESS'), edge('PROGRESS', 'DONE')],
});

const setup = (occupancy: Record<string, number>, active: WorkflowGraph = activeGraph()) => {
  mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
  mockPrisma.request.groupBy.mockResolvedValue(
    Object.entries(occupancy).map(([status, count]) => ({ status, _count: { _all: count } })),
  );
  mockPrisma.workflowVersion.findFirst.mockResolvedValue({ id: 'active-version', version: 3 });
  mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: active });
};

describe('planStatusRemap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty plan when every occupied status survives', async () => {
    setup({ NEW: 3, PROGRESS: 1 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries).toEqual([]);
    expect(plan.totalRequests).toBe(0);
  });

  it('suggests the depth-1 successor that survives in the draft', async () => {
    setup({ ACTION: 2 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS'), node('DONE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({
      statusCode: 'ACTION',
      requestCount: 2,
      suggestedTarget: 'PROGRESS',
      sourcePausesSla: true,
    });
    expect(plan.entries[0].allowedTargets).toEqual(['DONE', 'NEW', 'PROGRESS']);
    expect(plan.totalRequests).toBe(2);
  });

  it('walks past a removed successor to the next surviving status', async () => {
    setup({ REVIEW: 1 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS'), node('DONE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBe('PROGRESS');
  });

  it('suggests nothing when no surviving status is reachable', async () => {
    setup({ PROGRESS: 1 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
    expect(plan.entries[0].suggestionReason).toBe('No surviving status is reachable — choose a target manually');
  });

  it('terminates on a cycle in the active graph', async () => {
    const cyclic: WorkflowGraph = {
      nodes: [node('A'), node('B'), node('SAFE')],
      edges: [edge('A', 'B'), edge('B', 'A')],
    };
    setup({ A: 1 }, cyclic);
    const draftGraph: WorkflowGraph = { nodes: [node('SAFE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
  });

  it('breaks ties at the same depth by edge order', async () => {
    const fanOut: WorkflowGraph = {
      nodes: [node('A'), node('X'), node('Y')],
      edges: [edge('A', 'Y'), edge('A', 'X')],
    };
    setup({ A: 1 }, fanOut);
    const draftGraph: WorkflowGraph = { nodes: [node('X'), node('Y')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBe('Y');
  });

  it('returns an empty plan when the workflow type has no request types', async () => {
    mockPrisma.requestType.findMany.mockResolvedValue([]);
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph: { nodes: [], edges: [] } });
    expect(plan.entries).toEqual([]);
  });

  it('returns an empty plan when there is no active version to walk', async () => {
    setup({ ACTION: 1 });
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(null);
    const draftGraph: WorkflowGraph = { nodes: [node('PROGRESS')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
    expect(plan.entries[0].allowedTargets).toEqual(['PROGRESS']);
  });
});

describe('applyStatusRemap', () => {
  const mockTx = {
    requestType: { findMany: jest.fn() },
    request: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    workflowHistory: { createMany: jest.fn() },
    requestActivity: { createMany: jest.fn() },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteWorkflowCommandInTransaction.mockResolvedValue({ version: 5, historyId: 'h1' });
    mockTx.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
    mockTx.user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' });
    mockTx.request.findMany.mockResolvedValue([
      { id: 'req1', tenantId: 'ten1', departmentId: 'dep1', status: 'LEGACY', version: 4 },
    ]);
  });

  it('does nothing when the mapping is empty', async () => {
    const result = await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: {}, actorId: 'u1' });
    expect(result).toEqual({ movedCount: 0 });
    expect(mockTx.request.updateMany).not.toHaveBeenCalled();
  });

  it('moves requests through the workflow command boundary with optimistic concurrency', async () => {
    const result = await applyStatusRemap(mockTx, {
      workflowTypeId: 'wf1',
      remap: { LEGACY: 'IN_PROGRESS' },
      actorId: 'u1',
    });
    expect(result).toEqual({ movedCount: 1 });
    expect(mockExecuteWorkflowCommandInTransaction).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'req1',
      fromStatus: 'LEGACY',
      toStatus: 'IN_PROGRESS',
      expectedVersion: 4,
      actorId: 'u1',
      actorName: 'Ada Lovelace',
      source: 'workflow_version_publish_remap',
      skipNotifications: true,
    }), mockTx);
    expect(mockTx.request.updateMany).not.toHaveBeenCalled();
  });

  it('never includes SLA fields in the command patch', async () => {
    await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: { LEGACY: 'IN_PROGRESS' }, actorId: 'u1' });
    const command = mockExecuteWorkflowCommandInTransaction.mock.calls[0][0];
    expect(command).not.toHaveProperty('requestPatch.slaPausedAt');
    expect(command).not.toHaveProperty('requestPatch.slaDueAt');
    expect(command).not.toHaveProperty('requestPatch.slaPauseDurationMs');
  });

  it('propagates a concurrent version conflict', async () => {
    mockExecuteWorkflowCommandInTransaction.mockRejectedValueOnce(new Error('WORKFLOW_VERSION_CONFLICT'));
    await expect(applyStatusRemap(mockTx, {
      workflowTypeId: 'wf1', remap: { LEGACY: 'IN_PROGRESS' }, actorId: 'u1',
    })).rejects.toThrow('WORKFLOW_VERSION_CONFLICT');
  });

  it('skips a mapped status that turns out to hold nothing', async () => {
    mockTx.request.findMany.mockResolvedValue([]);
    const result = await applyStatusRemap(mockTx, {
      workflowTypeId: 'wf1',
      remap: { LEGACY: 'IN_PROGRESS' },
      actorId: 'u1',
    });
    expect(result).toEqual({ movedCount: 0 });
    expect(mockExecuteWorkflowCommandInTransaction).not.toHaveBeenCalled();
  });
});