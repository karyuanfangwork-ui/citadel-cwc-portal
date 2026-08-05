const mockPrisma = {
  requestType: { findMany: jest.fn() },
  request: { groupBy: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { validateGraph, validateLiveData } from '../workflowValidator.service';
import { GraphNode, WorkflowGraph } from '../workflowGraph.types';

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

const graph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('IN_PROGRESS'),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [
    {
      id: 'e1',
      fromNodeId: 'NEW',
      toNodeId: 'IN_PROGRESS',
      transitionLabel: null,
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
    },
    {
      id: 'e2',
      fromNodeId: 'IN_PROGRESS',
      toNodeId: 'CLOSED',
      transitionLabel: null,
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
    },
  ],
});

const input = { workflowTypeId: 'wf1', graph: graph() };

describe('validateLiveData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }, { id: 'rt2' }]);
  });

  it('reports nothing when every occupied status survives with an exit', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 4 } },
      { status: 'IN_PROGRESS', _count: { _all: 2 } },
    ]);
    await expect(validateLiveData({ workflowTypeId: 'wf1', graph: graph() })).resolves.toEqual([]);
  });

  it('blocks removing a status that requests currently occupy', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'PENDING_CFO', _count: { _all: 12 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    const finding = findings.find((f) => f.code === 'STATUS_IN_USE_REMOVED');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('12 requests');
    expect(finding!.message).toContain('PENDING_CFO');
  });

  it('blocks leaving an occupied status with no outgoing transitions', async () => {
    const stranded = graph();
    stranded.edges = stranded.edges.filter((e) => e.fromNodeId !== 'IN_PROGRESS');
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'IN_PROGRESS', _count: { _all: 8 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: stranded });
    const finding = findings.find((f) => f.code === 'OCCUPIED_STATUS_NO_EXIT');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('8 requests');
    expect(finding!.nodeId).toBe('IN_PROGRESS');
  });

  it('treats an edge to a missing node as no exit for occupied status validation', async () => {
    const dangling = graph();
    dangling.edges = [
      dangling.edges[0],
      { ...dangling.edges[1], toNodeId: 'MISSING' },
    ];
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'IN_PROGRESS', _count: { _all: 8 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: dangling });
    expect(findings.map((finding) => finding.code)).toContain('OCCUPIED_STATUS_NO_EXIT');
  });

  it('allows an occupied final status to have no outgoing transitions', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'CLOSED', _count: { _all: 99 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    expect(findings).toEqual([]);
  });

  it('scopes the request query to the request types bound to this workflow', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([]);
    await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    expect(mockPrisma.requestType.findMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1' },
      select: { id: true },
    });
    expect(mockPrisma.request.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: { requestTypeId: { in: ['rt1', 'rt2'] } },
      }),
    );
  });

  it('skips the request query entirely when no request type is bound', async () => {
    mockPrisma.requestType.findMany.mockResolvedValue([]);
    await expect(validateLiveData(input)).resolves.toEqual([]);
    expect(mockPrisma.request.groupBy).not.toHaveBeenCalled();
  });
});

describe('validateGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
    mockPrisma.request.groupBy.mockResolvedValue([]);
  });

  it('merges structural and live-data findings into one blocking list', async () => {
    const broken = graph();
    broken.nodes[0].isInitial = false;
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'GONE', _count: { _all: 3 } }]);

    const result = await validateGraph({ workflowTypeId: 'wf1', graph: broken });
    const codes = result.blocking.map((f) => f.code);
    expect(codes).toContain('MISSING_INITIAL');
    expect(codes).toContain('STATUS_IN_USE_REMOVED');
  });

  it('preserves structural warnings alongside blocking findings', async () => {
    const open = graph();
    open.edges[0].allowedRoles = [];
    const result = await validateGraph({ workflowTypeId: 'wf1', graph: open });
    expect(result.warnings.map((f) => f.code)).toContain('OPEN_EDGE');
  });
});