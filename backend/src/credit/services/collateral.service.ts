import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { AuditChainService } from './auditChain.service';

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

  // -------------------------------------------------------------------------
  // §7.1 — Collateral Cross-Application Linking
  // -------------------------------------------------------------------------

  /**
   * Link a collateral to another application (cross-application sharing).
   * Creates a CollateralApplicationLink and fires COLLATERAL_LINKED audit event.
   */
  async linkToApplication(collateralId: string, applicationId: string, userId: string) {
    // Verify collateral exists
    const collateral = await prisma.collateral.findUnique({
      where: { id: collateralId },
      include: { facility: { select: { applicationId: true } } },
    });
    if (!collateral) {
      throw new Error('Collateral not found');
    }

    // Prevent linking a collateral to its own originating application
    if (collateral.facility.applicationId === applicationId) {
      throw new Error('Collateral is already owned by this application');
    }

    // Check for existing link (unique constraint will also catch this)
    const existing = await prisma.collateralApplicationLink.findUnique({
      where: { collateralId_applicationId: { collateralId, applicationId } },
    });
    if (existing) {
      throw new Error('Collateral is already linked to this application');
    }

    const link = await prisma.collateralApplicationLink.create({
      data: {
        collateralId,
        applicationId,
        linkedById: userId,
      } as any,
    });

    // Audit the link on the target application
    await AuditChainService.appendEvent(
      applicationId,
      'COLLATERAL_LINKED',
      userId,
      `Collateral ${collateralId} linked to application ${applicationId}`,
      undefined,
      undefined,
      { collateralId, sourceApplicationId: collateral.facility.applicationId },
    );

    return link;
  }

  /**
   * Unlink a collateral from an application.
   * Deletes the CollateralApplicationLink and fires COLLATERAL_UNLINKED audit event.
   */
  async unlinkFromApplication(collateralId: string, applicationId: string, userId: string) {
    const link = await prisma.collateralApplicationLink.findUnique({
      where: { collateralId_applicationId: { collateralId, applicationId } },
    });
    if (!link) {
      throw new Error('Link not found');
    }

    await prisma.collateralApplicationLink.delete({
      where: { id: link.id },
    });

    // Audit the unlink
    await AuditChainService.appendEvent(
      applicationId,
      'COLLATERAL_UNLINKED',
      userId,
      `Collateral ${collateralId} unlinked from application ${applicationId}`,
      undefined,
      undefined,
      { collateralId },
    );

    return { deleted: true };
  }

  /**
   * Get all applications linked to a collateral (cross-application view).
   * Returns application summaries: applicationNo, borrowerName, state, amount.
   */
  async getLinkedApplications(collateralId: string) {
    const links = await prisma.collateralApplicationLink.findMany({
      where: { collateralId },
      include: {
        application: {
          select: {
            id: true,
            applicationNo: true,
            state: true,
            requestedAmount: true,
            borrowerProfile: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    return links.map((l: any) => ({
      linkId: l.id,
      applicationId: l.application.id,
      applicationNo: l.application.applicationNo,
      borrowerName: l.application.borrowerProfile?.name ?? null,
      state: l.application.state,
      amount: l.application.requestedAmount,
      linkedAt: l.linkedAt,
      linkedById: l.linkedById,
    }));
  }

  /**
   * Get all collateral linked to a given application (via join table).
   * Includes collateral details plus the original facility's application
   * (i.e. where the collateral was first created).
   */
  async getLinkedCollateral(applicationId: string) {
    const links = await prisma.collateralApplicationLink.findMany({
      where: { applicationId },
      include: {
        collateral: {
          select: {
            id: true,
            collateralType: true,
            description: true,
            titleReference: true,
            marketValue: true,
            forcedSaleValue: true,
            valuationDate: true,
            valuer: true,
            securityCategory: true,
            securitySubType: true,
            isExisting: true,
            isNewToBeObtained: true,
            createdAt: true,
            facility: {
              select: {
                id: true,
                applicationId: true,
                application: {
                  select: {
                    id: true,
                    applicationNo: true,
                    borrowerProfile: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    return links.map((l: any) => ({
      linkId: l.id,
      linkedAt: l.linkedAt,
      linkedById: l.linkedById,
      collateral: {
        id: l.collateral.id,
        collateralType: l.collateral.collateralType,
        description: l.collateral.description,
        titleReference: l.collateral.titleReference,
        marketValue: l.collateral.marketValue,
        forcedSaleValue: l.collateral.forcedSaleValue,
        valuationDate: l.collateral.valuationDate,
        valuer: l.collateral.valuer,
        securityCategory: l.collateral.securityCategory,
        securitySubType: l.collateral.securitySubType,
        isExisting: l.collateral.isExisting,
        isNewToBeObtained: l.collateral.isNewToBeObtained,
        createdAt: l.collateral.createdAt,
      },
      sourceApplication: l.collateral.facility?.application
        ? {
            id: l.collateral.facility.application.id,
            applicationNo: l.collateral.facility.application.applicationNo,
            borrowerName: l.collateral.facility.application.borrowerProfile?.name ?? null,
          }
        : null,
    }));
  }
}

export const collateralService = new CollateralService();