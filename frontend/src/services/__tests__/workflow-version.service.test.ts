import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('../api', () => ({ default: apiClient }));
import workflowVersionService from '../workflow-version.service';

const ok = (data: unknown) => ({ data: { status: 'success', data } });

describe('workflowVersionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists workflows and unwraps the envelope', async () => { apiClient.get.mockResolvedValueOnce(ok({ workflows: [] })); expect(await workflowVersionService.listWorkflows()).toEqual({ workflows: [] }); expect(apiClient.get).toHaveBeenCalledWith('/admin/workflows'); });
  it('lists versions', async () => { apiClient.get.mockResolvedValueOnce(ok({ versions: [] })); await workflowVersionService.listVersions('wt-1'); expect(apiClient.get).toHaveBeenCalledWith('/admin/workflows/wt-1/versions'); });
  it('creates a draft', async () => { apiClient.post.mockResolvedValueOnce(ok({ draft: { id: 'v-1', version: 2 } })); await workflowVersionService.createDraft('wt-1'); expect(apiClient.post).toHaveBeenCalledWith('/admin/workflows/wt-1/versions'); });
  it('loads a version detail', async () => { apiClient.get.mockResolvedValueOnce(ok({ version: {}, graph: { nodes: [], edges: [] }, validation: { blocking: [], warnings: [] } })); await workflowVersionService.getVersion('v-1'); expect(apiClient.get).toHaveBeenCalledWith('/admin/workflows/versions/v-1'); });
  it('sends complete node and edge batches', async () => { apiClient.patch.mockResolvedValue(ok({ upserted: 1, removed: 0 })); const node = { id: 'n', type: 'STATUS' as const, statusCode: 'OPEN', label: 'Open', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'radio_button_checked' }; const edge = { id: 'e', fromNodeId: 'n', toNodeId: 'n2', transitionLabel: null, requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: [], allowedExecutiveRoles: [] }; await workflowVersionService.updateNodes('v-1', { upsert: [node], remove: [] }); await workflowVersionService.updateEdges('v-1', { upsert: [edge], remove: [] }); expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/admin/workflows/versions/v-1/nodes', { upsert: [node], remove: [] }); expect(apiClient.patch).toHaveBeenNthCalledWith(2, '/admin/workflows/versions/v-1/edges', { upsert: [edge], remove: [] }); });
  it('calls validation and lifecycle endpoints', async () => { apiClient.post.mockResolvedValue(ok({ validation: { blocking: [], warnings: [] } })); await workflowVersionService.validateVersion('v'); expect(apiClient.post).toHaveBeenCalledWith('/admin/workflows/versions/v/validate'); apiClient.post.mockResolvedValueOnce(ok({ version: 2 })); await workflowVersionService.publishVersion('v'); expect(apiClient.post).toHaveBeenCalledWith('/admin/workflows/versions/v/publish'); apiClient.post.mockResolvedValueOnce(ok({ version: 1 })); await workflowVersionService.rollbackVersion('v'); expect(apiClient.post).toHaveBeenCalledWith('/admin/workflows/versions/v/rollback'); });
  it('discards a draft', async () => { apiClient.delete.mockResolvedValueOnce(ok({ discarded: true })); await workflowVersionService.discardDraft('v-1'); expect(apiClient.delete).toHaveBeenCalledWith('/admin/workflows/versions/v-1'); });
  it('propagates server errors', async () => { const error = new Error('already has an open draft'); apiClient.post.mockRejectedValueOnce(error); await expect(workflowVersionService.createDraft('wt-1')).rejects.toThrow('already has an open draft'); });
});
