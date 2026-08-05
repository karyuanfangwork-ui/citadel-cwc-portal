import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  updateNodes: vi.fn().mockResolvedValue({ upserted: 1, removed: 0 }),
  updateEdges: vi.fn().mockResolvedValue({ upserted: 1, removed: 0 }),
  validateVersion: vi.fn().mockResolvedValue({ validation: { blocking: [], warnings: [] } }),
}));
vi.mock('../../services/workflow-version.service', () => ({ default: service }));
import { useWorkflowGraph } from '../useWorkflowGraph';

const graph = {
  nodes: [{ id: 'n1', type: 'STATUS' as const, statusCode: 'OPEN', label: 'Open', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'radio_button_checked' }],
  edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n1', transitionLabel: 'Advance', requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: [], allowedExecutiveRoles: [] }],
};

describe('useWorkflowGraph', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the rendered edge label synchronized with inspector edits', () => {
    const { result } = renderHook(() => useWorkflowGraph('v1', graph, false));
    act(() => result.current.updateEdge('e1', { transitionLabel: 'Progress' }));
    expect(result.current.edges[0].label).toBe('Progress');
    expect((result.current.edges[0].data as { transitionLabel: string }).transitionLabel).toBe('Progress');
  });
});
