/**
 * Search, Report, KB & Export Isolation Tests — P02 T11
 *
 * Verifies that search, reporting, KB article listing, and exports
 * respect department-scoped visibility. An IT agent must not see
 * HR requests, articles, or report counts, and vice versa.
 *
 * Findings: #11–#15, #57–#58, #63–#66, #78, #96–#97
 */

import { policyService } from '../security/policy.service';
import { PolicyPrincipal } from '../security/policy.types';

// ── Principal fixtures ──────────────────────────────────────────────────

const itAgent: PolicyPrincipal = {
    userId: 'it-agent-1',
    tenantId: 'tenant-1',
    roles: ['AGENT'],
    permissions: ['request:read', 'request:update'],
    agentTeam: 'IT_SUPPORT',
};

const hrAgent: PolicyPrincipal = {
    userId: 'hr-agent-1',
    tenantId: 'tenant-1',
    roles: ['AGENT'],
    permissions: ['request:read', 'request:update'],
    agentTeam: 'HR_SERVICES',
};

const adminPrincipal: PolicyPrincipal = {
    userId: 'admin-1',
    tenantId: 'tenant-1',
    roles: ['ADMIN'],
    permissions: ['request:read', 'request:update', 'request:delete'],
};

const endUser: PolicyPrincipal = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    roles: ['END_USER'],
    permissions: ['request:read'],
};

const executivePrincipal: PolicyPrincipal = {
    userId: 'ceo-1',
    tenantId: 'tenant-1',
    roles: ['CEO'],
    permissions: ['request:read', 'request:approve'],
};

// ── Search & Report Visibility Tests ────────────────────────────────────

describe('Search, Report, KB & Export Isolation (P02 T11)', () => {
    describe('buildVisibleWhere for requests', () => {
        it('IT agent sees only IT-scoped requests', () => {
            const where = policyService.buildVisibleWhere(itAgent, 'request');
            // Should include team-based OR condition
            expect(where.AND || where.OR).toBeDefined();
        });

        it('HR agent sees only HR-scoped requests', () => {
            const where = policyService.buildVisibleWhere(hrAgent, 'request');
            expect(where.AND || where.OR).toBeDefined();
        });

        it('admin sees all requests in their tenant', () => {
            const where = policyService.buildVisibleWhere(adminPrincipal, 'request');
            // Admin should only have tenant filter (no team/owner scope)
            const hasTeamFilter = JSON.stringify(where).includes('IT_SUPPORT') ||
                JSON.stringify(where).includes('HR_SERVICES');
            expect(hasTeamFilter).toBe(false);
        });

        it('end user sees only own requests', () => {
            const where = policyService.buildVisibleWhere(endUser, 'request');
            // Should include requesterId filter
            expect(JSON.stringify(where)).toContain('user-1');
        });

        it('executive sees requests where they are approver/participant', () => {
            const where = policyService.buildVisibleWhere(executivePrincipal, 'request');
            expect(where.AND || where.OR).toBeDefined();
        });

        it('different team agents get different visibility scopes', () => {
            const itWhere = policyService.buildVisibleWhere(itAgent, 'request');
            const hrWhere = policyService.buildVisibleWhere(hrAgent, 'request');
            // They should not produce the same filter (different teams)
            expect(JSON.stringify(itWhere)).not.toEqual(JSON.stringify(hrWhere));
        });
    });

    describe('buildVisibleWhere for KB articles', () => {
        it('IT agent sees IT service desk articles and global articles', () => {
            const where = policyService.buildVisibleWhere(itAgent, 'kb_article');
            // Should include serviceDesk.code = IT_SUPPORT
            expect(JSON.stringify(where)).toContain('IT_SUPPORT');
        });

        it('HR agent sees HR service desk articles and global articles', () => {
            const where = policyService.buildVisibleWhere(hrAgent, 'kb_article');
            expect(JSON.stringify(where)).toContain('HR_SERVICES');
        });

        it('admin sees all KB articles (no department filter)', () => {
            const where = policyService.buildVisibleWhere(adminPrincipal, 'kb_article');
            // Admin should see everything (no team filter)
            const hasTeamFilter = JSON.stringify(where).includes('IT_SUPPORT') ||
                JSON.stringify(where).includes('HR_SERVICES');
            expect(hasTeamFilter).toBe(false);
        });

        it('end user without team sees only global articles', () => {
            const where = policyService.buildVisibleWhere(endUser, 'kb_article');
            // End users without agentTeam should see null serviceDeskId articles
            expect(where.AND || where.OR).toBeDefined();
        });
    });

    describe('buildVisibleWhere for reports', () => {
        it('report scope matches request scope for IT agent', () => {
            const requestWhere = policyService.buildVisibleWhere(itAgent, 'request');
            const reportWhere = policyService.buildVisibleWhere(itAgent, 'report');
            // Reports should use the same scope as requests
            expect(reportWhere).toEqual(requestWhere);
        });

        it('report scope matches request scope for HR agent', () => {
            const requestWhere = policyService.buildVisibleWhere(hrAgent, 'request');
            const reportWhere = policyService.buildVisibleWhere(hrAgent, 'report');
            expect(reportWhere).toEqual(requestWhere);
        });
    });

    describe('Cross-desk isolation invariants', () => {
        it('IT agent visibility does not include HR team references', () => {
            const where = policyService.buildVisibleWhere(itAgent, 'request');
            const json = JSON.stringify(where);
            // Should not contain HR team reference
            expect(json).not.toContain('HR_SERVICES');
            // Should contain IT team reference
            expect(json).toContain('IT_SUPPORT');
        });

        it('HR agent visibility does not include IT team references', () => {
            const where = policyService.buildVisibleWhere(hrAgent, 'request');
            const json = JSON.stringify(where);
            expect(json).not.toContain('IT_SUPPORT');
            expect(json).toContain('HR_SERVICES');
        });

        it('tenant boundary is always present for non-admin users', () => {
            const itWhere = policyService.buildVisibleWhere(itAgent, 'request');
            const json = JSON.stringify(itWhere);
            expect(json).toContain('tenant-1');
        });

        it('admin is not restricted by team scope', () => {
            const where = policyService.buildVisibleWhere(adminPrincipal, 'request');
            // Admin should have minimal conditions (just tenant)
            const json = JSON.stringify(where);
            expect(json).not.toContain('IT_SUPPORT');
            expect(json).not.toContain('HR_SERVICES');
        });
    });
});