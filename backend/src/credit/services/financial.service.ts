import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { formatCurrency } from '../utils/formatCurrency';
import { computeBorrowerExposure, EXPOSURE_STATES } from './exposureCompute.service';
import { getTemplateForType } from '../constants/financialStatementTemplates';
import { recalcScore } from './recalc.service';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// LOS-006 — Statement immutability guard
// ---------------------------------------------------------------------------

/**
 * Statuses in which a financial statement's figures may still change.
 * Once REVIEWED/APPROVED the statement is decision evidence: the score, memo and
 * approval pack all reference it, so amendments must create a new statement
 * version rather than mutating the reviewed one.
 */
export const MUTABLE_STATEMENT_STATUSES: string[] = ['DRAFT'];

export function assertStatementMutable(status: string, action: string): void {
  if (!MUTABLE_STATEMENT_STATUSES.includes(status)) {
    throw new AppError(
      `Cannot ${action} — the financial statement is ${status}. ` +
      `Approved figures are decision evidence; create a new statement to record an amendment.`,
      400,
    );
  }
}

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
  // LOS-006 — status and reviewedById removed from generic PATCH;
  // use POST /financials/:id/review (credit:approve) instead.
  // CA Memo Phase 3 — Section 12
  auditorName?: string | null;
  isQualified?: boolean | null;
  qualificationNotes?: string | null;
  isDraftAccounts?: boolean;
  commentarySalesProfitability?: string | null;
  commentaryAssetMgmt?: string | null;
  commentaryDebtMgmt?: string | null;
  commentaryCashflow?: string | null;
  commentaryConclusion?: string | null;
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
    label: 'Return on Sales (Net Margin)',
    category: 'PROFITABILITY',
    requiredKeys: ['net_income', 'revenue'],
    compute: (v) => v.revenue !== 0 ? v.net_income / v.revenue : null,
  },
  {
    key: 'gross_margin',
    label: 'Gross Margin',
    category: 'PROFITABILITY',
    requiredKeys: ['revenue', 'cogs'],
    compute: (v) => v.revenue !== 0 ? (v.revenue - v.cogs) / v.revenue : null,
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
    key: 'gearing_ratio',
    label: 'Gearing Ratio',
    category: 'LEVERAGE',
    requiredKeys: ['total_debt', 'total_equity'],
    compute: (v) => (v.total_debt + v.total_equity) !== 0 ? v.total_debt / (v.total_debt + v.total_equity) : null,
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
    key: 'ebitda_interest_cover',
    label: 'EBITDA Interest Cover',
    category: 'COVERAGE',
    requiredKeys: ['net_income', 'depreciation', 'interest'],
    compute: (v) => v.interest !== 0 ? (v.net_income + v.depreciation + v.interest) / v.interest : null,
  },
  {
    key: 'interest_coverage',
    label: 'Interest Coverage (EBIT)',
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
    key: 'inventory_days',
    label: 'Inventory Days',
    category: 'ACTIVITY',
    requiredKeys: ['inventory', 'cogs'],
    compute: (v) => v.cogs !== 0 ? (v.inventory / v.cogs) * 365 : null,
  },
  {
    key: 'receivables_days',
    label: 'Receivables Days',
    category: 'ACTIVITY',
    requiredKeys: ['accounts_receivable', 'revenue'],
    compute: (v) => v.revenue !== 0 ? (v.accounts_receivable / v.revenue) * 365 : null,
  },
  {
    key: 'payables_days',
    label: 'Payables Days',
    category: 'ACTIVITY',
    requiredKeys: ['accounts_payable', 'cogs'],
    compute: (v) => v.cogs !== 0 ? (v.accounts_payable / v.cogs) * 365 : null,
  },
];

// ---------------------------------------------------------------------------
// §1.4 — Threshold definitions for ratio badges
// ---------------------------------------------------------------------------

export interface RatioThreshold {
  ratioKey: string;
  passMax?: number;    // value <= passMax → PASS (for ratios where lower is better)
  passMin?: number;    // value >= passMin → PASS (for ratios where higher is better)
  warnMin?: number;    // warnMin <= value < passMin → WARN
  warnMax?: number;    // passMax < value <= warnMax → WARN
  unit: 'x' | '%' | 'days';  // display unit
  formatHint: string;  // tooltip text for formula
}

export const RATIO_THRESHOLDS: RatioThreshold[] = [
  { ratioKey: 'dscr', passMin: 1.25, warnMin: 1.0, unit: 'x', formatHint: 'EBITDA / (Interest + Principal Repayments)' },
  { ratioKey: 'gearing_ratio', passMax: 0.60, warnMax: 0.80, unit: '%', formatHint: 'Total Debt / (Total Debt + Total Equity)' },
  { ratioKey: 'current_ratio', passMin: 1.5, warnMin: 1.0, unit: 'x', formatHint: 'Current Assets / Current Liabilities' },
  { ratioKey: 'gross_margin', passMin: 0.20, warnMin: 0.10, unit: '%', formatHint: 'Gross Profit / Revenue' },
  { ratioKey: 'quick_ratio', passMin: 1.0, warnMin: 0.5, unit: 'x', formatHint: '(Current Assets - Inventory) / Current Liabilities' },
  { ratioKey: 'debt_to_equity', passMax: 1.5, warnMax: 2.0, unit: 'x', formatHint: 'Total Debt / Total Equity' },
  { ratioKey: 'ros', passMin: 0.05, warnMin: 0.0, unit: '%', formatHint: 'Net Income / Revenue' },
  { ratioKey: 'roe', passMin: 0.10, warnMin: 0.05, unit: '%', formatHint: 'Net Income / Total Equity' },
];

export function evaluateRatioThreshold(ratioKey: string, value: number): 'pass' | 'warn' | 'fail' | 'neutral' {
  const t = RATIO_THRESHOLDS.find(r => r.ratioKey === ratioKey);
  if (!t) return 'neutral';

  // Ratios where higher is better (passMin/warnMin pattern)
  if (t.passMin !== undefined) {
    if (value >= t.passMin) return 'pass';
    if (t.warnMin !== undefined && value >= t.warnMin) return 'warn';
    return 'fail';
  }
  // Ratios where lower is better (passMax/warnMax pattern)
  if (t.passMax !== undefined) {
    if (value <= t.passMax) return 'pass';
    if (t.warnMax !== undefined && value <= t.warnMax) return 'warn';
    return 'fail';
  }
  return 'neutral';
}

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

    // F4 — auto-populate template rows for CORPORATE borrowers
    let borrowerType: string | null = null;
    try {
      const bp = await prisma.borrowerProfile.findUnique({
        where: { id: data.borrowerProfileId },
        select: { borrowerType: true },
      });
      borrowerType = bp?.borrowerType ?? null;
    } catch { /* ignore — template is best-effort */ }

    const templateRows = borrowerType === 'CORPORATE'
      ? getTemplateForType(data.statementType)
      : [];

    if (templateRows.length > 0) {
      createData.lineItems = {
        create: templateRows.map((row, idx) => ({
          lineKey: row.lineKey,
          lineLabel: row.lineLabel,
          amount: new Prisma.Decimal(0),
          parentLineKey: row.parentLineKey ?? null,
          displayOrder: idx,
        })),
      };
    }

    return prisma.financialStatement.create({
      data: createData,
      include: {
        enteredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        lineItems: templateRows.length > 0
          ? { orderBy: { displayOrder: 'asc' as const } }
          : false,
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
    // LOS-006 — status and reviewedById are no longer set via generic PATCH.
    // Use the review endpoint (POST /financials/:id/review) for governance transitions.
    if (data.auditorName !== undefined) updateData.auditorName = data.auditorName;
    if (data.isQualified !== undefined) updateData.isQualified = data.isQualified;
    if (data.qualificationNotes !== undefined) updateData.qualificationNotes = data.qualificationNotes;
    if (data.isDraftAccounts !== undefined) updateData.isDraftAccounts = data.isDraftAccounts;
    if (data.commentarySalesProfitability !== undefined) updateData.commentarySalesProfitability = data.commentarySalesProfitability;
    if (data.commentaryAssetMgmt !== undefined) updateData.commentaryAssetMgmt = data.commentaryAssetMgmt;
    if (data.commentaryDebtMgmt !== undefined) updateData.commentaryDebtMgmt = data.commentaryDebtMgmt;
    if (data.commentaryCashflow !== undefined) updateData.commentaryCashflow = data.commentaryCashflow;
    if (data.commentaryConclusion !== undefined) updateData.commentaryConclusion = data.commentaryConclusion;

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
    // LOS-006 — block line-item mutations on reviewed/approved statements
    const stmt = await prisma.financialStatement.findFirst({ where: { id: statementId, deletedAt: null } });
    if (stmt) assertStatementMutable(stmt.status, 'edit line items');

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

    const result = await prisma.$transaction(operations);

    // §1.4 — Auto-compute ratios after every line-item save
    await this.computeRatios(statementId);

    return result;
  }

  /**
   * Delete specific line items by key.
   */
  async deleteLineItems(statementId: string, lineKeys: string[]) {
    // LOS-006 — block line-item mutations on reviewed/approved statements
    const stmt = await prisma.financialStatement.findFirst({ where: { id: statementId, deletedAt: null } });
    if (stmt) assertStatementMutable(stmt.status, 'delete line items');

    return prisma.financialLineItem.deleteMany({
      where: {
        statementId,
        lineKey: { in: lineKeys },
      },
    });
  }

  /**
   * Add a single line item to an existing financial statement.
   * F4 — convenience method for the "Add Row" UI control.
   */
  async addLine(statementId: string, lineKey: string, lineLabel: string, parentLineKey?: string | null) {
    const stmt = await prisma.financialStatement.findFirst({
      where: { id: statementId, deletedAt: null },
    });
    if (!stmt) return null;

    // LOS-006 — block line-item mutations on reviewed/approved statements
    assertStatementMutable(stmt.status, 'add line items');

    // Find the current max displayOrder to append at the end
    const maxOrder = await prisma.financialLineItem.aggregate({
      where: { statementId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    return prisma.financialLineItem.create({
      data: {
        statementId,
        lineKey,
        lineLabel,
        amount: new Prisma.Decimal(0),
        parentLineKey: parentLineKey ?? null,
        displayOrder: nextOrder,
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
      amountMap[item.lineKey] = formatCurrency(item.amount) ?? 0;
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
  async reviewStatement(statementId: string, reviewedById: string, action: 'APPROVE' | 'REJECT', isAdmin: boolean = false) {
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

    if (action === 'APPROVE') {
      const updated = await prisma.$transaction(async (tx) => {
        const stmt = await tx.financialStatement.update({
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

        // Auto-compute ratios atomically within the same transaction
        await this.computeRatiosInTx(tx, statementId);

        return stmt;
      });

      // Phase 2 — event-driven recalc: financial statement approval changes
      // the ratios that drive scoring, so fire a recalc (fire-and-log).
      if (updated.borrowerProfileId) {
        const apps = await prisma.creditApplication.findMany({
          where: { borrowerProfileId: updated.borrowerProfileId },
          select: { id: true },
        });
        for (const app of apps) {
          recalcScore(app.id, 'financial_statement_approval', {
            sourceUpdatedAt: new Date(),
          }).catch(() => {});
        }
      }

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
      vals[item.lineKey] = formatCurrency(item.amount) ?? 0;
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

    // Upsert all computed ratios (using unique constraint statementId + ratioKey)
    await Promise.all(computed.map((r) =>
      prisma.financialRatio.upsert({
        where: {
          statementId_ratioKey: {
            statementId,
            ratioKey: r.ratioKey,
          },
        },
        update: {
          ratioLabel: r.ratioLabel,
          value: r.value,
          category: r.category as any,
        },
        create: {
          statementId,
          ratioKey: r.ratioKey,
          ratioLabel: r.ratioLabel,
          value: r.value,
          category: r.category as any,
        },
      })
    ));

    return computed;
  }

  /**
   * Compute and persist financial ratios within an existing Prisma transaction.
   * Used by reviewStatement's approve path to ensure atomicity.
   */
  private async computeRatiosInTx(
    tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    statementId: string,
  ): Promise<void> {
    const lineItems = await tx.financialLineItem.findMany({
      where: { statementId },
    });

    const vals: Record<string, number> = {};
    for (const item of lineItems) {
      vals[item.lineKey] = formatCurrency(item.amount) ?? 0;
    }

    const computed: {
      ratioKey: string;
      ratioLabel: string;
      value: Prisma.Decimal;
      category: string;
    }[] = [];

    for (const def of RATIO_DEFINITIONS) {
      const allPresent = def.requiredKeys.every((key) => key in vals);
      if (!allPresent) continue;

      const result = def.compute(vals);
      if (result === null || !isFinite(result)) continue;

      computed.push({
        ratioKey: def.key,
        ratioLabel: def.label,
        value: new Prisma.Decimal(Math.round(result * 10000) / 10000),
        category: def.category,
      });
    }

    // Upsert within transaction
    await Promise.all(computed.map((r) =>
      tx.financialRatio.upsert({
        where: {
          statementId_ratioKey: {
            statementId,
            ratioKey: r.ratioKey,
          },
        },
        update: {
          ratioLabel: r.ratioLabel,
          value: r.value,
          category: r.category as any,
        },
        create: {
          statementId,
          ratioKey: r.ratioKey,
          ratioLabel: r.ratioLabel,
          value: r.value,
          category: r.category as any,
        },
      })
    ));
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

    const ratios = await prisma.financialRatio.findMany({
      where,
      orderBy: { category: 'asc' },
    });

    // §1.4 — Enrich with threshold data
    return ratios.map(r => ({
      ...r,
      threshold: (RATIO_THRESHOLDS.find(t => t.ratioKey === r.ratioKey)) ?? null,
      badge: evaluateRatioThreshold(r.ratioKey, Number(r.value)),
    }));
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
          value: formatCurrency(ratio.value) ?? 0,
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
   * Get total exposure for a borrower by summing all facilities in
   * APPROVED/OFFER/ACCEPTED/DISBURSED/ACTIVE applications.
   * §F2 — Delegates total computation to computeBorrowerExposure so the
   * two views can never diverge.
   */
  async getExposure(borrowerProfileId: string) {
    // §F2 — Use canonical exposure computation for the total figure
    const { totalExposure: canonicalTotal } = await computeBorrowerExposure(borrowerProfileId);

    // Still fetch facility-level detail for the breakdown, using the same EXPOSURE_STATES
    const applications = await prisma.creditApplication.findMany({
      where: {
        borrowerProfileId,
        state: { in: EXPOSURE_STATES },
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

    const facilities: {
      applicationId: string;
      facilityType: string;
      amount: number;
      approvedAmount: number | null;
      currency: string;
    }[] = [];

    for (const app of applications) {
      for (const fac of app.facilities) {
        facilities.push({
          applicationId: app.id,
          facilityType: fac.facilityType,
          amount: formatCurrency(fac.amount) ?? 0,
          approvedAmount: formatCurrency(fac.approvedAmount),
          currency: app.currency,
        });
      }
    }

    // Get borrower's exposure limit
    const borrower = await prisma.borrowerProfile.findUnique({
      where: { id: borrowerProfileId },
      select: { exposureLimit: true },
    });

    const exposureLimit = borrower?.exposureLimit
      ? formatCurrency(borrower.exposureLimit)
      : null;

    return {
      totalExposure: canonicalTotal,
      facilities,
      limits: {
        exposureLimit,
        utilizationPct:
          exposureLimit && exposureLimit > 0
            ? Math.round((canonicalTotal / exposureLimit) * 10000) / 100
            : null,
      },
    };
  }
}

export const financialService = new FinancialService();