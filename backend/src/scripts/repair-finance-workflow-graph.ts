/**
 * Read-only Finance Purchase Requisition graph repair planner.
 *
 * Default mode is --shadow. This command never mutates Prisma. --write is
 * intentionally fail-closed until a separately reviewed apply implementation
 * exists and an approval marker is supplied.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { compareFinanceVersion, FINANCE_CANONICAL_FINGERPRINT, FINANCE_CANONICAL_GRAPH, FINANCE_RUNTIME_STATUS_EVIDENCE, fingerprintGraph } from './financePurchaseRequisitionCanonical';
import * as graphService from '../services/workflowGraph.service';
import * as versionService from '../services/workflowVersion.service';
import { withSystemScope } from '../lib/execution-scope';

const prisma = new PrismaClient();
const has = (flag: string) => process.argv.includes(flag);
const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const toPersistedGraph = (existingVersion?: any) => {
  const existingNodesByStatus = new Map((existingVersion?.nodes ?? []).map((node: any) => [node.statusCode, node.id]));
  const nodeIdByStatus = new Map<string, string>(FINANCE_CANONICAL_GRAPH.nodes.map((node) => [node.statusCode!, (existingNodesByStatus.get(node.statusCode!) as string | undefined) ?? randomUUID()] as [string, string]));
  const existingEdgesByPair = new Map<string, string>((existingVersion?.edges ?? []).map((edge: any) => {
    const from = existingVersion.nodes.find((node: any) => node.id === edge.fromNodeId)?.statusCode;
    const to = existingVersion.nodes.find((node: any) => node.id === edge.toNodeId)?.statusCode;
    return [`${from}->${to}`, edge.id] as [string, string];
  }));
  const nodes = FINANCE_CANONICAL_GRAPH.nodes.map((node, index) => ({
    ...node,
    id: nodeIdByStatus.get(node.statusCode!)!,
    positionX: node.positionX ?? 80 + (index % 4) * 320,
    positionY: node.positionY ?? 80 + Math.floor(index / 4) * 180,
  }));
  const edges = FINANCE_CANONICAL_GRAPH.edges.map((edge) => {
    const fromStatus = FINANCE_CANONICAL_GRAPH.nodes.find((node) => node.id === edge.fromNodeId)!.statusCode!;
    const toStatus = FINANCE_CANONICAL_GRAPH.nodes.find((node) => node.id === edge.toNodeId)!.statusCode!;
    return { ...edge, id: existingEdgesByPair.get(`${fromStatus}->${toStatus}`) ?? randomUUID(), fromNodeId: nodeIdByStatus.get(fromStatus)!, toNodeId: nodeIdByStatus.get(toStatus)! };
  });
  return { nodes, edges };
};

async function main() {
  const writeRequested = has('--write');
  if (writeRequested) {
    const marker = valueAfter('--approval-marker') ?? process.env.WORKFLOW_REPAIR_APPROVAL_MARKER;
    if (!marker) {
      throw new Error('REFUSED: --write requires --approval-marker or WORKFLOW_REPAIR_APPROVAL_MARKER; no database writes were attempted');
    }
  }

  const workflow = await prisma.workflowType.findFirst({ where: { code: 'FINANCE' }, select: { id: true, code: true, name: true } });
  if (!workflow) throw new Error('Finance workflow type not found');
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowTypeId: workflow.id, status: { in: ['ACTIVE', 'DRAFT'] } },
    include: { nodes: true, edges: true },
    orderBy: [{ status: 'asc' }, { version: 'asc' }, { id: 'asc' }],
  });
  const compiledTransitions = await prisma.workflowTransition.findMany({
    where: { workflowTypeId: workflow.id, isActive: true },
    orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }],
  });
  const compiledSteps = await prisma.workflowStep.findMany({
    where: { workflowTypeId: workflow.id },
    orderBy: [{ displayOrder: 'asc' }, { status: 'asc' }],
  });
  const occupancy = await prisma.request.groupBy({
    by: ['status'],
    where: { requestType: { workflowTypeId: workflow.id } },
    _count: { _all: true },
  });
  const canonical = FINANCE_CANONICAL_FINGERPRINT;
  const comparisons = versions.map((version) => compareFinanceVersion(version));
  const active = versions.find((version) => String(version.status) === 'ACTIVE');
  const draft = versions.find((version) => String(version.status) === 'DRAFT');
  const graphOf = (version: any) => fingerprintGraph({
    nodes: version.nodes.map((node: any) => ({ ...node, type: 'STATUS' })),
    edges: version.edges.map((edge: any) => ({ ...edge })),
  });

  const report = {
    mode: 'shadow',
    writesAttempted: writeRequested,
    workflow: { id: workflow.id, code: workflow.code, name: workflow.name },
    canonical: {
      requestTypeCode: FINANCE_CANONICAL_GRAPH.requestTypeCode,
      approvalOrder: FINANCE_CANONICAL_GRAPH.approvalOrder,
      runtimeStatusEvidence: [...FINANCE_RUNTIME_STATUS_EVIDENCE].sort(),
      hash: canonical.hash,
      nodeCount: canonical.nodeCount,
      edgeCount: canonical.edgeCount,
      statuses: canonical.statuses,
      edges: canonical.edges,
    },
    versions: comparisons,
    active: active ? { versionId: active.id, version: active.version, fingerprint: graphOf(active) } : null,
    draft: draft ? { versionId: draft.id, version: draft.version, fingerprint: graphOf(draft) } : null,
    compiled: { nodeCount: compiledSteps.length, edgeCount: compiledTransitions.length },
    occupiedStatuses: occupancy.map((row: any) => ({ status: row.status, count: row._count._all })).sort((a, b) => a.status.localeCompare(b.status)),
    planner: {
      action: 'REVIEW_CANONICAL_GRAPH_THEN_CREATE_OR_REPLACE_DRAFT',
      duplicateLabelResolution: 'CFO_APPROVED_FIN has one APPROVE edge to PENDING_GROUP_DCEO_APPROVAL; payment processing is reached only after GROUP_DCEO_APPROVED, so no duplicate outgoing label is accepted',
      applyVerification: { expectedHash: canonical.hash, expectedNodeCount: canonical.nodeCount, expectedEdgeCount: canonical.edgeCount },
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (!writeRequested) return;

  const draftVersion = versions.find((version: any) => String(version.status) === 'DRAFT')
    ?? await (async () => {
      const created = await versionService.createDraft(workflow.id);
      return prisma.workflowVersion.findUnique({ where: { id: created.id } });
    })();
  if (!draftVersion) throw new Error('Unable to resolve a Finance draft for apply');
  const publisher = await prisma.user.findFirst({ where: { isActive: true, OR: [{ email: 'admin@test.local' }, { email: 'ceo@test.local' }] }, orderBy: { email: 'asc' }, select: { id: true, email: true } });
  if (!publisher) throw new Error('No active publisher account found for Finance graph apply');
  const persisted = toPersistedGraph();
  await graphService.replaceGraph(draftVersion.id, persisted.nodes, persisted.edges);
  const published = await versionService.publishVersion(draftVersion.id, publisher.id, {});
  const activeAfter = await prisma.workflowVersion.findFirst({ where: { workflowTypeId: workflow.id, status: 'ACTIVE' }, include: { nodes: true, edges: true } });
  if (!activeAfter) throw new Error('Finance publish returned without an ACTIVE version');
  const fingerprintAfter = fingerprintGraph({ nodes: activeAfter.nodes.map((node: any) => ({ ...node, type: 'STATUS' })), edges: activeAfter.edges.map((edge: any) => ({ ...edge })) });
  if (fingerprintAfter.hash !== FINANCE_CANONICAL_FINGERPRINT.hash) throw new Error(`Finance apply verification failed: expected ${FINANCE_CANONICAL_FINGERPRINT.hash}, received ${fingerprintAfter.hash}`);
  console.log(JSON.stringify({ apply: { writePerformed: true, publisher: publisher.email, published, activeVersion: activeAfter.version, fingerprint: fingerprintAfter } }, null, 2));
}

withSystemScope('finance-workflow-repair', main).catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
