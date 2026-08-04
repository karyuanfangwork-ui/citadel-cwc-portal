/**
 * Data-driven transition authorization.
 *
 * Replaces per-controller hasRole checks and bespoke executive-role lookups
 * (findCeoForRequest, findGroupDceo, findCfo) with rules stored on
 * workflow_transitions, so onboarding an entity or department no longer needs a
 * code change.
 *
 * Scope resolution is most-specific-first: (tenant, workflowType) beats
 * (tenant, NULL) beats (NULL, NULL). A row with both allow-lists empty imposes
 * no restriction.
 */

import prisma from '../utils/prisma';

export interface TransitionActor {
  userId: string;
  roles: string[];
  executiveRole: string | null;
}

export interface CanActorTransitionInput {
  actor: TransitionActor;
  tenantId: string | null;
  workflowTypeId: string | null;
  fromStatus: string;
  toStatus: string;
}

export async function canActorTransition(
  input: CanActorTransitionInput,
): Promise<{ allowed: boolean; reason?: string }> {
  const { actor, tenantId, workflowTypeId, fromStatus, toStatus } = input;

  const rule = await (prisma as any).workflowTransition.findFirst({
    where: {
      fromStatus,
      toStatus,
      isActive: true,
      AND: [
        { OR: [{ tenantId }, { tenantId: null }] },
        { OR: [{ workflowTypeId }, { workflowTypeId: null }] },
      ],
    },
    // NULLs sort last under `desc` in Postgres, so a concrete scope wins.
    orderBy: [{ tenantId: 'desc' }, { workflowTypeId: 'desc' }],
    select: { allowedRoles: true, allowedExecutiveRoles: true },
  });

  if (!rule) {
    return { allowed: false, reason: `No active transition ${fromStatus} → ${toStatus} in this scope` };
  }

  const allowedRoles: string[] = rule.allowedRoles ?? [];
  const allowedExecutiveRoles: string[] = rule.allowedExecutiveRoles ?? [];
  if (allowedRoles.length === 0 && allowedExecutiveRoles.length === 0) {
    return { allowed: true };
  }

  if (actor.roles.some((role) => allowedRoles.includes(role))) return { allowed: true };
  if (actor.executiveRole && allowedExecutiveRoles.includes(actor.executiveRole)) {
    return { allowed: true };
  }

  const required = [...allowedRoles, ...allowedExecutiveRoles].join(', ');
  return {
    allowed: false,
    reason: `Transition ${fromStatus} → ${toStatus} requires one of: ${required}`,
  };
}