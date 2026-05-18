import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

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
                select: { id: true, borrowerType: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
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
              select: { id: true, borrowerType: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
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
              select: { id: true, borrowerType: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
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
          select: { id: true, borrowerType: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
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
}

export const relatedPartyGroupService = new RelatedPartyGroupService();