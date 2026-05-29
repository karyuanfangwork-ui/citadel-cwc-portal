import prisma from '../../utils/prisma';
import { ApplicationState } from '@prisma/client';
import { AuditChainService } from './auditChain.service';

// ---------------------------------------------------------------------------
// §2.6 — Credit Approval Delegation Service
// ---------------------------------------------------------------------------
// When an approver enables delegation, their pending approval tasks are
// visible to the delegate, and the delegate can act on the approver's behalf.
//
// Resolution flow:
//   1. User who needs to approve → check if they have delegation enabled
//   2. If yes → the delegated user sees + can action those items
//   3. All decisions record the effective actor (delegate) and the
//      onBehalfOf (original approver) for audit trail
// ---------------------------------------------------------------------------

export interface DelegationResolution {
  /** The user who will actually perform the action */
  effectiveActorId: string;
  /** The original approver (set when delegated, null otherwise) */
  onBehalfOfId: string | null;
  /** Whether delegation was activated */
  isDelegated: boolean;
}

export interface DelegatedApprovalItem {
  applicationId: string;
  applicationNo: string;
  borrowerName: string;
  requestedAmount: number;
  currency: string;
  state: string;
  assignedRmId: string | null;
  /** The original approver who delegated */
  delegatedFromId: string | null;
  delegatedFromName: string | null;
}

// States where approval actions are possible
const APPROVAL_ELIGIBLE_STATES: ApplicationState[] = [
  ApplicationState.UNDERWRITING,
  ApplicationState.CREDIT_ASSESSMENT,
  ApplicationState.COMMITTEE_REVIEW,
];

class DelegationService {
  /**
   * Resolve the effective actor for an approval action.
   *
   * If the original approver has delegation enabled with an active delegate,
   * the delegate becomes the effective actor and the action is recorded
   * as "on behalf of" the original approver.
   *
   * @param originalApproverId - The user who was supposed to approve
   * @returns DelegationResolution with effective actor and on-behalf-of info
   */
  async resolveDelegation(originalApproverId: string): Promise<DelegationResolution> {
    const user = await prisma.user.findUnique({
      where: { id: originalApproverId },
      select: {
        id: true,
        delegationEnabled: true,
        delegatedToId: true,
        delegatedTo: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!user) {
      return {
        effectiveActorId: originalApproverId,
        onBehalfOfId: null,
        isDelegated: false,
      };
    }

    // Delegation is only active when both enabled AND delegate exists AND is active
    if (
      user.delegationEnabled &&
      user.delegatedToId &&
      user.delegatedTo?.isActive
    ) {
      return {
        effectiveActorId: user.delegatedToId,
        onBehalfOfId: originalApproverId,
        isDelegated: true,
      };
    }

    return {
      effectiveActorId: originalApproverId,
      onBehalfOfId: null,
      isDelegated: false,
    };
  }

  /**
   * Get pending approval items for a user, including items delegated to them.
   *
   * Returns applications that are in an approval-eligible state where:
   * - The user could approve (not the RM), AND
   * - The user has not yet approved, AND/OR
   * - Items delegated from other users where this user is the delegate
   *
   * @param userId - The user requesting their pending approvals
   */
  async getPendingApprovals(userId: string): Promise<DelegatedApprovalItem[]> {
    // Find all users who have delegated to this user
    const delegators = await prisma.user.findMany({
      where: {
        delegationEnabled: true,
        delegatedToId: userId,
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    // Find applications in approval-eligible states
    const applications = await prisma.creditApplication.findMany({
      where: {
        state: { in: APPROVAL_ELIGIBLE_STATES },
        deletedAt: null,
      },
      select: {
        id: true,
        applicationNo: true,
        state: true,
        requestedAmount: true,
        currency: true,
        assignedRmId: true,
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const results: DelegatedApprovalItem[] = [];

    for (const app of applications) {
      // Skip if user is the assigned RM (SOD violation)
      if (app.assignedRmId === userId) continue;

      // Check if user has already approved this application
      const existingApproval = await prisma.creditDecision.findFirst({
        where: {
          applicationId: app.id,
          decisionById: userId,
          decisionType: 'APPROVE',
        },
      });

      if (existingApproval) continue; // Already approved by this user

      // Determine delegation context: is this being seen because someone
      // delegated to this user?
      let delegatedFromId: string | null = null;
      let delegatedFromName: string | null = null;

      for (const delegator of delegators) {
        // A delegator hasn't approved yet if there's no approval from them
        const delegatorApproval = await prisma.creditDecision.findFirst({
          where: {
            applicationId: app.id,
            decisionById: delegator.id,
            decisionType: 'APPROVE',
          },
        });

        if (!delegatorApproval) {
          delegatedFromId = delegator.id;
          delegatedFromName = `${delegator.firstName} ${delegator.lastName}`;
          break;
        }
      }

      // Resolve borrower name from Account or Contact
      let borrowerName = 'Unknown';
      if (app.borrowerProfile) {
        if (app.borrowerProfile.account) {
          borrowerName = app.borrowerProfile.account.name;
        } else if (app.borrowerProfile.contact) {
          borrowerName = `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`;
        }
      }

      results.push({
        applicationId: app.id,
        applicationNo: app.applicationNo,
        borrowerName,
        requestedAmount: Number(app.requestedAmount),
        currency: app.currency,
        state: app.state,
        assignedRmId: app.assignedRmId,
        delegatedFromId,
        delegatedFromName,
      });
    }

    return results;
  }

  /**
   * Record a delegated approval action in the audit chain.
   *
   * @param applicationId - The application being acted upon
   * @param effectiveActorId - The user actually performing the action (delegate)
   * @param onBehalfOfId - The original approver who delegated
   * @param decision - APPROVE | REJECT | RETURN | ESCALATE
   * @param comment - Optional comment
   */
  async recordDelegatedAction(
    applicationId: string,
    effectiveActorId: string,
    onBehalfOfId: string,
    decision: string,
    comment?: string,
  ): Promise<void> {
    await AuditChainService.appendEvent(
      applicationId,
      'DELEGATED_APPROVAL',
      effectiveActorId,
      `delegated_approval_${decision.toLowerCase()}`,
      undefined, // oldState — not applicable here
      undefined, // newState — not applicable here
      {
        onBehalfOf: onBehalfOfId,
        decision,
        comment,
        delegatedAt: new Date().toISOString(),
      },
    );
  }

  /**
   * Validate that a delegate has permission to act on behalf of a delegator
   * for a specific application.
   *
   * Checks:
   * 1. Delegator has delegation enabled and points to this delegate
   * 2. Delegator is still active
   * 3. No SOD conflict for the delegate (cannot be the RM)
   *
   * @param delegatorId - The original approver
   * @param delegateId - The user acting on their behalf
   * @param applicationId - The application being acted upon
   */
  async validateDelegatedAction(
    delegatorId: string,
    delegateId: string,
    applicationId: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    // 1. Check delegator exists and has delegation enabled
    const delegator = await prisma.user.findUnique({
      where: { id: delegatorId },
      select: {
        id: true,
        isActive: true,
        delegationEnabled: true,
        delegatedToId: true,
      },
    });

    if (!delegator || !delegator.isActive) {
      return { valid: false, reason: 'Delegator is not active' };
    }

    if (!delegator.delegationEnabled) {
      return { valid: false, reason: 'Delegator has not enabled delegation' };
    }

    if (delegator.delegatedToId !== delegateId) {
      return { valid: false, reason: 'You are not the designated delegate for this user' };
    }

    // 2. Check SOD — delegate cannot be the RM of the application
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { assignedRmId: true },
    });

    if (!application) {
      return { valid: false, reason: 'Application not found' };
    }

    if (application.assignedRmId === delegateId) {
      return { valid: false, reason: 'SOD violation: Delegate cannot approve an application where they are the RM' };
    }

    return { valid: true };
  }
}

export const delegationService = new DelegationService();