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

    return prisma.guarantee.update({ where: { id }, data: updateData });
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