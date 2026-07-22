import prisma from '../utils/prisma';
import { guaranteeService, GuarantorCapacityResult } from '../credit/services/guarantee.service';

// ── Test data ──────────────────────────────────────────────────────────────
let testAppId: string;
let testFacilityId: string;
let testGuarantorId: string;
let testGuaranteeId: string;
let testGuaranteeId2: string;

beforeAll(async () => {
  const borrower = await prisma.borrowerProfile.create({
    data: { borrowerType: 'INDIVIDUAL', name: 'Guarantor Test Borrower' },
  });
  testGuarantorId = borrower.id;

  const app = await prisma.creditApplication.create({
    data: {
      applicationNo: `GUAR-TEST-${Date.now()}`,
      borrowerProfileId: borrower.id,
      productType: 'TERM_LOAN',
      requestedAmount: 500000,
      state: 'DRAFT',
      tenantId: '00000000-0000-0000-0000-000000000001',
    },
  });
  testAppId = app.id;

  const facility = await prisma.applicationFacility.create({
    data: {
      applicationId: app.id,
      facilityType: 'TERM_LOAN',
      amount: 500000,
      tenorMonths: 60,
    },
  });
  testFacilityId = facility.id;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  await prisma.guarantee.deleteMany({ where: { facilityId: testFacilityId } }).catch(() => {});
  await prisma.applicationFacility.deleteMany({ where: { applicationId: testAppId } }).catch(() => {});
  await prisma.creditApplication.deleteMany({ where: { id: testAppId } }).catch(() => {});
  await prisma.borrowerProfile.deleteMany({ where: { id: testGuarantorId } }).catch(() => {});
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-5: Guarantor Capacity Checks', () => {
  describe('checkGuarantorCapacity', () => {
    it('should create a guarantee and check capacity when under capacity', async () => {
      const guarantee = await guaranteeService.createGuarantee({
        facilityId: testFacilityId,
        guarantorProfileId: testGuarantorId,
        guaranteeType: 'PERSONAL',
        amount: 100000,
      });
      testGuaranteeId = guarantee.id;

      // Set net worth to assess capacity
      await guaranteeService.updateGuarantee(guarantee.id, {
        estimatedNetWorth: 500000,
        isRelatedParty: false,
      });

      const result = await guaranteeService.checkGuarantorCapacity(guarantee.id);

      expect(result.guaranteeAmount).toBe(100000);
      expect(result.estimatedNetWorth).toBe(500000);
      expect(result.aggregateExposure).toBe(100000);
      expect(result.capacityUtilization).toBeCloseTo(0.2, 2); // 100k / 500k = 20%
      expect(result.isOverCapacity).toBe(false);
      expect(result.isRelatedParty).toBe(false);
    });

    it('should flag over-capacity when guarantee exceeds net worth', async () => {
      // Create a second guarantee with same guarantor, larger amount
      const guarantee2 = await guaranteeService.createGuarantee({
        facilityId: testFacilityId,
        guarantorProfileId: testGuarantorId,
        guaranteeType: 'PERSONAL',
        amount: 450000, // Combined: 100k + 450k = 550k > 500k net worth
      });
      testGuaranteeId2 = guarantee2.id;

      // Set net worth on guarantee2 as well (service picks max across all guarantees for guarantor)
      await guaranteeService.updateGuarantee(guarantee2.id, {
        estimatedNetWorth: 500000,
      });

      const result = await guaranteeService.checkGuarantorCapacity(guarantee2.id);

      // Aggregate exposure across all guarantees for this guarantor
      expect(result.aggregateExposure).toBe(550000); // 100k + 450k
      expect(result.capacityUtilization).toBeCloseTo(1.1, 2); // 550k / 500k = 110%
      expect(result.isOverCapacity).toBe(true); // capacity utilization > 100%
    });

    it('should flag over-capacity when single guarantee exceeds net worth', async () => {
      // Create a guarantee with amount > net worth
      const guarantee3 = await guaranteeService.createGuarantee({
        facilityId: testFacilityId,
        guarantorProfileId: testGuarantorId,
        guaranteeType: 'PERSONAL',
        amount: 600000, // 600k > 500k net worth
      });

      // Set net worth so capacity can be assessed
      await guaranteeService.updateGuarantee(guarantee3.id, {
        estimatedNetWorth: 500000,
      });

      const result = await guaranteeService.checkGuarantorCapacity(guarantee3.id);

      expect(result.guaranteeAmount).toBe(600000);
      expect(result.isOverCapacity).toBe(true); // single guarantee > net worth

      // Clean up
      await guaranteeService.deleteGuarantee(guarantee3.id);
    });

    it('should handle missing net worth gracefully', async () => {
      // Create guarantee without setting estimatedNetWorth
      const borrower2 = await prisma.borrowerProfile.create({
        data: { borrowerType: 'INDIVIDUAL', name: 'No Net Worth Guarantor' },
      });

      const guarantee4 = await guaranteeService.createGuarantee({
        facilityId: testFacilityId,
        guarantorProfileId: borrower2.id,
        guaranteeType: 'PERSONAL',
        amount: 100000,
      });

      const result = await guaranteeService.checkGuarantorCapacity(guarantee4.id);

      expect(result.estimatedNetWorth).toBeNull();
      expect(result.isOverCapacity).toBe(false); // Cannot assess without net worth
      expect(result.capacityUtilization).toBe(Infinity); // Infinity when no net worth

      // Clean up
      await guaranteeService.deleteGuarantee(guarantee4.id);
      await prisma.borrowerProfile.delete({ where: { id: borrower2.id } });
    });

    it('should detect related party flag', async () => {
      // Mark the guarantor as a related party
      await guaranteeService.updateGuarantee(testGuaranteeId, {
        isRelatedParty: true,
        relatedPartyRole: 'DIRECTOR',
      });

      const result = await guaranteeService.checkGuarantorCapacity(testGuaranteeId);

      expect(result.isRelatedParty).toBe(true);
      expect(result.relatedPartyRole).toBe('DIRECTOR');
    });

    it('should throw error for non-existent guarantee', async () => {
      await expect(
        guaranteeService.checkGuarantorCapacity('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('updateGuarantee with related-party fields', () => {
    it('should update isRelatedParty and relatedPartyRole', async () => {
      const updated = await guaranteeService.updateGuarantee(testGuaranteeId2, {
        isRelatedParty: true,
        relatedPartyRole: 'SHAREHOLDER',
      });

      expect(updated.isRelatedParty).toBe(true);
      expect(updated.relatedPartyRole).toBe('SHAREHOLDER');
    });

    it('should clear relatedPartyRole by setting null', async () => {
      const updated = await guaranteeService.updateGuarantee(testGuaranteeId2, {
        relatedPartyRole: null,
      });

      expect(updated.relatedPartyRole).toBeNull();
    });
  });
});