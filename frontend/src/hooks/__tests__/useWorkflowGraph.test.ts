import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  updateNodes: vi.fn().mockResolvedValue({ upserted: 1, removed: 0 }),
  updateEdges: vi.fn().mockResolvedValue({ upserted: 1, removed: 0 }),
  replaceGraph: vi.fn().mockResolvedValue({ nodeCount: 1, edgeCount: 1 }),
  validateVersion: vi.fn().mockResolvedValue({ validation: { blocking: [], warnings: [] }, remapPlan: { entries: [], totalRequests: 0 } }),
}));
vi.mock('../../services/workflow-version.service', () => ({ default: service }));
import { useWorkflowGraph } from '../useWorkflowGraph';

const graph = {
  nodes: [
    { id: 'n1', type: 'STATUS' as const, statusCode: 'OPEN', label: 'Open', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'radio_button_checked' },
    { id: 'n2', type: 'STATUS' as const, statusCode: 'CFO_APPROVAL', label: 'CFO Approval', positionX: 100, positionY: 0, isInitial: false, isFinal: false, slaPause: true, icon: 'pending' },
    { id: 'n3', type: 'STATUS' as const, statusCode: 'CLOSED', label: 'Closed', positionX: 200, positionY: 0, isInitial: false, isFinal: true, slaPause: false, icon: 'check_circle' },
  ],
  edges: [
    { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', transitionLabel: 'SUBMIT', requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: [], allowedExecutiveRoles: [] },
    { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3', transitionLabel: 'APPROVE', requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: [], allowedExecutiveRoles: [] },
  ],
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

  it('persists deletion of a node and all of its incident edges', async () => {
    const { result } = renderHook(() => useWorkflowGraph('v1', graph, false));

    act(() => result.current.removeNode('n2'));
    expect(result.current.nodes.map((node) => node.id)).toEqual(['n1', 'n3']);
    expect(result.current.edges).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(service.replaceGraph).toHaveBeenCalledWith('v1', expect.objectContaining({
      nodes: expect.not.arrayContaining([expect.objectContaining({ id: 'n2' })]),
      edges: [],
    }));
  });

  it('seeds the remap plan from the initial detail and refreshes it on validate', async () => {
    const seeded = { entries: [{ statusCode: 'LEGACY', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows LEGACY → IN_PROGRESS', allowedTargets: ['IN_PROGRESS'], sourcePausesSla: false }], totalRequests: 1 };
    const refreshed = { entries: [], totalRequests: 0 };
    service.validateVersion.mockResolvedValue({ validation: { blocking: [], warnings: [] }, remapPlan: refreshed });

    const { result } = renderHook(() => useWorkflowGraph('v4', graph, false, seeded));
    expect(result.current.remapPlan).toEqual(seeded);

    await act(async () => { await result.current.validate(); });
    expect(result.current.remapPlan).toEqual(refreshed);
  });
});
