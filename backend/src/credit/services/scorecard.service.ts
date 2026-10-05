import prisma from '../../utils/prisma';
import { CreditProductType, Prisma } from '@prisma/client';
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
  productType?: CreditProductType;
}

export interface UpdateScorecardData {
  name?: string;
  description?: string;
}

export interface CreateVersionData {
  factorWeights: FactorWeights;
  retailFactorWeights: FactorWeights;
  changeReason: string;
}

export interface AuditContext {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  correlationId?: string | null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateFactorWeights(weights: FactorWeights): void {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new AppError('Factor weights must be an object containing all nine factor groups.', 400);
  }
  const keys = Object.keys(weights);
  const unexpected = keys.filter((key) => !FACTOR_GROUPS.includes(key as FactorGroup));
  if (unexpected.length > 0) throw new AppError(`Unsupported factor weight keys: ${unexpected.join(', ')}`, 400);

  for (const key of FACTOR_GROUPS) {
    const weight = (weights as unknown as Record<string, unknown>)[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw new AppError(`Factor weight '${key}' must be a finite number between 0 and 100`, 400);
    }
  }

  const total = FACTOR_GROUPS.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new AppError(`Factor weights must sum to 100, got ${total}`, 400);
  }
}

function requireGovernanceContext(context: AuditContext): void {
  if (!context?.tenantId || !context.actorId || !context.actorEmail) {
    throw new AppError('Tenant and authenticated actor context are required for scorecard governance.', 500);
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
        ...(data.productType ? { productType: data.productType } : {}),
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
      },
    });
  }

  /**
   * Soft-delete a scorecard by setting isActive = false.
   */
  async deleteScorecard(id: string, context: AuditContext) {
    requireGovernanceContext(context);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.creditScorecard.findUnique({ where: { id } });
      if (!existing) return null;

      const now = new Date();
      const activeVersions = await tx.creditScorecardVersion.findMany({
        where: { scorecardId: id, isActive: true },
        select: { id: true },
      });
      if (activeVersions.length > 0) {
        const deactivated = await tx.creditScorecardVersion.updateMany({
          where: { scorecardId: id, isActive: true },
          data: { isActive: false, effectiveTo: now },
        });
        if (deactivated.count !== activeVersions.length) {
          throw new AppError('Active scorecard versions changed concurrently; deactivation was rolled back.', 409);
        }
      }

      const scorecard = await tx.creditScorecard.update({
        where: { id },
        data: { isActive: false },
      });
      await PlatformAuditChainService.appendEvent({
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorEmail: context.actorEmail,
        correlationId: context.correlationId,
        action: 'SCORECARD_DEACTIVATED',
        resourceType: 'CreditScorecard',
        resourceId: id,
        oldValues: { isActive: existing.isActive },
        newValues: { isActive: false, deactivatedVersionIds: activeVersions.map((version) => version.id) },
      }, tx);
      return scorecard;
    });
  }

  // ==========================================================================
  // Versioning
  // ==========================================================================

  /**
   * Create a new version of a scorecard.
   * Factor weights must sum to 100.
   */
  async createVersion(scorecardId: string, data: CreateVersionData, context: AuditContext) {
    requireGovernanceContext(context);
    if (!data.changeReason?.trim() || data.changeReason.trim().length < 5 || data.changeReason.trim().length > 1000) {
      throw new AppError('A scorecard version change reason of 5–1000 characters is required.', 400);
    }
    validateFactorWeights(data.factorWeights);
    validateFactorWeights(data.retailFactorWeights);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('credit-scorecard-version-create'))`;
      const scorecard = await tx.creditScorecard.findUnique({ where: { id: scorecardId } });
      if (!scorecard) throw new AppError('Scorecard not found', 404);

      const latestVersion = await tx.creditScorecardVersion.findFirst({
        where: { scorecardId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const versionNumber = (latestVersion?.version ?? 0) + 1;
      const created = await tx.creditScorecardVersion.create({
        data: {
          scorecardId,
          version: versionNumber,
          factorWeights: data.factorWeights as any,
          retailFactorWeights: data.retailFactorWeights as any,
          changeReason: data.changeReason.trim(),
          effectiveFrom: new Date(),
          createdById: context.actorId,
        },
        include: {
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      await PlatformAuditChainService.appendEvent({
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorEmail: context.actorEmail,
        correlationId: context.correlationId,
        action: 'SCORECARD_VERSION_CREATED',
        resourceType: 'CreditScorecardVersion',
        resourceId: created.id,
        oldValues: null,
        newValues: {
          status: 'DRAFT',
          scorecardId,
          version: versionNumber,
          changeReason: created.changeReason,
          factorWeights: data.factorWeights,
          retailFactorWeights: data.retailFactorWeights,
        },
      }, tx);
      return created;
    });
  }


  /**
   * Approve a draft scorecard version as the first governance check.
   * Activation remains a separate action requiring a different checker.
   */
  async approveVersion(versionId: string, approverId: string, context: AuditContext) {
    requireGovernanceContext(context);
    const version = await prisma.creditScorecardVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new AppError('Scorecard version not found', 404);
    if (version.isActive) throw new AppError('Active scorecard versions cannot be approved again.', 409);
    if (version.approvedById || version.approvedAt) throw new AppError('Scorecard version is already approved.', 409);
    if (!version.createdById) {
      throw new AppError('System/legacy scorecard versions have no verified maker; create a human-owned proposal before approval.', 409);
    }
    if (version.createdById === approverId) {
      throw new AppError('Scorecard version approval requires a checker distinct from its creator.', 403);
    }
    if (context.actorId !== approverId) {
      throw new AppError('Scorecard approver must match the authenticated actor.', 403);
    }

    return prisma.$transaction(async (tx) => {
      const transition = await tx.creditScorecardVersion.updateMany({
        where: {
          id: versionId,
          isActive: false,
          approvedById: null,
          approvedAt: null,
          createdById: { not: approverId },
        },
        data: { approvedById: approverId, approvedAt: new Date() },
      });
      if (transition.count !== 1) throw new AppError('Scorecard version changed concurrently; reload and retry approval.', 409);
      const approved = await tx.creditScorecardVersion.findUnique({
        where: { id: versionId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      await PlatformAuditChainService.appendEvent({
        tenantId: context.tenantId,
        actorId: approverId,
        actorEmail: context.actorEmail,
        correlationId: context.correlationId,
        action: 'SCORECARD_VERSION_APPROVED',
        resourceType: 'CreditScorecardVersion',
        resourceId: versionId,
        oldValues: { status: 'DRAFT', approvedById: null },
        newValues: { status: 'APPROVED', approvedById: approverId },
        metadata: { scorecardId: version.scorecardId, version: version.version },
      }, tx);
      return approved;
    });
  }


  /**
   * Activate a specific version (deactivates all other versions of the same scorecard).
   *
   * Activation requires an independent checker and a third operator. The operator must also provide policy approval evidence.
   */
  async activateVersion(
    versionId: string,
    context: AuditContext,
    approval: { policyApprovalReference: string; marketConditionsAcknowledged: true },
  ) {
    requireGovernanceContext(context);
    const policyApprovalReference = approval?.policyApprovalReference?.trim();
    if (!policyApprovalReference || policyApprovalReference.length < 5 || policyApprovalReference.length > 200) {
      throw new AppError('A policy-owner approval reference of 5–200 characters is required.', 400);
    }
    if (approval?.marketConditionsAcknowledged !== true) {
      throw new AppError('Policy approval must explicitly acknowledge the market_conditions treatment.', 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('credit-scorecard-version-activation'))`;
      const version = await tx.creditScorecardVersion.findUnique({
        where: { id: versionId },
        include: { scorecard: true },
      });
      if (!version) throw new AppError('Scorecard version not found', 404);
      if (version.isActive) throw new AppError('Scorecard version is already active.', 409);
      if (!version.createdById) {
        throw new AppError('System/legacy scorecard versions have no verified maker; create a human-owned proposal before activation.', 409);
      }
      if (!version.approvedById || !version.approvedAt) {
        throw new AppError('Scorecard version must be approved before it can be activated.', 409);
      }
      if (version.approvedById === version.createdById) {
        throw new AppError('Scorecard version was self-approved; create and approve a fresh governed version.', 409);
      }
      if (context.actorId === version.createdById || context.actorId === version.approvedById) {
        throw new AppError('Scorecard activation requires an operator distinct from the maker and checker.', 403);
      }

      const now = new Date();
      if (version.effectiveFrom > now || (version.effectiveTo && version.effectiveTo <= now)) {
        throw new AppError('Scorecard version is outside its effective period and cannot be activated.', 409);
      }
      validateFactorWeights(version.factorWeights as unknown as FactorWeights);
      if (!version.retailFactorWeights) {
        throw new AppError('A reviewed retail factor map is required before scorecard activation.', 409);
      }
      validateFactorWeights(version.retailFactorWeights as unknown as FactorWeights);

      const activeVersions = await tx.creditScorecardVersion.findMany({
        where: {
          isActive: true,
          scorecard: { is: { isActive: true, productType: version.scorecard.productType } },
        },
        select: { id: true, scorecardId: true },
      });
      const conflictingScopeVersions = activeVersions.filter((active) => active.scorecardId !== version.scorecardId);
      if (conflictingScopeVersions.length > 0) {
        throw new AppError('Another scorecard already has an active version for this product scope. Resolve that governed version before activation.', 409);
      }

      const activeForScorecard = activeVersions.filter((active) => active.scorecardId === version.scorecardId);
      if (activeForScorecard.length > 1) {
        throw new AppError('Multiple active versions exist for this scorecard scope; resolve that ambiguity before activation.', 409);
      }
      if (activeForScorecard.length > 0) {
        const deactivated = await tx.creditScorecardVersion.updateMany({
          where: { scorecardId: version.scorecardId, isActive: true },
          data: { isActive: false, effectiveTo: now },
        });
        if (deactivated.count !== activeForScorecard.length) {
          throw new AppError('Active scorecard versions changed concurrently; activation was rolled back.', 409);
        }
      }

      const activated = await tx.creditScorecardVersion.updateMany({
        where: {
          id: versionId,
          isActive: false,
          createdById: version.createdById,
          approvedById: version.approvedById,
          approvedAt: { not: null },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        data: {
          isActive: true,
          effectiveTo: null,
          activatedById: context.actorId,
          activatedAt: now,
          policyApprovalReference,
          marketConditionsAcknowledged: true,
        },
      });
      if (activated.count !== 1) throw new AppError('Scorecard version changed concurrently; activation was rolled back.', 409);

      const scorecard = await tx.creditScorecard.update({
        where: { id: version.scorecardId },
        data: { isActive: true },
      });
      const activeVersion = await tx.creditScorecardVersion.findUnique({
        where: { id: versionId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      await PlatformAuditChainService.appendEvent({
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorEmail: context.actorEmail,
        correlationId: context.correlationId,
        action: 'SCORECARD_VERSION_ACTIVATED',
        resourceType: 'CreditScorecardVersion',
        resourceId: versionId,
        oldValues: { activeVersionIds: activeForScorecard.map((active) => active.id) },
        newValues: {
          status: 'ACTIVE',
          scorecardId: version.scorecardId,
          version: version.version,
          effectiveFrom: now.toISOString(),
          policyApprovalReference,
          marketConditionsAcknowledged: true,
        },
      }, tx);
      return { ...activeVersion, scorecard };
    });
  }


  /**
   * Deactivate a specific version.
   */
  async deactivateVersion(versionId: string, context: AuditContext) {
    requireGovernanceContext(context);
    return prisma.$transaction(async (tx) => {
      const version = await tx.creditScorecardVersion.findUnique({ where: { id: versionId } });
      if (!version) throw new AppError('Scorecard version not found', 404);
      const now = new Date();
      const transition = await tx.creditScorecardVersion.updateMany({
        where: { id: versionId, isActive: true },
        data: { isActive: false, effectiveTo: now },
      });
      if (transition.count !== 1) throw new AppError('Only an active scorecard version can be deactivated.', 409);
      const deactivated = await tx.creditScorecardVersion.findUnique({
        where: { id: versionId },
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
      await PlatformAuditChainService.appendEvent({
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorEmail: context.actorEmail,
        correlationId: context.correlationId,
        action: 'SCORECARD_VERSION_DEACTIVATED',
        resourceType: 'CreditScorecardVersion',
        resourceId: versionId,
        oldValues: { isActive: true, effectiveTo: version.effectiveTo },
        newValues: { isActive: false, effectiveTo: now.toISOString(), scorecardActive: scorecard?.isActive ?? false },
        metadata: { scorecardId: version.scorecardId, version: version.version },
      }, tx);
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