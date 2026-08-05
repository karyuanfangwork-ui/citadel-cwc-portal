import { AsyncLocalStorage } from 'async_hooks';

export interface UserContext {
  userId: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

const store = new AsyncLocalStorage<UserContext>();

/**
 * Run a callback with a user context. The credit auto-audit middleware
 * will read this to attribute writes to a real user instead of null.
 */
export function runWithUser<T>(ctx: UserContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/**
 * Get the current user context from the async store.
 * Returns undefined if called outside a runWithUser scope.
 */
export function getUserContext(): UserContext | undefined {
  return store.getStore();
}