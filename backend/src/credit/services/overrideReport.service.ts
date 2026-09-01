/** GAP-P1-02 / CA-P4-002 — override-rate reporting. */
import prisma from '../../utils/prisma';
import { TERMINAL_DECISION_TYPES, type OverrideDecisionType } from './decisionOverride';

export interface OverrideRateFilters {
  dateFrom?: Date; dateTo?: Date; approverId?: string;
  authorityLevel?: string; groupBy?: 'approver' | 'authority' | 'month';
}
export interface OverrideRateGroup {
  key: string; label: string; terminalDecisions: number; overrides: number;
  overrideRate: number; unlinked: number;
}
export interface OverrideRateResult {
  summary: { terminalDecisions: number; overrides: number; overrideRate: number; unlinked: number };
  groups: OverrideRateGroup[];
  decisions: {
    decisionId: string; applicationNo: string | null; decisionAt: string;
    approverName: string; authorityLevel: string | null;
    systemRecommendation: string | null; decisionType: string;
    isOverride: boolean; overrideReason: string | null; approvedAmount: number | null;
  }[];
}

const percentage = (numerator: number, denominator: number) =>
  denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
const nameOf = (user: { firstName?: string | null; lastName?: string | null } | null) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';

export const overrideReportService = {
  async getOverrideRate(filters: OverrideRateFilters = {}): Promise<OverrideRateResult> {
    const groupBy = filters.groupBy ?? 'approver';
    const where: Record<string, unknown> = {};
    if (filters.approverId) where.decisionById = filters.approverId;
    if (filters.authorityLevel) where.authorityLevel = filters.authorityLevel;
    if (filters.dateFrom || filters.dateTo) where.decisionAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
    const rows = await prisma.creditDecision.findMany({
      where,
      orderBy: { decisionAt: 'asc' },
      select: {
        id: true, decisionAt: true, decisionType: true, authorityLevel: true,
        systemRecommendation: true, isOverride: true, overrideReason: true,
        approvedAmount: true, decisionById: true,
        decidedBy: { select: { id: true, firstName: true, lastName: true } },
        application: { select: { applicationNo: true } },
      },
    });
    const buckets = new Map<string, OverrideRateGroup>();
    let terminalDecisions = 0; let overrides = 0; let unlinked = 0;
    for (const row of rows) {
      if (!TERMINAL_DECISION_TYPES.includes(row.decisionType as OverrideDecisionType)) continue;
      const key = groupBy === 'approver' ? row.decisionById
        : groupBy === 'authority' ? (row.authorityLevel ?? 'UNASSIGNED')
        : row.decisionAt.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? {
        key, label: groupBy === 'approver' ? nameOf(row.decidedBy) : key,
        terminalDecisions: 0, overrides: 0, overrideRate: 0, unlinked: 0,
      };
      if (row.systemRecommendation === null) { unlinked++; bucket.unlinked++; }
      else { terminalDecisions++; bucket.terminalDecisions++; if (row.isOverride) { overrides++; bucket.overrides++; } }
      buckets.set(key, bucket);
    }
    const groups = [...buckets.values()]
      .map((g) => ({ ...g, overrideRate: percentage(g.overrides, g.terminalDecisions) }))
      .sort((a, b) => a.key.localeCompare(b.key));
    return {
      summary: { terminalDecisions, overrides, overrideRate: percentage(overrides, terminalDecisions), unlinked },
      groups,
      decisions: rows.map((row) => ({
        decisionId: row.id, applicationNo: row.application?.applicationNo ?? null,
        decisionAt: row.decisionAt.toISOString(), approverName: nameOf(row.decidedBy),
        authorityLevel: row.authorityLevel, systemRecommendation: row.systemRecommendation,
        decisionType: row.decisionType, isOverride: row.isOverride, overrideReason: row.overrideReason,
        approvedAmount: row.approvedAmount === null ? null : Number(row.approvedAmount),
      })),
    };
  },
};
