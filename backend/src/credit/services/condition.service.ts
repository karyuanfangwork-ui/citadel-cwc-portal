import prisma from '../../utils/prisma';
import { Prisma, ConditionStatus as PrismaConditionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types — aligned with frontend ConditionPrecedent / CpCompletionStatus
// ---------------------------------------------------------------------------

export type ConditionTypeLabel = 'PRECEDENT' | 'SUBSEQUENT';
export type ConditionCategoryLabel = 'PRE_DISBURSEMENT' | 'POST_DISBURSEMENT' | 'FINANCIAL_COVENANT' | 'REPORTING' | 'OTHER';
export type ConditionStatusLabel = 'PENDING' | 'COMPLETED' | 'WAIVED' | 'EXPIRED';

export interface CreateConditionData {
  applicationId: string;
  title: string;
  description?: string;
  category?: ConditionCategoryLabel;
  conditionType?: ConditionTypeLabel;
  dueDate?: Date | string | null;
  decisionId?: string;
}

export interface UpdateConditionData {
  title?: string;
  description?: string;
  category?: ConditionCategoryLabel;
  conditionType?: ConditionTypeLabel;
  status?: ConditionStatusLabel;
  dueDate?: Date | string | null;
}

export interface CompleteConditionData {
  fulfilledById?: string;
  fulfilmentNotes?: string;
}

export interface WaiveConditionData {
  waiverReason: string;
  waivedById?: string;
}

// Frontend-aligned CP completion shape
export interface CpCompletionResult {
  applicationId: string;
  totalConditions: number;
  completedCount: number;
  waivedCount: number;
  pendingCount: number;
  isComplete: boolean;
}

// Shape returned by list/get — aligned with frontend ConditionPrecedent
export interface ConditionDto {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  category: ConditionCategoryLabel;
  conditionType?: ConditionTypeLabel;
  status: ConditionStatusLabel;
  isFulfilled?: boolean;
  decisionId?: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completer?: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null } | null;
  waiver?: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDto(c: any): ConditionDto {
  return {
    id: c.id,
    applicationId: c.applicationId,
    title: c.title,
    description: c.description,
    category: c.category,
    conditionType: c.conditionType,
    status: c.status,
    isFulfilled: c.isFulfilled ?? false,
    decisionId: c.decisionId ?? null,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    completedAt: c.fulfilledAt ? c.fulfilledAt.toISOString() : null,
    completedBy: c.fulfilledById ?? null,
    waiverReason: c.waiverReason ?? null,
    waivedAt: c.waivedAt ? c.waivedAt.toISOString() : null,
    waivedBy: c.waivedById ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    completer: c.fulfilledBy ? { id: c.fulfilledBy.id, firstName: c.fulfilledBy.firstName, lastName: c.fulfilledBy.lastName, email: c.fulfilledBy.email, avatarUrl: c.fulfilledBy.avatarUrl ?? null } : null,
    waiver: c.waivedBy ? { id: c.waivedBy.id, firstName: c.waivedBy.firstName, lastName: c.waivedBy.lastName, email: c.waivedBy.email, avatarUrl: c.waivedBy.avatarUrl ?? null } : null,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ConditionService {
  /**
   * List conditions for an application, optionally filtered by type.
   */
  async listConditions(applicationId: string, filters?: { conditionType?: ConditionTypeLabel }): Promise<ConditionDto[]> {
    const where: Prisma.ConditionWhereInput = { applicationId };
    if (filters?.conditionType) {
      where.conditionType = filters.conditionType;
    }

    const rows = await prisma.condition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    return rows.map(toDto);
  }

  /**
   * Get a single condition by ID.
   */
  async getCondition(id: string): Promise<ConditionDto | null> {
    const row = await prisma.condition.findUnique({
      where: { id },
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
    return row ? toDto(row) : null;
  }

  /**
   * Create a new condition.
   */
  async createCondition(data: CreateConditionData): Promise<ConditionDto> {
    const createData: Prisma.ConditionCreateInput = {
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? 'PRE_DISBURSEMENT',
      conditionType: data.conditionType ?? 'PRECEDENT',
      status: 'PENDING',
      isFulfilled: false,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      application: { connect: { id: data.applicationId } },
      ...(data.decisionId ? { decision: { connect: { id: data.decisionId } } } : {}),
    };

    const row = await prisma.condition.create({
      data: createData,
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    return toDto(row);
  }

  /**
   * Update an existing condition.
   */
  async updateCondition(id: string, data: UpdateConditionData): Promise<ConditionDto | null> {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.ConditionUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.conditionType !== undefined) updateData.conditionType = data.conditionType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    const row = await prisma.condition.update({
      where: { id },
      data: updateData,
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    return toDto(row);
  }

  /**
   * Complete (fulfill) a condition.
   * Sets status=COMPLETED, isFulfilled=true, fulfilledAt=now.
   */
  async completeCondition(id: string, data?: CompleteConditionData): Promise<ConditionDto | null> {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    if (existing.status === 'COMPLETED') {
      return toDto(existing);
    }

    const updateData: Prisma.ConditionUpdateInput = {
      status: PrismaConditionStatus.COMPLETED,
      isFulfilled: true,
      fulfilledAt: new Date(),
    };

    if (data?.fulfilledById) {
      updateData.fulfilledBy = { connect: { id: data.fulfilledById } };
    }
    if (data?.fulfilmentNotes) {
      updateData.fulfilmentNotes = data.fulfilmentNotes;
    }

    const row = await prisma.condition.update({
      where: { id },
      data: updateData,
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    return toDto(row);
  }

  /**
   * Waive a condition.
   * Sets status=WAIVED, isFulfilled=true, waivedAt=now, records reason + who waived.
   */
  async waiveCondition(id: string, data: WaiveConditionData): Promise<ConditionDto | null> {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    if (existing.status === 'WAIVED' || existing.status === 'COMPLETED') {
      return toDto(existing);
    }

    const updateData: Prisma.ConditionUpdateInput = {
      status: PrismaConditionStatus.WAIVED,
      isFulfilled: true,
      fulfilledAt: new Date(),
      waiverReason: data.waiverReason,
      waivedAt: new Date(),
    };

    if (data.waivedById) {
      updateData.waivedBy = { connect: { id: data.waivedById } };
    }

    const row = await prisma.condition.update({
      where: { id },
      data: updateData,
      include: {
        fulfilledBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        waivedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    return toDto(row);
  }

  /**
   * Check CP (Conditions Precedent) completion for an application.
   * Returns frontend-aligned CpCompletionStatus shape.
   */
  async checkCpCompletion(applicationId: string): Promise<CpCompletionResult> {
    const conditions = await prisma.condition.findMany({
      where: {
        applicationId,
        conditionType: 'PRECEDENT',
      },
    });

    const total = conditions.length;
    const completedCount = conditions.filter((c) => c.status === 'COMPLETED').length;
    const waivedCount = conditions.filter((c) => c.status === 'WAIVED').length;
    const pendingCount = conditions.filter((c) => c.status === 'PENDING').length;

    return {
      applicationId,
      totalConditions: total,
      completedCount,
      waivedCount,
      pendingCount,
      isComplete: total > 0 && pendingCount === 0,
    };
  }
}

export const conditionService = new ConditionService();