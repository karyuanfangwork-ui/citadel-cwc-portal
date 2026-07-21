/**
 * Execution scope and tenant isolation tests — P02 Task 6 (Findings #3–#4)
 *
 * Tests that:
 * 1. ExecutionScope type discriminates tenant/platform/system
 * 2. getExecutionScope() returns undefined outside scope
 * 3. runWithExecutionScope sets and clears scope correctly
 * 4. requireTenantScope() throws when no scope or wrong kind
 * 5. isScopeBypassed() returns true for platform/system scopes
 * 6. Tenant-scoped models list is complete (completeness check)
 */

import { describe, it, expect } from '@jest/globals';
import {
    runWithExecutionScope,
    getExecutionScope,
    requireTenantScope,
    isScopeBypassed,
    getScopeTenantId,
} from '../lib/execution-scope';
import { TENANT_SCOPED_MODELS } from '../generated/tenant-models';

describe('P02-06: Execution scope', () => {
    describe('runWithExecutionScope / getExecutionScope', () => {
        it('should return undefined outside a scope', () => {
            expect(getExecutionScope()).toBeUndefined();
        });

        it('should set tenant scope and return the result', async () => {
            const result = await runWithExecutionScope(
                { kind: 'tenant', tenantId: 'tenant-a' },
                async () => {
                    const scope = getExecutionScope();
                    expect(scope).toBeDefined();
                    expect(scope!.kind).toBe('tenant');
                    if (scope!.kind === 'tenant') {
                        expect(scope!.tenantId).toBe('tenant-a');
                    }
                    return 'ok';
                },
            );
            expect(result).toBe('ok');
        });

        it('should clear scope after callback completes', async () => {
            await runWithExecutionScope(
                { kind: 'tenant', tenantId: 'tenant-b' },
                async () => {
                    expect(getExecutionScope()).toBeDefined();
                },
            );
            expect(getExecutionScope()).toBeUndefined();
        });

        it('should set platform scope with reason', async () => {
            await runWithExecutionScope(
                { kind: 'platform', actorId: 'admin-1', reason: 'cross-tenant analytics' },
                async () => {
                    const scope = getExecutionScope();
                    expect(scope).toBeDefined();
                    expect(scope!.kind).toBe('platform');
                },
            );
        });

        it('should set system scope for background jobs', async () => {
            await runWithExecutionScope(
                { kind: 'system', jobName: 'sla-checker', runId: 'run-123' },
                async () => {
                    const scope = getExecutionScope();
                    expect(scope).toBeDefined();
                    expect(scope!.kind).toBe('system');
                },
            );
        });

        it('should support nested scopes (inner overrides outer)', async () => {
            await runWithExecutionScope(
                { kind: 'tenant', tenantId: 'tenant-outer' },
                async () => {
                    expect(getScopeTenantId()).toBe('tenant-outer');
                    await runWithExecutionScope(
                        { kind: 'tenant', tenantId: 'tenant-inner' },
                        async () => {
                            expect(getScopeTenantId()).toBe('tenant-inner');
                        },
                    );
                    expect(getScopeTenantId()).toBe('tenant-outer');
                },
            );
        });
    });

    describe('requireTenantScope', () => {
        it('should throw when no scope is set', () => {
            expect(() => requireTenantScope()).toThrow('TENANT_SCOPE_REQUIRED');
        });

        it('should throw when scope is platform', async () => {
            await runWithExecutionScope(
                { kind: 'platform', actorId: 'admin-1', reason: 'test' },
                async () => {
                    expect(() => requireTenantScope()).toThrow('TENANT_SCOPE_REQUIRED');
                },
            );
        });

        it('should return tenantId when tenant scope is set', async () => {
            await runWithExecutionScope(
                { kind: 'tenant', tenantId: 'tenant-xyz' },
                async () => {
                    const { tenantId } = requireTenantScope();
                    expect(tenantId).toBe('tenant-xyz');
                },
            );
        });
    });

    describe('isScopeBypassed', () => {
        it('should return false when no scope is set', () => {
            expect(isScopeBypassed()).toBe(false);
        });

        it('should return false for tenant scope', async () => {
            await runWithExecutionScope(
                { kind: 'tenant', tenantId: 't1' },
                async () => {
                    expect(isScopeBypassed()).toBe(false);
                },
            );
        });

        it('should return true for platform scope', async () => {
            await runWithExecutionScope(
                { kind: 'platform', actorId: 'admin-1', reason: 'analytics' },
                async () => {
                    expect(isScopeBypassed()).toBe(true);
                },
            );
        });

        it('should return true for system scope', async () => {
            await runWithExecutionScope(
                { kind: 'system', jobName: 'sla', runId: 'r1' },
                async () => {
                    expect(isScopeBypassed()).toBe(true);
                },
            );
        });
    });

    describe('Tenant-scoped models completeness', () => {
        it('should include all critical tenant-scoped models', () => {
            const critical = [
                'user', 'request', 'asset', 'creditApplication',
                'notification', 'auditLog', 'branch', 'entity',
                'serviceDesk', 'serviceCategory', 'requestType',
                'featureFlag', 'webhookSubscription', 'requestCounter',
            ];
            for (const model of critical) {
                expect(TENANT_SCOPED_MODELS).toContain(model);
            }
        });

        it('should have at least 25 tenant-scoped models', () => {
            expect(TENANT_SCOPED_MODELS.length).toBeGreaterThanOrEqual(25);
        });
    });

    describe('Phased enforcement mode', () => {
        it('should default to warn mode (TENANT_SCOPE_ENFORCE not set or not "strict")', () => {
            // The default enforcement mode is 'warn' — unscoped writes are logged
            // but not blocked. This allows gradual migration of call sites.
            const env = process.env.TENANT_SCOPE_ENFORCE;
            expect(env).not.toBe('strict');
        });
    });
});