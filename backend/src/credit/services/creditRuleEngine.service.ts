import prisma from '../../utils/prisma';
import { DEFAULT_DOCUMENT_RULES, DEFAULT_FIELD_RULES } from './creditRuleDefaults';
import { DocumentClass } from '@prisma/client';
import { logger } from '../../utils/logger';

const db = prisma as any;

export interface RuleScope {
  productType?: string | null;
  lane: string;
  borrowerType: string;
}

export interface ResolvedDocument {
  documentClass: DocumentClass;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
}

export interface ResolvedField {
  fieldPath: string;
  label: string;
  isMandatory: boolean;
}

type RuleConfigRow = {
  productType: string | null;
  lane: string | null;
  borrowerType: string | null;
  documentClass: string | null;
  documentLabel: string | null;
  fieldPath: string | null;
  fieldLabel: string | null;
  isMandatory: boolean;
  sortOrder: number;
};

function matchesScope(row: RuleConfigRow, scope: RuleScope): boolean {
  if (row.productType !== null && row.productType !== scope.productType) return false;
  if (row.lane !== null && row.lane !== scope.lane) return false;
  if (row.borrowerType !== null && row.borrowerType !== scope.borrowerType) return false;
  return true;
}

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

async function fetchRows(kind: 'REQUIRED_DOCUMENT' | 'REQUIRED_FIELD'): Promise<RuleConfigRow[]> {
  try {
    return (await db.creditRuleConfig.findMany({
      where: { kind: kind as any, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })) as RuleConfigRow[];
  } catch (error) {
    if (shouldFallback(error)) {
      logger.error({
        code: 'RULE_CONFIG_FALLBACK',
        reason: 'TABLE_UNAVAILABLE',
        kind,
        message: 'Credit rule configuration table unavailable; code defaults may be used.',
      });
      return [];
    }
    throw error;
  }
}

export async function resolveRequiredDocuments(scope: RuleScope): Promise<ResolvedDocument[]> {
  const rows = await fetchRows('REQUIRED_DOCUMENT');

  if (rows.length === 0) {
    logger.error({
      code: 'RULE_CONFIG_FALLBACK',
      reason: 'NO_ROWS_CONFIGURED',
      kind: 'REQUIRED_DOCUMENT',
      scope,
      message: 'No active required-document rules configured; code defaults used.',
    });
    const defaults = DEFAULT_DOCUMENT_RULES[scope.borrowerType] ?? DEFAULT_DOCUMENT_RULES.INDIVIDUAL;
    return defaults.map((rule, index) => ({
      documentClass: rule.documentClass,
      label: rule.label,
      isMandatory: true,
      sortOrder: index,
    }));
  }

  return rows
    .filter((row) => matchesScope(row, scope) && row.documentClass)
    .map((row) => ({
      documentClass: row.documentClass as DocumentClass,
      label: row.documentLabel ?? row.documentClass ?? 'Document',
      isMandatory: row.isMandatory,
      sortOrder: row.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function resolveRequiredFields(scope: RuleScope): Promise<ResolvedField[]> {
  const rows = await fetchRows('REQUIRED_FIELD');

  if (rows.length === 0) {
    return DEFAULT_FIELD_RULES.map((field) => ({
      fieldPath: field.fieldPath,
      label: field.label,
      isMandatory: true,
    }));
  }

  return rows
    .filter((row) => matchesScope(row, scope) && row.fieldPath)
    .map((row) => ({
      fieldPath: row.fieldPath as string,
      label: row.fieldLabel ?? row.fieldPath ?? 'Field',
      isMandatory: row.isMandatory,
    }));
}
