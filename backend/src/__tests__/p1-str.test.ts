import prisma from '../utils/prisma';
import { strService } from '../credit/services/str.service';
import { StrStatus } from '@prisma/client';

// ── Test data ──────────────────────────────────────────────────────────────
let testAppId: string;
let testStrId: string;

beforeAll(async () => {
  const borrower = await prisma.borrowerProfile.create({
    data: { borrowerType: 'INDIVIDUAL', name: 'STR Test Borrower' },
  });

  const app = await prisma.creditApplication.create({
    data: {
      applicationNo: `STR-TEST-${Date.now()}`,
      borrowerProfileId: borrower.id,
      productType: 'TERM_LOAN',
      requestedAmount: 200000,
      state: 'DRAFT',
    },
  });
  testAppId = app.id;
});

afterAll(async () => {
  await prisma.strAttachment.deleteMany({ where: { strId: testStrId } }).catch(() => {});
  await prisma.suspiciousTransaction.deleteMany({ where: { applicationId: testAppId } }).catch(() => {});
  await prisma.creditApplication.deleteMany({ where: { id: testAppId } }).catch(() => {});
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-7: STR Register', () => {
  describe('createStr', () => {
    it('should create a draft STR', async () => {
      const str = await strService.createStr({
        applicationId: testAppId,
        subjectName: 'Ahmad Bin Ismail',
        subjectIdType: 'NRIC',
        subjectIdNumber: '850101-01-5123',
        grounds: 'Unusual transaction pattern detected during credit assessment',
        severity: 'MEDIUM',
      });

      expect(str.id).toBeDefined();
      expect(str.status).toBe('DRAFT');
      expect(str.subjectName).toBe('Ahmad Bin Ismail');
      expect(str.severity).toBe('MEDIUM');
      expect(str.applicationId).toBe(testAppId);
      testStrId = str.id;
    });

    it('should create STR without application link', async () => {
      const str = await strService.createStr({
        subjectName: 'XYZ Corporation Sdn Bhd',
        subjectIdType: 'BRN',
        grounds: 'Structuring detected in deposit patterns',
        severity: 'HIGH',
      });

      expect(str.applicationId).toBeNull();
      expect(str.status).toBe('DRAFT');

      // Clean up
      await prisma.suspiciousTransaction.delete({ where: { id: str.id } });
    });
  });

  describe('updateStr', () => {
    it('should update a draft STR', async () => {
      const updated = await strService.updateStr(testStrId, {
        grounds: 'Updated: Multiple suspicious patterns detected',
        severity: 'HIGH',
      });

      expect(updated.grounds).toBe('Updated: Multiple suspicious patterns detected');
      expect(updated.severity).toBe('HIGH');
    });

    it('should not update a filed STR', async () => {
      // File the STR first
      await strService.fileStr(testStrId, { filingReference: 'FIU-2026-001' });

      await expect(
        strService.updateStr(testStrId, { grounds: 'Should fail' })
      ).rejects.toThrow(/after filing/i);
    });
  });

  describe('lifecycle transitions', () => {
    let lifecycleStrId: string;

    beforeAll(async () => {
      const str = await strService.createStr({
        subjectName: 'Lifecycle Test Subject',
        grounds: 'Test lifecycle transitions',
        severity: 'LOW',
      });
      lifecycleStrId = str.id;
    });

    it('should transition DRAFT → UNDER_REVIEW', async () => {
      const str = await strService.submitForReview(lifecycleStrId);
      expect(str.status).toBe('UNDER_REVIEW');
    });

    it('should not submit UNDER_REVIEW again', async () => {
      await expect(
        strService.submitForReview(lifecycleStrId)
      ).rejects.toThrow(/only draft/i);
    });

    it('should transition UNDER_REVIEW → FILED', async () => {
      const str = await strService.fileStr(lifecycleStrId, {
        filingReference: 'FIU-2026-LIFECYCLE',
      });
      expect(str.status).toBe('FILED');
      expect(str.filingReference).toBe('FIU-2026-LIFECYCLE');
      expect(str.filingDate).toBeDefined();
    });

    it('should not file an already-filed STR', async () => {
      await expect(
        strService.fileStr(lifecycleStrId, { filingReference: 'DUPLICATE' })
      ).rejects.toThrow(/already filed/i);
    });

    it('should transition FILED → ACKNOWLEDGED', async () => {
      const adminUserId = 'd116ac9e-80de-426f-bdc2-93dd869e51c8';
      const str = await strService.acknowledgeStr(lifecycleStrId, adminUserId);
      expect(str.status).toBe('ACKNOWLEDGED');
      expect(str.reviewedById).toBe(adminUserId);
      expect(str.reviewedAt).toBeDefined();
    });

    it('should not acknowledge a non-FILED STR', async () => {
      await expect(
        strService.acknowledgeStr(lifecycleStrId, 'd116ac9e-80de-426f-bdc2-93dd869e51c8')
      ).rejects.toThrow(/only filed/i);
    });

    it('should transition ACKNOWLEDGED → CLOSED', async () => {
      const str = await strService.closeStr(lifecycleStrId, 'Investigation complete — no further action');
      expect(str.status).toBe('CLOSED');
      expect(str.notes).toContain('Investigation complete');
    });

    it('should not close an already-closed STR', async () => {
      await expect(
        strService.closeStr(lifecycleStrId, 'Duplicate close')
      ).rejects.toThrow(/already closed/i);
    });
  });

  describe('listStrs', () => {
    it('should list STRs with pagination', async () => {
      const result = await strService.listStrs({ page: 1, limit: 10 });
      expect(result.items).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by status', async () => {
      const result = await strService.listStrs({ status: 'DRAFT' });
      expect(result.items.every((s: any) => s.status === 'DRAFT')).toBe(true);
    });
  });

  describe('linkAmlRescreenEvent', () => {
    it('should link STR to AML rescreen event', async () => {
      const str = await strService.createStr({
        subjectName: 'AML Link Test',
        grounds: 'Test AML linkage',
      });

      // Create a mock AML rescreen event
      const borrower = await prisma.borrowerProfile.create({
        data: { borrowerType: 'INDIVIDUAL', name: 'AML Test Borrower' },
      });

      const amlEvent = await prisma.amlRescreenEvent.create({
        data: {
          borrowerProfileId: borrower.id,
          screeningSource: 'PERIODIC',
          outcome: 'CONFIRMED_HIT',
          actionTaken: 'FILED_STR',
          triggeredById: 'd116ac9e-80de-426f-bdc2-93dd869e51c8',
        },
      });

      const updated = await strService.linkAmlRescreenEvent(str.id, amlEvent.id);
      expect(updated.amlRescreenEventId).toBe(amlEvent.id);

      // Clean up
      await prisma.suspiciousTransaction.delete({ where: { id: str.id } });
      await prisma.amlRescreenEvent.delete({ where: { id: amlEvent.id } });
      await prisma.borrowerProfile.delete({ where: { id: borrower.id } });
    });
  });

  describe('getStr', () => {
    it('should throw 404 for non-existent STR', async () => {
      await expect(
        strService.getStr('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(/not found/i);
    });
  });
});