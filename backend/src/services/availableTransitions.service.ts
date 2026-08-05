import prisma from '../utils/prisma';
import { canActorTransition, TransitionActor } from './transitionPolicy.service';

export interface AvailableTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
}

/**
 * Resolve the active, actor-authorized transitions for a request.
 * WorkflowTransition rows are compiled from the published workflow version;
 * scope resolution is most-specific-first.
 */
export async function getAvailableTransitionsForRequest(
  requestId: string,
  actor: TransitionActor,
): Promise<AvailableTransition[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      tenantId: true,
      requestType: {
        select: {
          workflowTypeId: true,
        },
      },
    },
  });

  if (!request) return [];

  const workflowTypeId = request.requestType?.workflowTypeId ?? null;
  const rows = await prisma.workflowTransition.findMany({
    where: {
      fromStatus: request.status,
      isActive: true,
      OR: [
        { tenantId: request.tenantId, workflowTypeId },
        { tenantId: request.tenantId, workflowTypeId: null },
        { tenantId: null, workflowTypeId },
        { tenantId: null, workflowTypeId: null },
      ],
    },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      transitionLabel: true,
      requiresComment: true,
      allowedRoles: true,
      allowedExecutiveRoles: true,
      tenantId: true,
      workflowTypeId: true,
    },
  });

  // A published workflow graph is a complete transition source for that
  // workflow. Global rows are legacy fallbacks for workflows that do not yet
  // have compiled rows; merging them per target leaks routes from other
  // workflows (for example HR/Finance approval routes into IT_SIMPLE).
  const hasWorkflowScopedRows = rows.some((row) => row.workflowTypeId === workflowTypeId);
  const scopedRows = hasWorkflowScopedRows
    ? rows.filter((row) => row.workflowTypeId === workflowTypeId)
    : rows;

  const specificity = (row: typeof rows[number]): number =>
    (row.tenantId !== null && row.tenantId === request.tenantId ? 2 : 0) +
    (row.workflowTypeId !== null && row.workflowTypeId === workflowTypeId ? 1 : 0);

  const selected = new Map<string, typeof rows[number]>();
  for (const row of [...scopedRows].sort((a, b) => specificity(b) - specificity(a))) {
    if (!selected.has(row.toStatus)) selected.set(row.toStatus, row);
  }

  const available: AvailableTransition[] = [];
  for (const row of selected.values()) {
    const decision = await canActorTransition({
      actor,
      tenantId: request.tenantId,
      workflowTypeId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
    });
    if (!decision.allowed) continue;

    available.push({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      transitionLabel: row.transitionLabel,
      // The HTTP status endpoint enforces a reason for terminal rejection and
      // cancellation transitions even when legacy transition metadata is false.
      // Normalize that invariant here so the UI cannot offer an invalid submit.
      requiresComment: row.requiresComment || ['REJECTED', 'CANCELLED'].includes(row.toStatus),
      allowedRoles: row.allowedRoles,
      allowedExecutiveRoles: row.allowedExecutiveRoles,
    });
  }

  return available;
}
