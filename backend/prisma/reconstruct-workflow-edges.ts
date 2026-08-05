import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { CANONICAL_WORKFLOW_TRANSITIONS, TransitionDef } from './seed-esm-transitions';
import { defaultWorkflows } from './seed-workflows';
import { loadGraph, compileVersionInTransaction } from '../src/services/workflowCompiler.service';
import { validateGraph } from '../src/services/workflowValidator.service';
import { GraphEdge, GraphNode, WorkflowGraph } from '../src/services/workflowGraph.types';

const prisma = new PrismaClient();
const writeMode = process.argv.includes('--write');

type DbClient = any;

type WorkflowStepRow = {
  status: string;
  label: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
};

function key(fromStatus: string, toStatus: string): string {
  return `${fromStatus}\u0000${toStatus}`;
}

const CANCELABLE_STATUSES: Record<string, string[]> = {
  IT_SIMPLE: ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING'],
  HR_GENERAL: ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'ACTION_REQUIRED', 'WAITING'],
  IT_PROCUREMENT: ['ACKNOWLEDGED_IT', 'PROCUREMENT_IN_PROGRESS', 'PENDING_INVOICE_IT', 'PAYMENT_PROCESSING_IT'],
  IT_HARDWARE_PROCUREMENT: [
    'ACKNOWLEDGED_IT', 'PROCUREMENT_IN_PROGRESS', 'HARDWARE_ORDERED', 'HARDWARE_RECEIVED',
    'SOFTWARE_PROVISIONED', 'PENDING_INVOICE_IT', 'PAYMENT_PROCESSING_IT',
  ],
  EXPENSE_REIMBURSEMENT: ['PAYMENT_PROCESSING'],
  FINANCE: ['FINANCE_PENDING_ACK', 'FINANCE_ACKNOWLEDGED', 'FINANCE_IN_PROGRESS'],
};

function planGraph(
  code: string,
  current: WorkflowGraph,
  steps: WorkflowStepRow[],
  occupiedStatuses: string[],
): { graph: WorkflowGraph; addedNodeStatuses: string[]; addedEdges: Array<{ fromStatus: string; toStatus: string }> } {
  const definitions: TransitionDef[] = CANONICAL_WORKFLOW_TRANSITIONS[code] ?? [];
  if (definitions.length === 0) throw new Error(`No canonical transition definition for workflow ${code}`);

  const stepStatuses = new Set(steps.map((step) => step.status));
  const statuses = new Set(stepStatuses);
  const transitionDefs = definitions.filter((transition) => stepStatuses.has(transition.fromStatus));
  for (const transition of transitionDefs) statuses.add(transition.toStatus);
  for (const status of occupiedStatuses) statuses.add(status);

  const transitionKeys = new Set<string>(
    transitionDefs.map((transition) => key(transition.fromStatus, transition.toStatus)),
  );
  const plannedTransitions = [...transitionDefs];

  // Seed step order is the canonical authoring order. Add only missing sequential
  // links needed to connect legacy visual steps that the older transition seed omitted.
  for (let index = 1; index < steps.length; index += 1) {
    const fromStatus = steps[index - 1].status;
    const toStatus = steps[index].status;
    const transitionKey = key(fromStatus, toStatus);
    if (!transitionKeys.has(transitionKey)) {
      transitionKeys.add(transitionKey);
      plannedTransitions.push({
        fromStatus,
        toStatus,
        transitionLabel: 'ADVANCE',
        requiresComment: false,
      });
    }
  }

  // CANCELLED is a runtime terminal state, but older seed data did not include
  // its graph edges. Only reconstruct these edges when live requests actually
  // occupy CANCELLED, and only for status pairs permitted by runtime policy.
  if (occupiedStatuses.includes('CANCELLED')) {
    for (const fromStatus of CANCELABLE_STATUSES[code] ?? []) {
      if (!statuses.has(fromStatus)) continue;
      const transitionKey = key(fromStatus, 'CANCELLED');
      if (transitionKeys.has(transitionKey)) continue;
      transitionKeys.add(transitionKey);
      plannedTransitions.push({
        fromStatus,
        toStatus: 'CANCELLED',
        transitionLabel: 'CANCEL',
        requiresComment: false,
      });
      statuses.add('CANCELLED');
    }
  }

  const outgoing = new Set(plannedTransitions.map((transition) => transition.fromStatus));
  const stepByStatus = new Map(steps.map((step) => [step.status, step]));
  const currentByStatus = new Map(current.nodes.map((node) => [node.statusCode, node]));
  const maxDisplayOrder = steps.reduce((max, step) => Math.max(max, step.displayOrder), 0);
  const graphNodes: GraphNode[] = [...statuses].map((status, index) => {
    const existing = currentByStatus.get(status);
    const step = stepByStatus.get(status);
    const hasIncoming = plannedTransitions.some((transition) => transition.toStatus === status);
    const isTerminal = !outgoing.has(status) && hasIncoming;
    return existing ?? {
      id: randomUUID(),
      type: 'STATUS',
      statusCode: status,
      label: step?.label ?? status,
      displayOrder: step?.displayOrder ?? maxDisplayOrder + index + 1,
      positionX: null,
      positionY: null,
      isInitial: step?.isInitial ?? false,
      isFinal: step?.isFinal ?? isTerminal,
      slaPause: step?.slaPause ?? false,
      icon: step?.icon ?? (isTerminal ? 'check_circle' : 'radio_button_checked'),
    };
  });

  const nodeByStatus = new Map(graphNodes.map((node) => [node.statusCode, node]));
  const existingEdgeKeys = new Set(
    current.edges.map((edge) => {
      const from = graphNodes.find((node) => node.id === edge.fromNodeId)?.statusCode;
      const to = graphNodes.find((node) => node.id === edge.toNodeId)?.statusCode;
      return from && to ? key(from, to) : '';
    }),
  );
  const graphEdges: GraphEdge[] = [...current.edges];
  const addedEdges: Array<{ fromStatus: string; toStatus: string }> = [];

  for (const transition of plannedTransitions) {
    const edgeKey = key(transition.fromStatus, transition.toStatus);
    if (existingEdgeKeys.has(edgeKey)) continue;
    const fromNode = nodeByStatus.get(transition.fromStatus);
    const toNode = nodeByStatus.get(transition.toStatus);
    if (!fromNode || !toNode) throw new Error(`Canonical edge endpoint missing for ${code}: ${edgeKey}`);
    graphEdges.push({
      id: randomUUID(),
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      transitionLabel: transition.transitionLabel,
      requiresComment: transition.requiresComment,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: [],
      allowedExecutiveRoles: [],
    });
    existingEdgeKeys.add(edgeKey);
    addedEdges.push({ fromStatus: transition.fromStatus, toStatus: transition.toStatus });
  }

  return {
    graph: { nodes: graphNodes, edges: graphEdges },
    addedNodeStatuses: graphNodes.filter((node) => !currentByStatus.has(node.statusCode as string)).map((node) => node.statusCode as string),
    addedEdges,
  };
}

async function getOccupiedStatuses(client: DbClient, workflowTypeId: string): Promise<string[]> {
  const requests = await client.request.findMany({
    where: { requestType: { workflowTypeId } },
    select: { status: true },
  });
  return [...new Set(requests.map((request: { status: string }) => request.status))];
}

async function inspectWorkflow(client: DbClient, workflowType: { id: string; code: string }) {
  const seedWorkflow = defaultWorkflows.find((workflow) => workflow.code === workflowType.code);
  if (!seedWorkflow) throw new Error(`No canonical step definition for workflow ${workflowType.code}`);
  const active = await client.workflowVersion.findFirst({
    where: { workflowTypeId: workflowType.id, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
  });
  if (!active) throw new Error(`No ACTIVE version exists for ${workflowType.code}`);

  const [{ graph }, occupiedStatuses] = await Promise.all([
    loadGraph(active.id, client),
    getOccupiedStatuses(client, workflowType.id),
  ]);
  const steps: WorkflowStepRow[] = seedWorkflow.steps.map((step, index) => ({
    status: step.status,
    label: step.label,
    icon: step.icon,
    displayOrder: index + 1,
    isInitial: step.isInitial ?? false,
    isFinal: step.isFinal ?? false,
    slaPause: step.slaPause ?? false,
  }));
  const planned = planGraph(workflowType.code, graph, steps, occupiedStatuses);
  const validation = await validateGraph({ workflowTypeId: workflowType.id, graph: planned.graph }, client);
  return { active, steps, planned, validation };
}

async function main() {
  const workflowTypes = await prisma.workflowType.findMany({
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  const reports: Array<Record<string, unknown>> = [];

  for (const workflowType of workflowTypes) {
    const report = await inspectWorkflow(prisma, workflowType);
    reports.push({
      workflow: workflowType.code,
      version: report.active.version,
      existingNodes: report.planned.graph.nodes.length - report.planned.addedNodeStatuses.length,
      plannedNodes: report.planned.graph.nodes.length,
      addedNodeStatuses: report.planned.addedNodeStatuses,
      plannedEdges: report.planned.graph.edges.length,
      addedEdges: report.planned.addedEdges.length,
      blockingFindings: report.validation.blocking,
    });
  }

  console.log(JSON.stringify({ mode: writeMode ? 'write' : 'shadow', reports }, null, 2));
  const blocking = reports.flatMap((report) => report.blockingFindings as unknown[]);
  if (blocking.length > 0) {
    throw new Error(`Canonical reconstruction blocked by ${blocking.length} validation finding(s)`);
  }
  if (!writeMode) return;

  await prisma.$transaction(async (tx) => {
    for (const workflowType of workflowTypes) {
      const report = await inspectWorkflow(tx, workflowType);
      const nodeIdsByStatus = new Map<string, string>();
      for (const node of report.planned.graph.nodes) {
        const statusCode = node.statusCode;
        if (!statusCode) continue;
        const existing = await tx.workflowNode.findFirst({
          where: { workflowVersionId: report.active.id, statusCode },
          select: { id: true },
        });
        if (existing) {
          nodeIdsByStatus.set(statusCode, existing.id);
        } else {
          const created = await tx.workflowNode.create({
            data: {
              id: node.id,
              workflowVersionId: report.active.id,
              type: 'STATUS',
              statusCode: node.statusCode,
              label: node.label,
              displayOrder: node.displayOrder,
              positionX: node.positionX,
              positionY: node.positionY,
              isInitial: node.isInitial,
              isFinal: node.isFinal,
              slaPause: node.slaPause,
              icon: node.icon,
            },
            select: { id: true },
          } as any);
          nodeIdsByStatus.set(statusCode, created.id);
        }
      }

      const existingEdges = await tx.workflowEdge.findMany({
        where: { workflowVersionId: report.active.id },
        select: { fromNodeId: true, toNodeId: true },
      });
      const existingPairs = new Set(existingEdges.map((edge: { fromNodeId: string; toNodeId: string }) => `${edge.fromNodeId}\u0000${edge.toNodeId}`));
      for (const edge of report.planned.graph.edges) {
        const fromNode = report.planned.graph.nodes.find((node) => node.id === edge.fromNodeId);
        const toNode = report.planned.graph.nodes.find((node) => node.id === edge.toNodeId);
        if (!fromNode?.statusCode || !toNode?.statusCode) continue;
        const fromNodeId = nodeIdsByStatus.get(fromNode.statusCode);
        const toNodeId = nodeIdsByStatus.get(toNode.statusCode);
        if (!fromNodeId || !toNodeId || existingPairs.has(`${fromNodeId}\u0000${toNodeId}`)) continue;
        await tx.workflowEdge.create({
          data: {
            id: edge.id,
            workflowVersionId: report.active.id,
            fromNodeId,
            toNodeId,
            transitionLabel: edge.transitionLabel,
            requiresComment: edge.requiresComment,
            autoAssignRole: edge.autoAssignRole,
            autoAssignUserId: edge.autoAssignUserId,
            allowedRoles: edge.allowedRoles,
            allowedExecutiveRoles: edge.allowedExecutiveRoles,
          },
        });
        existingPairs.add(`${fromNodeId}\u0000${toNodeId}`);
      }
      await compileVersionInTransaction(tx, report.active.id);
    }
  });
  console.log(`✅ Reconstructed canonical workflow edges for ${workflowTypes.length} workflow(s)`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
