import { validateStructure } from '../workflowValidator.service';
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
  allowedRoles: ['AGENT'],
  allowedExecutiveRoles: [],
  ...over,
});

// NEW → IN_PROGRESS → CLOSED
const validGraph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('IN_PROGRESS'),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [edge('NEW', 'IN_PROGRESS'), edge('IN_PROGRESS', 'CLOSED')],
});

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe('validateStructure', () => {
  it('reports nothing for a valid linear graph', () => {
    const result = validateStructure(validGraph());
    expect(result.blocking).toEqual([]);
  });

  it('blocks when no node is marked initial', () => {
    const graph = validGraph();
    graph.nodes[0].isInitial = false;
    expect(codes(validateStructure(graph).blocking)).toContain('MISSING_INITIAL');
  });

  it('blocks when more than one node is marked initial', () => {
    const graph = validGraph();
    graph.nodes[1].isInitial = true;
    const blocking = validateStructure(graph).blocking;
    expect(codes(blocking)).toContain('MULTIPLE_INITIAL');
    expect(blocking.find((f) => f.code === 'MULTIPLE_INITIAL')!.message).toContain('found 2');
  });

  it('blocks when no node is marked final', () => {
    const graph = validGraph();
    graph.nodes[2].isFinal = false;
    expect(codes(validateStructure(graph).blocking)).toContain('MISSING_FINAL');
  });

  it('blocks a node unreachable from the initial node', () => {
    const graph = validGraph();
    graph.nodes.push(node('ON_HOLD'));
    graph.edges.push(edge('ON_HOLD', 'CLOSED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'UNREACHABLE');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('ON_HOLD');
    expect(finding!.message).toContain('ON_HOLD');
  });

  it('blocks a node with no path to any final node', () => {
    const graph = validGraph();
    graph.nodes.push(node('ESCALATED'));
    graph.edges.push(edge('IN_PROGRESS', 'ESCALATED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'NO_PATH_TO_FINAL');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('ESCALATED');
  });

  it('blocks outgoing edges from a final node', () => {
    const graph = validGraph();
    graph.nodes.push(node('REOPENED'));
    graph.edges.push(edge('CLOSED', 'REOPENED'), edge('REOPENED', 'CLOSED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'FINAL_HAS_OUTGOING');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('CLOSED');
  });

  it('blocks an orphan node with no connections', () => {
    const graph = validGraph();
    graph.nodes.push(node('CANCELLED'));
    expect(codes(validateStructure(graph).blocking)).toContain('ORPHAN_NODE');
  });

  it('blocks an edge whose endpoint is missing from the graph', () => {
    const graph = validGraph();
    graph.edges.push(edge('IN_PROGRESS', 'GHOST'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'DANGLING_EDGE');
    expect(finding).toBeDefined();
    expect(finding!.edgeId).toBe('IN_PROGRESS->GHOST');
  });

  it('accumulates every fault rather than stopping at the first', () => {
    const graph: WorkflowGraph = {
      nodes: [node('A'), node('B')],
      edges: [],
    };
    const found = codes(validateStructure(graph).blocking);
    expect(found).toContain('MISSING_INITIAL');
    expect(found).toContain('MISSING_FINAL');
    expect(found).toContain('ORPHAN_NODE');
  });

  it('warns about an edge open to any authenticated user', () => {
    const graph = validGraph();
    graph.edges[0].allowedRoles = [];
    graph.edges[0].allowedExecutiveRoles = [];
    const finding = validateStructure(graph).warnings.find((f) => f.code === 'OPEN_EDGE');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('any authenticated user');
  });

  it('warns when a REJECT edge does not require a comment', () => {
    const graph = validGraph();
    graph.edges[1].transitionLabel = 'REJECT';
    graph.edges[1].requiresComment = false;
    expect(codes(validateStructure(graph).warnings)).toContain('REJECT_WITHOUT_COMMENT');
  });

  it('does not warn when a REJECT edge requires a comment', () => {
    const graph = validGraph();
    graph.edges[1].transitionLabel = 'REJECT';
    graph.edges[1].requiresComment = true;
    expect(codes(validateStructure(graph).warnings)).not.toContain('REJECT_WITHOUT_COMMENT');
  });

  it('blocks a STATUS node without a status code', () => {
    const graph = validGraph();
    graph.nodes[1].statusCode = null;
    expect(codes(validateStructure(graph).blocking)).toContain('INVALID_STATUS_NODE');
  });

  it('blocks duplicate node ids and duplicate status codes', () => {
    const graph = validGraph();
    graph.nodes.push({ ...graph.nodes[1], id: 'NEW' });
    const codesFound = codes(validateStructure(graph).blocking);
    expect(codesFound).toContain('DUPLICATE_NODE_ID');
    expect(codesFound).toContain('DUPLICATE_STATUS_CODE');
  });

  it('blocks duplicate edge identities', () => {
    const graph = validGraph();
    graph.edges.push({ ...graph.edges[0] });
    expect(codes(validateStructure(graph).blocking)).toContain('DUPLICATE_EDGE');
  });

  it('blocks duplicate outgoing transition labels', () => {
    const graph = validGraph();
    graph.edges[0].transitionLabel = 'ADVANCE';
    graph.edges.push(edge('NEW', 'CLOSED', { id: 'new-to-closed', transitionLabel: 'ADVANCE' }));
    expect(codes(validateStructure(graph).blocking)).toContain('DUPLICATE_OUTGOING_LABEL');
  });
});