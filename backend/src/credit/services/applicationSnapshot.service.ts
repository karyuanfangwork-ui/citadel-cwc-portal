import prisma from '../../utils/prisma';
import { getCaMemoData } from './caMemoPdf.service';
import { linkStatementsToApplication } from './statementLinking.service';
import { hashPayload } from './snapshotHash';
import { registerTransitionHook, type TransitionHookContext } from './transitionHooks';

export type SnapshotTypeName = 'COMMITTEE_SUBMISSION' | 'FINAL_DECISION';
const COMMITTEE_SUBMISSION_ACTIONS = ['submit_to_committee', 'resume_committee'] as const;
const FINAL_DECISION_ACTIONS = ['approve', 'reject'] as const;
export const SNAPSHOT_ACTIONS = [...COMMITTEE_SUBMISSION_ACTIONS, ...FINAL_DECISION_ACTIONS] as const;

export function resolveSnapshotType(action: string): SnapshotTypeName | null {
  if ((COMMITTEE_SUBMISSION_ACTIONS as readonly string[]).includes(action)) return 'COMMITTEE_SUBMISSION';
  if ((FINAL_DECISION_ACTIONS as readonly string[]).includes(action)) return 'FINAL_DECISION';
  return null;
}

export interface SnapshotOutcome {
  skipped: boolean;
  snapshotId: string | null;
  snapshotType: SnapshotTypeName | null;
  hash: string | null;
}

export async function takeApplicationSnapshot(ctx: TransitionHookContext): Promise<SnapshotOutcome> {
  const snapshotType = resolveSnapshotType(ctx.action);
  if (!snapshotType) return { skipped: true, snapshotId: null, snapshotType: null, hash: null };

  if (snapshotType === 'COMMITTEE_SUBMISSION') await linkStatementsToApplication(ctx.applicationId);
  const payload = await getCaMemoData(ctx.applicationId);
  const hash = hashPayload(payload);
  const previous = await prisma.applicationSnapshot.findFirst({
    where: { applicationId: ctx.applicationId, snapshotType },
    orderBy: { takenAt: 'desc' },
    select: { id: true, hash: true },
  });
  if (previous?.hash === hash) return { skipped: true, snapshotId: previous.id, snapshotType, hash };

  const created = await prisma.applicationSnapshot.create({
    data: {
      applicationId: ctx.applicationId,
      snapshotType,
      takenById: ctx.actorId,
      triggerAction: ctx.action,
      payload: payload as any,
      hash,
    },
  });
  return { skipped: false, snapshotId: created.id, snapshotType, hash };
}

export async function getSnapshots(applicationId: string) {
  return prisma.applicationSnapshot.findMany({
    where: { applicationId },
    orderBy: { takenAt: 'desc' },
    select: {
      id: true,
      snapshotType: true,
      takenAt: true,
      triggerAction: true,
      hash: true,
      takenBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getSnapshotById(applicationId: string, snapshotId: string) {
  return prisma.applicationSnapshot.findFirst({
    where: { id: snapshotId, applicationId },
    select: {
      id: true,
      applicationId: true,
      snapshotType: true,
      takenAt: true,
      triggerAction: true,
      hash: true,
      payload: true,
      takenBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export function registerSnapshotHook(): void {
  registerTransitionHook({
    name: 'application-snapshot',
    actions: SNAPSHOT_ACTIONS,
    run: async (ctx) => { await takeApplicationSnapshot(ctx); },
  });
}
