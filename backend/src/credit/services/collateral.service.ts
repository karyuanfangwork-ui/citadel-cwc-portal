import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COLLATERAL_TYPES = ['PROPERTY', 'VEHICLE', 'FD', 'SECURITIES', 'OTHER'] as const;
export type CollateralType = (typeof COLLATERAL_TYPES)[number];

export interface CreateCollateralData {
  facilityId: string;
  collateralType: string;
  description?: string | null;
  titleReference?: string | null;
  registeredTo?: string | null;
  marketValue?: string | number | null;
  forcedSaleValue?: string | number | null;
  valuationDate?: Date | string | null;
  valuer?: string | null;
  insuranceCoverRequired?: boolean;
}

export interface UpdateCollateralData {
  collateralType?: string;
  description?: string | null;
  titleReference?: string | null;
  registeredTo?: string | null;
  marketValue?: string | number | null;
  forcedSaleValue?: string | number | null;
  valuationDate?: Date | string | null;
  valuer?: string | null;
  insuranceCoverRequired?: boolean;
}

export interface CreateValuationData {
  collateralId: string;
  marketValue: string | number;
  forcedSaleValue: string | number;
  valuationDate: Date | string;
  valuer: string;
  reportReference?: string | null;
}

export interface CreateLienData {
  collateralId: string;
  lienHolder: string;
  lienAmount?: string | number | null;
  priority?: number;
  registeredAt?: Date | string | null;
}

export interface CreateInsuranceData {
  collateralId: string;
  insurer: string;
  policyNumber?: string | null;
  coverageAmount: string | number;
  effectiveDate: Date | string;
  expiryDate: Date | string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CollateralService {
  /**
   * List all collateral for a given application (through facilities).
   */
  async listCollateral(applicationId: string) {
    const facilities = await prisma.applicationFacility.findMany({
      where: { applicationId },
      select: { id: true },
    });
    const facilityIds = facilities.map((f: { id: string }) => f.id);

    if (facilityIds.length === 0) return [];

    return prisma.collateral.findMany({
      where: { facilityId: { in: facilityIds } },
      include: {
        valuations: { orderBy: { createdAt: 'desc' } },
        liens: { orderBy: { priority: 'asc' } },
        insuranceCovers: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single collateral by ID with relations.
   */
  async getCollateral(id: string) {
    return prisma.collateral.findUnique({
      where: { id },
      include: {
        valuations: { orderBy: { createdAt: 'desc' } },
        liens: { orderBy: { priority: 'asc' } },
        insuranceCovers: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Create a new collateral record.
   */
  async createCollateral(data: CreateCollateralData) {
    const createData: Prisma.CollateralCreateInput = {
      collateralType: data.collateralType,
      description: data.description ?? undefined,
      titleReference: data.titleReference ?? undefined,
      registeredTo: data.registeredTo ?? undefined,
      marketValue: data.marketValue != null ? new Prisma.Decimal(data.marketValue) : undefined,
      forcedSaleValue: data.forcedSaleValue != null ? new Prisma.Decimal(data.forcedSaleValue) : undefined,
      valuationDate: data.valuationDate ? new Date(data.valuationDate) : undefined,
      valuer: data.valuer ?? undefined,
      insuranceCoverRequired: data.insuranceCoverRequired ?? false,
      facility: { connect: { id: data.facilityId } },
    };

    return prisma.collateral.create({ data: createData });
  }

  /**
   * Update an existing collateral record.
   */
  async updateCollateral(id: string, data: UpdateCollateralData) {
    const existing = await prisma.collateral.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.CollateralUpdateInput = {};

    if (data.collateralType !== undefined) updateData.collateralType = data.collateralType;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.titleReference !== undefined) updateData.titleReference = data.titleReference;
    if (data.registeredTo !== undefined) updateData.registeredTo = data.registeredTo;
    if (data.marketValue !== undefined) updateData.marketValue = data.marketValue != null ? new Prisma.Decimal(data.marketValue) : null;
    if (data.forcedSaleValue !== undefined) updateData.forcedSaleValue = data.forcedSaleValue != null ? new Prisma.Decimal(data.forcedSaleValue) : null;
    if (data.valuationDate !== undefined) updateData.valuationDate = data.valuationDate ? new Date(data.valuationDate) : null;
    if (data.valuer !== undefined) updateData.valuer = data.valuer;
    if (data.insuranceCoverRequired !== undefined) updateData.insuranceCoverRequired = data.insuranceCoverRequired;

    return prisma.collateral.update({ where: { id }, data: updateData });
  }

  /**
   * Delete a collateral record.
   */
  async deleteCollateral(id: string) {
    const existing = await prisma.collateral.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.collateral.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Valuations
  // -------------------------------------------------------------------------

  /**
   * Add a valuation to a collateral.
   */
  async addValuation(data: CreateValuationData) {
    const createData: Prisma.CollateralValuationCreateInput = {
      marketValue: new Prisma.Decimal(data.marketValue),
      forcedSaleValue: new Prisma.Decimal(data.forcedSaleValue),
      valuationDate: new Date(data.valuationDate),
      valuer: data.valuer,
      reportReference: data.reportReference ?? undefined,
      collateral: { connect: { id: data.collateralId } },
    };

    const valuation = await prisma.collateralValuation.create({ data: createData });

    // Also update the parent collateral's inline valuation fields with latest
    await prisma.collateral.update({
      where: { id: data.collateralId },
      data: {
        marketValue: new Prisma.Decimal(data.marketValue),
        forcedSaleValue: new Prisma.Decimal(data.forcedSaleValue),
        valuationDate: new Date(data.valuationDate),
        valuer: data.valuer,
      },
    });

    return valuation;
  }

  /**
   * List valuations for a collateral.
   */
  async listValuations(collateralId: string) {
    return prisma.collateralValuation.findMany({
      where: { collateralId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------------
  // Liens
  // -------------------------------------------------------------------------

  /**
   * Add a lien to a collateral.
   */
  async addLien(data: CreateLienData) {
    const createData: Prisma.CollateralLienCreateInput = {
      lienHolder: data.lienHolder,
      lienAmount: data.lienAmount != null ? new Prisma.Decimal(data.lienAmount) : undefined,
      priority: data.priority ?? 1,
      registeredAt: data.registeredAt ? new Date(data.registeredAt) : undefined,
      collateral: { connect: { id: data.collateralId } },
    };

    return prisma.collateralLien.create({ data: createData });
  }

  /**
   * List liens for a collateral.
   */
  async listLiens(collateralId: string) {
    return prisma.collateralLien.findMany({
      where: { collateralId },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Discharge a lien by setting dischargeDate.
   */
  async dischargeLien(lienId: string, dischargeDate: Date | string) {
    const existing = await prisma.collateralLien.findUnique({ where: { id: lienId } });
    if (!existing) return null;

    return prisma.collateralLien.update({
      where: { id: lienId },
      data: { dischargeDate: new Date(dischargeDate) },
    });
  }

  // -------------------------------------------------------------------------
  // Insurance
  // -------------------------------------------------------------------------

  /**
   * Add insurance cover to a collateral.
   */
  async addInsurance(data: CreateInsuranceData) {
    const createData: Prisma.InsuranceCoverCreateInput = {
      insurer: data.insurer,
      policyNumber: data.policyNumber ?? undefined,
      coverageAmount: new Prisma.Decimal(data.coverageAmount),
      effectiveDate: new Date(data.effectiveDate),
      expiryDate: new Date(data.expiryDate),
      collateral: { connect: { id: data.collateralId } },
    };

    return prisma.insuranceCover.create({ data: createData });
  }

  /**
   * List insurance covers for a collateral.
   */
  async listInsurance(collateralId: string) {
    return prisma.insuranceCover.findMany({
      where: { collateralId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------------
  // Aggregate
  // -------------------------------------------------------------------------

  /**
   * Sum latest valuations for all collateral on an application.
   * Uses the inline marketValue on each Collateral record (updated on each valuation).
   */
  async getTotalCollateralValue(applicationId: string) {
    const facilities = await prisma.applicationFacility.findMany({
      where: { applicationId },
      select: { id: true },
    });
    const facilityIds = facilities.map((f: { id: string }) => f.id);

    const collaterals = await prisma.collateral.findMany({
      where: { facilityId: { in: facilityIds } },
      select: { id: true, marketValue: true },
    });

    let total = new Prisma.Decimal(0);
    for (const c of collaterals) {
      if (c.marketValue) {
        total = total.add(c.marketValue);
      }
    }

    return {
      applicationId,
      collateralCount: collaterals.length,
      totalMarketValue: total,
    };
  }
}

export const collateralService = new CollateralService();