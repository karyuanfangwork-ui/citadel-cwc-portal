/**
 * CA-P3-008 / GAP-P1-10 — one verdict shape for four evaluators that each
 * return their own.
 *
 * Pure: no Prisma, no service imports. Every mapping row in the plan's verdict
 * table is covered here without mocking anything.
 */

export type PolicyVerdictName = 'PASS' | 'WARN' | 'FAIL';

export type PolicyResultSource =
  | 'POLICY_LIMIT'
  | 'READINESS'
  | 'DEVIATION'
  | 'BUREAU'
  | 'MISSING_DATA';

export interface PolicyResultEntry {
  ruleCode: string;
  verdict: PolicyVerdictName;
  actual: string | null;
  threshold: string | null;
  message: string;
  source: PolicyResultSource;
}

interface PolicyBlockLike {
  limitId: string;
  limitType: string;
  severity: 'HARD' | 'SOFT';
  thresholdValue: number;
  proposedValue: number;
  message: string;
}

export function normalisePolicyLimits(result: { blocks: PolicyBlockLike[]; warnings: PolicyBlockLike[] }): PolicyResultEntry[] {
  const toEntry = (block: PolicyBlockLike, forceWarn: boolean): PolicyResultEntry => ({
    ruleCode: `LIMIT.${block.limitType}.${block.limitId}`,
    verdict: forceWarn || block.severity === 'SOFT' ? 'WARN' : 'FAIL',
    actual: String(block.proposedValue),
    threshold: String(block.thresholdValue),
    message: block.message,
    source: 'POLICY_LIMIT',
  });

  return [...result.blocks.map((block) => toEntry(block, false)), ...result.warnings.map((block) => toEntry(block, true))];
}

interface ReadinessIssueLike {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function normaliseReadiness(result: {
  errors: ReadinessIssueLike[];
  warnings: ReadinessIssueLike[];
  satisfied?: ReadinessIssueLike[];
}): PolicyResultEntry[] {
  const toEntry = (issue: ReadinessIssueLike, verdict: PolicyVerdictName): PolicyResultEntry => ({
    ruleCode: `READINESS.${issue.field}`,
    verdict,
    actual: null,
    threshold: null,
    message: issue.message,
    source: 'READINESS',
  });

  return [
    ...result.errors.map((issue) => toEntry(issue, 'FAIL')),
    ...result.warnings.map((issue) => toEntry(issue, 'WARN')),
    ...(result.satisfied ?? []).map((issue) => toEntry(issue, 'PASS')),
  ];
}

export function normaliseDeviations(result: {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  total: number;
}): PolicyResultEntry[] {
  const pending = result.pendingCount;
  return [{
    ruleCode: 'DEVIATION.PENDING',
    verdict: pending > 0 ? 'FAIL' : 'PASS',
    actual: String(pending),
    threshold: '0',
    message: pending > 0
      ? `${pending} deviation(s) awaiting approval. ${result.approvedCount} approved, ${result.rejectedCount} rejected.`
      : `No deviations awaiting approval (${result.approvedCount} approved, ${result.rejectedCount} rejected).`,
    source: 'DEVIATION',
  }];
}

export function normaliseBureauFreshness(result: { fresh: boolean; staleProviders: string[] }): PolicyResultEntry[] {
  return [{
    ruleCode: 'BUREAU.FRESHNESS',
    verdict: result.fresh ? 'PASS' : 'WARN',
    actual: result.staleProviders.length > 0 ? result.staleProviders.join(', ') : null,
    threshold: null,
    message: result.fresh
      ? 'All bureau reports are within the configured freshness window.'
      : `Stale bureau reports: ${result.staleProviders.join(', ')}.`,
    source: 'BUREAU',
  }];
}

const MISSING_DATA_VERDICTS: Record<string, PolicyVerdictName> = { BLOCK: 'FAIL', PENALTY: 'WARN', NEUTRAL: 'PASS' };

export function normaliseMissingInputs(records: unknown): PolicyResultEntry[] {
  if (!Array.isArray(records)) return [];
  const entries: PolicyResultEntry[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const factor = typeof record.factor === 'string' ? record.factor : null;
    const subField = typeof record.subField === 'string' ? record.subField : null;
    const policy = typeof record.policy === 'string' ? record.policy : null;
    if (!factor || !subField || !policy || !MISSING_DATA_VERDICTS[policy]) continue;
    entries.push({
      ruleCode: `MISSING_DATA.${factor}.${subField}`,
      verdict: MISSING_DATA_VERDICTS[policy],
      actual: 'missing',
      threshold: null,
      message: `${factor}.${subField} is missing; ${policy} policy applied.`,
      source: 'MISSING_DATA',
    });
  }
  return entries;
}

export interface PolicyResultSummary {
  total: number;
  passed: number;
  warned: number;
  failed: number;
  overall: PolicyVerdictName;
}

export function summarisePolicyResults(entries: PolicyResultEntry[]): PolicyResultSummary {
  const passed = entries.filter((entry) => entry.verdict === 'PASS').length;
  const warned = entries.filter((entry) => entry.verdict === 'WARN').length;
  const failed = entries.filter((entry) => entry.verdict === 'FAIL').length;
  return { total: entries.length, passed, warned, failed, overall: failed > 0 ? 'FAIL' : warned > 0 ? 'WARN' : 'PASS' };
}
