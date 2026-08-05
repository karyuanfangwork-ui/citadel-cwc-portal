/**
 * Connected Party Auto-Flag Service — §1.2
 *
 * Derives `connectedPartyFlag` on CreditApplication from RelatedPartyGroup membership.
 * Called at submit time and on every facility/party change.
 *
 * Rules:
 *   - If the primary borrower (or any co-borrower/guarantor party) is a member
 *     of any RelatedPartyGroup, the flag is set to true.
 *   - The flag can also be manually overridden via the connectedPartyFlag field
 *     on the application — but manual overrides are logged in CreditAuditEvent.
 *   - Authority-tier lookup on approval matrices uses the derived value.
 */

import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AuditChainService } from './auditChain.service';

interface ConnectedPartyResult {
  flagged: boolean;
  groups: Array<{ groupId: string; groupName: string; role: string | null }>;
  source: 'auto' | 'override';
}

/**
 * Check if a borrower profile belongs to any related-party groups
 * and return the group details.
 */
export async function checkConnectedPartyStatus(borrowerProfileId: string): Promise<ConnectedPartyResult> {
  const memberships = await prisma.relatedPartyMember.findMany({
    where: { borrowerProfileId },
    include: { group: { select: { id: true, name: true } } },
  });

  return {
    flagged: memberships.length > 0,
    groups: memberships.map((m) => ({
      groupId: m.group.id,
      groupName: m.group.name,
      role: m.role,
    })),
    source: 'auto',
  };
}

/**
 * Check all parties (borrower + co-borrowers + guarantors) on an application.
 * Returns true if ANY party is in a related-party group.
 */
export async function checkApplicationConnectedPartyStatus(
  applicationId: string,
): Promise<ConnectedPartyResult> {
  // Get the application with all its parties
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    include: {
      parties: {
        select: { borrowerProfileId: true, role: true },
      },
      borrowerProfile: {
        select: { id: true },
      },
    },
  });

  if (!application) {
    logger.warn(`[ConnectedParty] Application ${applicationId} not found`);
    return { flagged: false, groups: [], source: 'auto' };
  }

  // Collect all borrower profile IDs from the application
  const profileIds = new Set<string>();
  // Primary borrower
  profileIds.add(application.borrowerProfileId);
  // All parties (co-borrowers, guarantors, directors, etc.)
  for (const party of application.parties) {
    if (party.borrowerProfileId) {
      profileIds.add(party.borrowerProfileId);
    }
  }

  // Check all profiles for related-party group membership
  const allGroups: ConnectedPartyResult['groups'] = [];
  let anyFlagged = application.connectedPartyFlag; // preserve manual override

  for (const profileId of profileIds) {
    const result = await checkConnectedPartyStatus(profileId);
    if (result.flagged) {
      anyFlagged = true;
      allGroups.push(...result.groups);
    }
  }

  return {
    flagged: anyFlagged,
    groups: allGroups,
    source: 'auto',
  };
}

/**
 * Derive and persist the connectedPartyFlag on an application.
 * Called on: submit, party change, facility change.
 *
 * If the derived value differs from the current stored value,
 * updates the application and logs an audit event.
 * If a manual override was previously set, it is preserved but
 * the audit event notes the auto-derived value as well.
 */
export async function deriveAndSetConnectedPartyFlag(applicationId: string, actorId?: string): Promise<boolean> {
  const result = await checkApplicationConnectedPartyStatus(applicationId);

  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { connectedPartyFlag: true, applicationNo: true, state: true },
  });

  if (!application) return result.flagged;

  const derivedFlag = result.flagged;

  // If auto-derived flag is different from current flag, update it
  if (derivedFlag !== application.connectedPartyFlag) {
    await prisma.creditApplication.update({
      where: { id: applicationId },
      data: { connectedPartyFlag: derivedFlag },
    });

    // Log audit event via chain service
    await AuditChainService.appendEvent(
      applicationId,
      'CONNECTED_PARTY_FLAG_CHANGED',
      actorId ?? null,
      derivedFlag ? 'AUTO_FLAG_CONNECTED' : 'AUTO_UNFLAG_CONNECTED',
      String(application.connectedPartyFlag),
      String(derivedFlag),
      { source: result.source, groups: result.groups, previousFlag: application.connectedPartyFlag, newFlag: derivedFlag },
    );

    logger.info(
      `[ConnectedParty] Application ${application.applicationNo}: flag changed from ${application.connectedPartyFlag} to ${derivedFlag} (groups: ${result.groups.map((g) => g.groupName).join(', ') || 'none'})`,
    );
  }

  return derivedFlag;
}

/**
 * Handle manual override of connectedPartyFlag.
 * Records the override in the audit trail with the auto-derived value for comparison.
 */
export async function overrideConnectedPartyFlag(
  applicationId: string,
  overrideValue: boolean,
  actorId: string,
  overrideReason?: string,
): Promise<boolean> {
  // Check what the auto-derived value would be
  const autoResult = await checkApplicationConnectedPartyStatus(applicationId);

  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { connectedPartyFlag: true, applicationNo: true },
  });

  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  await prisma.creditApplication.update({
    where: { id: applicationId },
    data: { connectedPartyFlag: overrideValue },
  });

  // Log override audit event via chain service
  await AuditChainService.appendEvent(
    applicationId,
    'CONNECTED_PARTY_FLAG_OVERRIDE',
    actorId,
    overrideValue ? 'MANUAL_FLAG_CONNECTED' : 'MANUAL_UNFLAG_CONNECTED',
    String(application.connectedPartyFlag),
    String(overrideValue),
    { source: 'override', autoDerivedValue: autoResult.flagged, overrideValue, reason: overrideReason || null, groups: autoResult.groups },
  );

  logger.info(
    `[ConnectedParty] Application ${application.applicationNo}: manual override from ${application.connectedPartyFlag} to ${overrideValue} (auto would be ${autoResult.flagged})`,
  );

  return overrideValue;
}