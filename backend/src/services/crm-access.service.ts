import { AppError } from '../middleware/error.middleware';

export type VisibleOwnerIds = string[] | null;

export function assertOwnerVisible(visibleOwnerIds: VisibleOwnerIds, ownerId?: string | null): void {
  if (visibleOwnerIds === null) return;
  if (ownerId == null) return;
  if (visibleOwnerIds.includes(ownerId)) return;
  throw new AppError('CRM record not found', 404);
}

export function buildVisibleOwnerWhere<T extends Record<string, unknown>>(
  where: T,
  visibleOwnerIds: VisibleOwnerIds,
): T & { OR?: Array<Record<string, unknown>> } {
  if (visibleOwnerIds === null) return where;
  return { ...where, OR: [{ ownerId: { in: visibleOwnerIds } }, { ownerId: null }] };
}

export function assertRecordFound<T>(record: T | null | undefined, message = 'CRM record not found'): T {
  if (!record) throw new AppError(message, 404);
  return record;
}
