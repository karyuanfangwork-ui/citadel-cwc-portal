import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// FacilityType enum values — keep in sync with Prisma schema
export const FACILITY_TYPES = ['TERM_LOAN', 'REVOLVING', 'OVERDRAFT', 'LC', 'BG', 'TRUST_RECEIPT', 'BRIDGING'] as const;
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
  async createFacility(data: CreateApplicationFacilityData) {
    const createData: Prisma.ApplicationFacilityCreateInput = {
      facilityType: data.facilityType,
      amount: new Prisma.Decimal(data.amount),
      tenorMonths: data.tenorMonths ?? undefined,
      ratePct: data.ratePct != null ? new Prisma.Decimal(data.ratePct) : undefined,
      purpose: data.purpose ?? undefined,
      approvedAmount: data.approvedAmount != null ? new Prisma.Decimal(data.approvedAmount) : undefined,
      approvedTenor: data.approvedTenor ?? undefined,
      approvedRate: data.approvedRate != null ? new Prisma.Decimal(data.approvedRate) : undefined,
      application: { connect: { id: data.applicationId } },
    };

    return prisma.applicationFacility.create({ data: createData });
  }

  /**
   * Update an existing application facility.
   */
  async updateFacility(id: string, data: UpdateApplicationFacilityData) {
    const existing = await prisma.applicationFacility.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.ApplicationFacilityUpdateInput = {};

    if (data.facilityType !== undefined) updateData.facilityType = data.facilityType;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.tenorMonths !== undefined) updateData.tenorMonths = data.tenorMonths;
    if (data.ratePct !== undefined) updateData.ratePct = data.ratePct != null ? new Prisma.Decimal(data.ratePct) : null;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.approvedAmount !== undefined) updateData.approvedAmount = data.approvedAmount != null ? new Prisma.Decimal(data.approvedAmount) : null;
    if (data.approvedTenor !== undefined) updateData.approvedTenor = data.approvedTenor;
    if (data.approvedRate !== undefined) updateData.approvedRate = data.approvedRate != null ? new Prisma.Decimal(data.approvedRate) : null;

    return prisma.applicationFacility.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft-delete a facility (sets deletedAt timestamp).
   */
  async deleteFacility(id: string) {
    const existing = await prisma.applicationFacility.findUnique({ where: { id, deletedAt: null } });
    if (!existing) return null;

    return prisma.applicationFacility.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const applicationFacilityService = new ApplicationFacilityService();