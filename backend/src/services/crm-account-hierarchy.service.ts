export interface HierarchyDeps {
  getParentId: (accountId: string) => Promise<string | null>;
}

export interface CycleResult {
  ok: boolean;
  reason?: string;
}

/**
 * Detect whether setting `proposedParentId` as the parent of `accountId`
 * would create a cycle in the account hierarchy.
 *
 * Walk the proposed parent's ancestor chain; if `accountId` appears,
 * it's a cycle.
 */
export async function detectCycle(
  accountId: string,
  proposedParentId: string | null | undefined,
  deps: HierarchyDeps,
): Promise<CycleResult> {
  if (!proposedParentId) return { ok: true };
  if (proposedParentId === accountId) {
    return { ok: false, reason: 'An account cannot be its own parent.' };
  }

  // Walk the proposed parent's ancestors to check for back-reference to accountId
  let current: string | null = proposedParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === accountId) {
      return { ok: false, reason: 'Circular parent reference detected.' };
    }
    if (visited.has(current)) break; // guard against pre-existing cycles
    visited.add(current);
    current = await deps.getParentId(current);
  }

  return { ok: true };
}