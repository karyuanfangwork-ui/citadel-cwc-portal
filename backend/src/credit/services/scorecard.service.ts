import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

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
}

export interface UpdateScorecardData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateVersionData {
  factorWeights: FactorWeights;
  approvedById?: string;
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
  async createVersion(scorecardId: string, data: CreateVersionData) {
    const scorecard = await prisma.creditScorecard.findUnique({ where: { id: scorecardId } });
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    validateFactorWeights(data.factorWeights);

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
        effectiveFrom: new Date(),
        ...(data.approvedById ? { approvedById: data.approvedById, approvedAt: new Date() } : {}),
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Activate a specific version (deactivates all other versions of the same scorecard).
   */
  async activateVersion(versionId: string) {
    const version = await prisma.creditScorecardVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new Error('Scorecard version not found');
    }

    // Deactivate all other versions of the same scorecard in a transaction
    return prisma.$transaction(async (tx) => {
      await tx.creditScorecardVersion.updateMany({
        where: { scorecardId: version.scorecardId, isActive: true },
        data: { isActive: false },
      });

      return tx.creditScorecardVersion.update({
        where: { id: versionId },
        data: { isActive: true },
        include: {
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });
  }

  /**
   * Deactivate a specific version.
   */
  async deactivateVersion(versionId: string) {
    const version = await prisma.creditScorecardVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new Error('Scorecard version not found');
    }

    return prisma.creditScorecardVersion.update({
      where: { id: versionId },
      data: { isActive: false },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
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
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}

export const scorecardService = new ScorecardService();