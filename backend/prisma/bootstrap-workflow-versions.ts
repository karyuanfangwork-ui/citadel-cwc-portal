import { PrismaClient } from '@prisma/client';

import { CANONICAL_WORKFLOW_TRANSITIONS } from './seed-esm-transitions';
import { defaultWorkflows } from './seed-workflows';
import { loadGraph } from '../dist/services/workflowCompiler.service.js';
import {
  BootstrapRuntimePolicy,
  BootstrapStep,
  planCanonicalBootstrap,
} from '../dist/services/workflowBootstrap.service.js';
import { validateGraph } from '../dist/services/workflowValidator.service.js';

const prisma = new PrismaClient();

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

async function getGlobalPolicies(client: DbClient, workflowTypeId: string): Promise<BootstrapRuntimePolicy[]> {
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

  // Keep the argument in the function signature deliberately: the production
  // audit must make it obvious that policies are global fallback rows, not
  // workflow-scoped rows accidentally selected for another workflow.
  void workflowTypeId;
  return rows as BootstrapRuntimePolicy[];
}

async function inspectWorkflow(client: DbClient, workflowType: { id: string; code: string }) {
  const canonical = defaultWorkflows.find((workflow) => workflow.code === workflowType.code);
  if (!canonical) throw new Error(`No canonical step definition for workflow ${workflowType.code}`);

  const active = await client.workflowVersion.findFirst({
    where: { workflowTypeId: workflowType.id, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
  const current = active
    ? (await loadGraph(active.id, client)).graph
    : { nodes: [], edges: [] };

  const [occupiedStatuses, globalPolicies] = await Promise.all([
    getOccupiedStatuses(client, workflowType.id),
    getGlobalPolicies(client, workflowType.id),
  ]);
  const plan = planCanonicalBootstrap({
    workflowCode: workflowType.code,
    current,
    steps: toStepRows(canonical),
    definitions: CANONICAL_WORKFLOW_TRANSITIONS[workflowType.code] ?? [],
    globalPolicies,
    occupiedStatuses,
  });
  const validation = await validateGraph({ workflowTypeId: workflowType.id, graph: plan.graph }, client);

  return {
    workflow: workflowType.code,
    activeVersion: active?.version ?? null,
    existingNodes: current.nodes.length,
    existingEdges: current.edges.length,
    plannedNodes: plan.graph.nodes.length,
    plannedEdges: plan.graph.edges.length,
    addedNodeStatuses: plan.addedNodeStatuses,
    addedEdges: plan.addedEdges,
    occupiedStatuses,
    plannerIssues: plan.issues,
    validation: {
      blocking: validation.blocking,
      warnings: validation.warnings,
    },
  };
}

async function main() {
  const workflowTypes = await prisma.workflowType.findMany({
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  const reports = [];

  for (const workflowType of workflowTypes) {
    reports.push(await inspectWorkflow(prisma, workflowType));
  }

  const blockingCount = reports.reduce(
    (count, report) => count + report.plannerIssues.filter((issue) => issue.severity === 'BLOCKING').length + report.validation.blocking.length,
    0,
  );
  const warningCount = reports.reduce(
    (count, report) => count + report.plannerIssues.filter((issue) => issue.severity === 'WARNING').length + report.validation.warnings.length,
    0,
  );

  console.log(JSON.stringify({
    mode: 'shadow',
    writePerformed: false,
    workflowCount: reports.length,
    blockingCount,
    warningCount,
    reports,
  }, null, 2));

  if (blockingCount > 0) {
    throw new Error(`Workflow bootstrap blocked by ${blockingCount} finding(s); no data was written`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
