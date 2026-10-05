import { logger } from '../../utils/logger';
import prisma from '../../utils/prisma';
import { LEGACY_ENGINE_FACTORS } from './riskTaxonomy';
import { ratingBandService } from './ratingBand.service';

export type ConfigHealthSeverity = 'BLOCKING' | 'WARNING' | 'INFO';
export type ConfigHealthStatus = 'READY' | 'BLOCKED' | 'WARNING' | 'INFO';

export interface ConfigHealthCheck {
  name: string;
  ok: boolean;
  status: ConfigHealthStatus;
  severity: ConfigHealthSeverity;
  observed?: number;
  detail?: string;
  remediation?: string;
}

export interface CreditConfigurationReadiness {
  ready: boolean;
  checks: ConfigHealthCheck[];
}

/** Read-only governance configuration health check; never blocks boot. */
export async function checkCreditConfigurationHealth(): Promise<CreditConfigurationReadiness> {
  const db = prisma as any;
  const checks: ConfigHealthCheck[] = [];
  const add = (
    name: string,
    observed: number,
    severity: ConfigHealthSeverity,
    detail: string | undefined,
    remediation?: string,
  ) => {
    const ok = detail === undefined;
    const status: ConfigHealthStatus = severity === 'INFO'
      ? 'INFO'
      : detail
        ? severity === 'BLOCKING' ? 'BLOCKED' : severity
        : 'READY';
    const check: ConfigHealthCheck = {
      name,
      ok,
      status,
      severity,
      observed,
      ...(detail ? { detail } : {}),
      ...(remediation ? { remediation } : {}),
    };
    checks.push(check);
    if (detail && severity === 'BLOCKING') {
      logger.error({ code: 'CREDIT_CONFIG_HEALTH_FAILED', check: name, severity, observed, detail, remediation });
    } else if (detail && severity === 'WARNING') {
      logger.warn({ code: 'CREDIT_CONFIG_HEALTH_WARNING', check: name, severity, observed, detail, remediation });
    }
  };

  const runCount = async (
    name: string,
    query: () => Promise<number>,
    severity: ConfigHealthSeverity,
    emptyDetail: string,
    remediation: string,
  ) => {
    try {
      const count = await query();
      add(name, count, severity, count > 0 ? undefined : emptyDetail, remediation);
    } catch (error) {
      add(name, 0, severity, `${emptyDetail} (${error instanceof Error ? error.message : 'query failed'})`, remediation);
    }
  };

  const runInfoCount = async (name: string, query: () => Promise<number>, message: string) => {
    try {
      const count = await query();
      add(name, count, 'INFO', count > 0 ? message : undefined);
    } catch (error) {
      add(name, 0, 'INFO', `${message} State inventory unavailable (${error instanceof Error ? error.message : 'query failed'}).`);
    }
  };

  await Promise.all([
    runCount(
      'required-document-rules',
      () => db.creditRuleConfig.count({ where: { kind: 'REQUIRED_DOCUMENT', isActive: true } }),
      'WARNING',
      'No active required-document rules; built-in defaults may be used.',
      'Review and govern required-document rules for the intended product scopes.',
    ),
    runCount(
      'required-field-rules',
      () => db.creditRuleConfig.count({ where: { kind: 'REQUIRED_FIELD', isActive: true } }),
      'WARNING',
      'No active required-field rules; built-in defaults are being used.',
      'Review and activate a complete, approved required-field rule set.',
    ),
    runCount(
      'policy-parameters',
      () => db.creditPolicyParameter.count({ where: { isActive: true } }),
      'WARNING',
      'No active credit policy parameters.',
      'Review required policy parameters and their effective dates.',
    ),
  ]);

  await Promise.all([
    runInfoCount(
      'inactive-required-field-drafts',
      () => db.creditRuleConfig.count({ where: { kind: 'REQUIRED_FIELD', isActive: false } }),
      'Inactive required-field records exist; these are not used by validation.',
    ),
    runInfoCount(
      'draft-rating-bands',
      () => db.ratingBandConfig.count({ where: { status: 'DRAFT' } }),
      'Draft rating-band rows exist; they do not affect scoring.',
    ),
    runInfoCount(
      'inactive-scorecard-versions',
      () => db.creditScorecardVersion.count({ where: { isActive: false } }),
      'Inactive scorecard versions exist; they do not affect scoring.',
    ),
  ]);

  try {
    const now = new Date();
    const activeBands = await db.ratingBandConfig.findMany({
      where: {
        status: 'ACTIVE',
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      select: { scoreMin: true, scoreMax: true, rating: true, riskCategory: true },
    });
    if (activeBands.length === 0) {
      add(
        'rating-bands',
        0,
        'BLOCKING',
        'No effective ACTIVE rating bands; production scoring fails closed.',
        'Review a complete band set and activate it through the governed lifecycle.',
      );
    } else {
      const validation = ratingBandService.validateBandSet(activeBands);
      const errors = validation.errors;
      add(
        'rating-bands',
        activeBands.length,
        'BLOCKING',
        errors.length > 0 ? `The effective ACTIVE rating-band set is invalid: ${errors.join('; ')}` : undefined,
        errors.length > 0 ? 'Correct the draft and re-run band-set validation before approval or activation.' : undefined,
      );
    }
  } catch (error) {
    add(
      'rating-bands',
      0,
      'BLOCKING',
      `Unable to verify active rating bands (${error instanceof Error ? error.message : 'query failed'}).`,
      'Check database access and credit configuration state; do not enable static production fallback.',
    );
  }

  try {
    const now = new Date();
    const activeVersions = await db.creditScorecardVersion.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        scorecard: { isActive: true },
      },
      select: { scorecardId: true },
    });
    const distinctScorecards = new Set(activeVersions.map((version: { scorecardId: string }) => version.scorecardId));
    let detail: string | undefined;
    if (distinctScorecards.size === 0) {
      detail = 'No effective active scorecard version; production scoring cannot run.';
    } else if (distinctScorecards.size > 1) {
      detail = 'Multiple scorecards have effective active versions; application scoring can reject the selection as ambiguous.';
    }
    add(
      'scorecard-version',
      activeVersions.length,
      'BLOCKING',
      detail,
      detail ? 'Approve and activate one unambiguous scorecard methodology for each supported product scope.' : undefined,
    );
    if (distinctScorecards.size === 1 && activeVersions.length > 1) {
      add(
        'scorecard-version-duplicates',
        activeVersions.length,
        'WARNING',
        'More than one version of the same scorecard is active; scoring selects the highest version.',
        'Deactivate superseded versions through the scorecard lifecycle.',
      );
    }
  } catch (error) {
    add(
      'scorecard-version',
      0,
      'BLOCKING',
      `Unable to verify active scorecard versions (${error instanceof Error ? error.message : 'query failed'}).`,
      'Check database access and scorecard configuration.',
    );
  }

  await runCount(
    'legacy-risk-factor-taxonomy',
    async () => db.riskFactorMatrix.count({
      where: { isActive: true, factor: { in: [...LEGACY_ENGINE_FACTORS] } },
    }),
    'WARNING',
    'No active legacy risk-factor weights; this legacy borrower-risk engine uses hardcoded defaults and is not wired to application scoring.',
    'Confirm the legacy engine disposition; do not create active weights solely to clear this warning.',
  );

  return {
    ready: !checks.some((check) => check.severity === 'BLOCKING' && !check.ok),
    checks,
  };
}
