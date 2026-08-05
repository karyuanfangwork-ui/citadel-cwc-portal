/**
 * Backfills an ACTIVE version 1 for every WorkflowType by reverse-compiling
 * the rows that exist today.
 *
 *   npm run workflow:backfill:shadow   -> compare only, write nothing
 *   npm run workflow:backfill          -> persist version 1 rows
 *
 * Shadow mode is the Phase 1 gate: it reverse-compiles each workflow, projects
 * the result straight back, and diffs against the live transition rows. Zero
 * differences everywhere means the compiler is faithful and safe to let write.
 */
import 'dotenv/config';
import prisma from '../src/utils/prisma';
import {
  diffProjection,
  projectGraph,
  reverseCompile,
  ProjectedTransition,
} from '../src/services/workflowCompiler.service';
import { validateStructure } from '../src/services/workflowValidator.service';

const SHADOW = process.argv.includes('--shadow');

async function liveTransitions(workflowTypeId: string): Promise<ProjectedTransition[]> {
  const rows = await prisma.workflowTransition.findMany({
    where: { workflowTypeId, isActive: true },
  });
  return rows.map((t) => ({
    tenantId: null,
    workflowTypeId,
    fromStatus: t.fromStatus,
    toStatus: t.toStatus,
    transitionLabel: t.transitionLabel,
    requiresComment: t.requiresComment,
    autoAssignRole: t.autoAssignRole,
    autoAssignUserId: t.autoAssignUserId,
    allowedRoles: t.allowedRoles,
    allowedExecutiveRoles: t.allowedExecutiveRoles,
    isActive: true,
  }));
}

async function main() {
  const workflowTypes = await prisma.workflowType.findMany({ orderBy: { code: 'asc' } });
  console.log(`${SHADOW ? 'SHADOW' : 'WRITE'} mode — ${workflowTypes.length} workflow types\n`);

  let discrepancies = 0;
  let invalid = 0;

  for (const wt of workflowTypes) {
    const graph = await reverseCompile(wt.id);
    const { transitions } = projectGraph(graph, wt.id);
    const live = await liveTransitions(wt.id);
    const diff = diffProjection(transitions, live);
    const faults = diff.missing.length + diff.extra.length + diff.changed.length;

    const validation = validateStructure(graph);
    if (validation.blocking.length > 0) invalid++;

    console.log(
      `${wt.code.padEnd(32)} nodes=${String(graph.nodes.length).padStart(3)} edges=${String(
        graph.edges.length,
      ).padStart(3)} diff=${faults} validation=${validation.blocking.length}`,
    );
    if (faults > 0) {
      discrepancies += faults;
      if (diff.missing.length) console.log(`   missing from projection: ${diff.missing.join(', ')}`);
      if (diff.extra.length) console.log(`   invented by projection:  ${diff.extra.join(', ')}`);
      if (diff.changed.length) console.log(`   rules differ:            ${diff.changed.join(', ')}`);
    }
    for (const finding of validation.blocking) {
      console.log(`   validation: ${finding.code} — ${finding.message}`);
    }

    if (SHADOW) continue;
    if (faults > 0) {
      console.log(`   SKIPPED write — resolve discrepancies first`);
      continue;
    }

    const existing = await prisma.workflowVersion.findFirst({
      where: { workflowTypeId: wt.id, version: 1 },
    });
    if (existing) {
      console.log(`   version 1 already exists — skipped`);
      continue;
    }

    await prisma.$transaction(async (tx: any) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowTypeId: wt.id,
          version: 1,
          status: 'ACTIVE',
          notes: 'Backfilled from existing workflow steps and transitions',
          publishedAt: new Date(),
        },
      });
      await tx.workflowNode.createMany({
        data: graph.nodes.map((n) => ({
          id: n.id,
          workflowVersionId: version.id,
          type: 'STATUS',
          statusCode: n.statusCode,
          positionX: null,
          positionY: null,
          isInitial: n.isInitial,
          isFinal: n.isFinal,
          slaPause: n.slaPause,
          icon: n.icon,
        })),
      });
      await tx.workflowEdge.createMany({
        data: graph.edges.map((e) => ({
          id: e.id,
          workflowVersionId: version.id,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          transitionLabel: e.transitionLabel,
          requiresComment: e.requiresComment,
          autoAssignRole: e.autoAssignRole,
          autoAssignUserId: e.autoAssignUserId,
          allowedRoles: e.allowedRoles,
          allowedExecutiveRoles: e.allowedExecutiveRoles,
        })),
      });
    });
    console.log(`   wrote version 1`);
  }

  console.log(`\ntotal discrepancies: ${discrepancies}`);
  console.log(`workflows failing validation: ${invalid}`);
  if (SHADOW && discrepancies === 0) {
    console.log('\nGATE PASSED — compiler reproduces live rows exactly.');
  }
  if (SHADOW && discrepancies > 0) {
    console.log('\nGATE FAILED — do not proceed to Phase 2 until this is zero.');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());