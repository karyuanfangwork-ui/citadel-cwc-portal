/**
 * Execution Scope — P02 Task 6 (Findings #3–#4, #19, #41–#42)
 *
 * Provides explicit scoping for all database operations:
 * - **tenant**: Ordinary tenant-scoped queries. Requires tenantId.
 * - **platform**: Cross-tenant admin operations (e.g. platform analytics).
 *   Only available through explicit `runWithExecutionScope({ kind: 'platform' })`.
 * - **system**: Background jobs and migrations that must bypass tenant scope.
 *   Logged and auditable.
 *
 * The Prisma extension in `lib/prisma.ts` uses `getExecutionScope()` to decide:
 * - If no scope is set → fail closed with TENANT_SCOPE_REQUIRED error.
 * - If tenant scope → inject tenantId into queries as before.
 * - If platform/system scope → bypass tenant filter (with audit log).
 */

import { AsyncLocalStorage } from 'async_hooks';

export type ExecutionScope =
  | { kind: 'tenant'; tenantId: string; actorId?: string }
  | { kind: 'platform'; actorId: string; reason: string }
  | { kind: 'system'; tenantId?: string; jobName: string; runId: string };

interface ScopeEntry {
  scope: ExecutionScope;
}

const scopeStore = new AsyncLocalStorage<ScopeEntry>();

/**
 * Run a callback with an explicit execution scope.
 * All Prisma queries within the callback will respect this scope.
 */
export function runWithExecutionScope<T>(scope: ExecutionScope, fn: () => Promise<T>): Promise<T> {
  return scopeStore.run({ scope }, fn);
}

/**
 * Get the current execution scope from the async context.
 * Returns undefined if called outside a runWithExecutionScope scope.
 */
export function getExecutionScope(): ExecutionScope | undefined {
  return scopeStore.getStore()?.scope;
}

/**
 * Require a tenant execution scope. Throws if the current scope is not
 * tenant-scoped, which is useful for endpoints that must be tenant-isolated.
 */
export function requireTenantScope(): { tenantId: string; actorId?: string } {
  const scope = getExecutionScope();
  if (!scope) {
    throw new Error('TENANT_SCOPE_REQUIRED: No execution scope set. Use runWithExecutionScope() or runWithTenant().');
  }
  if (scope.kind !== 'tenant') {
    throw new Error(`TENANT_SCOPE_REQUIRED: Expected tenant scope, got ${scope.kind}.`);
  }
  return { tenantId: scope.tenantId, actorId: scope.actorId };
}

/**
 * Check if the current scope bypasses tenant filtering.
 * Returns true for platform and system scopes.
 */
export function isScopeBypassed(): boolean {
  const scope = getExecutionScope();
  return scope?.kind === 'platform' || scope?.kind === 'system';
}

/**
 * Get the tenant ID from the current scope, if it's a tenant scope.
 * Returns undefined for platform/system scopes or when no scope is set.
 */
export function getScopeTenantId(): string | undefined {
  const scope = getExecutionScope();
  if (scope?.kind === 'tenant') return scope.tenantId;
  if (scope?.kind === 'system') return scope.tenantId;
  return undefined;
}

/**
 * Backward-compatible wrapper: `runWithTenant` now delegates to
 * `runWithExecutionScope` with kind='tenant'.
 */
export { runWithTenant, getTenantId } from './tenant-context';