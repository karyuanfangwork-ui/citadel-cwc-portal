import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { GraphEdge, GraphNode } from '../services/workflow-version.service';

export type WorkflowNodeData = GraphNode & Record<string, unknown>;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

export function toReactFlowGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[] }): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
} {
  const needsLayout = graph.nodes.some((node) => node.positionX === null || node.positionY === null);
  const positions = needsLayout ? calculateLayout(graph.nodes, graph.edges) : new Map<string, { x: number; y: number }>();

  const nodes = graph.nodes.map((node) => {
    const fallback = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      type: 'status',
      position: {
        x: node.positionX ?? fallback.x,
        y: node.positionY ?? fallback.y,
      },
      data: { ...node },
    } satisfies Node<WorkflowNodeData>;
  });

  const edges = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    type: 'workflow' as const,
    data: { ...edge },
    label: edge.transitionLabel ?? undefined,
    animated: false,
  } satisfies Edge));

  return { nodes, edges };
}

export function calculateLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 140, marginx: 40, marginy: 40 });
  [...nodes].sort((a, b) => a.id.localeCompare(b.id)).forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  [...edges].sort((a, b) => a.id.localeCompare(b.id)).forEach((edge) => {
    if (graph.hasNode(edge.fromNodeId) && graph.hasNode(edge.toNodeId)) graph.setEdge(edge.fromNodeId, edge.toNodeId);
  });
  dagre.layout(graph);

  return new Map(nodes.map((node) => {
    const point = graph.node(node.id);
    return [node.id, {
      x: Math.round((point?.x ?? 0) - NODE_WIDTH / 2),
      y: Math.round((point?.y ?? 0) - NODE_HEIGHT / 2),
    }];
  }));
}

export function fromReactFlowGraph(nodes: Node<WorkflowNodeData>[], edges: Edge[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: nodes.map((node) => ({
      ...node.data,
      id: node.id,
      positionX: node.position.x,
      positionY: node.position.y,
    })),
    edges: edges.map((edge) => ({
      ...(edge.data as unknown as GraphEdge),
      id: edge.id,
      fromNodeId: edge.source,
      toNodeId: edge.target,
    })),
  };
}
