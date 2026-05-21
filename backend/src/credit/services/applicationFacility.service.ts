import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { requireEditableState } from './stateGuard.util';
import { AuditChainService } from './auditChain.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// FacilityType enum values — keep in sync with Prisma schema
export const FACILITY_TYPES = [
  // Phase 1 — Conventional banking
  'TERM_LOAN', 'REVOLVING', 'OVERDRAFT', 'LC', 'BG', 'TRUST_RECEIPT', 'BRIDGING',
  // Phase 2 — Islamic banking variants (hidden behind feature flag; do not expose in Phase 1 UI)
  'CASHLINE', 'RWC_I', 'LC_I', 'BG_I', 'ICMTD_I',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export interface CreateApplicationFacilityData {
  applicationId: string;
  facilityType: FacilityType;
  amount: string | number;
  tenorMonths?: number | null;
  ratePct?: string | number | null;
  purpose?: string | null;
  approvedAmount?: string | number | null;
  approvedTenor?: number | null;
  approvedRate?: string | number | null;
  // Phase 2
  pricingLabel?: string | null;
  existingLimit?: string | number | null;
  proposedChange?: string | number | null;
  newLimit?: string | number | null;
  outstandingBalance?: string | number | null;
  undisbursedLimit?: string | number | null;
  approvingLevel?: string | null;
  requestItemId?: string | null;
}

export interface UpdateApplicationFacilityData {
  facilityType?: FacilityType;
  amount?: string | number;
  tenorMonths?: number | null;
  ratePct?: string | number | null;
  purpose?: string | null;
  approvedAmount?: string | number | null;
  approvedTenor?: number | null;
  approvedRate?: string | number | null;
  // Phase 2
  pricingLabel?: string | null;
  existingLimit?: string | number | null;
  proposedChange?: string | number | null;
  newLimit?: string | number | null;
  outstandingBalance?: string | number | null;
  undisbursedLimit?: string | number | null;
  approvingLevel?: string | null;
  requestItemId?: string | null;
}

export interface ListApplicationFacilitiesOptions {
  applicationId: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ApplicationFacilityService {
  /**
   * List facilities for a credit application with pagination.
   */
  async listFacilities(options: ListApplicationFacilitiesOptions) {
    const { applicationId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationFacilityWhereInput = { applicationId, deletedAt: null };

    const [facilities, total] = await Promise.all([
      prisma.applicationFacility.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.applicationFacility.count({ where }),
    ]);

    return {
      facilities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single facility by ID (excludes soft-deleted).
   */
  async getFacility(id: string) {
    return prisma.applicationFacility.findUnique({ where: { id, deletedAt: null } });
  }

  /**
   * Create a new application facility.
   */
  async createFacility(data: CreateApplicationFacilityData, actorId?: string) {
    const app = await prisma.creditApplication.findUnique({
      where: { id: data.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${data.applicationId}`);
    }
    requireEditableState(app.state, 'create facility');

    const createData: Prisma.ApplicationFacilityCreateInput = {
      facilityType: data.facilityType,
      amount: new Prisma.Decimal(data.amount),
      tenorMonths: data.tenorMonths ?? undefined,
      ratePct: data.ratePct != null ? new Prisma.Decimal(data.ratePct) : undefined,
      purpose: data.purpose ?? undefined,
      approvedAmount: data.approvedAmount != null ? new Prisma.Decimal(data.approvedAmount) : undefined,
      approvedTenor: data.approvedTenor ?? undefined,
      approvedRate: data.approvedRate != null ? new Prisma.Decimal(data.approvedRate) : undefined,
      pricingLabel: data.pricingLabel ?? undefined,
      existingLimit: data.existingLimit != null ? new Prisma.Decimal(data.existingLimit) : undefined,
      proposedChange: data.proposedChange != null ? new Prisma.Decimal(data.proposedChange) : undefined,
      newLimit: data.newLimit != null ? new Prisma.Decimal(data.newLimit) : undefined,
      outstandingBalance: data.outstandingBalance != null ? new Prisma.Decimal(data.outstandingBalance) : undefined,
      undisbursedLimit: data.undisbursedLimit != null ? new Prisma.Decimal(data.undisbursedLimit) : undefined,
      approvingLevel: data.approvingLevel ?? undefined,
      requestItem: data.requestItemId ? { connect: { id: data.requestItemId } } : undefined,
      application: { connect: { id: data.applicationId } },
    };

    const facility = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationFacility.create({ data: createData });

      await AuditChainService.appendEvent(
        data.applicationId,
        'FACILITY_CREATED',
        actorId ?? null,
        'create',
        undefined,
        'FACILITY_CREATED',
        { facilityId: created.id, facilityType: created.facilityType },
        tx,
      );

      return created;
    });

    return facility;
  }

  /**
   * Update an existing application facility.
   */
  async updateFacility(id: string, data: UpdateApplicationFacilityData, actorId?: string) {
    const existing = await prisma.applicationFacility.findUnique({ where: { id } });
    if (!existing) return null;

    const app = await prisma.creditApplication.findUnique({
      where: { id: existing.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${existing.applicationId}`);
    }
    requireEditableState(app.state, 'update facility');

    const updateData: Prisma.ApplicationFacilityUpdateInput = {};

    if (data.facilityType !== undefined) updateData.facilityType = data.facilityType;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.tenorMonths !== undefined) updateData.tenorMonths = data.tenorMonths;
    if (data.ratePct !== undefined) updateData.ratePct = data.ratePct != null ? new Prisma.Decimal(data.ratePct) : null;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.approvedAmount !== undefined) updateData.approvedAmount = data.approvedAmount != null ? new Prisma.Decimal(data.approvedAmount) : null;
    if (data.approvedTenor !== undefined) updateData.approvedTenor = data.approvedTenor;
    if (data.approvedRate !== undefined) updateData.approvedRate = data.approvedRate != null ? new Prisma.Decimal(data.approvedRate) : null;
    if (data.pricingLabel !== undefined) updateData.pricingLabel = data.pricingLabel;
    if (data.existingLimit !== undefined) updateData.existingLimit = data.existingLimit != null ? new Prisma.Decimal(data.existingLimit) : null;
    if (data.proposedChange !== undefined) updateData.proposedChange = data.proposedChange != null ? new Prisma.Decimal(data.proposedChange) : null;
    if (data.newLimit !== undefined) updateData.newLimit = data.newLimit != null ? new Prisma.Decimal(data.newLimit) : null;
    if (data.outstandingBalance !== undefined) updateData.outstandingBalance = data.outstandingBalance != null ? new Prisma.Decimal(data.outstandingBalance) : null;
    if (data.undisbursedLimit !== undefined) updateData.undisbursedLimit = data.undisbursedLimit != null ? new Prisma.Decimal(data.undisbursedLimit) : null;
    if (data.approvingLevel !== undefined) updateData.approvingLevel = data.approvingLevel;
    if (data.requestItemId !== undefined) {
      updateData.requestItem = data.requestItemId ? { connect: { id: data.requestItemId } } : { disconnect: true };
    }

    const facility = await prisma.$transaction(async (tx) => {
      const updated = await tx.applicationFacility.update({
        where: { id },
        data: updateData,
      });

      await AuditChainService.appendEvent(
        existing.applicationId,
        'FACILITY_UPDATED',
        actorId ?? null,
        'update',
        undefined,
        'FACILITY_UPDATED',
        { facilityId: id, facilityType: existing.facilityType },
        tx,
      );

      return updated;
    });

    return facility;
  }

  /**
   * Soft-delete a facility (sets deletedAt timestamp).
   */
  async deleteFacility(id: string, actorId?: string) {
    const existing = await prisma.applicationFacility.findUnique({ where: { id, deletedAt: null } });
    if (!existing) return null;

    const app = await prisma.creditApplication.findUnique({
      where: { id: existing.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${existing.applicationId}`);
    }
    requireEditableState(app.state, 'delete facility');

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.applicationFacility.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await AuditChainService.appendEvent(
        existing.applicationId,
        'FACILITY_DELETED',
        actorId ?? null,
        'delete',
        undefined,
        'FACILITY_DELETED',
        { facilityId: id, facilityType: existing.facilityType },
        tx,
      );

      return result;
    });

    return deleted;
  }
}

export const applicationFacilityService = new ApplicationFacilityService();