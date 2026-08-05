const mockPrisma = {
  workflowStep: { findMany: jest.fn() },
  workflowTransition: { findMany: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { diffProjection, projectGraph, reverseCompile } from '../workflowCompiler.service';
import { ProjectedTransition } from '../workflowCompiler.service';

const step = (status: string, over: Record<string, unknown> = {}) => ({
  status,
  icon: 'radio_button_checked',
  displayOrder: 0,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  ...over,
});

const transition = (fromStatus: string, toStatus: string, over: Record<string, unknown> = {}) => ({
  fromStatus,
  toStatus,
  transitionLabel: null,
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
  ...over,
});

describe('reverseCompile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds a node per workflow step, preserving its flags', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true, icon: 'add' }),
      step('CLOSED', { isFinal: true, slaPause: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes.map((n) => n.statusCode)).toEqual(['NEW', 'CLOSED']);
    expect(graph.nodes[0].isInitial).toBe(true);
    expect(graph.nodes[0].icon).toBe('add');
    expect(graph.nodes[1].slaPause).toBe(true);
  });

  it('leaves coordinates null so the designer knows to auto-layout', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([step('NEW', { isInitial: true })]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes[0].positionX).toBeNull();
    expect(graph.nodes[0].positionY).toBeNull();
  });

  it('adds nodes for statuses referenced by transitions but missing a step', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([step('NEW', { isInitial: true })]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([transition('NEW', 'ON_HOLD')]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes.map((n) => n.statusCode).sort()).toEqual(['NEW', 'ON_HOLD']);
  });

  it('builds an edge per transition, wired to node ids', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true }),
      step('CLOSED', { isFinal: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([
      transition('NEW', 'CLOSED', { transitionLabel: 'CLOSE', requiresComment: true, allowedRoles: ['AGENT'] }),
    ]);

    const graph = await reverseCompile('wf1');
    const newNode = graph.nodes.find((n) => n.statusCode === 'NEW')!;
    const closedNode = graph.nodes.find((n) => n.statusCode === 'CLOSED')!;
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].fromNodeId).toBe(newNode.id);
    expect(graph.edges[0].toNodeId).toBe(closedNode.id);
    expect(graph.edges[0].requiresComment).toBe(true);
    expect(graph.edges[0].allowedRoles).toEqual(['AGENT']);
  });

  it('reads only workflow-scoped transitions, never the global fallback rows', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    await reverseCompile('wf1');
    expect(mockPrisma.workflowTransition.findMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1', isActive: true },
    });
  });

  it('round-trips: reverse-compiling then projecting reproduces the same transitions', async () => {
    const live = [
      transition('NEW', 'IN_PROGRESS', { transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
      transition('IN_PROGRESS', 'CLOSED', { transitionLabel: 'CLOSE', requiresComment: true }),
    ];
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true }),
      step('IN_PROGRESS'),
      step('CLOSED', { isFinal: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue(live);

    const graph = await reverseCompile('wf1');
    const { transitions } = projectGraph(graph, 'wf1');

    const key = (t: { fromStatus: string; toStatus: string }) => `${t.fromStatus}->${t.toStatus}`;
    expect(transitions.map(key).sort()).toEqual(live.map(key).sort());
    const submitted = transitions.find((t) => t.toStatus === 'IN_PROGRESS')!;
    expect(submitted.transitionLabel).toBe('SUBMIT');
    expect(submitted.allowedRoles).toEqual(['AGENT']);
  });
});

describe('diffProjection', () => {
  const projected = (over: Partial<ProjectedTransition> = {}): ProjectedTransition => ({
    tenantId: null,
    workflowTypeId: 'wf1',
    fromStatus: 'NEW',
    toStatus: 'CLOSED',
    transitionLabel: 'CLOSE',
    requiresComment: false,
    autoAssignRole: null,
    autoAssignUserId: null,
    allowedRoles: ['AGENT'],
    allowedExecutiveRoles: [],
    isActive: true,
    ...over,
  });

  it('reports no differences for identical sets', () => {
    expect(diffProjection([projected()], [projected()])).toEqual({
      missing: [],
      extra: [],
      changed: [],
    });
  });

  it('reports a transition present live but absent from the projection', () => {
    const result = diffProjection([], [projected()]);
    expect(result.missing).toEqual(['NEW->CLOSED']);
  });

  it('reports a transition the projection invents', () => {
    const result = diffProjection([projected()], []);
    expect(result.extra).toEqual(['NEW->CLOSED']);
  });

  it('reports a transition whose rules differ', () => {
    const result = diffProjection(
      [projected({ requiresComment: true })],
      [projected({ requiresComment: false })],
    );
    expect(result.changed).toEqual(['NEW->CLOSED']);
  });

  it('ignores allowedRoles ordering, which is not semantically meaningful', () => {
    const result = diffProjection(
      [projected({ allowedRoles: ['ADMIN', 'AGENT'] })],
      [projected({ allowedRoles: ['AGENT', 'ADMIN'] })],
    );
    expect(result.changed).toEqual([]);
  });
});