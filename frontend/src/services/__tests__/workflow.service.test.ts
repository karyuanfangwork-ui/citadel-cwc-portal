import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api', () => ({ default: api }));

import workflowService from '../workflow.service';

describe('workflowService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes the versioned workflow list envelope for legacy consumers', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { workflows: [{ id: 'wf-1', name: 'IT Support', code: 'IT_SUPPORT' }] },
      },
    });

    await expect(workflowService.getWorkflowTypes()).resolves.toEqual([
      { id: 'wf-1', name: 'IT Support', code: 'IT_SUPPORT', isActive: true, displayOrder: 0, steps: [] },
    ]);
    expect(api.get).toHaveBeenCalledWith('/admin/workflows');
  });

  it('keeps supporting the legacy workflow list response', async () => {
    const workflow = {
      id: 'wf-1',
      name: 'IT Support',
      code: 'IT_SUPPORT',
      isActive: true,
      displayOrder: 1,
      steps: [],
    };
    api.get.mockResolvedValueOnce({ data: [workflow] });

    await expect(workflowService.getWorkflowTypes()).resolves.toEqual([workflow]);
  });
});