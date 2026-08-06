import { PrismaClient } from '@prisma/client';

import { CANONICAL_WORKFLOW_TRANSITIONS } from './seed-esm-transitions';
import { defaultWorkflows } from './seed-workflows';
import { loadGraph, compileVersionInTransaction } from '../dist/services/workflowCompiler.service.js';
import {
  BootstrapRuntimePolicy,
  BootstrapStep,
  planCanonicalBootstrap,
} from '../dist/services/workflowBootstrap.service.js';
import { validateGraph } from '../dist/services/workflowValidator.service.js';

const prisma = new PrismaClient();
const WORKFLOW_CODE = 'IT_SIMPLE';
const REQUIRED_CONFIRMATION = 'IT_SIMPLE';

type DbClient = any;

function toStepRows(workflow: (typeof defaultWorkflows)[number]): BootstrapStep[] {
  return workflow.steps.map((step, index) => ({
    status: step.status,
    label: step.label,
    icon: step.icon,
    displayOrder: index + 1,
    isInitial: step.isInitial ?? false,
    isFinal: step.isFinal ?? false,
    slaPause: step.slaPause ?? false,
  }));
}

async function getOccupiedStatuses(client: DbClient, workflowTypeId: string): Promise<string[]> {
  const requests = await client.request.findMany({
    where: { requestType: { workflowTypeId } },
    select: { status: true },
  });
  return [...new Set(requests.map((request: { status: string }) => request.status))];
}

async function getGlobalPolicies(client: DbClient): Promise<BootstrapRuntimePolicy[]> {
  const rows = await client.workflowTransition.findMany({
    where: { workflowTypeId: null, isActive: true },
    select: {
      fromStatus: true,
      toStatus: true,
      transitionLabel: true,
      requiresComment: true,
      autoAssignRole: true,
      autoAssignUserId: true,
      allowedRoles: true,
      allowedExecutiveRoles: true,
      isActive: true,
    },
  });
  return rows as BootstrapRuntimePolicy[];
}

async function buildPlan(client: DbClient, workflowTypeId: string) {
  const canonical = defaultWorkflows.find((workflow) => workflow.code === WORKFLOW_CODE);
  if (!canonical) throw new Error(`No canonical step definition for ${WORKFLOW_CODE}`);

  const active = await client.workflowVersion.findFirst({
    where: { workflowTypeId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
  const current = active
    ? (await loadGraph(active.id, client)).graph
    : { nodes: [], edges: [] };
  const [occupiedStatuses, globalPolicies] = await Promise.all([
    getOccupiedStatuses(client, workflowTypeId),
    getGlobalPolicies(client),
  ]);
  const plan = planCanonicalBootstrap({
    workflowCode: WORKFLOW_CODE,
    current,
    steps: toStepRows(canonical),
    definitions: CANONICAL_WORKFLOW_TRANSITIONS[WORKFLOW_CODE] ?? [],
    globalPolicies,
    occupiedStatuses,
  });
  const validation = await validateGraph({ workflowTypeId, graph: plan.graph }, client);
  return { plan, validation, active, occupiedStatuses };
}

async function main() {
  if (process.env.WORKFLOW_BOOTSTRAP_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Refusing workflow write. Set WORKFLOW_BOOTSTRAP_CONFIRM=${REQUIRED_CONFIRMATION} explicitly for the approved pilot.`,
    );
  }

  const workflowType = await prisma.workflowType.findUnique({ where: { code: WORKFLOW_CODE } });
  if (!workflowType) throw new Error(`${WORKFLOW_CODE} workflow type was not found`);

  const preflight = await buildPlan(prisma, workflowType.id);
  const preflightBlocking = [
    ...preflight.plan.issues.filter((issue) => issue.severity === 'BLOCKING'),
    ...preflight.validation.blocking,
  ];
  if (preflightBlocking.length > 0) {
    throw new Error(
      `Refusing ${WORKFLOW_CODE} write: ${preflightBlocking.length} blocking finding(s) remain`,
    );
  }
  if (preflight.active) {
    throw new Error(`${WORKFLOW_CODE} already has an ACTIVE version; refusing to replace it`);
  }

  const result = await prisma.$transaction(async (tx: DbClient) => {
    const candidate = await buildPlan(tx, workflowType.id);
    const blocking = [
      ...candidate.plan.issues.filter((issue) => issue.severity === 'BLOCKING'),
      ...candidate.validation.blocking,
    ];
    if (blocking.length > 0) {
      throw new Error(`Transaction preflight failed with ${blocking.length} blocking finding(s)`);
    }

    const existing = await tx.workflowVersion.findFirst({
      where: { workflowTypeId: workflowType.id },
      select: { id: true, status: true, version: true },
    });
    if (existing) {
      throw new Error(
        `${WORKFLOW_CODE} version state changed during preflight: version ${existing.version} is ${existing.status}`,
      );
    }

    const version = await tx.workflowVersion.create({
      data: {
        workflowTypeId: workflowType.id,
        version: 1,
        status: 'ACTIVE',
        notes: 'Approved IT_SIMPLE pilot bootstrap with terminal cancellation policy',
        publishedAt: new Date(),
      },
    });

    await tx.workflowNode.createMany({
      data: candidate.plan.graph.nodes.map((node: any) => ({
        id: node.id,
        workflowVersionId: version.id,
        type: 'STATUS',
        statusCode: node.statusCode,
        label: node.label ?? node.statusCode,
        displayOrder: node.displayOrder ?? null,
        positionX: node.positionX,
        positionY: node.positionY,
        isInitial: node.isInitial,
        isFinal: node.isFinal,
        slaPause: node.slaPause,
        icon: node.icon,
      })),
    });

    await tx.workflowEdge.createMany({
      data: candidate.plan.graph.edges.map((edge: any) => ({
        id: edge.id,
        workflowVersionId: version.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        transitionLabel: edge.transitionLabel,
        requiresComment: edge.requiresComment,
        autoAssignRole: edge.autoAssignRole,
        autoAssignUserId: edge.autoAssignUserId,
        allowedRoles: edge.allowedRoles,
        allowedExecutiveRoles: edge.allowedExecutiveRoles,
      })),
    });

    const compiled = await compileVersionInTransaction(tx, version.id);
    return { versionId: version.id, version: version.version, ...compiled };
  });

  console.log(JSON.stringify({ mode: 'write', workflow: WORKFLOW_CODE, writePerformed: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
