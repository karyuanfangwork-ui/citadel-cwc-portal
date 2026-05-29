import prisma from '../../utils/prisma';
import { BureauProvider } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { logger } from '../../utils/logger';

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
}

export const amlRescreenService = new AmlRescreenService();