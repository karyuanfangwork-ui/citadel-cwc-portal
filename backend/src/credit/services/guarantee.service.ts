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
  // P1-5 — Related party fields
  isRelatedParty?: boolean;
  relatedPartyRole?: string | null;
}

// Risk rating values allowed for guarantor risk rating snapshot
export const GUARANTOR_RISK_RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'] as const;
export type GuarantorRiskRating = (typeof GUARANTOR_RISK_RATINGS)[number];

// P1-5 — Guarantor capacity check result
export interface GuarantorCapacityResult {
  guaranteeId: string;
  guarantorId: string;
  guaranteeAmount: number;
  estimatedNetWorth: number | null;
  contingentLiabilities: number;
  aggregateExposure: number;
  capacityUtilization: number;
  isOverCapacity: boolean;
  isRelatedParty: boolean;
  relatedPartyRole?: string;
}

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
    // P1-5 — Related party fields
    if (data.isRelatedParty !== undefined) updateData.isRelatedParty = data.isRelatedParty;
    if (data.relatedPartyRole !== undefined) updateData.relatedPartyRole = data.relatedPartyRole;

    return prisma.guarantee.update({ where: { id }, data: updateData });
  }

  /** P1-5 — Check guarantor capacity.
   * Computes aggregate exposure across all applications, capacity utilization,
   * and whether the guarantor is over-capacity.
   * If over-capacity, the application requires a deviation (P1-6) to proceed.
   */
  async checkGuarantorCapacity(guaranteeId: string): Promise<GuarantorCapacityResult> {
    const guarantee = await prisma.guarantee.findUnique({
      where: { id: guaranteeId },
      include: { guarantorProfile: true },
    });

    if (!guarantee) {
      throw new Error(`Guarantee ${guaranteeId} not found`);
    }

    const guarantorId = guarantee.guarantorProfileId;
    const guaranteeAmount = Number(guarantee.amount);

    // 1. Sum all guarantees for this guarantor across all applications
    // Also find the best estimatedNetWorth from any guarantee record
    const allGuarantees = await prisma.guarantee.findMany({
      where: { guarantorProfileId: guarantorId },
      select: { id: true, amount: true, estimatedNetWorth: true, contingentLiabilities: true, isRelatedParty: true, relatedPartyRole: true },
    });

    const aggregateExposure = allGuarantees.reduce((sum, g) => sum + Number(g.amount), 0);

    // Use the maximum non-null estimatedNetWorth across all guarantee records for this guarantor
    const netWorths = allGuarantees
      .map(g => g.estimatedNetWorth != null ? Number(g.estimatedNetWorth) : null)
      .filter((v): v is number => v !== null);
    const estimatedNetWorth = netWorths.length > 0 ? Math.max(...netWorths) : null;

    // Use max contingent liabilities across all records
    const contingents = allGuarantees
      .map(g => g.contingentLiabilities != null ? Number(g.contingentLiabilities) : 0);
    const contingentLiabilities = contingents.length > 0 ? Math.max(...contingents) : 0;

    // Related party: if flagged on ANY guarantee for this guarantor
    const isRelatedParty = allGuarantees.some(g => g.isRelatedParty === true);
    const relatedPartyRole = allGuarantees.find(g => g.isRelatedParty === true)?.relatedPartyRole ?? undefined;

    // 2. Compute capacity utilization
    const CAPACITY_UTILIZATION_THRESHOLD = 1.0; // 100% — can be moved to CreditPolicyLimit
    const capacityUtilization = estimatedNetWorth != null && estimatedNetWorth > 0
      ? aggregateExposure / estimatedNetWorth
      : Infinity;

    // 3. Check if guarantee exceeds net worth or utilization exceeds threshold
    const isOverCapacity = estimatedNetWorth != null
      ? (guaranteeAmount > estimatedNetWorth || capacityUtilization > CAPACITY_UTILIZATION_THRESHOLD)
      : false; // Cannot assess without net worth

    return {
      guaranteeId: guarantee.id,
      guarantorId,
      guaranteeAmount,
      estimatedNetWorth,
      contingentLiabilities,
      aggregateExposure,
      capacityUtilization,
      isOverCapacity,
      isRelatedParty,
      relatedPartyRole,
    };
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