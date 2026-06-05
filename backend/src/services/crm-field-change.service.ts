// ============================================================================
// Field-level change tracking — persist diffs as CrmFieldChange rows
// ============================================================================

import prisma from '../utils/prisma';

const TRACKABLE_TYPES = ['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY'] as const;
type EntityType = typeof TRACKABLE_TYPES[number];

// Fields to skip — internal/bookkeeping fields that add noise
const SKIP_FIELDS = new Set([
  'updatedAt', 'updated_at', 'createdAt', 'created_at', 'id',
  'ruleScore', 'rule_score', 'calculatedScore',
]);

/**
 * Compute the diff between two objects and persist each changed field
 * as a CrmFieldChange row. Values are coerced to strings for storage.
 */
export async function trackFieldChanges(
  entityType: EntityType,
  entityId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  changedBy: string,
): Promise<void> {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  for (const key of Object.keys(newValues)) {
    if (SKIP_FIELDS.has(key)) continue;
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    // Compare stringified to handle Date objects, numbers, etc.
    const oldStr = oldVal === null || oldVal === undefined ? null : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? null : String(newVal);
    if (oldStr !== newStr) {
      changes.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }

  if (changes.length === 0) return;

  await prisma.crmFieldChange.createMany({
    data: changes.map(c => ({
      entityType,
      entityId,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      changedBy,
    })),
  });
}

/**
 * Retrieve field-change history for a given entity.
 */
export async function getFieldChanges(entityType: EntityType, entityId: string, limit = 100) {
  return prisma.crmFieldChange.findMany({
    where: { entityType, entityId },
    orderBy: { changedAt: 'desc' },
    take: limit,
  });
}