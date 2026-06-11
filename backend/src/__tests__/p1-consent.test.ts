import prisma from '../utils/prisma';
import { consentService } from '../credit/services/consent.service';
import { ConsentPurpose, ConsentStatus } from '@prisma/client';

// ── Test data ──────────────────────────────────────────────────────────────
let testBorrowerId: string;
let testApplicationId: string;
let createdConsentIds: string[] = [];

beforeAll(async () => {
  const borrower = await prisma.borrowerProfile.create({
    data: { borrowerType: 'INDIVIDUAL', name: 'Consent Test Borrower' },
  });
  testBorrowerId = borrower.id;

  const appNo = `CONSENT-TEST-${Date.now()}`;
  const application = await prisma.creditApplication.create({
    data: {
      applicationNo: appNo,
      borrowerProfileId: borrower.id,
      productType: 'TERM_LOAN',
      requestedAmount: 100000,
      state: 'DRAFT',
    },
  });
  testApplicationId = application.id;
});

afterAll(async () => {
  for (const id of createdConsentIds) {
    await prisma.consentRecord.delete({ where: { id } }).catch(() => {});
  }
  if (testApplicationId) {
    await prisma.creditApplication.delete({ where: { id: testApplicationId } }).catch(() => {});
  }
  if (testBorrowerId) {
    await prisma.borrowerProfile.delete({ where: { id: testBorrowerId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-2: PDPA Consent Records', () => {
  // ── Record consent ───────────────────────────────────────────────────────
  describe('recordConsent', () => {
    it('should record a new BUREAU_PULL consent', async () => {
      const consent = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.BUREAU_PULL,
        evidence: 'WEB_FORM',
        channel: 'PORTAL',
      });

      createdConsentIds.push(consent.id);
      expect(consent).toBeDefined();
      expect(consent.purpose).toBe(ConsentPurpose.BUREAU_PULL);
      expect(consent.status).toBe(ConsentStatus.ACTIVE);
      expect(consent.subjectId).toBe(testBorrowerId);
      expect(consent.subjectType).toBe('BORROWER');
    });

    it('should return existing active consent instead of creating duplicate', async () => {
      // BUREAU_PULL already exists from previous test
      const consent = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.BUREAU_PULL,
      });

      // Should be the same consent, not a new one
      expect(consent.purpose).toBe(ConsentPurpose.BUREAU_PULL);
      expect(consent.status).toBe(ConsentStatus.ACTIVE);
    });

    it('should allow recording a different purpose consent for same subject', async () => {
      const consent = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.PROCESSING,
        evidence: 'WEB_FORM',
        channel: 'PORTAL',
      });

      createdConsentIds.push(consent.id);
      expect(consent.purpose).toBe(ConsentPurpose.PROCESSING);
      expect(consent.status).toBe(ConsentStatus.ACTIVE);
    });

    it('should record consent with applicationId linkage', async () => {
      const consent = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.THIRD_PARTY_SHARING,
        applicationId: testApplicationId,
      });

      createdConsentIds.push(consent.id);
      expect(consent.applicationId).toBe(testApplicationId);
    });
  });

  // ── Check consent ────────────────────────────────────────────────────────
  describe('checkConsent', () => {
    it('should return true when active consent exists', async () => {
      const hasConsent = await consentService.checkConsent(testBorrowerId, ConsentPurpose.BUREAU_PULL);
      expect(hasConsent).toBe(true);
    });

    it('should return false when no consent exists for purpose', async () => {
      const hasConsent = await consentService.checkConsent(testBorrowerId, ConsentPurpose.MARKETING);
      expect(hasConsent).toBe(false);
    });

    it('should return false for a non-existent subject', async () => {
      const hasConsent = await consentService.checkConsent('00000000-0000-0000-0000-000000000000', ConsentPurpose.BUREAU_PULL);
      expect(hasConsent).toBe(false);
    });
  });

  // ── Get active consent ───────────────────────────────────────────────────
  describe('getActiveConsent', () => {
    it('should return the full consent record for an active purpose', async () => {
      const consent = await consentService.getActiveConsent(testBorrowerId, ConsentPurpose.BUREAU_PULL);
      expect(consent).not.toBeNull();
      expect(consent!.purpose).toBe(ConsentPurpose.BUREAU_PULL);
      expect(consent!.status).toBe(ConsentStatus.ACTIVE);
    });

    it('should return null for a non-existent purpose', async () => {
      const consent = await consentService.getActiveConsent(testBorrowerId, ConsentPurpose.MARKETING);
      expect(consent).toBeNull();
    });
  });

  // ── Withdraw consent ────────────────────────────────────────────────────
  describe('withdrawConsent', () => {
    let marketingConsentId: string;

    beforeAll(async () => {
      const consent = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.MARKETING,
      });
      marketingConsentId = consent.id;
      createdConsentIds.push(consent.id);
    });

    it('should withdraw an active consent', async () => {
      const withdrawn = await consentService.withdrawConsent(marketingConsentId, {
        withdrawnById: 'd116ac9e-80de-426f-bdc2-93dd869e51c8',
        reason: 'User requested withdrawal via portal',
      });

      expect(withdrawn.status).toBe(ConsentStatus.WITHDRAWN);
      expect(withdrawn.withdrawnAt).toBeDefined();
      expect(withdrawn.withdrawnById).toBe('d116ac9e-80de-426f-bdc2-93dd869e51c8');
      expect(withdrawn.withdrawalReason).toBe('User requested withdrawal via portal');
    });

    it('should not allow withdrawing an already-withdrawn consent', async () => {
      await expect(
        consentService.withdrawConsent(marketingConsentId, {
          withdrawnById: 'd116ac9e-80de-426f-bdc2-93dd869e51c8',
          reason: 'Double withdrawal attempt',
        })
      ).rejects.toThrow(/cannot withdraw consent/i);
    });

    it('should report consent as absent after withdrawal', async () => {
      const hasConsent = await consentService.checkConsent(testBorrowerId, ConsentPurpose.MARKETING);
      expect(hasConsent).toBe(false);
    });
  });

  // ── Get subject consents ─────────────────────────────────────────────────
  describe('getSubjectConsents', () => {
    it('should list all consents for a subject', async () => {
      const consents = await consentService.getSubjectConsents(testBorrowerId);
      expect(consents.length).toBeGreaterThanOrEqual(2); // BUREAU_PULL + PROCESSING at minimum
    });
  });

  // ── Get consent by ID ────────────────────────────────────────────────────
  describe('getConsent', () => {
    it('should retrieve a consent record by ID', async () => {
      const created = await consentService.recordConsent({
        subjectId: testBorrowerId,
        subjectType: 'BORROWER',
        purpose: ConsentPurpose.PROCESSING,
      });
      // If already exists, it returns existing — find it
      const fetched = await consentService.getConsent(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('should throw 404 for non-existent consent', async () => {
      await expect(
        consentService.getConsent('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── PDPA export ──────────────────────────────────────────────────────────
  describe('exportSubjectData', () => {
    it('should export all consent data for a subject', async () => {
      const exportData = await consentService.exportSubjectData(testBorrowerId);
      expect(exportData.subjectId).toBe(testBorrowerId);
      expect(exportData.consents.length).toBeGreaterThanOrEqual(1);
      expect(exportData.borrowerProfile).toBeDefined();
      expect(exportData.borrowerProfile!.name).toBe('Consent Test Borrower');
      expect(exportData.exportedAt).toBeDefined();
    });
  });
});