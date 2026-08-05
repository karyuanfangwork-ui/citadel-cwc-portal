import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InputSourceType = 'RATIO' | 'QUALITATIVE' | 'EXTERNAL';

export interface FactorDefinition {
  id: string;
  factorKey: string;
  label: string;
  description: string | null;
  inputSourceType: InputSourceType;
  applicableBorrowerTypes: string[];
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sortOrder: number;
  predecessorId: string | null;
}

// ---------------------------------------------------------------------------
// Canonical factor definitions — single source of truth for P2.1
//
// These match the 9 FACTOR_GROUPS in scorecard.service.ts but are now
// database-driven with input source type, borrower applicability,
// activation, and effective dates.
// ---------------------------------------------------------------------------

const CANONICAL_FACTORS: Omit<FactorDefinition, 'id' | 'effectiveFrom' | 'predecessorId'>[] = [
  {
    factorKey: 'financial_performance',
    label: 'Financial Performance',
    description: 'Profitability ratios (ROS, ROA, ROE) derived from approved financial statements.',
    inputSourceType: 'RATIO',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 10,
  },
  {
    factorKey: 'leverage',
    label: 'Leverage',
    description: 'Debt-to-equity and debt-to-asset ratios measuring financial leverage.',
    inputSourceType: 'RATIO',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 20,
  },
  {
    factorKey: 'liquidity',
    label: 'Liquidity',
    description: 'Current and quick ratio measuring short-term obligation coverage.',
    inputSourceType: 'RATIO',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 30,
  },
  {
    factorKey: 'cashflow',
    label: 'Cashflow',
    description: 'DSCR and interest coverage for corporate; DSR percentage for retail borrowers.',
    inputSourceType: 'RATIO',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 40,
  },
  {
    factorKey: 'management',
    label: 'Management Quality',
    description: 'Qualitative assessment of management capability and governance.',
    inputSourceType: 'QUALITATIVE',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 50,
  },
  {
    factorKey: 'industry',
    label: 'Industry Risk',
    description: 'Qualitative assessment of industry/market sector risk.',
    inputSourceType: 'QUALITATIVE',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 60,
  },
  {
    factorKey: 'collateral',
    label: 'Collateral Quality',
    description: 'Qualitative assessment of collateral coverage and quality.',
    inputSourceType: 'QUALITATIVE',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 70,
  },
  {
    factorKey: 'relationship',
    label: 'Relationship History',
    description: 'Qualitative assessment of existing banking relationship and track record.',
    inputSourceType: 'QUALITATIVE',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 80,
  },
  {
    factorKey: 'market_conditions',
    label: 'Market Conditions',
    description: 'External macroeconomic and market data factor. Currently uses NEUTRAL policy — no real data source configured. Weight should be 0 or governance warning emitted until real data is available.',
    inputSourceType: 'EXTERNAL',
    applicableBorrowerTypes: ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATE'],
    isActive: true,
    effectiveTo: null,
    sortOrder: 90,
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ScoreFactorDefinitionService {
  /**
   * Get all active factor definitions currently in effect.
   * Returns DB rows if seeded; falls back to CANONICAL_FACTORS otherwise.
   * Effective-dated: only returns rows where effectiveFrom <= now AND
   * (effectiveTo IS NULL OR effectiveTo >= now).
   */
  async getActiveDefinitions(): Promise<FactorDefinition[]> {
    const now = new Date();
    const rows = await prisma.scoreFactorDefinition.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        inputSourceType: r.inputSourceType as InputSourceType,
        applicableBorrowerTypes: r.applicableBorrowerTypes.split(','),
        predecessorId: r.predecessorId,
      }));
    }

    // Fallback: return canonical definitions (unseeded DB behavior)
    return CANONICAL_FACTORS.map((f) => ({
      ...f,
      id: `canonical:${f.factorKey}`,
      effectiveFrom: now,
      predecessorId: null,
    }));
  }

  /**
   * Get a single active factor definition by key.
   * For effective-dated models, returns the currently effective version.
   */
  async getDefinitionByKey(factorKey: string): Promise<FactorDefinition | null> {
    const now = new Date();
    const row = await prisma.scoreFactorDefinition.findFirst({
      where: {
        factorKey,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' }, // P2.1: get the most recent effective version
    });

    if (row) {
      return {
        ...row,
        inputSourceType: row.inputSourceType as InputSourceType,
        applicableBorrowerTypes: row.applicableBorrowerTypes.split(','),
        predecessorId: row.predecessorId,
      };
    }

    // Fallback: return from canonical
    const canonical = CANONICAL_FACTORS.find((f) => f.factorKey === factorKey);
    if (!canonical) return null;

    return {
      ...canonical,
      id: `canonical:${canonical.factorKey}`,
      effectiveFrom: now,
      predecessorId: null,
    };
  }

  /**
   * Get active factor definitions applicable to a specific borrower type.
   */
  async getDefinitionsForBorrowerType(borrowerType: string): Promise<FactorDefinition[]> {
    const all = await this.getActiveDefinitions();
    return all.filter((f) => f.applicableBorrowerTypes.includes(borrowerType));
  }

  /**
   * Validate that all factors in a weight set have an active definition.
   * Returns governance warnings for factors that are missing a definition
   * or have an EXTERNAL input source with no real data provider.
   */
  async validateFactorWeights(
    factorWeights: Record<string, number>,
  ): Promise<{ valid: boolean; warnings: GovernanceWarning[] }> {
    const warnings: GovernanceWarning[] = [];
    const activeDefs = await this.getActiveDefinitions();
    const activeKeys = new Set(activeDefs.map((d) => d.factorKey));

    // Check for weight keys without an active definition
    for (const key of Object.keys(factorWeights)) {
      if (!activeKeys.has(key)) {
        warnings.push({
          field: key,
          message: `Factor '${key}' has no active ScoreFactorDefinition. Weight is ${factorWeights[key]} but the factor is not governed.`,
          severity: 'warning',
        });
      }
    }

    // Check for EXTERNAL factors with weight > 0 (no real data source)
    for (const def of activeDefs) {
      if (def.inputSourceType === 'EXTERNAL' && (factorWeights[def.factorKey] ?? 0) > 0) {
        warnings.push({
          field: def.factorKey,
          message: `Factor '${def.factorKey}' has weight ${factorWeights[def.factorKey]} but uses an EXTERNAL data source with no real provider configured. Consider setting weight to 0 until real data is available.`,
          severity: 'warning',
        });
      }
    }

    return { valid: warnings.length === 0, warnings };
  }

  /**
   * Create a successor definition for an existing factor.
   * The predecessor is automatically given an effectiveTo date,
   * and the successor inherits its factorKey and increases sortOrder.
   * P2.1: Effective-dated versioning — no in-place mutation of active definitions.
   */
  async createSuccessor(
    predecessorId: string,
    data: {
      label?: string;
      description?: string;
      inputSourceType?: InputSourceType;
      applicableBorrowerTypes?: string[];
      isActive?: boolean;
      effectiveFrom: Date;
      sortOrder?: number;
    },
    _createdBy?: string,
  ): Promise<FactorDefinition> {
    const predecessor = await prisma.scoreFactorDefinition.findUnique({
      where: { id: predecessorId },
    });
    if (!predecessor) {
      throw new AppError('Predecessor factor definition not found', 404);
    }

    // Close the predecessor's effective window
    const effectiveTo = new Date(data.effectiveFrom.getTime() - 1); // 1ms before successor starts
    await prisma.scoreFactorDefinition.update({
      where: { id: predecessorId },
      data: { effectiveTo, isActive: false },
    });

    // Create the successor
    const successor = await prisma.scoreFactorDefinition.create({
      data: {
        factorKey: predecessor.factorKey,
        label: data.label ?? predecessor.label,
        description: data.description ?? predecessor.description,
        inputSourceType: data.inputSourceType ?? predecessor.inputSourceType,
        applicableBorrowerTypes: data.applicableBorrowerTypes?.join(',') ?? predecessor.applicableBorrowerTypes,
        isActive: data.isActive ?? true,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: null,
        sortOrder: data.sortOrder ?? predecessor.sortOrder,
        predecessorId: predecessorId,
      },
    });

    return {
      ...successor,
      inputSourceType: successor.inputSourceType as InputSourceType,
      applicableBorrowerTypes: successor.applicableBorrowerTypes.split(','),
      predecessorId: successor.predecessorId,
    };
  }

  /**
   * Seed the canonical factor definitions into the database.
   * Idempotent — uses findFirst + create pattern.
   * P2.1: No longer uses factorKey @unique; uses @@unique([factorKey, effectiveFrom]).
   */
  async seedDefinitions(_approvedById?: string): Promise<number> {
    let created = 0;
    const now = new Date();

    for (const def of CANONICAL_FACTORS) {
      // Check if this factor key already has an active, currently-effective definition
      const existing = await prisma.scoreFactorDefinition.findFirst({
        where: {
          factorKey: def.factorKey,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
      });
      if (!existing) {
        await prisma.scoreFactorDefinition.create({
          data: {
            factorKey: def.factorKey,
            label: def.label,
            description: def.description,
            inputSourceType: def.inputSourceType,
            applicableBorrowerTypes: def.applicableBorrowerTypes.join(','),
            isActive: def.isActive,
            effectiveTo: def.effectiveTo,
            sortOrder: def.sortOrder,
          },
        });
        created++;
      }
    }
    return created;
  }

  /**
   * List all factor definitions (including inactive) with pagination.
   */
  async listDefinitions(options: { page?: number; limit?: number; isActive?: boolean } = {}) {
    const { page = 1, limit = 50, isActive } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [definitions, total] = await Promise.all([
      prisma.scoreFactorDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ factorKey: 'asc' }, { effectiveFrom: 'desc' }],
      }),
      prisma.scoreFactorDefinition.count({ where }),
    ]);

    return {
      definitions: definitions.map((d: any) => ({
        ...d,
        inputSourceType: d.inputSourceType as InputSourceType,
        applicableBorrowerTypes: d.applicableBorrowerTypes.split(','),
        predecessorId: d.predecessorId,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update a factor definition (deactivate, change label/description, etc.)
   * P2.1: For governance, prefer createSuccessor over in-place update.
   * In-place updates should be limited to metadata (label, description, sortOrder).
   */
  async updateDefinition(id: string, data: {
    label?: string;
    description?: string;
    inputSourceType?: InputSourceType;
    applicableBorrowerTypes?: string[];
    isActive?: boolean;
    effectiveTo?: Date | null;
    sortOrder?: number;
  }) {
    const existing = await prisma.scoreFactorDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Score factor definition not found', 404);
    }

    return prisma.scoreFactorDefinition.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.inputSourceType !== undefined && { inputSourceType: data.inputSourceType }),
        ...(data.applicableBorrowerTypes !== undefined && { applicableBorrowerTypes: data.applicableBorrowerTypes.join(',') }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  /**
   * Validate that effective windows for the same factorKey do not overlap.
   * P2.1 governance: ensures no two definitions for the same factor are
   * simultaneously active with overlapping effective periods.
   */
  async validateNoOverlap(factorKey: string, effectiveFrom: Date, effectiveTo: Date | null, excludeId?: string): Promise<boolean> {
    const where: any = {
      factorKey,
      isActive: true,
      effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    const overlapping = await prisma.scoreFactorDefinition.findFirst({ where });
    return !overlapping;
  }
}

// ---------------------------------------------------------------------------
// Governance Warning type (shared with scoringValidators)
// ---------------------------------------------------------------------------

export interface GovernanceWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export const scoreFactorDefinitionService = new ScoreFactorDefinitionService();