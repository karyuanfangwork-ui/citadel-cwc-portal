import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConditionType = 'PRECEDENT' | 'SUBSEQUENT';

export interface CreateConditionData {
  applicationId: string;
  conditionType: ConditionType;
  description: string;
  dueDate?: Date | string | null;
  isFulfilled?: boolean;
  fulfilmentNotes?: string | null;
}

export interface UpdateConditionData {
  conditionType?: ConditionType;
  description?: string;
  dueDate?: Date | string | null;
}

export interface CompleteConditionData {
  fulfilledById?: string;
  fulfilmentNotes?: string;
  evidenceDocumentUrl?: string;  // stored in fulfilmentNotes if no dedicated field
}

export interface WaiveConditionData {
  waiverReason: string;
  approvedById?: string;
}

export interface CpCompletionResult {
  allCompleted: boolean;
  total: number;
  fulfilled: number;
  unfulfilled: number;
  overdue: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ConditionService {
  /**
   * List conditions for an application, optionally filtered by type.
   */
  async listConditions(applicationId: string, filters?: { conditionType?: ConditionType }) {
    const where: Prisma.ConditionWhereInput = { applicationId };
    if (filters?.conditionType) {
      where.conditionType = filters.conditionType;
    }

    return prisma.condition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single condition by ID.
   */
  async getCondition(id: string) {
    return prisma.condition.findUnique({ where: { id } });
  }

  /**
   * Create a new condition.
   */
  async createCondition(data: CreateConditionData) {
    const createData: Prisma.ConditionCreateInput = {
      conditionType: data.conditionType,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      isFulfilled: data.isFulfilled ?? false,
      fulfilmentNotes: data.fulfilmentNotes ?? undefined,
      application: { connect: { id: data.applicationId } },
    };

    return prisma.condition.create({ data: createData });
  }

  /**
   * Update an existing condition.
   */
  async updateCondition(id: string, data: UpdateConditionData) {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.ConditionUpdateInput = {};

    if (data.conditionType !== undefined) updateData.conditionType = data.conditionType;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    return prisma.condition.update({ where: { id }, data: updateData });
  }

  /**
   * Complete (fulfill) a condition.
   * Sets isFulfilled=true, fulfilledAt=now, and optionally stores who fulfilled it and notes.
   */
  async completeCondition(id: string, data?: CompleteConditionData) {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    if (existing.isFulfilled) {
      return existing; // already fulfilled
    }

    const updateData: Prisma.ConditionUpdateInput = {
      isFulfilled: true,
      fulfilledAt: new Date(),
    };

    if (data?.fulfilledById) {
      updateData.fulfilledById = data.fulfilledById;
    }
    if (data?.fulfilmentNotes || data?.evidenceDocumentUrl) {
      const notes: string[] = [];
      if (data.fulfilmentNotes) notes.push(data.fulfilmentNotes);
      if (data.evidenceDocumentUrl) notes.push(`Evidence: ${data.evidenceDocumentUrl}`);
      updateData.fulfilmentNotes = notes.join(' | ');
    }

    return prisma.condition.update({ where: { id }, data: updateData });
  }

  /**
   * Waive a condition.
   * Sets isFulfilled=true, fulfilledAt=now, and records waiver reason + approver in fulfilmentNotes.
   * Since there is no ConditionWaiver table, waiver info is stored in fulfilmentNotes.
   */
  async waiveCondition(id: string, data: WaiveConditionData) {
    const existing = await prisma.condition.findUnique({ where: { id } });
    if (!existing) return null;

    if (existing.isFulfilled) {
      return existing; // already fulfilled
    }

    const notes: string[] = [];
    notes.push(`[WAIVED] Reason: ${data.waiverReason}`);
    if (data.approvedById) {
      notes.push(`Approved by: ${data.approvedById}`);
    }

    const updateData: Prisma.ConditionUpdateInput = {
      isFulfilled: true,
      fulfilledAt: new Date(),
      fulfilmentNotes: notes.join(' | '),
    };

    return prisma.condition.update({ where: { id }, data: updateData });
  }

  /**
   * Check CP (Conditions Precedent) completion for an application.
   * Returns a summary: if all PRECEDENT conditions are fulfilled, allCompleted=true.
   * This serves as a gate for advancing the application state.
   */
  async checkCpCompletion(applicationId: string): Promise<CpCompletionResult> {
    const conditions = await prisma.condition.findMany({
      where: {
        applicationId,
        conditionType: 'PRECEDENT',
      },
    });

    const total = conditions.length;
    const fulfilled = conditions.filter((c) => c.isFulfilled).length;
    const unfulfilled = conditions.filter((c) => !c.isFulfilled).length;

    const now = new Date();
    const overdue = conditions.filter(
      (c) => !c.isFulfilled && c.dueDate && new Date(c.dueDate) < now,
    ).length;

    return {
      allCompleted: total > 0 && unfulfilled === 0,
      total,
      fulfilled,
      unfulfilled,
      overdue,
    };
  }
}

export const conditionService = new ConditionService();