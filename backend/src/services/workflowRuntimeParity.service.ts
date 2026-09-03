/**
 * Read-only inventory of the status/workflow sources that participate in runtime.
 * This module deliberately has no mutation path; the client is injectable so the
 * parity contract can be tested without a database.
 */
import prisma from '../utils/prisma';
import { VALID_TRANSITIONS } from '../utils/workflowTransitions';
import { loadOccupancy } from './statusRemap.service';

export interface RuntimeEvidenceProvider {
  (workflow: { id: string; code: string }): Promise<string[]> | string[];
}

export interface WorkflowRuntimeParityOptions {
  workflowCode?: string;
  client?: any;
  runtimeEvidenceProvider?: RuntimeEvidenceProvider;
}

export interface ParityStatusDefinition {
  code: string;
  label: string;
  isActive: boolean;
  lifecycleType: string;
}
export interface ParityWorkflowVersion {
  id: string;
  workflowTypeId: string;
  version: number;
  status: string;
  nodeStatusCodes: string[];
  edges: Array<{ fromStatus: string; toStatus: string }>;
}
export interface ParityCompiledStep {
  status: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
}
export interface ParityCompiledTransition {
  fromStatus: string;
  toStatus: string;
  transitionLabel: string | null;
  requiresComment: boolean;
}
export type ParityFindingCode =
  | 'CATALOGUE_ONLY'
  | 'RUNTIME_ONLY'
  | 'OCCUPIED_MISSING'
  | 'COMPILED_GRAPH_MISMATCH';
export interface ParityFinding {
  code: ParityFindingCode;
  status?: string;
  transition?: string;
  detail: string;
}
export interface WorkflowRuntimeParityResult {
  workflow: { id: string; code: string; name: string };
  statusDefinitions: ParityStatusDefinition[];
  workflowVersions: ParityWorkflowVersion[];
  graph: { statuses: string[]; transitions: Array<{ fromStatus: string; toStatus: string }> };
  compiled: { steps: ParityCompiledStep[]; transitions: ParityCompiledTransition[] };
  runtimeStatusEvidence: string[];
  requestOccupancy: Array<{ status: string; count: number }>;
  findings: ParityFinding[];
  catalogueOnly: string[];
  draftOnly: string[];
  activeOnly: string[];
  runtimeMissingFromActiveGraph: string[];
  occupiedMissingFromActiveGraph: string[];
  compiledMissingFromGraph: string[];
  graphMissingFromCompiled: string[];
  deterministic: true;
}

/** A no-op keeps the service honest when no runtime evidence source is supplied. */
export const emptyRuntimeEvidenceProvider: RuntimeEvidenceProvider = () => [];

/** Legacy fallback evidence, kept explicit and injectable for the CLI/audits. */
export const legacyRuntimeEvidenceProvider: RuntimeEvidenceProvider = () => {
  const statuses = new Set<string>();
  for (const [from, tos] of Object.entries(VALID_TRANSITIONS)) {
    statuses.add(from);
    tos.forEach((to) => statuses.add(to));
  }
  return [...statuses];
};

const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const transitionKey = (fromStatus: string, toStatus: string) => `${fromStatus}->${toStatus}`;

export async function inventoryWorkflowRuntimeParity(
  options: WorkflowRuntimeParityOptions = {},
): Promise<WorkflowRuntimeParityResult[]> {
  const client = options.client ?? prisma;
  const workflows = await client.workflowType.findMany({
    where: options.workflowCode ? { code: options.workflowCode } : undefined,
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  const provider = options.runtimeEvidenceProvider ?? emptyRuntimeEvidenceProvider;
  const results: WorkflowRuntimeParityResult[] = [];

  for (const workflow of [...workflows].sort((a: any, b: any) => a.code.localeCompare(b.code))) {
    const [definitions, versions, steps, compiledTransitions, occupancy, runtimeEvidence] = await Promise.all([
      client.requestStatusDefinition.findMany({ orderBy: { code: 'asc' } }),
      client.workflowVersion.findMany({
        where: { workflowTypeId: workflow.id },
        include: { nodes: true, edges: true },
        orderBy: [{ version: 'asc' }, { id: 'asc' }],
      }),
      client.workflowStep.findMany({ where: { workflowTypeId: workflow.id }, orderBy: [{ displayOrder: 'asc' }, { status: 'asc' }] }),
      client.workflowTransition.findMany({ where: { workflowTypeId: workflow.id, isActive: true }, orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }] }),
      loadOccupancy(workflow.id, client),
      provider({ id: workflow.id, code: workflow.code }),
    ]);

    const statusDefinitions: ParityStatusDefinition[] = definitions.map((d: any) => ({
      code: d.code, label: d.label, isActive: d.isActive, lifecycleType: String(d.lifecycleType),
    })).sort((a: ParityStatusDefinition, b: ParityStatusDefinition) => a.code.localeCompare(b.code));
    const graphTransitions: Array<{ fromStatus: string; toStatus: string }> = [];
    const graphStatuses: string[] = [];
    const parityVersions: ParityWorkflowVersion[] = versions.map((v: any) => {
      const byId = new Map((v.nodes ?? []).map((n: any) => [n.id, n.statusCode]));
      const nodeStatusCodes = sorted((v.nodes ?? []).map((n: any) => n.statusCode).filter(Boolean));
      const edges = (v.edges ?? []).map((e: any) => ({ fromStatus: byId.get(e.fromNodeId), toStatus: byId.get(e.toNodeId) }))
        .filter((e: any) => e.fromStatus && e.toStatus).map((e: any) => ({ fromStatus: e.fromStatus, toStatus: e.toStatus }))
        .sort((a: any, b: any) => transitionKey(a.fromStatus, a.toStatus).localeCompare(transitionKey(b.fromStatus, b.toStatus)));
      graphStatuses.push(...nodeStatusCodes); graphTransitions.push(...edges);
      return { id: v.id, workflowTypeId: v.workflowTypeId, version: v.version, status: String(v.status), nodeStatusCodes, edges };
    });
    const graph = { statuses: sorted(graphStatuses), transitions: uniqueTransitions(graphTransitions) };
    const compiled = {
      steps: steps.map((s: any) => ({ status: s.status, displayOrder: s.displayOrder, isInitial: s.isInitial, isFinal: s.isFinal, slaPause: s.slaPause })),
      transitions: compiledTransitions.map((t: any) => ({ fromStatus: t.fromStatus, toStatus: t.toStatus, transitionLabel: t.transitionLabel ?? null, requiresComment: t.requiresComment })),
    };
    const runtime = sorted((runtimeEvidence as string[]).map((status: string) => status));
    const catalogue = new Set(statusDefinitions.map((d) => d.code));
    const represented = new Set([...graph.statuses, ...compiled.steps.map((s: ParityCompiledStep) => s.status)]);
    const findings: ParityFinding[] = [];
    for (const status of statusDefinitions.map((d) => d.code)) if (!represented.has(status) && !runtime.includes(status)) findings.push({ code: 'CATALOGUE_ONLY', status, detail: `Catalogue status ${status} is not represented by graph, compiled steps, or runtime evidence` });
    for (const status of runtime) if (!catalogue.has(status)) findings.push({ code: 'RUNTIME_ONLY', status, detail: `Runtime status ${status} has no catalogue definition` });
    for (const [status, count] of [...occupancy.entries()].sort((a, b) => a[0].localeCompare(b[0]))) if (!represented.has(status)) findings.push({ code: 'OCCUPIED_MISSING', status, detail: `${count} request(s) occupy ${status}, but it is absent from the graph and compiled steps` });
    const graphKeys = new Set<string>(graph.transitions.map((t) => transitionKey(t.fromStatus, t.toStatus)));
    const compiledKeys = new Set<string>(compiled.transitions.map((t: ParityCompiledTransition) => transitionKey(t.fromStatus, t.toStatus)));
    const activeVersion = parityVersions.find((version) => version.status === 'ACTIVE');
    const draftVersion = parityVersions.find((version) => version.status === 'DRAFT');
    const activeStatuses = new Set(activeVersion?.nodeStatusCodes ?? []);
    const draftStatuses = new Set(draftVersion?.nodeStatusCodes ?? []);
    const catalogueStatuses = new Set(statusDefinitions.filter((definition) => definition.isActive).map((definition) => definition.code));
    const catalogueOnly = sorted([...catalogueStatuses].filter((status) => !activeStatuses.has(status)));
    const draftOnly = sorted([...draftStatuses].filter((status) => !activeStatuses.has(status)));
    const activeOnly = sorted([...activeStatuses].filter((status) => !catalogueStatuses.has(status)));
    const runtimeMissingFromActiveGraph = sorted(runtime.filter((status) => !activeStatuses.has(status)));
    const occupiedMissingFromActiveGraph = sorted([...occupancy.keys()].filter((status) => !activeStatuses.has(status)));
    const compiledMissingFromGraph = sorted([...compiledKeys].filter((key) => !graphKeys.has(key)));
    const graphMissingFromCompiled = sorted([...graphKeys].filter((key) => !compiledKeys.has(key)));
    for (const key of graphMissingFromCompiled) findings.push({ code: 'COMPILED_GRAPH_MISMATCH', transition: key, detail: `Graph transition ${key} has no compiled transition` });
    for (const key of compiledMissingFromGraph) findings.push({ code: 'COMPILED_GRAPH_MISMATCH', transition: key, detail: `Compiled transition ${key} has no graph edge` });
    results.push({ workflow: { id: workflow.id, code: workflow.code, name: workflow.name }, statusDefinitions, workflowVersions: parityVersions, graph, compiled, runtimeStatusEvidence: runtime, requestOccupancy: [...occupancy.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([status, count]) => ({ status, count })), findings: findings.sort((a, b) => `${a.code}:${a.status ?? a.transition ?? ''}`.localeCompare(`${b.code}:${b.status ?? b.transition ?? ''}`)), catalogueOnly, draftOnly, activeOnly, runtimeMissingFromActiveGraph, occupiedMissingFromActiveGraph, compiledMissingFromGraph, graphMissingFromCompiled, deterministic: true });
  }
  return results;
}

export const auditWorkflowRuntimeParity = inventoryWorkflowRuntimeParity;

function uniqueTransitions(values: Array<{ fromStatus: string; toStatus: string }>) {
  const byKey = new Map(values.map((value) => [transitionKey(value.fromStatus, value.toStatus), value]));
  return [...byKey.values()].sort((a, b) => transitionKey(a.fromStatus, a.toStatus).localeCompare(transitionKey(b.fromStatus, b.toStatus)));
}
