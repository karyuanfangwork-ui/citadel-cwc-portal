import { inventoryWorkflowRuntimeParity } from '../workflowRuntimeParity.service';

const definition = (code: string) => ({ code, label: code, isActive: true, lifecycleType: 'OPEN' });
const clientFor = (overrides: Record<string, unknown> = {}) => ({
  workflowType: { findMany: jest.fn().mockResolvedValue([{ id: 'wf-1', code: 'IT_SIMPLE', name: 'IT Simple' }]) },
  requestStatusDefinition: { findMany: jest.fn().mockResolvedValue([]) },
  workflowVersion: { findMany: jest.fn().mockResolvedValue([]) },
  workflowStep: { findMany: jest.fn().mockResolvedValue([]) },
  workflowTransition: { findMany: jest.fn().mockResolvedValue([]) },
  requestType: { findMany: jest.fn().mockResolvedValue([]) },
  request: { groupBy: jest.fn().mockResolvedValue([]) },
  ...overrides,
});

const run = (client: any, evidence: string[] = []) =>
  inventoryWorkflowRuntimeParity({ client, runtimeEvidenceProvider: () => evidence });

describe('inventoryWorkflowRuntimeParity', () => {
  it('returns deterministic empty sets for an empty catalogue and runtime', async () => {
    const result = (await run(clientFor()))[0];
    expect(result.statusDefinitions).toEqual([]);
    expect(result.graph).toEqual({ statuses: [], transitions: [] });
    expect(result.compiled).toEqual({ steps: [], transitions: [] });
    expect(result.requestOccupancy).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(result.deterministic).toBe(true);
  });

  it('reports catalogue-only statuses', async () => {
    const client = clientFor({ requestStatusDefinition: { findMany: jest.fn().mockResolvedValue([definition('CATALOGUE_ONLY')]) } });
    const result = (await run(client))[0];
    expect(result.findings).toEqual([expect.objectContaining({ code: 'CATALOGUE_ONLY', status: 'CATALOGUE_ONLY' })]);
  });

  it('reports occupied statuses absent from graph and compiled steps', async () => {
    const client = clientFor({
      requestType: { findMany: jest.fn().mockResolvedValue([{ id: 'request-type-1' }]) },
      request: { groupBy: jest.fn().mockResolvedValue([{ status: 'REMOVED', _count: { _all: 3 } }]) },
    });
    const result = (await run(client))[0];
    expect(result.requestOccupancy).toEqual([{ status: 'REMOVED', count: 3 }]);
    expect(result.findings).toEqual([expect.objectContaining({ code: 'OCCUPIED_MISSING', status: 'REMOVED' })]);
  });

  it('reports runtime-only statuses from the injectable evidence provider', async () => {
    const result = (await run(clientFor(), ['LEGACY_RUNTIME']))[0];
    expect(result.runtimeStatusEvidence).toEqual(['LEGACY_RUNTIME']);
    expect(result.findings).toEqual([expect.objectContaining({ code: 'RUNTIME_ONLY', status: 'LEGACY_RUNTIME' })]);
  });

  it('reports graph transitions missing from compiled artifacts', async () => {
    const client = clientFor({
      workflowVersion: { findMany: jest.fn().mockResolvedValue([{
        id: 'version-1', workflowTypeId: 'wf-1', version: 1, status: 'ACTIVE',
        nodes: [{ id: 'n1', statusCode: 'A' }, { id: 'n2', statusCode: 'B' }],
        edges: [{ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' }],
      }]) },
      workflowStep: { findMany: jest.fn().mockResolvedValue([{ status: 'A', displayOrder: 0, isInitial: true, isFinal: false, slaPause: false }, { status: 'B', displayOrder: 1, isInitial: false, isFinal: true, slaPause: false }]) },
    });
    const result = (await run(client))[0];
    expect(result.findings).toEqual([expect.objectContaining({ code: 'COMPILED_GRAPH_MISMATCH', transition: 'A->B' })]);
  });
});
