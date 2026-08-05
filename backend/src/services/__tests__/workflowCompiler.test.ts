const mockTx = {
  workflowVersion: { findUnique: jest.fn() },
  workflowTransition: { deleteMany: jest.fn(), createMany: jest.fn() },
  workflowStep: { deleteMany: jest.fn(), createMany: jest.fn() },
};
const mockPrisma = {
  workflowVersion: { findUnique: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { compileVersion, projectGraph } from '../workflowCompiler.service';
import { GraphEdge, GraphNode, WorkflowGraph } from '../workflowGraph.types';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: 'STATUS',
  statusCode: id,
  positionX: 10,
  positionY: 20,
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

const graph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true, icon: 'add' }),
    node('IN_PROGRESS', { slaPause: false }),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [
    edge('NEW', 'IN_PROGRESS', { transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
    edge('IN_PROGRESS', 'CLOSED', {
      transitionLabel: 'CLOSE',
      requiresComment: true,
      allowedExecutiveRoles: ['CEO'],
      autoAssignRole: 'IT',
    }),
  ],
});

describe('projectGraph', () => {
  it('maps each edge to a workflow-scoped transition row', () => {
    const { transitions } = projectGraph(graph(), 'wf1');
    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toEqual({
      tenantId: null,
      workflowTypeId: 'wf1',
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
      transitionLabel: 'SUBMIT',
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
      isActive: true,
    });
  });

  it('carries comment, auto-assign, and executive-role rules onto the transition', () => {
    const { transitions } = projectGraph(graph(), 'wf1');
    const close = transitions.find((t) => t.toStatus === 'CLOSED')!;
    expect(close.requiresComment).toBe(true);
    expect(close.autoAssignRole).toBe('IT');
    expect(close.allowedExecutiveRoles).toEqual(['CEO']);
  });

  it('maps each node to a workflow step, ordered from the initial node outward', () => {
    const { steps } = projectGraph(graph(), 'wf1');
    expect(steps.map((s) => s.status)).toEqual(['NEW', 'IN_PROGRESS', 'CLOSED']);
    expect(steps.map((s) => s.displayOrder)).toEqual([0, 1, 2]);
    expect(steps[0]).toEqual({
      workflowTypeId: 'wf1',
      status: 'NEW',
      label: 'NEW',
      icon: 'add',
      displayOrder: 0,
      isInitial: true,
      isFinal: false,
      slaPause: false,
    });
  });

  it('preserves authored labels and display order when projecting steps', () => {
    const authored = graph();
    authored.nodes[0].label = 'Submitted by requester';
    authored.nodes[0].displayOrder = 7;
    authored.nodes[1].label = 'Agent review';
    authored.nodes[1].displayOrder = 8;
    authored.nodes[2].label = 'Closed';
    authored.nodes[2].displayOrder = 9;
    const { steps } = projectGraph(authored, 'wf1');
    expect(steps.map((step) => step.label)).toEqual(['Submitted by requester', 'Agent review', 'Closed']);
    expect(steps.map((step) => step.displayOrder)).toEqual([7, 8, 9]);
  });

  it('orders steps by graph distance so a branching graph still reads sensibly', () => {
    const branching: WorkflowGraph = {
      nodes: [
        node('NEW', { isInitial: true }),
        node('APPROVED'),
        node('REJECTED', { isFinal: true }),
        node('CLOSED', { isFinal: true }),
      ],
      edges: [
        edge('NEW', 'APPROVED'),
        edge('NEW', 'REJECTED'),
        edge('APPROVED', 'CLOSED'),
      ],
    };
    const { steps } = projectGraph(branching, 'wf1');
    expect(steps[0].status).toBe('NEW');
    expect(steps.map((s) => s.status).slice(1, 3).sort()).toEqual(['APPROVED', 'REJECTED']);
    expect(steps[3].status).toBe('CLOSED');
  });

  it('skips non-status nodes, which have no status code to compile', () => {
    const withGate: WorkflowGraph = graph();
    withGate.nodes.push({ ...node('gate-1'), statusCode: null });
    const { transitions, steps } = projectGraph(withGate, 'wf1');
    expect(steps.map((s) => s.status)).not.toContain(null);
    expect(steps).toHaveLength(3);
    expect(transitions).toHaveLength(2);
  });
});

describe('compileVersion', () => {
  beforeEach(() => jest.clearAllMocks());

  const dbVersion = {
    id: 'v1',
    workflowTypeId: 'wf1',
    nodes: [
      { id: 'NEW', type: 'STATUS', statusCode: 'NEW', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'add' },
      { id: 'CLOSED', type: 'STATUS', statusCode: 'CLOSED', positionX: 0, positionY: 0, isInitial: false, isFinal: true, slaPause: false, icon: 'done' },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'NEW', toNodeId: 'CLOSED', transitionLabel: 'CLOSE', requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: ['AGENT'], allowedExecutiveRoles: [] },
    ],
  };

  it('replaces only this workflow\'s transitions, leaving global rows untouched', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    mockTx.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    await compileVersion('v1');
    expect(mockTx.workflowTransition.deleteMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1', tenantId: null },
    });
  });

  it('writes the projected transitions and steps', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    mockTx.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    const result = await compileVersion('v1');
    expect(mockTx.workflowTransition.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ fromStatus: 'NEW', toStatus: 'CLOSED', workflowTypeId: 'wf1' }),
      ],
    });
    expect(mockTx.workflowStep.createMany).toHaveBeenCalled();
    expect(result).toEqual({ transitionCount: 1, stepCount: 2 });
  });

  it('runs delete and create inside a single transaction', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    mockTx.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    await compileVersion('v1');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('throws when the version does not exist', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(null);
    mockTx.workflowVersion.findUnique.mockResolvedValue(null);
    await expect(compileVersion('missing')).rejects.toThrow('Workflow version missing not found');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});