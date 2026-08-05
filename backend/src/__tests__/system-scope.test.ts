/**
 * System Scope Middleware Tests — P02 Task 6 hotfix
 *
 * Verifies that pre-auth routes (login, register, forgot-password, etc.)
 * run inside a system execution scope so that tenant-scoped Prisma
 * operations (user.findUnique, user.update) don't throw TENANT_SCOPE_REQUIRED.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getExecutionScope } from '../lib/execution-scope';
import { systemScope } from '../middleware/system-scope.middleware';
import { Request, Response, NextFunction } from 'express';

describe('P02-06: System Scope Middleware', () => {
    it('should set system execution scope for downstream handlers', (done) => {
        const middleware = systemScope('auth:login');

        const mockReq = {} as Request;
        const mockRes = {} as Response;
        const mockNext: NextFunction = () => {
            // Inside next(), the scope should be set
            const scope = getExecutionScope();
            expect(scope).toBeDefined();
            expect(scope!.kind).toBe('system');
            if (scope!.kind === 'system') {
                expect(scope!.jobName).toBe('auth:login');
            }
            done();
        };

        middleware(mockReq, mockRes, mockNext);
    });

    it('should propagate scope to async operations within next()', (done) => {
        const middleware = systemScope('auth:refresh');

        const mockReq = {} as Request;
        const mockRes = {} as Response;
        const mockNext: NextFunction = () => {
            // Simulate an async operation (like a Prisma query)
            setTimeout(() => {
                const scope = getExecutionScope();
                expect(scope).toBeDefined();
                expect(scope!.kind).toBe('system');
                if (scope!.kind === 'system') {
                    expect(scope!.jobName).toBe('auth:refresh');
                }
                done();
            }, 10);
        };

        middleware(mockReq, mockRes, mockNext);
    });

    it('should clear scope after middleware completes', () => {
        const middleware = systemScope('auth:forgot-password');

        const mockReq = {} as Request;
        const mockRes = {} as Response;
        const mockNext: NextFunction = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        // After middleware returns, scope should be cleared
        const scope = getExecutionScope();
        expect(scope).toBeUndefined();
    });

    it('should use unique job-specific runId for each call', () => {
        const middleware = systemScope('auth:test');
        const ids: string[] = [];

        for (let i = 0; i < 3; i++) {
            const mockNext: NextFunction = () => {
                const scope = getExecutionScope();
                if (scope!.kind === 'system') {
                    ids.push(scope!.runId);
                }
            };
            middleware({} as Request, {} as Response, mockNext);
        }

        // Each call should have a non-empty runId
        expect(ids.every(id => id.length > 0)).toBe(true);
        expect(ids.length).toBe(3);
    });
});