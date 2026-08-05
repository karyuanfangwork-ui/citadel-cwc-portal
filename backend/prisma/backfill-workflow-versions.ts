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
import { validateGraph } from '../src/services/workflowValidator.service';

const SHADOW = process.argv.includes('--shadow');

async function liveTransitions(workflowTypeId: string, client: any = prisma): Promise<ProjectedTransition[]> {
  const rows: Array<{
    fromStatus: string;
    toStatus: string;
    transitionLabel: string | null;
    requiresComment: boolean;
    autoAssignRole: string | null;
    autoAssignUserId: string | null;
    allowedRoles: string[];
    allowedExecutiveRoles: string[];
  }> = await client.workflowTransition.findMany({
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

    const validation = await validateGraph({ workflowTypeId: wt.id, graph });
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
    if (faults > 0 || validation.blocking.length > 0) {
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

    const wrote = await prisma.$transaction(async (tx: any) => {
      const candidate = await reverseCompile(wt.id, tx);
      const revalidated = await validateGraph({ workflowTypeId: wt.id, graph: candidate }, tx);
      const { transitions: candidateTransitions } = projectGraph(candidate, wt.id);
      const candidateDiff = diffProjection(candidateTransitions, await liveTransitions(wt.id, tx));
      if (
        revalidated.blocking.length > 0 ||
        candidateDiff.missing.length > 0 ||
        candidateDiff.extra.length > 0 ||
        candidateDiff.changed.length > 0
      ) {
        throw new Error(`Backfill candidate changed during transaction for ${wt.code}`);
      }

      const existingInTransaction = await tx.workflowVersion.findFirst({
        where: { workflowTypeId: wt.id, version: 1 },
      });
      if (existingInTransaction) return false;

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
        data: candidate.nodes.map((n) => ({
          id: n.id,
          workflowVersionId: version.id,
          type: 'STATUS',
          statusCode: n.statusCode,
          label: n.label ?? n.statusCode,
          displayOrder: n.displayOrder ?? null,
          positionX: null,
          positionY: null,
          isInitial: n.isInitial,
          isFinal: n.isFinal,
          slaPause: n.slaPause,
          icon: n.icon,
        })),
      });
      await tx.workflowEdge.createMany({
        data: candidate.edges.map((e) => ({
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
      return true;
    });
    if (wrote) console.log(`   wrote version 1`);
    else console.log(`   version 1 appeared during transaction — skipped`);
  }

  console.log(`\ntotal discrepancies: ${discrepancies}`);
  console.log(`workflows failing validation: ${invalid}`);
  if (SHADOW && discrepancies === 0 && invalid === 0) {
    console.log('\nGATE PASSED — compiler reproduces live rows exactly.');
  }
  if (discrepancies > 0 || invalid > 0) {
    console.log('\nGATE FAILED — do not proceed to Phase 2 until discrepancies and blocking validation findings are zero.');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());