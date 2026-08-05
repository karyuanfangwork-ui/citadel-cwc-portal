/**
 * Data-driven transition authorization.
 *
 * Replaces per-controller hasRole checks and bespoke executive-role lookups
 * (findCeoForRequest, findGroupDceo, findCfo) with rules stored on
 * workflow_transitions, so onboarding an entity or department no longer needs a
 * code change.
 *
 * Scope resolution is most-specific-first: (tenant, workflowType) beats
 * (tenant, NULL) beats (NULL, NULL). A row with both allow-lists empty defaults
 * to Agent/Admin operational access. Explicit role or executive allow-lists
 * remain authoritative for approval transitions.
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

  // Resolve scopes explicitly instead of relying on database NULL ordering.
  // PostgreSQL sorts NULLs first for DESC unless NULLS LAST is specified.
  const scopes = [
    { tenantId, workflowTypeId },
    { tenantId, workflowTypeId: null },
    { tenantId: null, workflowTypeId },
    { tenantId: null, workflowTypeId: null },
  ];

  let rule: { allowedRoles: string[]; allowedExecutiveRoles: string[] } | null = null;
  for (const scope of scopes) {
    rule = await (prisma as any).workflowTransition.findFirst({
      where: { fromStatus, toStatus, isActive: true, ...scope },
      select: { allowedRoles: true, allowedExecutiveRoles: true },
    });
    if (rule) break;
  }

  if (!rule) {
    return { allowed: false, reason: `No active transition ${fromStatus} → ${toStatus} in this scope` };
  }

  const allowedRoles: string[] = rule.allowedRoles ?? [];
  const allowedExecutiveRoles: string[] = rule.allowedExecutiveRoles ?? [];
  if (allowedRoles.length === 0 && allowedExecutiveRoles.length === 0) {
    const canManageWorkflow = actor.roles.some((role) => ['AGENT', 'ADMIN'].includes(role.toUpperCase()));
    return canManageWorkflow
      ? { allowed: true }
      : { allowed: false, reason: 'Workflow transitions require the AGENT or ADMIN role' };
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