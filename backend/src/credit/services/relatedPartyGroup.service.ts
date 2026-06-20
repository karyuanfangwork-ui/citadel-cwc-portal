import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { computeBorrowerExposure } from './exposureCompute.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateRelatedPartyGroupData {
  name: string;
  description?: string | null;
  relationshipType?: string | null;
}

export interface UpdateRelatedPartyGroupData {
  name?: string;
  description?: string | null;
  relationshipType?: string | null;
}

export interface AddRelatedPartyMemberData {
  borrowerProfileId: string;
  role?: string | null;
}

export interface ListRelatedPartyGroupsOptions {
  page?: number;
  limit?: number;
  search?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RelatedPartyGroupService {
  /**
   * List related party groups with pagination and optional search.
   */
  async listRelatedPartyGroups(options: ListRelatedPartyGroupsOptions) {
    const { page = 1, limit = 20, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.RelatedPartyGroupWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { relationshipType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.relatedPartyGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: {
              borrowerProfile: {
                select: { id: true, borrowerType: true, name: true },
              },
            },
          },
          _count: { select: { members: true } },
        },
      }),
      prisma.relatedPartyGroup.count({ where }),
    ]);

    return {
      groups,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single related party group by ID.
   */
  async getRelatedPartyGroup(id: string) {
    return prisma.relatedPartyGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            borrowerProfile: {
              select: { id: true, borrowerType: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Create a new related party group.
   */
  async createRelatedPartyGroup(data: CreateRelatedPartyGroupData) {
    const createData: Prisma.RelatedPartyGroupCreateInput = {
      name: data.name,
      description: data.description ?? undefined,
      relationshipType: data.relationshipType ?? undefined,
    };

    return prisma.relatedPartyGroup.create({
      data: createData,
      include: { members: true },
    });
  }

  /**
   * Update an existing related party group.
   */
  async updateRelatedPartyGroup(id: string, data: UpdateRelatedPartyGroupData) {
    const existing = await prisma.relatedPartyGroup.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.RelatedPartyGroupUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.relationshipType !== undefined) updateData.relationshipType = data.relationshipType;

    return prisma.relatedPartyGroup.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: {
            borrowerProfile: {
              select: { id: true, borrowerType: true, name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Delete a related party group (cascades to members).
   */
  async deleteRelatedPartyGroup(id: string) {
    const existing = await prisma.relatedPartyGroup.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.relatedPartyGroup.delete({ where: { id } });
  }

  /**
   * Add a borrower profile as a member to a related party group.
   */
  async addMember(groupId: string, data: AddRelatedPartyMemberData) {
    // Check group exists
    const group = await prisma.relatedPartyGroup.findUnique({ where: { id: groupId } });
    if (!group) return null;

    // Check borrower profile exists
    const profile = await prisma.borrowerProfile.findFirst({ where: { id: data.borrowerProfileId, deletedAt: null } });
    if (!profile) return null;

    return prisma.relatedPartyMember.create({
      data: {
        groupId,
        borrowerProfileId: data.borrowerProfileId,
        role: data.role ?? undefined,
      },
      include: {
        group: { select: { id: true, name: true } },
        borrowerProfile: {
          select: { id: true, borrowerType: true, name: true },
        },
      },
    });
  }

  /**
   * Remove a member from a related party group.
   */
  async removeMember(memberId: string) {
    const existing = await prisma.relatedPartyMember.findUnique({ where: { id: memberId } });
    if (!existing) return null;

    return prisma.relatedPartyMember.delete({ where: { id: memberId } });
  }

  /**
   * §7.2 — Group Exposure Aggregation
   * Computes the aggregate exposure across all member borrower profiles in a group.
   * Sums totalExposure and exposureLimit from each member's BorrowerProfile,
   * and breaks down exposure by currency from active CreditApplication facilities.
   */
  async getGroupExposure(groupId: string) {
    const group = await prisma.relatedPartyGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            borrowerProfile: {
              select: {
                id: true,
                borrowerType: true,
                name: true,
                exposureLimit: true,
                creditRiskRating: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) return null;

    // Aggregate totals
    let aggregateTotalExposure = 0;
    let aggregateExposureLimit = 0;
    const memberExposures: Array<{
      memberId: string;
      borrowerProfileId: string;
      borrowerName: string;
      borrowerType: string;
      creditRiskRating: string | null;
      totalExposure: number;
      exposureLimit: number | null;
      utilizationPct: number | null;
    }> = [];

    for (const member of group.members) {
      const bp = member.borrowerProfile;
      // §F2 — Use canonical exposure computation instead of stale bp.totalExposure
      const { totalExposure: computedExp } = await computeBorrowerExposure(bp.id);
      const totalExp = computedExp;
      const expLimit = bp.exposureLimit ? Number(bp.exposureLimit) : null;

      aggregateTotalExposure += totalExp;
      if (expLimit) aggregateExposureLimit += expLimit;

      const borrowerName = bp.name ?? 'Unnamed Borrower';

      memberExposures.push({
        memberId: member.id,
        borrowerProfileId: bp.id,
        borrowerName,
        borrowerType: bp.borrowerType,
        creditRiskRating: bp.creditRiskRating,
        totalExposure: totalExp,
        exposureLimit: expLimit,
        utilizationPct: expLimit && expLimit > 0 ? Math.round((totalExp / expLimit) * 10000) / 100 : null,
      });
    }

    // Get per-currency breakdown from active facilities for all group members
    const memberBorrowerIds = group.members.map((m) => m.borrowerProfile.id);

    const activeApplications = await prisma.creditApplication.findMany({
      where: {
        borrowerProfileId: { in: memberBorrowerIds },
        state: { in: ['APPROVED', 'ACTIVE', 'DISBURSED', 'ACCEPTED', 'OFFER'] },
        deletedAt: null,
      },
      select: {
        id: true,
        applicationNo: true,
        currency: true,
        borrowerProfileId: true,
        facilities: {
          select: {
            amount: true,
            approvedAmount: true,
            outstandingBalance: true,
            facilityType: true,
          },
        },
      },
    });

    // Aggregate by currency
    const currencyBreakdown: Record<string, { totalApproved: number; totalOutstanding: number; facilityCount: number }> = {};

    for (const app of activeApplications) {
      for (const facility of app.facilities) {
        const currency = app.currency || 'MYR';
        if (!currencyBreakdown[currency]) {
          currencyBreakdown[currency] = { totalApproved: 0, totalOutstanding: 0, facilityCount: 0 };
        }
        const approved = facility.approvedAmount ? Number(facility.approvedAmount) : Number(facility.amount);
        const outstanding = facility.outstandingBalance ? Number(facility.outstandingBalance) : 0;
        currencyBreakdown[currency].totalApproved += approved;
        currencyBreakdown[currency].totalOutstanding += outstanding;
        currencyBreakdown[currency].facilityCount += 1;
      }
    }

    const groupUtilization = aggregateExposureLimit > 0
      ? Math.round((aggregateTotalExposure / aggregateExposureLimit) * 10000) / 100
      : null;

    return {
      groupId: group.id,
      groupName: group.name,
      relationshipType: group.relationshipType,
      memberCount: group.members.length,
      aggregateTotalExposure,
      aggregateExposureLimit: aggregateExposureLimit || null,
      groupUtilizationPct: groupUtilization,
      memberExposures,
      currencyBreakdown,
      activeApplicationCount: activeApplications.length,
    };
  }
}

export const relatedPartyGroupService = new RelatedPartyGroupService();