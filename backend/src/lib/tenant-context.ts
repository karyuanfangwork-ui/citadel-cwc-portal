import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage<string>();

/**
 * Run a callback with a tenant context. All Prisma queries within the callback
 * will automatically have tenantId injected by the Prisma extension.
 *
 * NOTE: This is now a thin wrapper around `runWithExecutionScope({ kind: 'tenant' })`.
 * For new code, prefer using `runWithExecutionScope` directly, which also supports
 * platform and system scopes.
 */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return store.run(tenantId, fn);
}

/**
 * Get the current tenant ID from the async context.
 * Returns undefined if called outside a runWithTenant scope.
 */
export function getTenantId(): string | undefined {
  return store.getStore();
}