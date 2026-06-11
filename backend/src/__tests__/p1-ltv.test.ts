import prisma from '../utils/prisma';
import { collateralService, LtvResult } from '../credit/services/collateral.service';

// ── Test data ──────────────────────────────────────────────────────────────
let testAppId: string;
let testFacilityId: string;
let testCollateralIds: string[] = [];

beforeAll(async () => {
  // Seed haircut configs
  const configs = [
    { securityCategory: 'PROPERTY', haircutPercent: 0.30, minValuationAgeMonths: 12 },
    { securityCategory: 'VEHICLE', haircutPercent: 0.40, minValuationAgeMonths: 6 },
    { securityCategory: 'FD', haircutPercent: 0.05, minValuationAgeMonths: 3 },
    { securityCategory: 'SECURITIES', haircutPercent: 0.50, minValuationAgeMonths: 3 },
    { securityCategory: 'OTHER', haircutPercent: 0.50, minValuationAgeMonths: 6 },
  ];
  for (const c of configs) {
    await prisma.collateralHaircutConfig.upsert({
      where: { securityCategory_isActive: { securityCategory: c.securityCategory, isActive: true } },
      update: { haircutPercent: c.haircutPercent, minValuationAgeMonths: c.minValuationAgeMonths },
      create: c,
    });
  }

  const borrower = await prisma.borrowerProfile.create({
    data: { borrowerType: 'INDIVIDUAL', name: 'LTV Test Borrower' },
  });

  const app = await prisma.creditApplication.create({
    data: {
      applicationNo: `LTV-TEST-${Date.now()}`,
      borrowerProfileId: borrower.id,
      productType: 'TERM_LOAN',
      requestedAmount: 500000,
      state: 'DRAFT',
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
  for (const id of testCollateralIds) {
    await prisma.collateral.deleteMany({ where: { id } }).catch(() => {});
  }
  await prisma.applicationFacility.deleteMany({ where: { id: testFacilityId } }).catch(() => {});
  await prisma.creditApplication.deleteMany({ where: { id: testAppId } }).catch(() => {});
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-4: LTV Gate + Collateral Hardening', () => {
  describe('computeLtv', () => {
    it('should return 100% LTV when no collateral exists', async () => {
      const result = await collateralService.computeLtv(testFacilityId);

      expect(result.ltvPercent).toBe(Infinity);
      expect(result.exceedsCap).toBe(true);
      expect(result.totalAdjustedValue).toBe(0);
      expect(result.haircutDetails).toHaveLength(0);
    });

    it('should compute LTV with PROPERTY collateral and 30% haircut', async () => {
      const collateral = await prisma.collateral.create({
        data: {
          facilityId: testFacilityId,
          collateralType: 'PROPERTY',
          securityCategory: 'PROPERTY',
          marketValue: 800000,
          forcedSaleValue: 700000,
          valuationDate: new Date(),
          valuer: 'Test Valuer',
        },
      });
      testCollateralIds.push(collateral.id);

      const result = await collateralService.computeLtv(testFacilityId);

      // FSV = 700000, haircut = 30%, adjusted = 700000 * 0.70 = 490000
      // LTV = 500000 / 490000 * 100 = 102.04%
      expect(result.totalMarketValue).toBe(800000);
      expect(result.totalAdjustedValue).toBeCloseTo(490000, 0);
      expect(result.ltvPercent).toBeGreaterThan(70);
      expect(result.exceedsCap).toBe(true);
      expect(result.haircutDetails).toHaveLength(1);
      expect(result.haircutDetails[0].haircut).toBeCloseTo(0.30, 2);
      expect(result.haircutDetails[0].adjustedValue).toBeCloseTo(490000, 0);
      expect(result.staleValuations).toHaveLength(0);
    });

    it('should detect stale valuations', async () => {
      const staleCollateral = await prisma.collateral.create({
        data: {
          facilityId: testFacilityId,
          collateralType: 'PROPERTY',
          securityCategory: 'PROPERTY',
          marketValue: 300000,
          forcedSaleValue: 250000,
          valuationDate: new Date(Date.now() - 15 * 30 * 24 * 60 * 60 * 1000), // 15 months ago
          valuer: 'Old Valuer',
        },
      });
      testCollateralIds.push(staleCollateral.id);

      const result = await collateralService.computeLtv(testFacilityId);

      expect(result.staleValuations.length).toBeGreaterThanOrEqual(1);
      const stale = result.staleValuations.find((s: any) => s.id === staleCollateral.id);
      expect(stale).toBeDefined();
      expect(stale!.ageMonths).toBeGreaterThanOrEqual(12);
    });

    it('should pass LTV with sufficient collateral', async () => {
      // Create a separate facility with sufficient collateral
      const facility2 = await prisma.applicationFacility.create({
        data: {
          applicationId: testAppId,
          facilityType: 'TERM_LOAN',
          amount: 100000,
          tenorMonths: 60,
        },
      });

      const collateral = await prisma.collateral.create({
        data: {
          facilityId: facility2.id,
          collateralType: 'PROPERTY',
          securityCategory: 'PROPERTY',
          marketValue: 500000,
          forcedSaleValue: 450000,
          valuationDate: new Date(),
          valuer: 'Test Valuer',
        },
      });

      const result = await collateralService.computeLtv(facility2.id);

      // FSV = 450000, haircut 30%, adjusted = 315000
      // LTV = 100000 / 315000 * 100 = 31.75%
      expect(result.ltvPercent).toBeLessThan(70);
      expect(result.exceedsCap).toBe(false);

      // Clean up
      await prisma.collateral.delete({ where: { id: collateral.id } });
      await prisma.applicationFacility.delete({ where: { id: facility2.id } });
    });

    it('should apply FD haircut (5%) for FD collateral', async () => {
      const facility3 = await prisma.applicationFacility.create({
        data: {
          applicationId: testAppId,
          facilityType: 'TERM_LOAN',
          amount: 200000,
          tenorMonths: 12,
        },
      });

      const collateral = await prisma.collateral.create({
        data: {
          facilityId: facility3.id,
          collateralType: 'FD',
          securityCategory: 'FD',
          marketValue: 300000,
          forcedSaleValue: 300000,
          valuationDate: new Date(),
          valuer: 'Bank',
        },
      });

      const result = await collateralService.computeLtv(facility3.id);

      // FSV = 300000, haircut 5%, adjusted = 285000
      // LTV = 200000 / 285000 * 100 = 70.18%
      expect(result.haircutDetails[0].haircut).toBeCloseTo(0.05, 2);
      expect(result.haircutDetails[0].adjustedValue).toBeCloseTo(285000, 0);
      expect(result.exceedsCap).toBe(true); // 70.18 > 70

      // Clean up
      await prisma.collateral.delete({ where: { id: collateral.id } });
      await prisma.applicationFacility.delete({ where: { id: facility3.id } });
    });
  });

  describe('computeApplicationLtv', () => {
    it('should compute LTV for all facilities in an application', async () => {
      const results = await collateralService.computeApplicationLtv(testAppId);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r: LtvResult) => {
        expect(r.facilityId).toBeDefined();
        expect(r.ltvPercent).toBeDefined();
        expect(r.exceedsCap).toBeDefined();
      });
    });
  });

  describe('softDeleteCollateral', () => {
    it('should soft-delete a collateral record', async () => {
      const facility = await prisma.applicationFacility.create({
        data: {
          applicationId: testAppId,
          facilityType: 'TERM_LOAN',
          amount: 50000,
          tenorMonths: 12,
        },
      });

      const collateral = await prisma.collateral.create({
        data: {
          facilityId: facility.id,
          collateralType: 'VEHICLE',
          marketValue: 60000,
          valuationDate: new Date(),
        },
      });

      const deletedById = 'd116ac9e-80de-426f-bdc2-93dd869e51c8';
      const result = await collateralService.softDeleteCollateral(
        collateral.id, deletedById, 'Test soft delete'
      );

      expect(result.softDeletedAt).toBeDefined();
      expect(result.softDeletedById).toBe(deletedById);
      expect(result.softDeleteReason).toBe('Test soft delete');

      // Should be excluded from list queries
      const listed = await collateralService.listCollateral(testAppId);
      const found = listed.find((c: any) => c.id === collateral.id);
      expect(found).toBeUndefined();

      // Clean up
      await prisma.collateral.delete({ where: { id: collateral.id } });
      await prisma.applicationFacility.delete({ where: { id: facility.id } });
    });

    it('should not soft-delete an already-soft-deleted record', async () => {
      const facility = await prisma.applicationFacility.create({
        data: {
          applicationId: testAppId,
          facilityType: 'TERM_LOAN',
          amount: 30000,
          tenorMonths: 6,
        },
      });

      const collateral = await prisma.collateral.create({
        data: {
          facilityId: facility.id,
          collateralType: 'OTHER',
          marketValue: 20000,
        },
      });

      const deletedById = 'd116ac9e-80de-426f-bdc2-93dd869e51c8';
      await collateralService.softDeleteCollateral(collateral.id, deletedById, 'First delete');

      await expect(
        collateralService.softDeleteCollateral(collateral.id, deletedById, 'Second delete')
      ).rejects.toThrow(/already soft-deleted/i);

      // Clean up
      await prisma.collateral.delete({ where: { id: collateral.id } });
      await prisma.applicationFacility.delete({ where: { id: facility.id } });
    });

    it('should throw 404 for non-existent collateral', async () => {
      await expect(
        collateralService.softDeleteCollateral('00000000-0000-0000-0000-000000000000', 'admin', 'test')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('listCollateral excludes soft-deleted', () => {
    it('should only return active (non-soft-deleted) collateral', async () => {
      const facility = await prisma.applicationFacility.create({
        data: {
          applicationId: testAppId,
          facilityType: 'TERM_LOAN',
          amount: 100000,
          tenorMonths: 24,
        },
      });

      const c1 = await prisma.collateral.create({
        data: {
          facilityId: facility.id,
          collateralType: 'PROPERTY',
          marketValue: 200000,
          valuationDate: new Date(),
        },
      });

      const c2 = await prisma.collateral.create({
        data: {
          facilityId: facility.id,
          collateralType: 'VEHICLE',
          marketValue: 50000,
        },
      });

      // Soft-delete one
      await collateralService.softDeleteCollateral(c2.id, 'd116ac9e-80de-426f-bdc2-93dd869e51c8', 'remove vehicle');

      const listed = await collateralService.listCollateral(testAppId);
      const ids = listed.map((c: any) => c.id);

      expect(ids).toContain(c1.id);
      expect(ids).not.toContain(c2.id);

      // Clean up
      await prisma.collateral.delete({ where: { id: c1.id } });
      await prisma.collateral.delete({ where: { id: c2.id } });
      await prisma.applicationFacility.delete({ where: { id: facility.id } });
    });
  });
});