import { ApplicationState } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';

import prisma from '../../utils/prisma';

const REJECTION_REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_INCOME: 'Insufficient Income',
  HIGH_EXISTING_OBLIGATIONS: 'High Existing Obligations',
  POOR_CREDIT_HISTORY: 'Poor Credit History',
  INADEQUATE_COLLATERAL: 'Inadequate Collateral',
  WEAK_BUSINESS_PERFORMANCE: 'Weak Business Performance',
  INCOMPLETE_DOCUMENTATION: 'Incomplete Documentation',
  AML_COMPLIANCE_ISSUE: 'AML / Compliance Issue',
  POLICY_BREACH: 'Policy Breach',
  CONCENTRATION_LIMIT: 'Concentration Limit',
  OTHER: 'Other',
};

export function getRejectionReasonLabels() {
  return Object.entries(REJECTION_REASON_LABELS).map(([value, label]) => ({ value, label }));
}

class RejectionService {
  /**
   * Notify relevant parties about a rejection.
   * Sends in-app notification to the RM and logs audit event.
   */
  async notifyRejection(applicationId: string, rejectionReasonCode: string, rejectionReason: string | null): Promise<void> {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        borrowerProfile: { include: { account: true, contact: true } },
        assignedRm: { select: { id: true, firstName: true, lastName: true, email: true, tenantId: true } },
      },
    });
    if (!app) return;

    const borrowerName =
      app.borrowerProfile?.account?.name ??
      (app.borrowerProfile?.contact
        ? `${app.borrowerProfile.contact.firstName ?? ''} ${app.borrowerProfile.contact.lastName ?? ''}`.trim()
        : null) ??
      app.borrowerProfile?.name ??
      'Unnamed Borrower';

    const reasonLabel = REJECTION_REASON_LABELS[rejectionReasonCode] ?? rejectionReasonCode;
    const detailText = rejectionReason ? ` — ${rejectionReason}` : '';

    // Notify RM if assigned + audit event (atomic)
    if (app.assignedRmId && app.assignedRm) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: app.assignedRmId!,
            tenantId: app.assignedRm!.tenantId ?? '00000000-0000-0000-0000-000000000001',
            channel: 'IN_APP',
            subject: 'Application Rejected',
            body: `Application ${app.applicationNo ?? app.id.slice(0, 8)} for ${borrowerName} has been rejected. Reason: ${reasonLabel}${detailText}`,
            relatedRequestId: applicationId,
          },
        });

        // Audit event
        await AuditChainService.appendEvent(
          applicationId,
          'REJECTION_NOTIFIED',
          app.assignedRmId ?? '',
          'notify_rejection',
          undefined,
          undefined,
          { rejectionReasonCode, reasonLabel, rejectionReason },
          tx as any,
        );
      });
    } else {
      // No RM assigned — still log audit event atomically (single write, no tx needed for audit-only)
      await AuditChainService.appendEvent(
        applicationId,
        'REJECTION_NOTIFIED',
        '',
        'notify_rejection',
        undefined,
        undefined,
        { rejectionReasonCode, reasonLabel, rejectionReason },
      );
    }
  }

  /**
   * Clone a rejected application into a new DRAFT.
   * Copies: borrower, product type, requested amount/tenor, parties, facilities.
   * Does NOT copy: decisions, documents, conditions.
   */
  async copyToNewApplication(applicationId: string, requestedById: string): Promise<string> {
    const source = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: { parties: true, facilities: true },
    });
    if (!source) {
      throw new AppError('Source application not found', 404);
    }
    if (source.state !== 'REJECTED') {
      throw new AppError('Only rejected applications can be cloned', 400);
    }

    const newApp = await prisma.$transaction(async (tx) => {
      const created = await tx.creditApplication.create({
        data: {
          applicationNo: `CA-CLONE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          borrowerProfileId: source.borrowerProfileId,
          productType: source.productType,
          currency: source.currency,
          requestedAmount: source.requestedAmount,
          requestedTenor: source.requestedTenor,
          purpose: source.purpose,
          state: ApplicationState.DRAFT,
          assignedRmId: requestedById,
          parentApplicationId: source.id,
          // Copy parties
          parties: {
            create: source.parties.map((p) => ({
              role: p.role,
              borrowerProfileId: p.borrowerProfileId,
              liabilityPct: p.liabilityPct,
            })),
          },
          // Copy facilities
          facilities: {
            create: source.facilities.map((f) => ({
              facilityType: f.facilityType,
              amount: f.amount,
              tenorMonths: f.tenorMonths,
              ratePct: f.ratePct,
              purpose: f.purpose,
              existingLimit: f.existingLimit,
              proposedChange: f.proposedChange,
              newLimit: f.newLimit,
              outstandingBalance: f.outstandingBalance,
              undisbursedLimit: f.undisbursedLimit,
              approvingLevel: f.approvingLevel,
              pricingLabel: f.pricingLabel,
            })),
          },
        },
      });

      // Audit event
      await AuditChainService.appendEvent(
        created.id,
        'APPLICATION_CLONED',
        requestedById,
        'clone_from_rejected',
        source.id,
        created.id,
        { parentApplicationId: source.id },
        tx as any,
      );

      return created;
    });

    return newApp.id;
  }
}

export const rejectionService = new RejectionService();