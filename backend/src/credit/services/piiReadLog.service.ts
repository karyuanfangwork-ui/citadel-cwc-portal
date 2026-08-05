import prisma from '../../utils/prisma';

export class PiiReadLogService {
  /**
   * Log a PII read access event.
   */
  static async logPiiAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    field: string,
    reason?: string,
  ): Promise<void> {
    await prisma.piiReadLog.create({
      data: {
        userId,
        resourceType,
        resourceId,
        field,
        reason,
      },
    });
  }

  /**
   * Get PII read logs with filters and pagination.
   */
  static async getPiiReadLogs(filters: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    field?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.field) where.field = filters.field;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.piiReadLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.piiReadLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}