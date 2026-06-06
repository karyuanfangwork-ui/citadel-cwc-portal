import prisma from '../../utils/prisma';
import { BureauProvider, AmlRescreenOutcome, AmlRescreenAction } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// §2.7 — AML Re-Screening Service
// ---------------------------------------------------------------------------
// Quarterly PEP/sanctions re-screening for active credit applications.
// Creates CreditBureauCheck(type=AML_RESCREEN) records for each borrower
// that hasn't been re-screened in the last 90 days.
// ---------------------------------------------------------------------------

const RESCREEN_INTERVAL_DAYS = 90;

// States where re-screening is relevant (active applications not yet completed)
const RESCREENABLE_STATES = [
  'SUBMITTED',
  'KYC_REVIEW',
  'KYC_APPROVED',
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
  'APPROVED',
  'OFFER',
  'ACCEPTED',
  'DISBURSED',
  'ACTIVE',
];

class AmlRescreenService {
  /**
   * Find all active applications where the borrower hasn't been
   * re-screened in the last 90 days and queue them for re-screening.
   *
   * Returns the number of applications queued.
   */
  async queueQuarterlyRescreen(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RESCREEN_INTERVAL_DAYS);

    // Find applications in rescreenable states that are not deleted
    const applications = await prisma.creditApplication.findMany({
      where: {
        state: { in: RESCREENABLE_STATES as any },
        deletedAt: null,
      },
      select: {
        id: true,
        applicationNo: true,
        borrowerProfileId: true,
      },
    });

    let queuedCount = 0;

    for (const app of applications) {
      // Check if there's already a recent AML_RESCREEN for this application
      const recentScreen = await prisma.creditBureauCheck.findFirst({
        where: {
          applicationId: app.id,
          provider: BureauProvider.AML_RESCREEN,
          runDate: { gte: cutoffDate },
        },
      });

      if (recentScreen) continue; // Already screened recently

      // Create a placeholder AML re-screen record
      // The actual screening logic is a stub — Wave 4.5 will implement the real adapter
      try {
        await prisma.creditBureauCheck.create({
          data: {
            applicationId: app.id,
            provider: BureauProvider.AML_RESCREEN,
            subjectName: `AML Quarterly Re-screen — ${app.applicationNo}`,
            runDate: new Date(),
            hasHits: null, // Will be populated by the real adapter
            findings: 'Queued for quarterly AML re-screening. Awaiting PEP/sanctions check.',
          },
        });

        // Create audit event
        await AuditChainService.appendEvent(
          app.id,
          'AML_RESCREEN_QUEUED',
          null, // system-generated
          'aml_rescreen_queued',
          undefined,
          undefined,
          {
            provider: 'AML_RESCREEN',
            reason: 'quarterly_rescreen',
            rescreenIntervalDays: RESCREEN_INTERVAL_DAYS,
          },
        );

        logger.info(`[§2.7] AML re-screen queued for app ${app.applicationNo}`);
        queuedCount++;
      } catch (err: any) {
        // Log but don't fail the batch
        logger.error(`[§2.7] Failed to queue AML re-screen for app ${app.applicationNo}: ${err.message}`);
      }
    }

    return queuedCount;
  }

  /**
   * Process a completed AML re-screening result.
   * Updates the CreditBureauCheck record with findings and creates an audit event.
   */
  async processRescreenResult(
    checkId: string,
    hasHits: boolean,
    findings: string,
    runById?: string,
  ): Promise<void> {
    await prisma.creditBureauCheck.update({
      where: { id: checkId },
      data: { hasHits, findings },
    });

    const check = await prisma.creditBureauCheck.findUnique({
      where: { id: checkId },
      select: { applicationId: true },
    });

    if (!check) return;

    await AuditChainService.appendEvent(
      check.applicationId,
      hasHits ? 'AML_RESCREEN_HITS' : 'AML_RESCREEN_CLEAR',
      runById ?? null,
      hasHits ? 'aml_rescreen_hits_found' : 'aml_rescreen_clear',
      undefined,
      undefined,
      {
        checkId,
        hasHits,
        findingsSummary: findings.substring(0, 500),
      },
    );
  }

  // -----------------------------------------------------------------------
  // §2.8 — AML Rescreen Event Log (explicit officer-triggered screenings)
  // -----------------------------------------------------------------------

  /**
   * Trigger a new AML rescreen event. Creates an AmlRescreenEvent record
   * and an audit trail entry. If outcome is CONFIRMED_HIT, notifies compliance.
   */
  async triggerRescreen(dto: {
    borrowerProfileId: string;
    applicationId?: string;
    triggeredById: string;
    screeningSource: string;
    outcome: AmlRescreenOutcome;
    hitDetails?: string;
    actionTaken: AmlRescreenAction;
    actionNotes?: string;
  }) {
    const event = await prisma.amlRescreenEvent.create({
      data: {
        borrowerProfileId: dto.borrowerProfileId,
        applicationId: dto.applicationId ?? null,
        triggeredById: dto.triggeredById,
        screeningSource: dto.screeningSource,
        outcome: dto.outcome,
        hitDetails: dto.hitDetails ?? null,
        actionTaken: dto.actionTaken,
        actionNotes: dto.actionNotes ?? null,
      },
    });

    // Audit event
    await AuditChainService.appendEvent(
      dto.applicationId ?? 'N/A',
      dto.outcome === 'CONFIRMED_HIT' ? 'AML_RESCREEN_CONFIRMED_HIT' : 'AML_RESCREEN_TRIGGERED',
      dto.triggeredById,
      'aml_rescreen_triggered',
      undefined,
      undefined,
      {
        eventId: event.id,
        outcome: dto.outcome,
        screeningSource: dto.screeningSource,
        actionTaken: dto.actionTaken,
      },
    );

    // If confirmed hit, notification is handled at the controller/route level
    // (we create a Notification record for compliance team)
    if (dto.outcome === AmlRescreenOutcome.CONFIRMED_HIT) {
      await this.notifyComplianceHit(event.id, dto.borrowerProfileId, dto.applicationId);
    }

    return event;
  }

  /**
   * Get the full AML rescreen event history for a borrower profile.
   */
  async getHistory(borrowerProfileId: string) {
    return prisma.amlRescreenEvent.findMany({
      where: { borrowerProfileId },
      orderBy: { triggeredAt: 'desc' },
      include: {
        triggeredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Compliance review of an AML rescreen event — marks it as reviewed.
   */
  async reviewEvent(eventId: string, reviewedById: string, reviewNotes?: string) {
    const event = await prisma.amlRescreenEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError('AML rescreen event not found', 404);
    if (event.reviewedAt) throw new AppError('Event already reviewed', 400);

    const updated = await prisma.amlRescreenEvent.update({
      where: { id: eventId },
      data: {
        reviewedById,
        reviewedAt: new Date(),
        actionNotes: reviewNotes ? `${event.actionNotes ?? ''}\n--- Compliance Review ---\n${reviewNotes}`.trim() : event.actionNotes,
      },
    });

    await AuditChainService.appendEvent(
      event.applicationId ?? 'N/A',
      'AML_RESCREEN_REVIEWED',
      reviewedById,
      'aml_rescreen_reviewed',
      undefined,
      undefined,
      { eventId, reviewNotes },
    );

    return updated;
  }

  /**
   * Notify compliance team about a confirmed hit.
   */
  private async notifyComplianceHit(eventId: string, _borrowerProfileId: string, _applicationId?: string) {
    try {
      // Find compliance officers (users with COMPLIANCE role)
      const complianceOfficers = await prisma.user.findMany({
        where: { roles: { some: { role: { name: 'COMPLIANCE' } } } },
        select: { id: true },
      });

      for (const officer of complianceOfficers) {
        await prisma.notification.create({
          data: {
            userId: officer.id,
            channel: 'IN_APP',
            subject: 'AML Confirmed Hit — Compliance Review Required',
            body: `AML rescreen event ${eventId} has a confirmed hit. Compliance review is required before the application can progress.`,
            relatedRequestId: null,
          },
        });
      }
    } catch (err: any) {
      logger.error(`[§2.8] Failed to notify compliance for event ${eventId}: ${err.message}`);
    }
  }
}

export const amlRescreenService = new AmlRescreenService();