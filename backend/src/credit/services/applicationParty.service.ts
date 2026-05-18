import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const PARTY_ROLES = ['borrower', 'guarantor', 'co_borrower', 'sponsor'] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export interface CreateApplicationPartyData {
  applicationId: string;
  borrowerProfileId: string;
  role: string;
  liabilityPct?: string | number | null;
}

export interface UpdateApplicationPartyData {
  role?: string;
  liabilityPct?: string | number | null;
}

export interface ListApplicationPartiesOptions {
  applicationId: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ApplicationPartyService {
  /**
   * List parties for a credit application with pagination.
   */
  async listParties(options: ListApplicationPartiesOptions) {
    const { applicationId, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ApplicationPartyWhereInput = { applicationId };

    const [parties, total] = await Promise.all([
      prisma.applicationParty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          borrowerProfile: {
            select: {
              id: true,
              borrowerType: true,
              account: { select: { id: true, name: true } },
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.applicationParty.count({ where }),
    ]);

    return {
      parties,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single party by ID.
   */
  async getParty(id: string) {
    return prisma.applicationParty.findUnique({
      where: { id },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Create a new application party.
   */
  async createParty(data: CreateApplicationPartyData) {
    const createData: Prisma.ApplicationPartyCreateInput = {
      role: data.role,
      liabilityPct: data.liabilityPct != null ? new Prisma.Decimal(data.liabilityPct) : undefined,
      application: { connect: { id: data.applicationId } },
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
    };

    return prisma.applicationParty.create({
      data: createData,
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Update an existing application party.
   */
  async updateParty(id: string, data: UpdateApplicationPartyData) {
    const existing = await prisma.applicationParty.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.ApplicationPartyUpdateInput = {};

    if (data.role !== undefined) updateData.role = data.role;
    if (data.liabilityPct !== undefined) updateData.liabilityPct = data.liabilityPct != null ? new Prisma.Decimal(data.liabilityPct) : null;

    return prisma.applicationParty.update({
      where: { id },
      data: updateData,
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Delete an application party.
   */
  async deleteParty(id: string) {
    const existing = await prisma.applicationParty.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.applicationParty.delete({ where: { id } });
  }
}

export const applicationPartyService = new ApplicationPartyService();