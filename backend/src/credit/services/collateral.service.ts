import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { recalcScore } from './recalc.service';
import { getNumberPolicy } from './policyParameter.service';
import { assertVersionMatch } from '../utils/optimisticConcurrency';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COLLATERAL_TYPES = ['PROPERTY', 'VEHICLE', 'FD', 'SECURITIES', 'OTHER'] as const;
export type CollateralType = (typeof COLLATERAL_TYPES)[number];

// P1-4 — LTV computation result
export interface LtvResult {
  facilityId: string;
  facilityAmount: number;
  totalMarketValue: number;
  totalAdjustedValue: number;    // After haircut
  ltvPercent: number;            // facilityAmount / totalAdjustedValue * 100
  exceedsCap: boolean;           // ltvPercent > LTV_CAP
  staleValuations: { id: string; collateralType: string; valuationDate: Date | null; ageMonths: number }[];
  haircutDetails: { collateralId: string; category: string; marketValue: number; haircut: number; adjustedValue: number }[];
}

// Default LTV caps (overridable via CreditPolicyLimit or config)
const LTV_CAP_DEFAULT = 70; // 70%

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
  /** LOS-018 — optimistic-concurrency token */
  expectedUpdatedAt?: string;
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
      where: { facilityId: { in: facilityIds }, softDeletedAt: null },
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

    assertVersionMatch(existing.updatedAt, data.expectedUpdatedAt, 'Collateral');

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

    const result = await prisma.collateral.update({ where: { id }, data: updateData });

    // P2-6 — fire recalc for the linked application (collateral affects the
    // collateral factor score). Collateral links via facilityId → applicationId.
    if (existing.facilityId) {
      const facility = await prisma.applicationFacility.findUnique({
        where: { id: existing.facilityId },
        select: { applicationId: true },
      });
      if (facility?.applicationId) {
        recalcScore(facility.applicationId, 'collateral_update', {
          sourceUpdatedAt: new Date(),
        }).catch(() => {});
      }
    }

    return result;
  }

  /**
   * P1-4 — Soft delete a collateral record (replaces hard-delete for audit trail).
   */
  async softDeleteCollateral(id: string, deletedById: string, reason: string) {
    const existing = await prisma.collateral.findUnique({ where: { id } });
    if (!existing) throw new AppError('Collateral not found', 404);
    if (existing.softDeletedAt) throw new AppError('Collateral already soft-deleted', 400);

    const result = await prisma.collateral.update({
      where: { id },
      data: {
        softDeletedAt: new Date(),
        softDeletedById: deletedById,
        softDeleteReason: reason,
      },
    });

    logger.info('Collateral soft-deleted', { collateralId: id, deletedById, reason });
    return result;
  }

  /**
   * @deprecated Use softDeleteCollateral instead
   * Hard-delete kept for backward compat but logs a warning.
   */
  async deleteCollateral(id: string) {
    const existing = await prisma.collateral.findUnique({ where: { id } });
    if (!existing) return null;

    logger.warn('Hard-delete called on collateral — prefer softDeleteCollateral', { collateralId: id });
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
      where: { facilityId: { in: facilityIds }, softDeletedAt: null },
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
  // P1-4 — LTV Gate + Haircut Computation
  // -------------------------------------------------------------------------

  /**
   * Compute Loan-to-Value for a facility, applying haircut by security category.
   * Flags stale valuations and checks against LTV cap.
   */
  async computeLtv(facilityId: string, ltvCap?: number): Promise<LtvResult> {
    const effectiveLtvCap = ltvCap ?? await getNumberPolicy('collateral.ltv_cap.default_pct', LTV_CAP_DEFAULT);
    const facility = await prisma.applicationFacility.findUnique({
      where: { id: facilityId },
      select: { id: true, amount: true },
    });
    if (!facility) throw new AppError('Facility not found', 404);

    const facilityAmount = Number(facility.amount);

    // Get all non-deleted collateral for this facility
    const collaterals = await prisma.collateral.findMany({
      where: { facilityId, softDeletedAt: null },
      select: {
        id: true,
        collateralType: true,
        securityCategory: true,
        marketValue: true,
        forcedSaleValue: true,
        valuationDate: true,
      },
    });

    // Load haircut configs
    const haircutConfigs = await prisma.collateralHaircutConfig.findMany({
      where: { isActive: true },
    });
    const haircutMap = new Map(haircutConfigs.map(h => [h.securityCategory, Number(h.haircutPercent)]));

    let totalMarketValue = 0;
    let totalAdjustedValue = 0;
    const staleValuations: LtvResult['staleValuations'] = [];
    const haircutDetails: LtvResult['haircutDetails'] = [];

    for (const c of collaterals) {
      const fsv = c.forcedSaleValue ? Number(c.forcedSaleValue) : (c.marketValue ? Number(c.marketValue) : 0);
      totalMarketValue += c.marketValue ? Number(c.marketValue) : 0;

      // Determine category for haircut: use securityCategory if set, else collateralType
      const category = c.securityCategory ?? c.collateralType;
      const haircut = haircutMap.get(category) ?? 0.50; // default 50% for unknown categories

      const adjustedValue = fsv * (1 - haircut);
      totalAdjustedValue += adjustedValue;

      haircutDetails.push({
        collateralId: c.id,
        category,
        marketValue: c.marketValue ? Number(c.marketValue) : 0,
        haircut,
        adjustedValue,
      });

      // Check staleness
      if (c.valuationDate) {
        const ageMs = Date.now() - c.valuationDate.getTime();
        const ageMonths = Math.floor(ageMs / (30 * 24 * 60 * 60 * 1000));
        const config = haircutConfigs.find(h => h.securityCategory === category);
        const staleThreshold = config?.minValuationAgeMonths ?? 12;

        if (ageMonths > staleThreshold) {
          staleValuations.push({
            id: c.id,
            collateralType: c.collateralType,
            valuationDate: c.valuationDate,
            ageMonths,
          });
        }
      } else {
        // No valuation date = stale
        staleValuations.push({
          id: c.id,
          collateralType: c.collateralType,
          valuationDate: null,
          ageMonths: Infinity,
        });
      }
    }

    const ltvPercent = totalAdjustedValue > 0
      ? (facilityAmount / totalAdjustedValue) * 100
      : Infinity;

    return {
      facilityId,
      facilityAmount,
      totalMarketValue,
      totalAdjustedValue,
      ltvPercent: Math.round(ltvPercent * 100) / 100,
      exceedsCap: ltvPercent > effectiveLtvCap,
      staleValuations,
      haircutDetails,
    };
  }

  /**
   * Compute LTV for all facilities on an application.
   */
  async computeApplicationLtv(applicationId: string, ltvCap?: number): Promise<LtvResult[]> {
    const facilities = await prisma.applicationFacility.findMany({
      where: { applicationId },
      select: { id: true },
    });

    const results: LtvResult[] = [];
    for (const f of facilities) {
      results.push(await this.computeLtv(f.id, ltvCap));
    }
    return results;
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

    const link = await prisma.$transaction(async (tx) => {
      const created = await tx.collateralApplicationLink.create({
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
        tx as any,
      );

      return created;
    });

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

    await prisma.$transaction(async (tx) => {
      await tx.collateralApplicationLink.delete({
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
        tx as any,
      );
    });

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