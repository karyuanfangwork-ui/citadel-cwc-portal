import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { withSystemScope } from '../src/lib/execution-scope';
import { replaceGraph } from '../src/services/workflowGraph.service';
import { loadGraph } from '../src/services/workflowCompiler.service';
import { createDraft, publishVersion } from '../src/services/workflowVersion.service';

const prisma = new PrismaClient();
const WORKFLOW_CODE = 'FINANCE';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const PUBLISHER_EMAIL = 'admin@test.local';
const REQUIRED_PAIRS = new Set([
  'PENDING_CEO_APPROVAL_FIN->PENDING_CFO_APPROVAL_FIN',
  'PENDING_CEO_APPROVAL_FIN->CEO_APPROVED_FIN',
  'CEO_APPROVED_FIN->PENDING_CFO_APPROVAL_FIN',
  'PENDING_CEO_APPROVAL_FIN->CEO_REJECTED_FIN',
]);

async function main() {
  const writeMode = process.argv.includes('--write');
  if (writeMode && !process.argv.includes('--approve-local-finance-rectification')) {
    throw new Error('Refusing workflow publish. Re-run with --write --approve-local-finance-rectification after reviewing shadow output.');
  }

  const workflow = await prisma.workflowType.findUnique({
    where: { code: WORKFLOW_CODE },
    select: { id: true, versions: { where: { status: 'ACTIVE' }, select: { id: true, version: true } } },
  });
  const active = workflow?.versions[0];
  if (!workflow || !active) throw new Error('Active Finance workflow version not found');

  const { graph } = await loadGraph(active.id);
  const statusByNode = new Map(graph.nodes.map((node) => [node.id, node.statusCode]));
  const edgePlans = graph.edges.flatMap((edge) => {
    const from = statusByNode.get(edge.fromNodeId);
    const to = statusByNode.get(edge.toNodeId);
    const pair = `${from}->${to}`;
    if (!REQUIRED_PAIRS.has(pair)) return [];
    const roles = [...new Set([...edge.allowedExecutiveRoles, 'GROUP_DCEO'])].sort();
    return [{ edgeId: edge.id, pair, currentRoles: edge.allowedExecutiveRoles, plannedRoles: roles }];
  });
  const seenPairs = new Set(edgePlans.map((item) => item.pair));
  const missingPairs = [...REQUIRED_PAIRS].filter((pair) => !seenPairs.has(pair));
  const changes = edgePlans.filter((item) => JSON.stringify(item.currentRoles) !== JSON.stringify(item.plannedRoles));
  console.log(JSON.stringify({
    mode: writeMode ? 'write' : 'shadow',
    applyWillRun: writeMode && changes.length > 0,
    workflow: WORKFLOW_CODE,
    activeVersion: active.version,
    activeVersionId: active.id,
    requiredEdges: edgePlans,
    missingPairs,
    edgesToChange: changes.length,
  }, null, 2));
  if (!writeMode || changes.length === 0) return;
  if (missingPairs.length > 0) throw new Error(`Refusing publish; active graph is missing expected edge(s): ${missingPairs.join(', ')}`);

  const publisher = await prisma.user.findFirst({
    where: { email: PUBLISHER_EMAIL, tenantId: TENANT_ID, isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
    select: { id: true, email: true },
  });
  if (!publisher) throw new Error('Active local Finance workflow publisher admin@test.local was not found');

  const draft = await createDraft(workflow.id);
  const draftGraph = (await loadGraph(draft.id)).graph;
  const draftStatusByNode = new Map(draftGraph.nodes.map((node) => [node.id, node.statusCode]));
  const patchedEdges = draftGraph.edges.map((edge) => {
    const pair = `${draftStatusByNode.get(edge.fromNodeId)}->${draftStatusByNode.get(edge.toNodeId)}`;
    return REQUIRED_PAIRS.has(pair)
      ? { ...edge, allowedExecutiveRoles: [...new Set([...edge.allowedExecutiveRoles, 'GROUP_DCEO'])].sort() }
      : edge;
  });
  await replaceGraph(draft.id, draftGraph.nodes, patchedEdges);
  const published = await publishVersion(draft.id, publisher.id, {});
  const activeAfter = await prisma.workflowVersion.findFirst({
    where: { workflowTypeId: workflow.id, status: 'ACTIVE' },
    include: { nodes: true, edges: true },
  });
  if (!activeAfter) throw new Error('Workflow publish completed without an active version');
  const statusAfter = new Map(activeAfter.nodes.map((node) => [node.id, node.statusCode]));
  const verification = activeAfter.edges
    .filter((edge) => REQUIRED_PAIRS.has(`${statusAfter.get(edge.fromNodeId)}->${statusAfter.get(edge.toNodeId)}`))
    .map((edge) => ({
      pair: `${statusAfter.get(edge.fromNodeId)}->${statusAfter.get(edge.toNodeId)}`,
      allowedExecutiveRoles: edge.allowedExecutiveRoles,
    }));
  if (verification.length !== REQUIRED_PAIRS.size || verification.some((edge) => !edge.allowedExecutiveRoles.includes('GROUP_DCEO'))) {
    throw new Error('Published Finance graph failed Group DCEO authorization verification');
  }
  console.log(JSON.stringify({
    publish: { publisher: publisher.email, version: activeAfter.version, result: published, verifiedEdges: verification },
  }, null, 2));
}

withSystemScope('finance-purchase-requisition-dceo-ceo-gate', main)
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
