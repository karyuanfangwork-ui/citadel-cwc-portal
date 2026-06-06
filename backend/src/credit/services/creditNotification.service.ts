/**
 * Credit Notification Service
 *
 * Provides a single entry point `onApplicationEvent()` that:
 *   1. Resolves the relevant recipients (assigned RM, analyst, approvers)
 *   2. Creates Notification records in the database
 *   3. Pushes real-time SSE events to connected clients
 *   4. Fires emails via the existing notification.service.ts `notify()`
 *
 * Designed to be called from the credit application state machine or
 * approval action service on every state transition / lifecycle event.
 *
 * Usage (to be wired into state machine):
 *   creditNotificationService.onApplicationEvent(
 *     applicationId,
 *     'credit_application_approved',
 *     actorId,
 *     { borrowerName: 'Acme Corp', ... }
 *   );
 */

import prisma from '../../utils/prisma';
import { notifyMultiple } from '../../services/notification.service';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreditEventType =
  | 'credit_application_submitted'
  | 'credit_application_approved'
  | 'credit_application_rejected'
  | 'credit_approval_requested'
  | 'credit_application_withdrawn'
  | 'disbursement_requested'
  | 'disbursement_approved'
  | 'disbursement_completed';

export interface CreditEventDetails {
  /** Human-readable application number (e.g. CA-00001) */
  applicationNo?: string;
  /** Borrower display name */
  borrowerName?: string;
  /** Currency code (e.g. MYR) */
  currency?: string;
  /** Requested/approved/rejected amount */
  requestedAmount?: string;
  approvedAmount?: string;
  /** Reason for rejection or withdrawal */
  rejectionReason?: string;
  /** Who withdrew */
  withdrawnBy?: string;
  /** Current application state label */
  applicationState?: string;
  /** Approval progress */
  approvalsCollected?: number;
  approvalsRequired?: number;
  /** Any additional context */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

interface ApplicationRecipients {
  rmId: string | null;
  analystId: string | null;
  approverIds: string[];
}

async function resolveRecipients(applicationId: string): Promise<ApplicationRecipients> {
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: {
      assignedRmId: true,
      assignedAnalystId: true,
      decisions: {
        where: { decisionType: 'APPROVE' },
        select: { decisionById: true },
      },
    },
  });

  if (!application) {
    return { rmId: null, analystId: null, approverIds: [] };
  }

  const approverIds = application.decisions.map((d: { decisionById: string }) => d.decisionById);

  return {
    rmId: application.assignedRmId,
    analystId: application.assignedAnalystId,
    approverIds,
  };
}

// ---------------------------------------------------------------------------
// Event → recipient mapping
// ---------------------------------------------------------------------------

function getTargetUserIds(
  eventType: CreditEventType,
  actorId: string,
  recipients: ApplicationRecipients,
): string[] {
  const unique = new Set<string>();

  switch (eventType) {
    case 'credit_application_submitted': {
      // Notify the assigned RM (if not the submitter) and analyst
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      break;
    }
    case 'credit_application_approved': {
      // Notify RM and analyst
      if (recipients.rmId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      break;
    }
    case 'credit_application_rejected': {
      // Notify RM and analyst
      if (recipients.rmId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      break;
    }
    case 'credit_approval_requested': {
      // Notify users with approval authority (RM is excluded by SOD; analysts don't approve)
      // For now, we notify the RM (who may need to track status) and existing approvers.
      // The approval controller should additionally look up eligible approvers from the matrix.
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      for (const id of recipients.approverIds) {
        if (id !== actorId) unique.add(id);
      }
      break;
    }
    case 'credit_application_withdrawn': {
      // Notify RM, analyst, and any approvers who already voted
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      for (const id of recipients.approverIds) {
        if (id !== actorId) unique.add(id);
      }
      break;
    }
    case 'disbursement_requested': {
      // Notify RM and approvers (they need to approve)
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      for (const id of recipients.approverIds) {
        if (id !== actorId) unique.add(id);
      }
      break;
    }
    case 'disbursement_approved': {
      // Notify RM and analyst — order approved, ready for disbursement
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      break;
    }
    case 'disbursement_completed': {
      // Notify RM, analyst, and approvers — disbursement done
      if (recipients.rmId && recipients.rmId !== actorId) unique.add(recipients.rmId);
      if (recipients.analystId && recipients.analystId !== actorId) unique.add(recipients.analystId);
      for (const id of recipients.approverIds) {
        if (id !== actorId) unique.add(id);
      }
      break;
    }
  }

  return Array.from(unique);
}

// ---------------------------------------------------------------------------
// Lookup additional approvers by authority level
// ---------------------------------------------------------------------------

async function lookupEligibleApproverUserIds(
  applicationId: string,
): Promise<string[]> {
  // Find users who have credit:approve permission and are NOT the assigned RM
  const application = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { assignedRmId: true },
  });
  const rmId = application?.assignedRmId;

  const approverUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: {
            permissions: {
              some: {
                permission: { name: 'credit:approve' },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return approverUsers
    .map((u) => u.id)
    .filter((id) => id !== rmId);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CreditNotificationService {
  /**
   * Main entry point — call on any credit application lifecycle event.
   *
   * @param applicationId  UUID of the CreditApplication
   * @param eventType      One of the CreditEventType values
   * @param actorId        UUID of the user who triggered the event
   * @param details        Template variables for notification rendering
   */
  async onApplicationEvent(
    applicationId: string,
    eventType: CreditEventType,
    actorId: string,
    details: CreditEventDetails = {},
  ): Promise<void> {
    try {
      // 1. Resolve recipients
      const recipients = await resolveRecipients(applicationId);
      let targetUserIds = getTargetUserIds(eventType, actorId, recipients);

      // For approval_requested, also include eligible approvers from the permission system
      if (eventType === 'credit_approval_requested') {
        const eligibleApproverIds = await lookupEligibleApproverUserIds(applicationId);
        const combined = new Set([...targetUserIds, ...eligibleApproverIds]);
        combined.delete(actorId); // Never notify the actor
        targetUserIds = Array.from(combined);
      }

      if (targetUserIds.length === 0) {
        logger.info(`[CreditNotify] No recipients for ${eventType} on ${applicationId}`);
        return;
      }

      // 2. Build template variables — include applicationId for link generation
      const variables: Record<string, string> = {
        ...Object.fromEntries(
          Object.entries(details).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
            .map(([k, v]) => [k, String(v)])
        ),
        applicationId,
      };

      // 3. Send notifications via the existing notification service
      //    This handles: DB notification record creation, SSE push, and email
      await notifyMultiple(
        targetUserIds,
        eventType,
        variables,
        undefined, // relatedRequestId — not applicable for credit
      );

      logger.info(
        `[CreditNotify] ${eventType} → notified ${targetUserIds.length} user(s) for application ${applicationId}`,
      );
    } catch (error) {
      // Notification failures should never block the business flow
      logger.error(
        `[CreditNotify] Failed to send ${eventType} for application ${applicationId}`,
        { error: String(error) },
      );
    }
  }
}

export const creditNotificationService = new CreditNotificationService();