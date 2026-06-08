import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const GUARANTEE_TYPES = ['PERSONAL', 'CORPORATE'] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

export interface CreateGuaranteeData {
  facilityId: string;
  guarantorProfileId: string;
  guaranteeType: string;
  amount: string | number;
  isLimited?: boolean;
}

export interface UpdateGuaranteeData {
  guaranteeType?: string;
  amount?: string | number;
  isLimited?: boolean;
  // S7.3 — Guarantor Financial Assessment
  contingentLiabilities?: string | number | null;
  estimatedNetWorth?: string | number | null;
  guarantorRiskRatingSnapshot?: string | null;
  remarks?: string | null;
}

// Risk rating values allowed for guarantor risk rating snapshot
export const GUARANTOR_RISK_RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'] as const;
export type GuarantorRiskRating = (typeof GUARANTOR_RISK_RATINGS)[number];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class GuaranteeService {
  /**
   * List all guarantees for a given application (through facilities).
   */
  async listGuarantees(applicationId: string) {
    const facilities = await prisma.applicationFacility.findMany({
      where: { applicationId },
      select: { id: true },
    });
    const facilityIds = facilities.map((f: { id: string }) => f.id);

    if (facilityIds.length === 0) return [];

    return prisma.guarantee.findMany({
      where: { facilityId: { in: facilityIds } },
      include: {
        guarantorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single guarantee by ID.
   */
  async getGuarantee(id: string) {
    return prisma.guarantee.findUnique({
      where: { id },
      include: {
        guarantorProfile: true,
      },
    });
  }

  /**
   * Create a new guarantee.
   */
  async createGuarantee(data: CreateGuaranteeData) {
    const createData: Prisma.GuaranteeCreateInput = {
      guaranteeType: data.guaranteeType,
      amount: new Prisma.Decimal(data.amount),
      isLimited: data.isLimited ?? true,
      facility: { connect: { id: data.facilityId } },
      guarantorProfile: { connect: { id: data.guarantorProfileId } },
    };

    return prisma.guarantee.create({ data: createData });
  }

  /**
   * Update an existing guarantee.
   */
  async updateGuarantee(id: string, data: UpdateGuaranteeData) {
    const existing = await prisma.guarantee.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.GuaranteeUpdateInput = {};

    if (data.guaranteeType !== undefined) updateData.guaranteeType = data.guaranteeType;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.isLimited !== undefined) updateData.isLimited = data.isLimited;

    // S7.3 — Guarantor Financial Assessment fields
    if (data.contingentLiabilities !== undefined) {
      updateData.contingentLiabilities = data.contingentLiabilities === null ? null : new Prisma.Decimal(data.contingentLiabilities);
    }
    if (data.estimatedNetWorth !== undefined) {
      updateData.estimatedNetWorth = data.estimatedNetWorth === null ? null : new Prisma.Decimal(data.estimatedNetWorth);
    }
    if (data.guarantorRiskRatingSnapshot !== undefined) {
      updateData.guarantorRiskRatingSnapshot = data.guarantorRiskRatingSnapshot;
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    return prisma.guarantee.update({ where: { id }, data: updateData });
  }

  /**
   * S7.3 — Update guarantor financial assessment fields only.
   * Accepts the four Phase 4 / S7.3 fields.
   */
  async updateFinancialAssessment(id: string, data: {
    contingentLiabilities?: string | number | null;
    estimatedNetWorth?: string | number | null;
    guarantorRiskRatingSnapshot?: string | null;
    remarks?: string | null;
  }) {
    const existing = await prisma.guarantee.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.GuaranteeUpdateInput = {};

    if (data.contingentLiabilities !== undefined) {
      updateData.contingentLiabilities = data.contingentLiabilities === null ? null : new Prisma.Decimal(data.contingentLiabilities);
    }
    if (data.estimatedNetWorth !== undefined) {
      updateData.estimatedNetWorth = data.estimatedNetWorth === null ? null : new Prisma.Decimal(data.estimatedNetWorth);
    }
    if (data.guarantorRiskRatingSnapshot !== undefined) {
      updateData.guarantorRiskRatingSnapshot = data.guarantorRiskRatingSnapshot;
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    return prisma.guarantee.update({
      where: { id },
      data: updateData,
      include: { guarantorProfile: true },
    });
  }

  /**
   * Delete a guarantee.
   */
  async deleteGuarantee(id: string) {
    const existing = await prisma.guarantee.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.guarantee.delete({ where: { id } });
  }
}

export const guaranteeService = new GuaranteeService();