import { describe, expect, it } from 'vitest';
import { calculateLayout, fromReactFlowGraph, toReactFlowGraph } from '../workflowLayout';

const node = (id: string, x: number | null = null, y: number | null = null) => ({ id, type: 'STATUS' as const, statusCode: id, label: id, positionX: x, positionY: y, isInitial: id === 'OPEN', isFinal: id === 'DONE', slaPause: false, icon: 'radio_button_checked' });

describe('workflowLayout', () => {
  it('lays out null coordinates while preserving explicit coordinates', () => {
    const result = toReactFlowGraph({ nodes: [node('OPEN', 0, 0), node('DONE')], edges: [] });
    expect(result.nodes.find((item) => item.id === 'OPEN')?.position).toEqual({ x: 0, y: 0 });
    expect(result.nodes.find((item) => item.id === 'DONE')?.position).not.toEqual({ x: null, y: null });
  });
  it('is deterministic', () => { const graph = { nodes: [node('OPEN'), node('DONE')], edges: [{ id: 'e', fromNodeId: 'OPEN', toNodeId: 'DONE', transitionLabel: null, requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: [], allowedExecutiveRoles: [] }] }; expect(calculateLayout(graph.nodes, graph.edges)).toEqual(calculateLayout(graph.nodes, graph.edges)); });
  it('round trips graph metadata and endpoints', () => { const graph = { nodes: [node('OPEN', 10, 20)], edges: [] }; const flow = toReactFlowGraph(graph); const restored = fromReactFlowGraph(flow.nodes, flow.edges); expect(restored.nodes[0]).toMatchObject(graph.nodes[0]); });
});
