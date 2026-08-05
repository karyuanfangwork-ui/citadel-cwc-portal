const mockPrisma = {
  workflowType: { findMany: jest.fn() },
};
const mockGraph = {
  updateNodes: jest.fn(),
  updateEdges: jest.fn(),
};
const mockVersion = {
  listVersions: jest.fn(),
  createDraft: jest.fn(),
  getVersionDetail: jest.fn(),
  publishVersion: jest.fn(),
  rollbackToVersion: jest.fn(),
  discardDraft: jest.fn(),
};

jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../services/workflowGraph.service', () => mockGraph);
jest.mock('../../services/workflowVersion.service', () => mockVersion);

import { WorkflowVersionController } from '../workflowVersion.controller';

function invoke(handler: Function, body: unknown, params: Record<string, string> = {}, user?: { id: string }) {
  return new Promise<{ response?: { statusCode: number; body: unknown }; error?: Error & { statusCode?: number } }>((resolve) => {
    const response = { statusCode: 200, body: undefined as unknown };
    const res = {
      status(code: number) {
        response.statusCode = code;
        return res;
      },
      json(payload: unknown) {
        response.body = payload;
        resolve({ response });
        return res;
      },
    };
    const next = (error?: Error & { statusCode?: number }) => resolve({ error });
    handler({ body, params, user } as any, res as any, next);
  });
}

describe('WorkflowVersionController API contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects malformed node payloads before reaching graph service', async () => {
    const controller = new WorkflowVersionController();
    const result = await invoke(controller.updateNodes, { upsert: [{ id: 'n1' }], remove: [] }, { versionId: 'v1' });

    expect(result.error?.statusCode).toBe(422);
    expect(mockGraph.updateNodes).not.toHaveBeenCalled();
  });

  it('rejects malformed edge payloads before reaching graph service', async () => {
    const controller = new WorkflowVersionController();
    const result = await invoke(
      controller.updateEdges,
      { upsert: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }], remove: [] },
      { versionId: 'v1' },
    );

    expect(result.error?.statusCode).toBe(422);
    expect(mockGraph.updateEdges).not.toHaveBeenCalled();
  });

  it('returns graph batch counts after an atomic service update', async () => {
    mockGraph.updateNodes.mockResolvedValue(undefined);
    const controller = new WorkflowVersionController();
    const result = await invoke(
      controller.updateNodes,
      { upsert: [{ id: '11111111-1111-4111-8111-111111111111', statusCode: 'NEW', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'start' }], remove: ['22222222-2222-4222-8222-222222222222'] },
      { versionId: 'v1' },
    );

    expect(result.response).toEqual({
      statusCode: 200,
      body: { status: 'success', data: { upserted: 1, removed: 1 } },
    });
    expect(mockGraph.updateNodes).toHaveBeenCalledWith('v1', expect.any(Array), ['22222222-2222-4222-8222-222222222222']);
  });

  it('returns 201 and the draft contract when creating a draft', async () => {
    mockVersion.createDraft.mockResolvedValue({ id: 'v2', version: 2 });
    const controller = new WorkflowVersionController();
    const result = await invoke(controller.createDraft, {}, { workflowTypeId: 'wf1' });

    expect(result.response).toEqual({
      statusCode: 201,
      body: { status: 'success', data: { draft: { id: 'v2', version: 2 } } },
    });
  });

  it('passes the authenticated publisher to the lifecycle service', async () => {
    mockVersion.publishVersion.mockResolvedValue({ version: 2, transitionCount: 3, stepCount: 4, movedCount: 0 });
    const controller = new WorkflowVersionController();
    const result = await invoke(controller.publish, {}, { versionId: 'v2' }, { id: 'user-1' });

    expect(result.response?.body).toEqual({
      status: 'success',
      data: { version: 2, transitionCount: 3, stepCount: 4, movedCount: 0 },
    });
    expect(mockVersion.publishVersion).toHaveBeenCalledWith('v2', 'user-1', {});
  });
});

describe('publish endpoint status remap contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVersion.publishVersion.mockResolvedValue({ version: 4, transitionCount: 1, stepCount: 2, movedCount: 2 });
  });

  const controller = new WorkflowVersionController();

  it('forwards a well-formed mapping to the service', async () => {
    const { response } = await invoke(controller.publish, { statusRemap: { LEGACY: 'IN_PROGRESS' } }, { versionId: 'v4' }, { id: 'u1' });
    expect(mockVersion.publishVersion).toHaveBeenCalledWith('v4', 'u1', { LEGACY: 'IN_PROGRESS' });
    expect(response!.statusCode).toBe(200);
  });

  it('defaults to an empty mapping when the body omits it', async () => {
    await invoke(controller.publish, {}, { versionId: 'v4' }, { id: 'u1' });
    expect(mockVersion.publishVersion).toHaveBeenCalledWith('v4', 'u1', {});
  });

  it('rejects a mapping that is not an object of strings', async () => {
    const { error } = await invoke(controller.publish, { statusRemap: { LEGACY: 42 } }, { versionId: 'v4' }, { id: 'u1' });
    expect(error).toBeDefined();
    expect((error as { statusCode?: number }).statusCode).toBe(422);
    expect(mockVersion.publishVersion).not.toHaveBeenCalled();
  });

  it('rejects a mapping sent as an array', async () => {
    const { error } = await invoke(controller.publish, { statusRemap: ['LEGACY'] }, { versionId: 'v4' }, { id: 'u1' });
    expect((error as { statusCode?: number }).statusCode).toBe(422);
  });
});

describe('validate endpoint', () => {
  const controller = new WorkflowVersionController();

  it('returns the remap plan alongside validation so the dialog can be prefilled', async () => {
    const remapPlan = { entries: [], totalRequests: 0 };
    mockVersion.getVersionDetail.mockResolvedValue({ version: {}, graph: { nodes: [], edges: [] }, validation: { blocking: [], warnings: [] }, remapPlan });
    const { response } = await invoke(controller.validate, {}, { versionId: 'v4' });
    expect((response!.body as any).data).toEqual({ validation: { blocking: [], warnings: [] }, remapPlan });
  });
});
