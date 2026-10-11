import { Prisma } from '@prisma/client';
import { policyService } from './policy.service';
import { PolicyPrincipal } from './policy.types';

/**
 * Build the complete visibility predicate used by request-list queries.
 * Keep policy scope, confidentiality exceptions, and soft-delete filtering
 * together so list aggregates cannot accidentally omit part of the access rule.
 */
export function buildRequestListScope(principal: PolicyPrincipal): Prisma.RequestWhereInput {
  const conditions: Prisma.RequestWhereInput[] = [
    { deletedAt: null },
    policyService.buildVisibleWhere(principal, 'request') as Prisma.RequestWhereInput,
  ];

  const canSeeAllConfidential = principal.roles.includes('ADMIN')
    || principal.permissions.includes('request:confidential');

  if (!canSeeAllConfidential) {
    conditions.push({
      OR: [
        { isConfidential: false },
        { requesterId: principal.userId },
        { assignedToId: principal.userId },
        { approvals: { some: { approverId: principal.userId } } },
        { participants: { some: { userId: principal.userId } } },
      ],
    });
  }

  return { AND: conditions };
}
