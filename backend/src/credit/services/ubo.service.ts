import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateUboData {
  borrowerProfileId: string;
  name: string;
  nricPassport?: string | null;
  ownershipPct: number | string;
  isPep?: boolean;
  sourceOfWealth?: string | null;
  countryOfResidence?: string | null;
}

export interface UpdateUboData {
  name?: string;
  nricPassport?: string | null;
  ownershipPct?: number | string;
  isPep?: boolean;
  sourceOfWealth?: string | null;
  countryOfResidence?: string | null;
}

export interface ListUbosOptions {
  borrowerProfileId: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class UboService {
  /**
   * List UBOs for a borrower profile with pagination.
   */
  async listUbos(options: ListUbosOptions) {
    const { borrowerProfileId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UltimateBeneficialOwnerWhereInput = {
      borrowerProfileId,
    };

    const [beneficialOwners, total] = await Promise.all([
      prisma.ultimateBeneficialOwner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ultimateBeneficialOwner.count({ where }),
    ]);

    return {
      beneficialOwners,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single UBO by ID.
   */
  async getUbo(id: string) {
    return prisma.ultimateBeneficialOwner.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new UBO.
   */
  async createUbo(data: CreateUboData) {
    const createData: Prisma.UltimateBeneficialOwnerCreateInput = {
      name: data.name,
      nricPassport: data.nricPassport ?? undefined,
      ownershipPct: new Prisma.Decimal(data.ownershipPct as string | number),
      isPep: data.isPep ?? false,
      sourceOfWealth: data.sourceOfWealth ?? undefined,
      countryOfResidence: data.countryOfResidence ?? undefined,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
    };

    return prisma.ultimateBeneficialOwner.create({
      data: createData,
    });
  }

  /**
   * Update an existing UBO.
   */
  async updateUbo(id: string, data: UpdateUboData) {
    const existing = await prisma.ultimateBeneficialOwner.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.UltimateBeneficialOwnerUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nricPassport !== undefined) updateData.nricPassport = data.nricPassport;
    if (data.ownershipPct !== undefined) updateData.ownershipPct = new Prisma.Decimal(data.ownershipPct as string | number);
    if (data.isPep !== undefined) updateData.isPep = data.isPep;
    if (data.sourceOfWealth !== undefined) updateData.sourceOfWealth = data.sourceOfWealth;
    if (data.countryOfResidence !== undefined) updateData.countryOfResidence = data.countryOfResidence;

    return prisma.ultimateBeneficialOwner.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a UBO.
   */
  async deleteUbo(id: string) {
    const existing = await prisma.ultimateBeneficialOwner.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.ultimateBeneficialOwner.delete({ where: { id } });
  }
}

export const uboService = new UboService();