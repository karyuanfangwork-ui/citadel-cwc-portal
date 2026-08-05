import prisma from '../../utils/prisma';
import { CaRequestType, Prisma } from '@prisma/client';

export const CA_REQUEST_TYPES = [
  'FACILITY_RENEWAL',
  'VARIATION',
  'POLICY_BREACH_RATIFICATION',
  'SICR_IMPAIRMENT',
] as const;

export interface CreateRequestItemData {
  applicationId: string;
  requestType: CaRequestType;
  sortOrder?: number;
  approvingLevel?: string | null;
  rationale?: string | null;
}

export interface UpdateRequestItemData {
  requestType?: CaRequestType;
  sortOrder?: number;
  approvingLevel?: string | null;
  rationale?: string | null;
}

class RequestItemService {
  async listByApplication(applicationId: string) {
    return prisma.requestItem.findMany({
      where: { applicationId },
      orderBy: { sortOrder: 'asc' },
      include: { facilities: { where: { deletedAt: null }, select: { id: true, facilityType: true, amount: true } } },
    });
  }

  async getOne(id: string) {
    return prisma.requestItem.findUnique({ where: { id } });
  }

  async create(data: CreateRequestItemData) {
    return prisma.requestItem.create({
      data: {
        applicationId: data.applicationId,
        requestType: data.requestType,
        sortOrder: data.sortOrder ?? 1,
        approvingLevel: data.approvingLevel ?? undefined,
        rationale: data.rationale ?? undefined,
      },
    });
  }

  async update(id: string, data: UpdateRequestItemData) {
    const existing = await prisma.requestItem.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.RequestItemUpdateInput = {};
    if (data.requestType !== undefined) updateData.requestType = data.requestType;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.approvingLevel !== undefined) updateData.approvingLevel = data.approvingLevel;
    if (data.rationale !== undefined) updateData.rationale = data.rationale;

    return prisma.requestItem.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    const existing = await prisma.requestItem.findUnique({ where: { id } });
    if (!existing) return null;
    return prisma.requestItem.delete({ where: { id } });
  }
}

export const requestItemService = new RequestItemService();
