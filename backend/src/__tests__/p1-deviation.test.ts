import prisma from '../utils/prisma';
import { deviationService } from '../credit/services/deviation.service';
import { DeviationStatus, DeviationSeverity } from '@prisma/client';

// ── Test data ──────────────────────────────────────────────────────────────
let testApplicationId: string;
let testBorrowerId: string;
let createdDeviationIds: string[] = [];
let requesterUserId: string;

beforeAll(async () => {
  // Create a borrower profile + application for testing
  const borrower = await prisma.borrowerProfile.create({
    data: {
      borrowerType: 'INDIVIDUAL',
      name: 'Deviation Test Borrower',
    },
  });
  testBorrowerId = borrower.id;

  const appNo = `DEV-TEST-${Date.now()}`;
  const application = await prisma.creditApplication.create({
    data: {
      applicationNo: appNo,
      borrowerProfileId: borrower.id,
      productType: 'TERM_LOAN',
      purpose: 'Test deviation register',
      requestedAmount: 500000,
      state: 'UNDERWRITING',
      tenantId: '00000000-0000-0000-0000-000000000001',
    },
  });

  testApplicationId = application.id;

  const requester = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!requester) {
    throw new Error('No active test user found for deviation creator attribution');
  }
  requesterUserId = requester.id;
});

afterAll(async () => {
  // Clean up all created deviations
  for (const id of createdDeviationIds) {
    await prisma.deviationApproval.delete({ where: { id } }).catch(() => {});
  }
  // Clean up test application and borrower
  if (testApplicationId) {
    await prisma.creditApplication.delete({ where: { id: testApplicationId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-6: Deviation Register (Service Layer)', () => {
  // ── Create deviation ─────────────────────────────────────────────────────
  describe('createDeviation', () => {
    it('should create a deviation record for a policy breach', async () => {
      const deviation = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'LTV_CAP',
        description: 'LTV exceeds the 70% cap for residential property',
        actualValue: 85,
        thresholdValue: 70,
        severity: DeviationSeverity.HIGH,
        justification: 'Strong borrower with excellent repayment history',
      });

      createdDeviationIds.push(deviation.id);
      expect(deviation).toBeDefined();
      expect(deviation.policyRule).toBe('LTV_CAP');
      expect(deviation.status).toBe(DeviationStatus.PENDING);
      expect(deviation.severity).toBe(DeviationSeverity.HIGH);
      expect(deviation.requiredAuthorityLevel).toBe('COMMITTEE'); // HIGH severity maps to COMMITTEE
      expect(deviation.actualValue).toBeDefined();
      expect(deviation.thresholdValue).toBeDefined();
    });

    it('should reject creation of non-waivable deviation', async () => {
      await expect(
        deviationService.createDeviation({
          applicationId: testApplicationId,
          policyRule: 'REGULATORY_LIMIT',
          description: 'Regulatory limit breach',
          justification: 'Not possible',
          isNonWaivable: true,
        })
      ).rejects.toThrow(/non-waivable/i);
    });

    it('should default severity to MEDIUM and authority to SENIOR_MANAGER', async () => {
      const deviation = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'MINOR_BREACH',
        description: 'Minor policy breach',
        justification: 'Justification text',
      });

      createdDeviationIds.push(deviation.id);
      expect(deviation.severity).toBe(DeviationSeverity.MEDIUM);
      expect(deviation.requiredAuthorityLevel).toBe('SENIOR_MANAGER');
    });

    it('should persist the requester for SOD enforcement', async () => {
      const deviation = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'CREATOR_ATTRIBUTION',
        description: 'Creator attribution test',
        severity: DeviationSeverity.LOW,
        justification: 'Test creator attribution',
      }, requesterUserId);

      createdDeviationIds.push(deviation.id);
      expect(deviation.createdById).toBe(requesterUserId);
    });
  });

  // ── Get deviation ───────────────────────────────────────────────────────
  describe('getDeviation', () => {
    it('should get a deviation by ID', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'NET_DSR',
        description: 'Net DSR exceeds 50% threshold',
        actualValue: 65,
        thresholdValue: 50,
        justification: 'Borrower has strong asset backing',
      });
      createdDeviationIds.push(created.id);

      const deviation = await deviationService.getDeviation(created.id);
      expect(deviation.id).toBe(created.id);
      expect(deviation.policyRule).toBe('NET_DSR');
    });

    it('should throw 404 for non-existent deviation', async () => {
      await expect(
        deviationService.getDeviation('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── Update deviation ────────────────────────────────────────────────────
  describe('updateDeviation', () => {
    it('should update a pending deviation', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'EXPOSURE_LIMIT',
        description: 'Single borrower exposure exceeds limit',
        severity: DeviationSeverity.LOW,
        justification: 'Original justification',
      });
      createdDeviationIds.push(created.id);

      const updated = await deviationService.updateDeviation(created.id, {
        justification: 'Updated justification with more detail',
        severity: DeviationSeverity.MEDIUM,
      });

      expect(updated.justification).toBe('Updated justification with more detail');
      expect(updated.severity).toBe(DeviationSeverity.MEDIUM);
    });

    it('should not update a non-pending deviation', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'UPDATE_TEST',
        description: 'Test',
        justification: 'Test justification',
      });
      createdDeviationIds.push(created.id);

      // Approve it first
      await deviationService.approveDeviation(created.id, requesterUserId, 'COMMITTEE', 'Approved');

      await expect(
        deviationService.updateDeviation(created.id, { justification: 'Should fail' })
      ).rejects.toThrow(/only pending/i);
    });
  });

  // ── Approve deviation ───────────────────────────────────────────────────
  describe('approveDeviation', () => {
    it('should approve a pending deviation with sufficient authority', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'GUARANTOR_CAPACITY',
        description: 'Guarantor capacity slightly below threshold',
        actualValue: 95,
        thresholdValue: 100,
        severity: DeviationSeverity.LOW,
        justification: 'Guarantor has other unencumbered assets',
      });
      createdDeviationIds.push(created.id);

      const approved = await deviationService.approveDeviation(
        created.id,
        requesterUserId,
        'MANAGER',
        'Approved — compensating factors present'
      );

      expect(approved.status).toBe(DeviationStatus.APPROVED);
      expect(approved.approvedById).toBe(requesterUserId);
      expect(approved.approvalComments).toBe('Approved — compensating factors present');
    });

    it('should reject approval with insufficient authority', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'CRITICAL_BREACH',
        description: 'Critical policy breach',
        severity: DeviationSeverity.CRITICAL,
        justification: 'Needs board approval',
      });
      createdDeviationIds.push(created.id);

      // CRITICAL severity requires BOARD authority, MANAGER should fail
      await expect(
        deviationService.approveDeviation(created.id, requesterUserId, 'MANAGER', 'Trying to approve')
      ).rejects.toThrow(/below the required level/i);
    });

    it('should reject self-approval by the deviation requester', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SELF_APPROVAL_TEST',
        description: 'Requester cannot approve own deviation',
        severity: DeviationSeverity.LOW,
        justification: 'Test self approval SOD',
      }, requesterUserId);
      createdDeviationIds.push(created.id);

      await expect(
        deviationService.approveDeviation(created.id, requesterUserId, 'MANAGER', 'Self approve')
      ).rejects.toMatchObject({
        statusCode: 403,
        details: { code: 'DEVIATION_SOD_VIOLATION' },
      });
    });

    it('should not approve a non-waivable deviation', async () => {
      // This would have been blocked at creation, but test the service method directly
      const created = await prisma.deviationApproval.create({
        data: {
          applicationId: testApplicationId,
          policyRule: 'NON_WAIVABLE_TEST',
          description: 'Test non-waivable',
          justification: 'Test',
          status: DeviationStatus.PENDING,
          severity: DeviationSeverity.LOW,
          isNonWaivable: true,
          requiredAuthorityLevel: 'BOARD',
        },
      });
      createdDeviationIds.push(created.id);

      await expect(
        deviationService.approveDeviation(created.id, requesterUserId, 'BOARD', 'Try approve')
      ).rejects.toThrow(/non-waivable/i);
    });

    it('should not approve an already-approved deviation', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'DOUBLE_APPROVE_TEST',
        description: 'Test double approve',
        severity: DeviationSeverity.LOW,
        justification: 'Test',
      });
      createdDeviationIds.push(created.id);

      await deviationService.approveDeviation(created.id, requesterUserId, 'MANAGER', 'First approve');

      await expect(
        deviationService.approveDeviation(created.id, requesterUserId, 'MANAGER', 'Second approve')
      ).rejects.toThrow(/only pending/i);
    });
  });

  // ── Reject deviation ────────────────────────────────────────────────────
  describe('rejectDeviation', () => {
    it('should reject a pending deviation', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'CONCENTRATION_LIMIT',
        description: 'Sector concentration exceeds policy limit',
        severity: DeviationSeverity.MEDIUM,
        justification: 'Temporary market conditions',
      });
      createdDeviationIds.push(created.id);

      const rejected = await deviationService.rejectDeviation(
        created.id,
        requesterUserId,
        'Breach is too significant — restructure the facility'
      );

      expect(rejected.status).toBe(DeviationStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Breach is too significant — restructure the facility');
      expect(rejected.rejectedById).toBe(requesterUserId);
    });

    it('should not reject a non-pending deviation', async () => {
      const created = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'REJECT_TWICE_TEST',
        description: 'Test',
        severity: DeviationSeverity.LOW,
        justification: 'Test',
      });
      createdDeviationIds.push(created.id);

      await deviationService.rejectDeviation(created.id, requesterUserId, 'First rejection');

      await expect(
        deviationService.rejectDeviation(created.id, requesterUserId, 'Second rejection')
      ).rejects.toThrow(/only pending/i);
    });
  });

  // ── Application deviation checks ────────────────────────────────────────
  describe('hasPendingDeviations / checkApplicationDeviations', () => {
    it('should detect pending deviations', async () => {
      // We have several PENDING deviations from earlier tests
      const hasPending = await deviationService.hasPendingDeviations(testApplicationId);
      expect(hasPending).toBe(true);
    });

    it('should return correct counts from checkApplicationDeviations', async () => {
      const result = await deviationService.checkApplicationDeviations(testApplicationId);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.pendingCount).toBeGreaterThanOrEqual(1);
      expect(result.approvedCount).toBeGreaterThanOrEqual(1); // The LOW severity one we approved
      expect(result.rejectedCount).toBeGreaterThanOrEqual(1); // The CONCENTRATION_LIMIT one we rejected
      expect(result.canProceed).toBe(false); // PENDING deviations exist
    });

    it('should report canProceed=true when no pending deviations', async () => {
      // Create a fresh application with no deviations
      const borrower = await prisma.borrowerProfile.create({
        data: { borrowerType: 'INDIVIDUAL', name: 'Clean Test Borrower' },
      });
      const app = await prisma.creditApplication.create({
        data: {
          applicationNo: `CLEAN-TEST-${Date.now()}`,
          borrowerProfileId: borrower.id,
          productType: 'TERM_LOAN',
          requestedAmount: 100000,
          state: 'DRAFT',
          tenantId: '00000000-0000-0000-0000-000000000001',
        },
      });

      const result = await deviationService.checkApplicationDeviations(app.id);
      expect(result.canProceed).toBe(true);
      expect(result.pendingCount).toBe(0);
      expect(result.total).toBe(0);

      // Clean up
      await prisma.creditApplication.delete({ where: { id: app.id } });
      await prisma.borrowerProfile.delete({ where: { id: borrower.id } });
    });
  });

  // ── List deviations (register view) ──────────────────────────────────────
  describe('listOpenDeviations', () => {
    it('should list deviations with pagination', async () => {
      const result = await deviationService.listOpenDeviations({
        applicationId: testApplicationId,
        page: 1,
        limit: 10,
      });

      expect(result.deviations).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.deviations.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const result = await deviationService.listOpenDeviations({
        applicationId: testApplicationId,
        status: DeviationStatus.PENDING,
      });

      expect(result.deviations.every(d => d.status === DeviationStatus.PENDING)).toBe(true);
    });

    it('should filter by policy rule', async () => {
      const result = await deviationService.listOpenDeviations({
        policyRule: 'LTV_CAP',
      });

      expect(result.deviations.every(d => d.policyRule === 'LTV_CAP')).toBe(true);
    });
  });

  // ── autoCreateFromBreach ─────────────────────────────────────────────────
  describe('autoCreateFromBreach', () => {
    it('should auto-create deviation from policy breach detection', async () => {
      const deviation = await deviationService.autoCreateFromBreach({
        applicationId: testApplicationId,
        policyRule: 'LTV_CAP',
        description: 'LTV 85% exceeds 70% cap',
        actualValue: 85,
        thresholdValue: 70,
        severity: DeviationSeverity.HIGH,
      });

      createdDeviationIds.push(deviation.id);
      expect(deviation).toBeDefined();
      expect(deviation.policyRule).toBe('LTV_CAP');
      expect(deviation.status).toBe(DeviationStatus.PENDING);
      expect(deviation.justification).toMatch(/Auto-detected/);
      expect(deviation.actualValue).toBeDefined();
      expect(deviation.thresholdValue).toBeDefined();
    });
  });

  // ── Severity-to-authority mapping ────────────────────────────────────────
  describe('severity authority mapping', () => {
    it('LOW severity requires MANAGER approval', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_LOW',
        description: 'Low severity',
        severity: DeviationSeverity.LOW,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);
      expect(d.requiredAuthorityLevel).toBe('MANAGER');
    });

    it('MEDIUM severity requires SENIOR_MANAGER approval', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_MED',
        description: 'Medium severity',
        severity: DeviationSeverity.MEDIUM,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);
      expect(d.requiredAuthorityLevel).toBe('SENIOR_MANAGER');
    });

    it('MEDIUM severity cannot be approved by MANAGER authority', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_MED_MANAGER_REJECT',
        description: 'Medium severity manager reject',
        severity: DeviationSeverity.MEDIUM,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);

      await expect(
        deviationService.approveDeviation(d.id, requesterUserId, 'MANAGER', 'Manager attempt')
      ).rejects.toThrow(/below the required level/i);
    });

    it('MEDIUM severity can be approved by SENIOR_MANAGER authority', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_MED_SENIOR_APPROVE',
        description: 'Medium severity senior approve',
        severity: DeviationSeverity.MEDIUM,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);

      const approved = await deviationService.approveDeviation(
        d.id,
        requesterUserId,
        'SENIOR_MANAGER',
        'Senior approval',
      );

      expect(approved.status).toBe(DeviationStatus.APPROVED);
    });

    it('HIGH severity requires COMMITTEE approval', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_HIGH',
        description: 'High severity',
        severity: DeviationSeverity.HIGH,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);
      expect(d.requiredAuthorityLevel).toBe('COMMITTEE');
    });

    it('CRITICAL severity requires BOARD approval', async () => {
      const d = await deviationService.createDeviation({
        applicationId: testApplicationId,
        policyRule: 'SEV_CRIT',
        description: 'Critical severity',
        severity: DeviationSeverity.CRITICAL,
        justification: 'Test',
      });
      createdDeviationIds.push(d.id);
      expect(d.requiredAuthorityLevel).toBe('BOARD');
    });
  });
});