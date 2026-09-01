import crypto from 'crypto';
import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { policyLimitService } from './policyLimit.service';
import { validateSubmissionReadiness } from './submissionReadiness.service';
import { deviationService } from './deviation.service';
import { isBureauCheckFresh } from './bureauCheck.service';
import { getPolicySetVersion } from './policySet.service';
import { registerTransitionHook, type TransitionHookContext } from './transitionHooks';
import {
  normalisePolicyLimits,
  normaliseReadiness,
  normaliseDeviations,
  normaliseBureauFreshness,
  normaliseMissingInputs,
  summarisePolicyResults,
  type PolicyResultEntry,
  type PolicyResultSource,
  type PolicyResultSummary,
} from './policyResult';

/** CA-P3-008 — thin façade over the existing policy evaluators. */
export const POLICY_EVALUATION_ACTIONS = [
  'submit_to_committee',
  'resume_committee',
  'approve',
  'reject',
] as const;

export interface PolicyEvaluation {
  entries: PolicyResultEntry[];
  summary: PolicyResultSummary;
}

async function collect(source: PolicyResultSource, run: () => Promise<PolicyResultEntry[]>): Promise<PolicyResultEntry[]> {
  try {
    return await run();
  } catch (err: any) {
    const message = err?.message ?? String(err);
    logger.error({ code: 'POLICY_EVALUATION_SOURCE_FAILED', source, detail: message });
    return [{
      ruleCode: `${source}.EVALUATION_ERROR`,
      verdict: 'FAIL',
      actual: null,
      threshold: null,
      message: `Policy evaluation failed for ${source}: ${message}`,
      source,
    }];
  }
}

export async function evaluatePolicy(applicationId: string): Promise<PolicyEvaluation> {
  const groups = await Promise.all([
    collect('POLICY_LIMIT', async () => normalisePolicyLimits(await policyLimitService.evaluatePolicy(applicationId))),
    collect('READINESS', async () => normaliseReadiness(await validateSubmissionReadiness(applicationId, { stage: 'committee' }))),
    collect('DEVIATION', async () => normaliseDeviations(await deviationService.checkApplicationDeviations(applicationId))),
    collect('BUREAU', async () => normaliseBureauFreshness(await isBureauCheckFresh(applicationId))),
    collect('MISSING_DATA', async () => {
      const run = await prisma.creditScoreRun.findFirst({
        where: { applicationId },
        orderBy: { runAt: 'desc' },
        select: { missingInputs: true },
      });
      return normaliseMissingInputs(run?.missingInputs);
    }),
  ]);
  const entries = groups.flat();
  return { entries, summary: summarisePolicyResults(entries) };
}

export interface PersistOutcome {
  skipped: boolean;
  evaluationId: string | null;
  written: number;
  summary: PolicyResultSummary | null;
}

export async function persistPolicyEvaluation(ctx: TransitionHookContext): Promise<PersistOutcome> {
  if (!(POLICY_EVALUATION_ACTIONS as readonly string[]).includes(ctx.action)) {
    return { skipped: true, evaluationId: null, written: 0, summary: null };
  }

  const { entries, summary } = await evaluatePolicy(ctx.applicationId);
  if (entries.length === 0) return { skipped: true, evaluationId: null, written: 0, summary };

  const evaluationId = crypto.randomUUID();
  let policySetVersion: string | null = null;
  try {
    policySetVersion = await getPolicySetVersion();
  } catch {
    policySetVersion = null;
  }
  const evaluatedAt = new Date();
  const { count } = await prisma.policyResult.createMany({
    data: entries.map((entry) => ({
      applicationId: ctx.applicationId,
      evaluationId,
      ruleCode: entry.ruleCode,
      verdict: entry.verdict,
      source: entry.source,
      actual: entry.actual,
      threshold: entry.threshold,
      message: entry.message,
      triggerAction: ctx.action,
      evaluatedAt,
      evaluatedById: ctx.actorId,
      policySetVersion,
    })),
  });
  return { skipped: false, evaluationId, written: count, summary };
}

export async function getPolicyEvaluations(applicationId: string) {
  const rows = await prisma.policyResult.findMany({
    where: { applicationId },
    orderBy: [{ evaluatedAt: 'desc' }, { ruleCode: 'asc' }],
  });
  const byEvaluation = new Map<string, typeof rows>();
  for (const row of rows) byEvaluation.set(row.evaluationId, [...(byEvaluation.get(row.evaluationId) ?? []), row]);
  return [...byEvaluation.entries()].map(([evaluationId, group]) => ({
    evaluationId,
    evaluatedAt: group[0].evaluatedAt,
    triggerAction: group[0].triggerAction,
    summary: summarisePolicyResults(group as unknown as PolicyResultEntry[]),
  }));
}

export async function getPolicyEvaluation(applicationId: string, evaluationId: string) {
  const rows = await prisma.policyResult.findMany({
    where: { applicationId, evaluationId },
    orderBy: [{ verdict: 'asc' }, { ruleCode: 'asc' }],
  });
  if (rows.length === 0) return null;
  return {
    evaluationId,
    evaluatedAt: rows[0].evaluatedAt,
    triggerAction: rows[0].triggerAction,
    policySetVersion: rows[0].policySetVersion,
    summary: summarisePolicyResults(rows as unknown as PolicyResultEntry[]),
    results: rows,
  };
}

export function registerPolicyEngineHook(): void {
  registerTransitionHook({
    name: 'policy-evaluation',
    actions: POLICY_EVALUATION_ACTIONS,
    run: async (ctx) => { await persistPolicyEvaluation(ctx); },
  });
}
