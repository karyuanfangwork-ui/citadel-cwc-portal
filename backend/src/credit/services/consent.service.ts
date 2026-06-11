import prisma from '../../utils/prisma';
import { ConsentStatus, ConsentPurpose } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordConsentData {
  subjectId: string;
  subjectType: string; // 'BORROWER' | 'CONTACT'
  purpose: ConsentPurpose;
  consentText?: string;
  consentTextVersion?: string;
  evidence?: string;
  channel?: string;
  grantedById?: string;
  applicationId?: string;
  expiresAt?: Date;
}

export interface WithdrawConsentData {
  withdrawnById: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ConsentService {
  /**
   * Record a new consent. Enforces one active consent per purpose per subject.
   * If an ACTIVE consent already exists for this subject+purpose, returns it instead.
   */
  async recordConsent(data: RecordConsentData) {
    // Check for existing active consent
    const existing = await prisma.consentRecord.findFirst({
      where: {
        subjectId: data.subjectId,
        subjectType: data.subjectType,
        purpose: data.purpose,
        status: ConsentStatus.ACTIVE,
      },
    });

    if (existing) {
      logger.info(`[Consent] Active ${data.purpose} consent already exists for subject ${data.subjectId}, returning existing`);
      return existing;
    }

    const consent = await prisma.consentRecord.create({
      data: {
        subjectId: data.subjectId,
        subjectType: data.subjectType,
        purpose: data.purpose,
        status: ConsentStatus.ACTIVE,
        consentText: data.consentText,
        consentTextVersion: data.consentTextVersion,
        evidence: data.evidence ?? 'WEB_FORM',
        channel: data.channel ?? 'PORTAL',
        grantedById: data.grantedById,
        applicationId: data.applicationId,
        expiresAt: data.expiresAt,
      },
    });

    logger.info(`[Consent] Recorded ${data.purpose} consent for subject ${data.subjectId} (id=${consent.id})`);
    return consent;
  }

  /**
   * Withdraw an active consent. Sets status to WITHDRAWN with timestamp and reason.
   */
  async withdrawConsent(consentId: string, data: WithdrawConsentData) {
    const consent = await prisma.consentRecord.findUnique({ where: { id: consentId } });
    if (!consent) {
      throw new AppError('Consent record not found', 404, { code: 'CONSENT_NOT_FOUND' });
    }

    if (consent.status !== ConsentStatus.ACTIVE) {
      throw new AppError(`Cannot withdraw consent in ${consent.status} status. Only ACTIVE consent can be withdrawn.`, 400, { code: 'CONSENT_NOT_ACTIVE' });
    }

    const withdrawn = await prisma.consentRecord.update({
      where: { id: consentId },
      data: {
        status: ConsentStatus.WITHDRAWN,
        withdrawnAt: new Date(),
        withdrawnById: data.withdrawnById,
        withdrawalReason: data.reason,
      },
    });

    logger.info(`[Consent] Withdrawn ${consent.purpose} consent for subject ${consent.subjectId} (id=${consentId})`);
    return withdrawn;
  }

  /**
   * Check if an active consent exists for a subject and purpose.
   * Returns the active consent record or null.
   */
  async checkConsent(subjectId: string, purpose: ConsentPurpose): Promise<boolean> {
    const consent = await prisma.consentRecord.findFirst({
      where: {
        subjectId,
        purpose,
        status: ConsentStatus.ACTIVE,
      },
    });
    return consent !== null;
  }

  /**
   * Get the active consent record for a subject and purpose (full record, not just boolean).
   */
  async getActiveConsent(subjectId: string, purpose: ConsentPurpose) {
    return prisma.consentRecord.findFirst({
      where: {
        subjectId,
        purpose,
        status: ConsentStatus.ACTIVE,
      },
    });
  }

  /**
   * List all consent records for a subject.
   */
  async getSubjectConsents(subjectId: string) {
    return prisma.consentRecord.findMany({
      where: { subjectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single consent record by ID.
   */
  async getConsent(consentId: string) {
    const consent = await prisma.consentRecord.findUnique({ where: { id: consentId } });
    if (!consent) {
      throw new AppError('Consent record not found', 404, { code: 'CONSENT_NOT_FOUND' });
    }
    return consent;
  }

  /**
   * PDPA data-subject export — gather all personal data linked to a subject.
   */
  async exportSubjectData(subjectId: string) {
    const consents = await prisma.consentRecord.findMany({
      where: { subjectId },
      orderBy: { createdAt: 'desc' },
    });

    // Also gather related borrower profile data if subject is a borrower
    let borrowerData = null;
    const borrowerConsent = consents.find(c => c.subjectType === 'BORROWER');
    if (borrowerConsent) {
      borrowerData = await prisma.borrowerProfile.findUnique({
        where: { id: subjectId },
        select: {
          id: true,
          name: true,
          borrowerType: true,
          createdAt: true,
        },
      });
    }

    return {
      subjectId,
      consents,
      borrowerProfile: borrowerData,
      exportedAt: new Date(),
    };
  }
}

export const consentService = new ConsentService();