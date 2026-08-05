const mockPrisma = {
  requestType: { findMany: jest.fn() },
  request: { groupBy: jest.fn() },
  workflowVersion: { findFirst: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockLoadOccupancy = jest.fn();
jest.mock('../statusRemap.service', () => ({
  loadOccupancy: (...args: unknown[]) => mockLoadOccupancy(...args),
}));

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

const occupy = (entries: [string, number][]) =>
  new Map(entries.map(([status, count]) => [status, count]));

describe('validateLiveData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOccupancy.mockResolvedValue(new Map());
  });

  it('reports nothing when every occupied status survives with an exit', async () => {
    mockLoadOccupancy.mockResolvedValue(occupy([['NEW', 4], ['IN_PROGRESS', 2]]));
    await expect(validateLiveData({ workflowTypeId: 'wf1', graph: graph() })).resolves.toEqual([]);
  });

  it('blocks removing a status that requests currently occupy', async () => {
    mockLoadOccupancy.mockResolvedValue(occupy([['PENDING_CFO', 12]]));
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    const finding = findings.find((f) => f.code === 'STATUS_IN_USE_REMOVED');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('12 requests');
    expect(finding!.message).toContain('PENDING_CFO');
  });

  it('blocks leaving an occupied status with no outgoing transitions', async () => {
    const stranded = graph();
    stranded.edges = stranded.edges.filter((e) => e.fromNodeId !== 'IN_PROGRESS');
    mockLoadOccupancy.mockResolvedValue(occupy([['IN_PROGRESS', 8]]));
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
    mockLoadOccupancy.mockResolvedValue(occupy([['IN_PROGRESS', 8]]));
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: dangling });
    expect(findings.map((finding) => finding.code)).toContain('OCCUPIED_STATUS_NO_EXIT');
  });

  it('allows an occupied final status to have no outgoing transitions', async () => {
    mockLoadOccupancy.mockResolvedValue(occupy([['CLOSED', 99]]));
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    expect(findings).toEqual([]);
  });

  it('returns empty when there is no occupancy', async () => {
    mockLoadOccupancy.mockResolvedValue(new Map());
    await expect(validateLiveData(input)).resolves.toEqual([]);
  });
});

describe('validateLiveData with a status remap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOccupancy.mockResolvedValue(new Map());
  });

  const occupyStatus = (status: string, count: number) =>
    mockLoadOccupancy.mockResolvedValue(occupy([[status, count]]));

  it('clears STATUS_IN_USE_REMOVED when the status is mapped to a survivor', async () => {
    occupyStatus('LEGACY', 2);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    expect(findings.map((f) => f.code)).not.toContain('STATUS_IN_USE_REMOVED');
  });

  it('still blocks a stranded status that has no mapping', async () => {
    mockLoadOccupancy.mockResolvedValue(occupy([['LEGACY', 1], ['ANCIENT', 1]]));
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    const stranded = findings.filter((f) => f.code === 'STATUS_IN_USE_REMOVED');
    expect(stranded).toHaveLength(1);
    expect(stranded[0].message).toContain('ANCIENT');
  });

  it('blocks a mapping whose target is not in the draft', async () => {
    occupyStatus('LEGACY', 1);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'NOT_A_STATUS' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_TARGET_MISSING');
  });

  it('blocks a mapping onto a non-final target with no outgoing edges', async () => {
    occupyStatus('LEGACY', 1);
    const withDeadEnd = graph();
    withDeadEnd.nodes.push({
      id: 'PARKED',
      type: 'STATUS',
      statusCode: 'PARKED',
      positionX: 0,
      positionY: 0,
      isInitial: false,
      isFinal: false,
      slaPause: false,
      icon: 'radio_button_checked',
    });
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: withDeadEnd,
      statusRemap: { LEGACY: 'PARKED' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_TARGET_NO_EXIT');
  });

  it('blocks a mapping of a status onto itself', async () => {
    occupyStatus('IN_PROGRESS', 1);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { IN_PROGRESS: 'IN_PROGRESS' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_SELF');
  });

  it('blocks when the remap would move more requests than the cap allows', async () => {
    occupyStatus('LEGACY', 5000);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    const capped = findings.find((f) => f.code === 'REMAP_VOLUME_EXCEEDED');
    expect(capped).toBeDefined();
    expect(capped!.message).toContain('5000');
  });

  it('validates remap targets even when there is no occupancy', async () => {
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'NOT_A_STATUS' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_TARGET_MISSING');
  });

  it('rejects a remap source that still exists in the draft', async () => {
    occupyStatus('LEGACY', 1);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { IN_PROGRESS: 'CLOSED' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_SOURCE_NOT_REMOVED');
  });
});

describe('validateGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOccupancy.mockResolvedValue(new Map());
  });

  it('merges structural and live-data findings into one blocking list', async () => {
    const broken = graph();
    broken.nodes[0].isInitial = false;
    mockLoadOccupancy.mockResolvedValue(occupy([['GONE', 3]]));

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