/**
 * System Scope Middleware — P02 Task 6 hotfix
 *
 * Wraps pre-auth route handlers in a system execution scope so that
 * tenant-scoped Prisma operations (user.findUnique, user.update, etc.)
 * don't fail with TENANT_SCOPE_REQUIRED during login, registration,
 * and password reset flows.
 *
 * Usage:
 *   router.post('/login', systemScope('auth:login'), authController.login);
 *   router.post('/register', systemScope('auth:register'), authController.register);
 *
 * How it works:
 *   AsyncLocalStorage.run() is synchronous — it sets context for the
 *   entire async lifecycle of the callback.  By calling next() inside
 *   the run() callback, all downstream middleware and handlers inherit
 *   the system scope.
 */

import { Request, Response, NextFunction } from 'express';
import type { ExecutionScope } from '../lib/execution-scope';

// Reuse the same ALS store as execution-scope.ts — this ensures
// getExecutionScope() inside the handlers returns our system scope.
import { scopeStore } from '../lib/execution-scope';

export function systemScope(jobName: string) {
    return (_req: Request, _res: Response, next: NextFunction) => {
        const scope: ExecutionScope = {
            kind: 'system',
            jobName,
            runId: `${jobName}-${Date.now()}`,
        };
        // Run the entire downstream pipeline inside this scope.
        // AsyncLocalStorage.run() is synchronous and the context
        // propagates to all async operations started within it.
        scopeStore.run({ scope }, () => {
            next();
        });
    };
}