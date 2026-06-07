import prisma from '../../utils/prisma';
import { RiskRating } from '@prisma/client';

// ---------------------------------------------------------------------------
// Risk rating ordering — AAA is best (1), D is worst (10)
// ---------------------------------------------------------------------------
const RATING_ORDER: Record<string, number> = {
  AAA: 1, AA: 2, A: 3, BBB: 4, BB: 5,
  B: 6, CCC: 7, CC: 8, C: 9, D: 10, NR: 11,
};

function ratingToOrdinal(r: string): number {
  return RATING_ORDER[r] ?? 99;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateApprovalMatrixData {
  name: string;
  description?: string;
  minExposure: number | string;
  maxExposure: number | string;
  minRating: RiskRating;
  maxRating: RiskRating;
  authorityLevel: string;
  requiredApproverCount?: number;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
}

export interface UpdateApprovalMatrixData {
  name?: string;
  description?: string;
  minExposure?: number | string;
  maxExposure?: number | string;
  minRating?: RiskRating;
  maxRating?: RiskRating;
  authorityLevel?: string;
  requiredApproverCount?: number;
  isActive?: boolean;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date | null;
}

export interface ApprovalAuthorityResult {
  authorityLevel: string;
  requiredApproverCount: number;
  matrixId: string;
  matrixName: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ApprovalMatrixService {
  /**
   * Look up the approval authority for a given exposure amount and risk rating.
   * Finds the matching active matrix row where:
   *   - minExposure <= exposure <= maxExposure
   *   - minRating (ordinal) <= risk rating ordinal <= maxRating (ordinal)
   *   - isActive = true
   *   - effectiveFrom <= now <= effectiveTo (or effectiveTo is null)
   */
  async lookupApprovalAuthority(exposure: number, riskRating: string, branchId?: string | null): Promise<ApprovalAuthorityResult | null> {
    const now = new Date();
    const ratingOrdinal = ratingToOrdinal(riskRating);

    // Fetch active, currently-effective matrices filtered by exposure range in DB
    // (rating range can't be filtered in DB since it uses ordinal comparison)
    const matrices = await prisma.creditApprovalMatrix.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        minExposure: { lte: exposure },
        maxExposure: { gte: exposure },
      },
      // Order by minExposure DESC so tighter (higher) exposure ranges are
      // checked first — prevents a "Medium Exposure" matrix (minExposure=0)
      // from matching before a "High Exposure" matrix (minExposure=500000)
      // when the exposure falls in both ranges.
      orderBy: { minExposure: 'desc' },
    });

    const matches = (matrix: typeof matrices[number]) => {
      const minExp = Number(matrix.minExposure);
      const maxExp = Number(matrix.maxExposure);
      const minOrd = ratingToOrdinal(matrix.minRating);
      const maxOrd = ratingToOrdinal(matrix.maxRating);

      return (
        exposure >= minExp &&
        exposure <= maxExp &&
        ratingOrdinal >= minOrd &&
        ratingOrdinal <= maxOrd
      );
    };

    const toResult = (matrix: typeof matrices[number]): ApprovalAuthorityResult => ({
      authorityLevel: matrix.authorityLevel,
      requiredApproverCount: matrix.requiredApproverCount,
      matrixId: matrix.id,
      matrixName: matrix.name,
    });

    // §3.1 — Branch-specific matrices take precedence over the global matrix
    if (branchId) {
      const branchMatch = matrices.find(m => m.branchId === branchId && matches(m));
      if (branchMatch) return toResult(branchMatch);
    }

    const globalMatch = matrices.find(m => m.branchId === null && matches(m));
    if (globalMatch) return toResult(globalMatch);

    return null;
  }

  /**
   * List approval matrices with pagination.
   */
  async listMatrices(options: { page?: number; limit?: number; isActive?: boolean } = {}) {
    const { page = 1, limit = 20, isActive } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;

    const [matrices, total] = await Promise.all([
      prisma.creditApprovalMatrix.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      }),
      prisma.creditApprovalMatrix.count({ where }),
    ]);

    return {
      matrices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single approval matrix by ID.
   */
  async getMatrix(id: string) {
    return prisma.creditApprovalMatrix.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  /**
   * Create a new approval matrix.
   */
  async createMatrix(data: CreateApprovalMatrixData, actorId?: string) {
    const matrix = await prisma.creditApprovalMatrix.create({
      data: {
        name: data.name,
        description: data.description ?? undefined,
        minExposure: data.minExposure,
        maxExposure: data.maxExposure,
        minRating: data.minRating,
        maxRating: data.maxRating,
        authorityLevel: data.authorityLevel,
        requiredApproverCount: data.requiredApproverCount ?? 1,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? undefined,
      },
    });

    // Create initial version snapshot
    if (actorId) {
      await this.createVersionSnapshot(matrix.id, 1, matrix, actorId);
    }

    return matrix;
  }

  /**
   * Update an existing approval matrix.
   */
  async updateMatrix(id: string, data: UpdateApprovalMatrixData, actorId?: string) {
    const existing = await prisma.creditApprovalMatrix.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.minExposure !== undefined) updateData.minExposure = data.minExposure;
    if (data.maxExposure !== undefined) updateData.maxExposure = data.maxExposure;
    if (data.minRating !== undefined) updateData.minRating = data.minRating;
    if (data.maxRating !== undefined) updateData.maxRating = data.maxRating;
    if (data.authorityLevel !== undefined) updateData.authorityLevel = data.authorityLevel;
    if (data.requiredApproverCount !== undefined) updateData.requiredApproverCount = data.requiredApproverCount;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = data.effectiveFrom;
    if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo;

    const matrix = await prisma.creditApprovalMatrix.update({
      where: { id },
      data: updateData,
    });

    // Create new version snapshot if substantive fields changed
    const substantiveFields = [
      'minExposure', 'maxExposure', 'minRating', 'maxRating',
      'authorityLevel', 'requiredApproverCount',
    ];
    const hasSubstantiveChange = substantiveFields.some(f => (data as any)[f] !== undefined);

    if (hasSubstantiveChange && actorId) {
      const lastVersion = await prisma.creditApprovalMatrixVersion.findFirst({
        where: { matrixId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;
      await this.createVersionSnapshot(id, nextVersion, matrix, actorId);
    }

    return matrix;
  }

  /**
   * Delete an approval matrix.
   */
  async deleteMatrix(id: string) {
    const existing = await prisma.creditApprovalMatrix.findUnique({ where: { id } });
    if (!existing) return null;

    await prisma.creditApprovalMatrix.delete({ where: { id } });
    return existing;
  }

  /**
   * Create a version snapshot of a matrix.
   */
  private async createVersionSnapshot(
    matrixId: string,
    version: number,
    matrix: any,
    approvedById: string,
  ) {
    const snapshot = {
      name: matrix.name,
      description: matrix.description,
      minExposure: matrix.minExposure?.toString(),
      maxExposure: matrix.maxExposure?.toString(),
      minRating: matrix.minRating,
      maxRating: matrix.maxRating,
      authorityLevel: matrix.authorityLevel,
      requiredApproverCount: matrix.requiredApproverCount,
      isActive: matrix.isActive,
      effectiveFrom: matrix.effectiveFrom?.toISOString(),
      effectiveTo: matrix.effectiveTo?.toISOString() ?? null,
    };

    await prisma.creditApprovalMatrixVersion.create({
      data: {
        matrixId,
        version,
        snapshot,
        approvedById,
        approvedAt: new Date(),
      },
    });
  }
}

export const approvalMatrixService = new ApprovalMatrixService();