import prisma from '../../utils/prisma';
import { computePolicySetVersion, type PolicySetInput } from './policySetVersion';

const CACHE_TTL_MS = 30_000;
let cached: { version: string; at: number } | null = null;

/**
 * CA-P6-003 — gather the configuration currently in force and derive its version.
 * Parameters are active and time-effective; rule configs and limits are active.
 */
export async function gatherPolicySet(): Promise<PolicySetInput> {
  const now = new Date();
  const [parameters, ruleConfigs, limits] = await Promise.all([
    prisma.creditPolicyParameter.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      select: { key: true, value: true, productType: true, lane: true, borrowerType: true },
    }),
    prisma.creditRuleConfig.findMany({
      where: { isActive: true },
      select: {
        kind: true,
        documentClass: true,
        fieldPath: true,
        productType: true,
        lane: true,
        borrowerType: true,
      },
    }),
    prisma.creditPolicyLimit.findMany({
      where: { isActive: true },
      select: { type: true, maxValue: true, thresholdPct: true, sector: true, productType: true },
    }),
  ]);

  return {
    parameters: parameters.map((parameter) => ({
      key: parameter.key,
      value: parameter.value,
      productType: parameter.productType ?? null,
      lane: parameter.lane ?? null,
      borrowerType: parameter.borrowerType ?? null,
    })),
    ruleConfigs: ruleConfigs.map((rule) => ({
      kind: String(rule.kind),
      documentClass: rule.documentClass ? String(rule.documentClass) : null,
      fieldPath: rule.fieldPath ?? null,
      productType: rule.productType ?? null,
      lane: rule.lane ?? null,
      borrowerType: rule.borrowerType ?? null,
    })),
    limits: limits.map((limit) => ({
      type: String(limit.type),
      maxValue: String(limit.maxValue),
      thresholdPct: String(limit.thresholdPct),
      sector: limit.sector ?? null,
      productType: limit.productType ?? null,
    })),
  };
}

export async function getPolicySetVersion(): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.version;
  const version = computePolicySetVersion(await gatherPolicySet());
  cached = { version, at: Date.now() };
  return version;
}

export function clearPolicySetCache(): void {
  cached = null;
}
