import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { PlatformAuditChainService } from '../../services/platformAuditChain.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const FACTOR_GROUPS = [
  'financial_performance',
  'leverage',
  'liquidity',
  'cashflow',
  'management',
  'industry',
  'collateral',
  'relationship',
  'market_conditions',
] as const;

export type FactorGroup = (typeof FACTOR_GROUPS)[number];

/**
 * Canonical demo/default weights. Values are percentages, matching the
 * FactorWeights contract and the scoring governance validators.
 *
 * Keep this shape aligned with FACTOR_GROUPS: silently accepting legacy names
 * would make every runtime lookup resolve to zero.
 */
export const CANONICAL_FACTOR_WEIGHTS: FactorWeights = {
  financial_performance: 30,
  leverage: 0,
  liquidity: 0,
  cashflow: 25,
  management: 15,
  industry: 10,
  collateral: 20,
  relationship: 0,
  market_conditions: 0,
};

export interface FactorWeights {
  financial_performance: number;
  leverage: number;
  liquidity: number;
  cashflow: number;
  management: number;
  industry: number;
  collateral: number;
  relationship: number;
  market_conditions: number;
}

export interface CreateScorecardData {
  name: string;
  description?: string;
  productType?: string;
}

export interface UpdateScorecardData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateVersionData {
  factorWeights: FactorWeights;
  retailFactorWeights?: FactorWeights;
}

export interface AuditContext {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateFactorWeights(weights: FactorWeights): void {
  // All 9 factor groups must be present
  for (const key of FACTOR_GROUPS) {
    if (weights[key] === undefined || weights[key] === null) {
      throw new Error(`Missing factor weight: ${key}`);
    }
    if (typeof weights[key] !== 'number' || weights[key] < 0 || weights[key] > 100) {
      throw new Error(`Factor weight '${key}' must be a number between 0 and 100`);
    }
  }

  const total = FACTOR_GROUPS.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Factor weights must sum to 100, got ${total}`);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ScorecardService {
  // ==========================================================================
  // CRUD — Scorecards
  // ==========================================================================

  /**
   * List all scorecards with pagination and optional isActive filter.
   */
  async listScorecards(options: { page?: number; limit?: number; isActive?: boolean } = {}) {
    const { page = 1, limit = 20, isActive } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.CreditScorecardWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [scorecards, total] = await Promise.all([
      prisma.creditScorecard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { versions: true } },
        },
      }),
      prisma.creditScorecard.count({ where }),
    ]);

    return {
      scorecards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single scorecard by ID with latest version info.
   */
  async getScorecard(id: string) {
    return prisma.creditScorecard.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  }

  /**
   * Create a new scorecard.
   */
  async createScorecard(data: CreateScorecardData) {
    return prisma.creditScorecard.create({
      data: {
        name: data.name,
        description: data.description,
        ...(data.productType ? { productType: data.productType as any } : {}),
      },
    });
  }

  /**
   * Update a scorecard.
   */
  async updateScorecard(id: string, data: UpdateScorecardData) {
    const existing = await prisma.creditScorecard.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.creditScorecard.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Soft-delete a scorecard by setting isActive = false.
   */
  async deleteScorecard(id: string) {
    const existing = await prisma.creditScorecard.findUnique({ where: { id } });
    if (!existing) return null;

    // Deactivate all active versions
    await prisma.creditScorecardVersion.updateMany({
      where: { scorecardId: id, isActive: true },
      data: { isActive: false },
    });

    return prisma.creditScorecard.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==========================================================================
  // Versioning
  // ==========================================================================

  /**
   * Create a new version of a scorecard.
   * Factor weights must sum to 100.
   */
  async createVersion(scorecardId: string, data: CreateVersionData, createdById?: string) {
    const scorecard = await prisma.creditScorecard.findUnique({ where: { id: scorecardId } });
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    validateFactorWeights(data.factorWeights);
    if (data.retailFactorWeights) {
      validateFactorWeights(data.retailFactorWeights);
    }

    // Determine next version number
    const latestVersion = await prisma.creditScorecardVersion.findFirst({
      where: { scorecardId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    return prisma.creditScorecardVersion.create({
      data: {
        scorecardId,
        version: nextVersion,
        factorWeights: data.factorWeights as any,
        retailFactorWeights: data.retailFactorWeights ? data.retailFactorWeights as any : undefined,
        effectiveFrom: new Date(),
        createdById: createdById ?? null,
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Approve a draft scorecard version as the first governance check.
   * Activation remains a separate action requiring a different checker.
   */
  async approveVersion(versionId: string, approverId: string, auditContext?: AuditContext) {
    const version = await prisma.creditScorecardVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new AppError('Scorecard version not found', 404);
    }
    if (version.isActive) {
      throw new AppError('Active scorecard versions cannot be approved again.', 409);
    }
    if (version.approvedById) {
      throw new AppError('Scorecard version is already approved.', 409);
    }

    return prisma.$transaction(async (tx) => {
      const approved = await tx.creditScorecardVersion.update({
        where: { id: versionId },
        data: {
          approvedById: approverId,
          approvedAt: new Date(),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      if (auditContext) {
        await PlatformAuditChainService.appendEvent({
          tenantId: auditContext.tenantId,
          actorId: approverId,
          actorEmail: auditContext.actorEmail,
          action: 'SCORECARD_VERSION_APPROVED',
          resourceType: 'CreditScorecardVersion',
          resourceId: versionId,
          oldValues: { approvedById: version.approvedById, isActive: version.isActive },
          newValues: { approvedById: approverId, isActive: approved.isActive },
          metadata: { scorecardId: version.scorecardId, version: version.version },
        }, tx);
      }

      return approved;
    });
  }

  /**
   * Activate a specific version (deactivates all other versions of the same scorecard).
   *
   * Phase 5 maker/checker: activation requires a distinct second approver
   * (checker) who is different from the version's approvedById (maker).
   */
  async activateVersion(versionId: string, secondApproverId: string, auditContext?: AuditContext) {
    const version = await prisma.creditScorecardVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new AppError('Scorecard version not found', 404);
    }

    // Maker/checker — the second approver must differ from the first approver.
    if (!version.approvedById || !version.approvedAt) {
      throw new AppError(
        'Scorecard version must be approved before it can be activated.',
        409,
      );
    }
    if (secondApproverId === version.approvedById) {
      throw new AppError(
        'Scorecard activation requires a second approver (checker) who is different from the version approver.',
        409,
      );
    }
    if (version.createdById && secondApproverId === version.createdById) {
      throw new AppError(
        'Scorecard activation cannot be performed by the version creator.',
        409,
      );
    }

    // Ambiguity guard: only one scorecard may have an active version at a time.
    const conflicting = await prisma.creditScorecardVersion.findFirst({
      where: { isActive: true, scorecardId: { not: version.scorecardId } },
    });
    if (conflicting) {
      throw new AppError(
        'Another scorecard already has an active version. Deactivate it before activating this one.',
        409,
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.creditScorecardVersion.updateMany({
        where: { scorecardId: version.scorecardId, isActive: true },
        data: { isActive: false },
      });

      const activeVersion = await tx.creditScorecardVersion.update({
        where: { id: versionId },
        data: { isActive: true },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      const scorecard = await tx.creditScorecard.update({
        where: { id: version.scorecardId },
        data: { isActive: true },
      });

      if (auditContext) {
        await PlatformAuditChainService.appendEvent({
          tenantId: auditContext.tenantId,
          actorId: secondApproverId,
          actorEmail: auditContext.actorEmail,
          action: 'SCORECARD_VERSION_ACTIVATED',
          resourceType: 'CreditScorecardVersion',
          resourceId: versionId,
          oldValues: { isActive: version.isActive },
          newValues: { isActive: activeVersion.isActive, scorecardActive: scorecard.isActive },
          metadata: { scorecardId: version.scorecardId, version: version.version },
        }, tx);
      }

      return { ...activeVersion, scorecard };
    });
  }

  /**
   * Deactivate a specific version.
   */
  async deactivateVersion(versionId: string, auditContext?: AuditContext) {
    const version = await prisma.creditScorecardVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new Error('Scorecard version not found');
    }

    return prisma.$transaction(async (tx) => {
      const deactivated = await tx.creditScorecardVersion.update({
        where: { id: versionId },
        data: { isActive: false },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      const remainingActive = await tx.creditScorecardVersion.count({
        where: { scorecardId: version.scorecardId, isActive: true },
      });
      const scorecard = remainingActive === 0
        ? await tx.creditScorecard.update({ where: { id: version.scorecardId }, data: { isActive: false } })
        : await tx.creditScorecard.findUnique({ where: { id: version.scorecardId } });

      if (auditContext) {
        await PlatformAuditChainService.appendEvent({
          tenantId: auditContext.tenantId,
          actorId: auditContext.actorId,
          actorEmail: auditContext.actorEmail,
          action: 'SCORECARD_VERSION_DEACTIVATED',
          resourceType: 'CreditScorecardVersion',
          resourceId: versionId,
          oldValues: { isActive: version.isActive },
          newValues: { isActive: deactivated.isActive, scorecardActive: scorecard?.isActive ?? false },
          metadata: { scorecardId: version.scorecardId, version: version.version },
        }, tx);
      }

      return { ...deactivated, scorecard };
    });
  }

  /**
   * List all versions for a scorecard.
   */
  async listVersions(scorecardId: string) {
    return prisma.creditScorecardVersion.findMany({
      where: { scorecardId },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}

export const scorecardService = new ScorecardService();