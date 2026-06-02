import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { requireEditableState } from './stateGuard.util';
import { AuditChainService } from './auditChain.service';

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
              name: true,
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
  async createParty(data: CreateApplicationPartyData, actorId?: string) {
    const app = await prisma.creditApplication.findUnique({
      where: { id: data.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${data.applicationId}`);
    }
    requireEditableState(app.state, 'create party');

    const createData: Prisma.ApplicationPartyCreateInput = {
      role: data.role,
      liabilityPct: data.liabilityPct != null ? new Prisma.Decimal(data.liabilityPct) : undefined,
      application: { connect: { id: data.applicationId } },
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
    };

    const party = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationParty.create({
        data: createData,
        include: {
          borrowerProfile: {
            select: {
              id: true,
              borrowerType: true,
              name: true,
              account: { select: { id: true, name: true } },
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      await AuditChainService.appendEvent(
        data.applicationId,
        'PARTY_CREATED',
        actorId ?? null,
        'create',
        undefined,
        'PARTY_CREATED',
        { partyId: created.id, role: created.role, borrowerProfileId: data.borrowerProfileId },
        tx,
      );

      return created;
    });

    return party;
  }

  /**
   * Update an existing application party.
   */
  async updateParty(id: string, data: UpdateApplicationPartyData, actorId?: string) {
    const existing = await prisma.applicationParty.findUnique({ where: { id } });
    if (!existing) return null;

    const app = await prisma.creditApplication.findUnique({
      where: { id: existing.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${existing.applicationId}`);
    }
    requireEditableState(app.state, 'update party');

    const updateData: Prisma.ApplicationPartyUpdateInput = {};

    if (data.role !== undefined) updateData.role = data.role;
    if (data.liabilityPct !== undefined) updateData.liabilityPct = data.liabilityPct != null ? new Prisma.Decimal(data.liabilityPct) : null;

    const party = await prisma.$transaction(async (tx) => {
      const updated = await tx.applicationParty.update({
        where: { id },
        data: updateData,
        include: {
          borrowerProfile: {
            select: {
              id: true,
              borrowerType: true,
              name: true,
              account: { select: { id: true, name: true } },
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      await AuditChainService.appendEvent(
        existing.applicationId,
        'PARTY_UPDATED',
        actorId ?? null,
        'update',
        undefined,
        'PARTY_UPDATED',
        { partyId: id, role: existing.role },
        tx,
      );

      return updated;
    });

    return party;
  }

  /**
   * Delete an application party.
   */
  async deleteParty(id: string, actorId?: string) {
    const existing = await prisma.applicationParty.findUnique({ where: { id } });
    if (!existing) return null;

    const app = await prisma.creditApplication.findUnique({
      where: { id: existing.applicationId },
      select: { state: true },
    });
    if (!app) {
      throw new Error(`Application not found: ${existing.applicationId}`);
    }
    requireEditableState(app.state, 'delete party');

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.applicationParty.delete({ where: { id } });

      await AuditChainService.appendEvent(
        existing.applicationId,
        'PARTY_DELETED',
        actorId ?? null,
        'delete',
        undefined,
        'PARTY_DELETED',
        { partyId: id, role: existing.role, borrowerProfileId: existing.borrowerProfileId },
        tx,
      );

      return result;
    });

    return deleted;
  }
}

export const applicationPartyService = new ApplicationPartyService();