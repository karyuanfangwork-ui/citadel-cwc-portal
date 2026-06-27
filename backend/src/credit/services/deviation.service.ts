import prisma from '../../utils/prisma';
import { DeviationStatus, DeviationSeverity, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { AUTHORITY_HIERARCHY } from './authority.service';

// Severity → minimum authority required to approve
const SEVERITY_AUTHORITY_MAP: Record<string, string> = {
  LOW: 'MANAGER',
  MEDIUM: 'SENIOR_MANAGER',
  HIGH: 'COMMITTEE',
  CRITICAL: 'BOARD',
};

// ── Types ───────────────────────────────────────────────────────────────────
interface CreateDeviationData {
  applicationId: string;
  policyRule: string;
  description: string;
  actualValue?: number;
  thresholdValue?: number;
  severity?: DeviationSeverity;
  justification: string;
  isNonWaivable?: boolean;
  requiredAuthorityLevel?: string;
  reviewDate?: Date;
  sunsetDate?: Date;
}

interface UpdateDeviationData {
  description?: string;
  justification?: string;
  severity?: DeviationSeverity;
  reviewDate?: Date;
  sunsetDate?: Date;
}

interface ListDeviationsFilters {
  applicationId?: string;
  status?: DeviationStatus;
  policyRule?: string;
  severity?: DeviationSeverity;
  page?: number;
  limit?: number;
}

// ── Service ─────────────────────────────────────────────────────────────────
class DeviationService {
  /**
   * Create a new policy deviation record.
   * Throws if the rule is non-waivable.
   */
  async createDeviation(data: CreateDeviationData, actorId?: string) {
    // Check if this is a non-waivable rule
    if (data.isNonWaivable) {
      throw new AppError(
        `Policy rule "${data.policyRule}" is non-waivable and cannot be deviated from.`,
        403,
        { code: 'NON_WAIVABLE_RULE' }
      );
    }

    // Set default authority level based on severity
    const severity = data.severity ?? DeviationSeverity.MEDIUM;
    const requiredAuthorityLevel =
      data.requiredAuthorityLevel ?? SEVERITY_AUTHORITY_MAP[severity] ?? 'MANAGER';

    const deviation = await prisma.deviationApproval.create({
      data: {
        applicationId: data.applicationId,
        policyRule: data.policyRule,
        description: data.description,
        actualValue: data.actualValue != null ? data.actualValue : null,
        thresholdValue: data.thresholdValue != null ? data.thresholdValue : null,
        severity,
        justification: data.justification,
        status: DeviationStatus.PENDING,
        isNonWaivable: data.isNonWaivable ?? false,
        requiredAuthorityLevel,
        createdById: actorId ?? null,
        reviewDate: data.reviewDate ?? null,
        sunsetDate: data.sunsetDate ?? null,
      },
    });

    logger.info(`Deviation created: ${deviation.id} for rule ${data.policyRule} on app ${data.applicationId}`);
    return deviation;
  }

  /**
   * Update a pending deviation (only PENDING can be updated).
   */
  async updateDeviation(id: string, data: UpdateDeviationData) {
    const existing = await prisma.deviationApproval.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Deviation record not found.', 404, { code: 'NOT_FOUND' });
    }
    if (existing.status !== DeviationStatus.PENDING) {
      throw new AppError('Only PENDING deviations can be updated.', 400, { code: 'INVALID_STATUS' });
    }

    const updateData: Prisma.DeviationApprovalUpdateInput = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.justification !== undefined) updateData.justification = data.justification;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.reviewDate !== undefined) updateData.reviewDate = data.reviewDate;
    if (data.sunsetDate !== undefined) updateData.sunsetDate = data.sunsetDate;

    const updated = await prisma.deviationApproval.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  /**
   * Approve a pending deviation.
   * Requires the approver's authority level to meet or exceed the required level.
   */
  async approveDeviation(id: string, approverId: string, approverAuthorityLevel: string, comments?: string) {
    const existing = await prisma.deviationApproval.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Deviation record not found.', 404, { code: 'NOT_FOUND' });
    }
    if (existing.status !== DeviationStatus.PENDING) {
      throw new AppError('Only PENDING deviations can be approved.', 400, { code: 'INVALID_STATUS' });
    }
    if (existing.isNonWaivable) {
      throw new AppError('Non-waivable deviations cannot be approved.', 403, { code: 'NON_WAIVABLE_RULE' });
    }
    if (existing.createdById && existing.createdById === approverId) {
      throw new AppError(
        'Deviation approval requires approval by a different officer from the requester.',
        403,
        { code: 'DEVIATION_SOD_VIOLATION' }
      );
    }

    // Check authority level
    const requiredLevel = existing.requiredAuthorityLevel ?? 'MANAGER';
    const approverRank = AUTHORITY_HIERARCHY[approverAuthorityLevel] ?? 0;
    const requiredRank = AUTHORITY_HIERARCHY[requiredLevel] ?? 0;
    if (approverRank < requiredRank) {
      throw new AppError(
        `Your authority level (${approverAuthorityLevel}) is below the required level (${requiredLevel}) for this deviation.`,
        403,
        { code: 'INSUFFICIENT_AUTHORITY', requiredLevel, approverAuthorityLevel }
      );
    }

    const updated = await prisma.deviationApproval.update({
      where: { id },
      data: {
        status: DeviationStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
        approvalComments: comments ?? null,
      },
    });

    logger.info(`Deviation approved: ${id} by ${approverId} (authority: ${approverAuthorityLevel})`);
    return updated;
  }

  /**
   * Reject a pending deviation.
   */
  async rejectDeviation(id: string, rejecterId: string, reason: string) {
    const existing = await prisma.deviationApproval.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Deviation record not found.', 404, { code: 'NOT_FOUND' });
    }
    if (existing.status !== DeviationStatus.PENDING) {
      throw new AppError('Only PENDING deviations can be rejected.', 400, { code: 'INVALID_STATUS' });
    }

    const updated = await prisma.deviationApproval.update({
      where: { id },
      data: {
        status: DeviationStatus.REJECTED,
        rejectedById: rejecterId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    logger.info(`Deviation rejected: ${id} by ${rejecterId}`);
    return updated;
  }

  /**
   * Get a single deviation record.
   */
  async getDeviation(id: string) {
    const deviation = await prisma.deviationApproval.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!deviation) {
      throw new AppError('Deviation record not found.', 404, { code: 'NOT_FOUND' });
    }
    return deviation;
  }

  /**
   * List deviations for an application.
   */
  async getApplicationDeviations(applicationId: string) {
    return prisma.deviationApproval.findMany({
      where: { applicationId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List open deviations (register view) with filters and pagination.
   */
  async listOpenDeviations(filters: ListDeviationsFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeviationApprovalWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.applicationId) where.applicationId = filters.applicationId;
    if (filters.policyRule) where.policyRule = filters.policyRule;
    if (filters.severity) where.severity = filters.severity;

    const [deviations, total] = await Promise.all([
      prisma.deviationApproval.findMany({
        where,
        include: {
          application: { select: { id: true, applicationNo: true, state: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          rejectedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deviationApproval.count({ where }),
    ]);

    return {
      deviations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if an application has any unresolved (PENDING) deviations.
   * Used by approval gate — cannot approve if pending deviations exist.
   */
  async hasPendingDeviations(applicationId: string): Promise<boolean> {
    const count = await prisma.deviationApproval.count({
      where: {
        applicationId,
        status: DeviationStatus.PENDING,
      },
    });
    return count > 0;
  }

  /**
   * Check if all deviations for an application are resolved (APPROVED or no deviations).
   * Returns { canProceed, pendingCount, approvedCount, rejectedCount }
   */
  async checkApplicationDeviations(applicationId: string) {
    const deviations = await prisma.deviationApproval.findMany({
      where: { applicationId },
      select: { status: true },
    });

    const pendingCount = deviations.filter((d: { status: DeviationStatus }) => d.status === DeviationStatus.PENDING).length;
    const approvedCount = deviations.filter((d: { status: DeviationStatus }) => d.status === DeviationStatus.APPROVED).length;
    const rejectedCount = deviations.filter((d: { status: DeviationStatus }) => d.status === DeviationStatus.REJECTED).length;

    // Can proceed only if no PENDING deviations exist
    const canProceed = pendingCount === 0;

    return { canProceed, pendingCount, approvedCount, rejectedCount, total: deviations.length };
  }

  /**
   * Auto-create a deviation when a policy breach is detected (e.g., LTV > cap).
   * Called by other services (LTV, guarantor, DSR).
   */
  async autoCreateFromBreach(params: {
    applicationId: string;
    policyRule: string;
    description: string;
    actualValue: number;
    thresholdValue: number;
    severity?: DeviationSeverity;
    isNonWaivable?: boolean;
  }) {
    return this.createDeviation({
      applicationId: params.applicationId,
      policyRule: params.policyRule,
      description: params.description,
      actualValue: params.actualValue,
      thresholdValue: params.thresholdValue,
      severity: params.severity ?? DeviationSeverity.MEDIUM,
      justification: `Auto-detected policy breach: ${params.policyRule} (${params.actualValue} exceeds threshold ${params.thresholdValue})`,
      isNonWaivable: params.isNonWaivable ?? false,
    });
  }
}

export const deviationService = new DeviationService();
export default deviationService;