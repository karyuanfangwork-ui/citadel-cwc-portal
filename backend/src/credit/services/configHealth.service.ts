import { logger } from '../../utils/logger';
import prisma from '../../utils/prisma';
import { RISK_FACTOR_KEYS } from './riskTaxonomy';

export interface ConfigHealthCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Read-only governance configuration health check; never blocks boot. */
export async function checkCreditConfigurationHealth(): Promise<ConfigHealthCheck[]> {
  const db = prisma as any;
  const checks: ConfigHealthCheck[] = [];
  const run = async (name: string, query: () => Promise<number>, detail: string) => {
    try {
      const count = await query();
      const check = { name, ok: count > 0, detail: count > 0 ? undefined : detail };
      checks.push(check);
      if (!check.ok) logger.error({ code: 'CREDIT_CONFIG_HEALTH_FAILED', check: name, detail });
    } catch (error) {
      const check = { name, ok: false, detail: `${detail} (${error instanceof Error ? error.message : 'query failed'})` };
      checks.push(check);
      logger.error({ code: 'CREDIT_CONFIG_HEALTH_FAILED', check: name, detail: check.detail });
    }
  };

  await run('required-document-rules', () => db.creditRuleConfig.count({ where: { kind: 'REQUIRED_DOCUMENT', isActive: true } }), 'No active required-document rules');
  await run('required-field-rules', () => db.creditRuleConfig.count({ where: { kind: 'REQUIRED_FIELD', isActive: true } }), 'No active required-field rules');
  await run('policy-parameters', () => db.creditPolicyParameter.count({ where: { isActive: true } }), 'No active policy parameters');
  await run('rating-bands', () => db.ratingBandConfig.count({ where: { status: 'ACTIVE' } }), 'No active rating bands');
  await run(
    'risk-factor-taxonomy',
    async () => (await db.riskFactorMatrix.count({
      where: { isActive: true, factor: { in: [...RISK_FACTOR_KEYS] } },
    })) as number,
    'No active risk factor weights match the canonical taxonomy — the engine is running on hardcoded DEFAULT_WEIGHTS',
  );
  await run('published-scorecard-version', () => db.creditScorecardVersion.count({ where: { isActive: true, scorecard: { isActive: true } } }), 'No active scorecard version');
  return checks;
}
