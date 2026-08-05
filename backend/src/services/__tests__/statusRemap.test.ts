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

import { planStatusRemap } from '../statusRemap.service';
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
    // ACTION is also removed, so REVIEW must reach PROGRESS at depth 2.
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS'), node('DONE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBe('PROGRESS');
  });

  it('suggests nothing when no surviving status is reachable', async () => {
    setup({ PROGRESS: 1 });
    // Only NEW survives, and PROGRESS cannot reach it.
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