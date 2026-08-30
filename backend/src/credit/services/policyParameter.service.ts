import prisma from '../../utils/prisma';
import { logger } from '../../utils/logger';

export interface PolicyScope {
  productType?: string | null;
  lane?: string | null;
  borrowerType?: string | null;
}

type PolicyRow = {
  key: string;
  value: unknown;
  productType: string | null;
  lane: string | null;
  borrowerType: string | null;
  effectiveFrom: Date;
};

function shouldFallback(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return Boolean(
    err?.code === 'P2021' ||
      err?.code === 'P2022' ||
      err?.code === '22P02' ||
      err?.message?.includes('does not exist') ||
      err?.message?.includes('invalid input value'),
  );
}

function matchesDimension(rowValue: string | null, scopeValue?: string | null): boolean {
  return rowValue === null || rowValue === (scopeValue ?? null);
}

function specificity(row: PolicyRow, scope?: PolicyScope): number {
  let score = 0;
  if (row.productType !== null && row.productType === (scope?.productType ?? null)) score += 1;
  if (row.lane !== null && row.lane === (scope?.lane ?? null)) score += 1;
  if (row.borrowerType !== null && row.borrowerType === (scope?.borrowerType ?? null)) score += 1;
  return score;
}

function selectBestRow(rows: PolicyRow[], scope?: PolicyScope): PolicyRow | null {
  const matching = rows.filter((row) =>
    matchesDimension(row.productType, scope?.productType) &&
    matchesDimension(row.lane, scope?.lane) &&
    matchesDimension(row.borrowerType, scope?.borrowerType),
  );

  if (matching.length === 0) return null;

  return matching.sort((a, b) => {
    const specificityDiff = specificity(b, scope) - specificity(a, scope);
    if (specificityDiff !== 0) return specificityDiff;
    return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
  })[0];
}

async function fetchPolicyRows(key: string): Promise<PolicyRow[]> {
  const now = new Date();
  const db = prisma as any;

  if (!db.creditPolicyParameter?.findMany) {
    return [];
  }

  return db.creditPolicyParameter.findMany({
    where: {
      key,
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    select: {
      key: true,
      value: true,
      productType: true,
      lane: true,
      borrowerType: true,
      effectiveFrom: true,
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export async function getPolicyParameter<T>(
  key: string,
  defaultValue: T,
  scope?: PolicyScope,
): Promise<T> {
  try {
    const rows = await fetchPolicyRows(key);
    const row = selectBestRow(rows as PolicyRow[], scope);
    if (!row) {
      logger.error({ code: 'POLICY_PARAMETER_FALLBACK', reason: 'NO_ROWS_CONFIGURED', key, scope, message: 'No active policy parameter configured; code default used.' });
      return defaultValue;
    }
    return row.value as T;
  } catch (error) {
    if (shouldFallback(error)) {
      logger.error({ code: 'POLICY_PARAMETER_FALLBACK', reason: 'TABLE_UNAVAILABLE', key, scope, message: 'Policy parameter table unavailable; code default used.' });
      return defaultValue;
    }
    throw error;
  }
}

export async function getNumberPolicy(
  key: string,
  defaultValue: number,
  scope?: PolicyScope,
): Promise<number> {
  const value = await getPolicyParameter<unknown>(key, defaultValue, scope);
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export async function getStringPolicy(
  key: string,
  defaultValue: string,
  scope?: PolicyScope,
): Promise<string> {
  const value = await getPolicyParameter<unknown>(key, defaultValue, scope);
  return typeof value === 'string' ? value : defaultValue;
}

export async function getBooleanPolicy(
  key: string,
  defaultValue: boolean,
  scope?: PolicyScope,
): Promise<boolean> {
  const value = await getPolicyParameter<unknown>(key, defaultValue, scope);
  return typeof value === 'boolean' ? value : defaultValue;
}

export async function getPolicyMap<T>(
  defaults: Record<string, T>,
  scope?: PolicyScope,
): Promise<Record<string, T>> {
  const entries = await Promise.all(
    Object.entries(defaults).map(async ([key, defaultValue]) => [
      key,
      await getPolicyParameter(key, defaultValue, scope),
    ] as const),
  );

  return Object.fromEntries(entries) as Record<string, T>;
}
