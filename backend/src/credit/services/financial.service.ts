import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateStatementData {
  borrowerProfileId: string;
  period: string;
  fiscalYearEnd: string;
  statementType: string;
  currency: string;
  enteredById: string;
}

export interface UpdateStatementData {
  period?: string;
  fiscalYearEnd?: string;
  statementType?: string;
  currency?: string;
  reviewedById?: string | null;
  status?: string;
}

export interface LineItemInput {
  lineKey: string;
  lineLabel: string;
  amount: string | number;
  parentLineKey?: string | null;
  displayOrder: number;
}

export interface ListStatementsOptions {
  page?: number;
  limit?: number;
  statementType?: string;
  period?: string;
  status?: string;
  fiscalYearEnd?: string;
}

// ---------------------------------------------------------------------------
// Ratio definitions
// ---------------------------------------------------------------------------

interface RatioDef {
  key: string;
  label: string;
  category: 'PROFITABILITY' | 'LEVERAGE' | 'LIQUIDITY' | 'COVERAGE' | 'ACTIVITY';
  requiredKeys: string[];
  compute: (vals: Record<string, number>) => number | null;
}

const RATIO_DEFINITIONS: RatioDef[] = [
  // Profitability
  {
    key: 'ros',
    label: 'Return on Sales',
    category: 'PROFITABILITY',
    requiredKeys: ['net_income', 'revenue'],
    compute: (v) => v.revenue !== 0 ? v.net_income / v.revenue : null,
  },
  {
    key: 'roa',
    label: 'Return on Assets',
    category: 'PROFITABILITY',
    requiredKeys: ['net_income', 'total_assets'],
    compute: (v) => v.total_assets !== 0 ? v.net_income / v.total_assets : null,
  },
  {
    key: 'roe',
    label: 'Return on Equity',
    category: 'PROFITABILITY',
    requiredKeys: ['net_income', 'total_equity'],
    compute: (v) => v.total_equity !== 0 ? v.net_income / v.total_equity : null,
  },
  // Leverage
  {
    key: 'debt_to_equity',
    label: 'Debt/Equity',
    category: 'LEVERAGE',
    requiredKeys: ['total_debt', 'total_equity'],
    compute: (v) => v.total_equity !== 0 ? v.total_debt / v.total_equity : null,
  },
  {
    key: 'debt_to_assets',
    label: 'Debt/Assets',
    category: 'LEVERAGE',
    requiredKeys: ['total_debt', 'total_assets'],
    compute: (v) => v.total_assets !== 0 ? v.total_debt / v.total_assets : null,
  },
  // Liquidity
  {
    key: 'current_ratio',
    label: 'Current Ratio',
    category: 'LIQUIDITY',
    requiredKeys: ['current_assets', 'current_liabilities'],
    compute: (v) => v.current_liabilities !== 0 ? v.current_assets / v.current_liabilities : null,
  },
  {
    key: 'quick_ratio',
    label: 'Quick Ratio',
    category: 'LIQUIDITY',
    requiredKeys: ['current_assets', 'inventory', 'current_liabilities'],
    compute: (v) => v.current_liabilities !== 0 ? (v.current_assets - v.inventory) / v.current_liabilities : null,
  },
  // Coverage
  {
    key: 'dscr',
    label: 'Debt Service Coverage Ratio',
    category: 'COVERAGE',
    requiredKeys: ['net_income', 'depreciation', 'interest', 'principal'],
    compute: (v) => (v.interest + v.principal) !== 0 ? (v.net_income + v.depreciation + v.interest) / (v.interest + v.principal) : null,
  },
  {
    key: 'interest_coverage',
    label: 'Interest Coverage',
    category: 'COVERAGE',
    requiredKeys: ['ebit', 'interest'],
    compute: (v) => v.interest !== 0 ? v.ebit / v.interest : null,
  },
  // Activity
  {
    key: 'asset_turnover',
    label: 'Asset Turnover',
    category: 'ACTIVITY',
    requiredKeys: ['revenue', 'total_assets'],
    compute: (v) => v.total_assets !== 0 ? v.revenue / v.total_assets : null,
  },
  {
    key: 'inventory_turnover',
    label: 'Inventory Turnover',
    category: 'ACTIVITY',
    requiredKeys: ['cogs', 'inventory'],
    compute: (v) => v.inventory !== 0 ? v.cogs / v.inventory : null,
  },
  {
    key: 'receivables_turnover',
    label: 'Receivables Turnover',
    category: 'ACTIVITY',
    requiredKeys: ['revenue', 'accounts_receivable'],
    compute: (v) => v.accounts_receivable !== 0 ? v.revenue / v.accounts_receivable : null,
  },
  {
    key: 'payables_turnover',
    label: 'Payables Turnover',
    category: 'ACTIVITY',
    requiredKeys: ['cogs', 'accounts_payable'],
    compute: (v) => v.accounts_payable !== 0 ? v.cogs / v.accounts_payable : null,
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class FinancialService {
  // ==========================================================================
  // CRUD — Statements
  // ==========================================================================

  /**
   * List financial statements for a borrower profile with pagination & filters.
   */
  async listStatements(borrowerProfileId: string, options: ListStatementsOptions = {}) {
    const {
      page = 1,
      limit = 20,
      statementType,
      period,
      status,
      fiscalYearEnd,
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.FinancialStatementWhereInput = {
      borrowerProfileId,
      deletedAt: null,
    };

    if (statementType) {
      where.statementType = statementType as any;
    }
    if (period) {
      where.period = period as any;
    }
    if (status) {
      where.status = status as any;
    }
    if (fiscalYearEnd) {
      // Filter by exact date or date range
      const date = new Date(fiscalYearEnd);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.fiscalYearEnd = { gte: date, lt: nextDay } as any;
    }

    const [statements, total] = await Promise.all([
      prisma.financialStatement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fiscalYearEnd: 'desc' },
        include: {
          enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { lineItems: true, ratios: true } },
        },
      }),
      prisma.financialStatement.count({ where }),
    ]);

    return {
      statements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single financial statement by ID with full details.
   */
  async getStatement(id: string) {
    return prisma.financialStatement.findFirst({
      where: { id, deletedAt: null },
      include: {
        enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lineItems: { orderBy: { displayOrder: 'asc' } },
        ratios: { orderBy: { category: 'asc' } },
        borrowerProfile: {
          select: { id: true, borrowerType: true, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  /**
   * Create a new financial statement.
   */
  async createStatement(data: CreateStatementData) {
    const createData: Prisma.FinancialStatementCreateInput = {
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      period: data.period as any,
      fiscalYearEnd: new Date(data.fiscalYearEnd),
      statementType: data.statementType as any,
      currency: data.currency as any,
      enteredBy: { connect: { id: data.enteredById } },
      status: 'DRAFT',
    };

    return prisma.financialStatement.create({
      data: createData,
      include: {
        enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Update an existing financial statement.
   */
  async updateStatement(id: string, data: UpdateStatementData) {
    const existing = await prisma.financialStatement.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    const updateData: Prisma.FinancialStatementUpdateInput = {};

    if (data.period !== undefined) updateData.period = data.period as any;
    if (data.fiscalYearEnd !== undefined) updateData.fiscalYearEnd = new Date(data.fiscalYearEnd);
    if (data.statementType !== undefined) updateData.statementType = data.statementType as any;
    if (data.currency !== undefined) updateData.currency = data.currency as any;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.reviewedById !== undefined) {
      updateData.reviewedBy = data.reviewedById
        ? { connect: { id: data.reviewedById } }
        : { disconnect: true };
    }

    return prisma.financialStatement.update({
      where: { id },
      data: updateData,
      include: {
        enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Soft-delete a financial statement (only DRAFT status).
   */
  async deleteStatement(id: string) {
    const existing = await prisma.financialStatement.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'DRAFT') {
      throw new Error('Only DRAFT financial statements can be deleted');
    }

    return prisma.financialStatement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================================================
  // Line Items
  // ==========================================================================

  /**
   * List line items for a statement.
   */
  async listLineItems(statementId: string) {
    return prisma.financialLineItem.findMany({
      where: { statementId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Batch upsert line items for a statement.
   * Items are matched by statementId + lineKey; new items are created,
   * existing items are updated.
   */
  async upsertLineItems(statementId: string, items: LineItemInput[]) {
    const operations = items.map((item) =>
      prisma.financialLineItem.upsert({
        where: {
          statementId_lineKey: {
            statementId,
            lineKey: item.lineKey,
          },
        },
        update: {
          lineLabel: item.lineLabel,
          amount: new Prisma.Decimal(item.amount as string | number),
          parentLineKey: item.parentLineKey ?? null,
          displayOrder: item.displayOrder,
        },
        create: {
          statementId,
          lineKey: item.lineKey,
          lineLabel: item.lineLabel,
          amount: new Prisma.Decimal(item.amount as string | number),
          parentLineKey: item.parentLineKey ?? null,
          displayOrder: item.displayOrder,
        },
      })
    );

    return prisma.$transaction(operations);
  }

  /**
   * Delete specific line items by key.
   */
  async deleteLineItems(statementId: string, lineKeys: string[]) {
    return prisma.financialLineItem.deleteMany({
      where: {
        statementId,
        lineKey: { in: lineKeys },
      },
    });
  }

  // ==========================================================================
  // Balance Sheet Validation
  // ==========================================================================

  /**
   * Validate that the balance sheet balances:
   * total_assets == total_liabilities + total_equity
   */
  async validateBalanceSheet(statementId: string) {
    const lineItems = await prisma.financialLineItem.findMany({
      where: { statementId },
    });

    const amountMap: Record<string, number> = {};
    for (const item of lineItems) {
      amountMap[item.lineKey] = Number(item.amount);
    }

    const totalAssets = amountMap['total_assets'] ?? 0;
    const totalLiabilities = amountMap['total_liabilities'] ?? 0;
    const totalEquity = amountMap['total_equity'] ?? 0;

    const difference = totalAssets - (totalLiabilities + totalEquity);
    const balanced = Math.abs(difference) < 0.01; // tolerance for decimal rounding

    return {
      balanced,
      totalAssets,
      totalLiabilities,
      totalEquity,
      difference: Math.round(difference * 100) / 100,
    };
  }

  // ==========================================================================
  // Maker-Checker Workflow
  // ==========================================================================

  /**
   * Submit a DRAFT statement for review → REVIEWED.
   * Requires enteredById !== actorId OR admin bypass.
   */
  async submitForReview(statementId: string, actorId: string, isAdmin: boolean = false) {
    const statement = await prisma.financialStatement.findFirst({
      where: { id: statementId, deletedAt: null },
    });

    if (!statement) {
      throw new Error('Financial statement not found');
    }

    if (statement.status !== 'DRAFT') {
      throw new Error('Only DRAFT statements can be submitted for review');
    }

    // Maker-checker: the person who entered it cannot review it, unless admin bypass
    if (statement.enteredById === actorId && !isAdmin) {
      throw new Error('The person who entered the statement cannot submit it for review without admin bypass');
    }

    return prisma.financialStatement.update({
      where: { id: statementId },
      data: { status: 'REVIEWED' },
      include: {
        enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Review a REVIEWED statement → APPROVED (with auto-compute of ratios).
   * The reviewer must be different from the person who entered the data.
   */
  async reviewStatement(statementId: string, reviewedById: string, action: 'approve' | 'reject', isAdmin: boolean = false) {
    const statement = await prisma.financialStatement.findFirst({
      where: { id: statementId, deletedAt: null },
    });

    if (!statement) {
      throw new Error('Financial statement not found');
    }

    if (statement.status !== 'REVIEWED') {
      throw new Error('Only REVIEWED statements can be approved/rejected');
    }

    // Maker-checker: reviewer must be different from enterer (admin bypass allowed)
    if (statement.enteredById === reviewedById && !isAdmin) {
      throw new Error('The reviewer must be different from the person who entered the statement');
    }

    if (action === 'approve') {
      const updated = await prisma.financialStatement.update({
        where: { id: statementId },
        data: {
          status: 'APPROVED',
          reviewedById,
        },
        include: {
          enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // Auto-compute ratios when approved
      await this.computeRatios(statementId);

      return updated;
    } else {
      // Reject → back to DRAFT
      return prisma.financialStatement.update({
        where: { id: statementId },
        data: {
          status: 'DRAFT',
        },
        include: {
          enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    }
  }

  // ==========================================================================
  // Ratio Computation
  // ==========================================================================

  /**
   * Compute financial ratios from line items.
   * Called automatically when status transitions to APPROVED.
   * If any required lineKey is missing, that ratio is skipped (no error).
   */
  async computeRatios(statementId: string) {
    const lineItems = await prisma.financialLineItem.findMany({
      where: { statementId },
    });

    // Build a map of lineKey → numeric amount
    const vals: Record<string, number> = {};
    for (const item of lineItems) {
      vals[item.lineKey] = Number(item.amount);
    }

    const computed: {
      ratioKey: string;
      ratioLabel: string;
      value: Prisma.Decimal;
      category: string;
    }[] = [];

    for (const def of RATIO_DEFINITIONS) {
      // Check if all required keys are present
      const allPresent = def.requiredKeys.every((key) => key in vals);
      if (!allPresent) {
        continue; // skip this ratio
      }

      const result = def.compute(vals);
      if (result === null || !isFinite(result)) {
        continue; // skip if division by zero or invalid
      }

      computed.push({
        ratioKey: def.key,
        ratioLabel: def.label,
        value: new Prisma.Decimal(Math.round(result * 10000) / 10000),
        category: def.category,
      });
    }

    // Delete existing ratios and re-insert
    await prisma.$transaction(async (tx) => {
      await tx.financialRatio.deleteMany({
        where: { statementId },
      });

      if (computed.length > 0) {
        await tx.financialRatio.createMany({
          data: computed.map((r) => ({
            statementId,
            ratioKey: r.ratioKey,
            ratioLabel: r.ratioLabel,
            value: r.value,
            category: r.category as any,
          })),
        });
      }
    });

    return computed;
  }

  /**
   * List ratios for a statement with optional filtering.
   */
  async listRatios(statementId: string, filters?: { category?: string; ratioKey?: string }) {
    const where: Prisma.FinancialRatioWhereInput = {
      statementId,
    };

    if (filters?.category) {
      where.category = filters.category as any;
    }
    if (filters?.ratioKey) {
      where.ratioKey = filters.ratioKey;
    }

    return prisma.financialRatio.findMany({
      where,
      orderBy: { category: 'asc' },
    });
  }

  // ==========================================================================
  // Trend Analysis
  // ==========================================================================

  /**
   * Analyze trends in financial ratios across statements over time.
   */
  async getTrendAnalysis(
    borrowerProfileId: string,
    ratioKey?: string,
    category?: string,
  ) {
    // Get all approved/reviewed statements for this borrower, ordered by fiscal year
    const statements = await prisma.financialStatement.findMany({
      where: {
        borrowerProfileId,
        deletedAt: null,
        status: { in: ['APPROVED', 'REVIEWED'] },
      },
      orderBy: { fiscalYearEnd: 'asc' },
      select: {
        id: true,
        fiscalYearEnd: true,
        statementType: true,
        ratios: {
          where: {
            ...(ratioKey ? { ratioKey } : {}),
            ...(category ? { category: category as any } : {}),
          },
          orderBy: { ratioKey: 'asc' },
        },
      },
    });

    // Group ratios by ratioKey across time
    const trendMap: Record<string, {
      ratioKey: string;
      ratioLabel: string;
      category: string;
      dataPoints: { statementId: string; fiscalYearEnd: Date; value: number }[];
      direction: 'improving' | 'stable' | 'declining';
    }> = {};

    for (const stmt of statements) {
      for (const ratio of stmt.ratios) {
        if (!trendMap[ratio.ratioKey]) {
          trendMap[ratio.ratioKey] = {
            ratioKey: ratio.ratioKey,
            ratioLabel: ratio.ratioLabel,
            category: ratio.category,
            dataPoints: [],
            direction: 'stable',
          };
        }
        trendMap[ratio.ratioKey].dataPoints.push({
          statementId: stmt.id,
          fiscalYearEnd: stmt.fiscalYearEnd,
          value: Number(ratio.value),
        });
      }
    }

    // Determine direction for each ratio trend
    for (const key of Object.keys(trendMap)) {
      const points = trendMap[key].dataPoints;
      if (points.length >= 2) {
        const latest = points[points.length - 1].value;
        const previous = points[points.length - 2].value;
        const change = latest - previous;
        const pctChange = previous !== 0 ? Math.abs(change / previous) : 0;

        if (pctChange < 0.05) {
          // Less than 5% change = stable
          trendMap[key].direction = 'stable';
        } else {
          // Determine if improving or declining based on category
          // For leverage ratios, decreasing is improving; for others, increasing is improving
          const leverageKeys = ['debt_to_equity', 'debt_to_assets'];
          if (leverageKeys.includes(key)) {
            trendMap[key].direction = change < 0 ? 'improving' : 'declining';
          } else {
            trendMap[key].direction = change > 0 ? 'improving' : 'declining';
          }
        }
      }
    }

    return {
      borrowerProfileId,
      statements: statements.length,
      trends: Object.values(trendMap),
    };
  }

  // ==========================================================================
  // Exposure Aggregation
  // ==========================================================================

  /**
   * Get total exposure for a borrower by summing all ACTIVE/DISBURSED facility amounts.
   */
  async getExposure(borrowerProfileId: string) {
    // Find all applications for this borrower that are in ACTIVE or DISBURSED state
    const applications = await prisma.creditApplication.findMany({
      where: {
        borrowerProfileId,
        state: { in: ['ACTIVE', 'DISBURSED'] },
        deletedAt: null,
      },
      include: {
        facilities: {
          select: {
            id: true,
            facilityType: true,
            amount: true,
            approvedAmount: true,
          },
        },
      },
    });

    let totalExposure = new Prisma.Decimal(0);
    const facilities: {
      applicationId: string;
      facilityType: string;
      amount: number;
      approvedAmount: number | null;
      currency: string;
    }[] = [];

    for (const app of applications) {
      for (const fac of app.facilities) {
        const effectiveAmount = fac.approvedAmount ?? fac.amount;
        totalExposure = totalExposure.add(effectiveAmount);
        facilities.push({
          applicationId: app.id,
          facilityType: fac.facilityType,
          amount: Number(fac.amount),
          approvedAmount: fac.approvedAmount ? Number(fac.approvedAmount) : null,
          currency: app.currency,
        });
      }
    }

    // Get borrower's exposure limit
    const borrower = await prisma.borrowerProfile.findUnique({
      where: { id: borrowerProfileId },
      select: { exposureLimit: true, totalExposure: true },
    });

    const exposureLimit = borrower?.exposureLimit
      ? Number(borrower.exposureLimit)
      : null;

    return {
      totalExposure: Number(totalExposure),
      facilities,
      limits: {
        exposureLimit,
        utilizationPct:
          exposureLimit && exposureLimit > 0
            ? Math.round((Number(totalExposure) / exposureLimit) * 10000) / 100
            : null,
      },
    };
  }
}

export const financialService = new FinancialService();