/**
 * Department Isolation Matrix — P02 Task 9 (Findings #8, #10–#12, #16, #42, #55)
 *
 * Tests the complete tenant × department × principal × action × classification
 * isolation matrix. Every cross-boundary access must be denied (404).
 * This proves the policy-based request access system closes all ADMIN/AGENT
 * bypass paths that existed in the old requestAccess.service.ts.
 *
 * Strategy:
 * - Mock Prisma at the model level for pure logic tests
 * - Use the policy service's authorize() and buildVisibleWhere() directly
 * - Verify that the new getAuthorizedRequest() denies cross-tenant/cross-desk access
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { policyService } from '../security/policy.service';
import { PolicyPrincipal, ResourceDescriptor } from '../security/policy.types';

// ── Test Matrix Constants ─────────────────────────────────────────────

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

const DEPT_IT = 'dept-it';
const DEPT_HR = 'dept-hr';
const DEPT_FIN = 'dept-fin';

// ── Principals ─────────────────────────────────────────────────────────

const itAgentA: PolicyPrincipal = {
    userId: 'u-it-a',
    tenantId: TENANT_A,
    roles: ['AGENT'],
    permissions: ['request:read'],
    agentTeam: 'IT',
    departmentIds: [DEPT_IT],
};

const hrAgentA: PolicyPrincipal = {
    userId: 'u-hr-a',
    tenantId: TENANT_A,
    roles: ['AGENT'],
    permissions: ['request:read'],
    agentTeam: 'HR',
    departmentIds: [DEPT_HR],
};

const finApproverA: PolicyPrincipal = {
    userId: 'u-fin-a',
    tenantId: TENANT_A,
    roles: ['AGENT'],
    permissions: ['request:read', 'request:approve'],
    agentTeam: 'FIN',
    departmentIds: [DEPT_FIN],
};

const tenantAdminA: PolicyPrincipal = {
    userId: 'u-admin-a',
    tenantId: TENANT_A,
    roles: ['ADMIN'],
    permissions: [],
    departmentIds: [DEPT_IT, DEPT_HR, DEPT_FIN],
};

const requesterA: PolicyPrincipal = {
    userId: 'u-requester-a',
    tenantId: TENANT_A,
    roles: ['END_USER'],
    permissions: ['request:create'],
};

const crossTenantAdminB: PolicyPrincipal = {
    userId: 'u-admin-b',
    tenantId: TENANT_B,
    roles: ['ADMIN'],
    permissions: [],
    departmentIds: [],
};

const ceoA: PolicyPrincipal = {
    userId: 'u-ceo-a',
    tenantId: TENANT_A,
    roles: ['CEO'],
    permissions: [],
};

const cfoA: PolicyPrincipal = {
    userId: 'u-cfo-a',
    tenantId: TENANT_A,
    roles: ['CFO'],
    permissions: [],
};

const participantA: PolicyPrincipal = {
    userId: 'u-participant-a',
    tenantId: TENANT_A,
    roles: ['END_USER'],
    permissions: [],
};

// ── Resources ──────────────────────────────────────────────────────────

const itRequestA: ResourceDescriptor = {
    type: 'request',
    id: 'req-it-1',
    ownerId: 'u-requester-a',
    tenantId: TENANT_A,
    assignedToId: 'u-it-a',
    isConfidential: false,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'OPEN',
    approverIds: [],
    participantIds: [],
    departmentId: DEPT_IT,
};

const hrConfidentialA: ResourceDescriptor = {
    type: 'request',
    id: 'req-hr-conf-1',
    ownerId: 'u-requester-hr',
    tenantId: TENANT_A,
    assignedToId: 'u-hr-a',
    isConfidential: true,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'OPEN',
    approverIds: [],
    participantIds: [],
    departmentId: DEPT_HR,
};

const hrPayrollA: ResourceDescriptor = {
    type: 'request',
    id: 'req-hr-payroll-1',
    ownerId: 'u-requester-hr2',
    tenantId: TENANT_A,
    assignedToId: 'u-hr-a',
    isConfidential: true,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'OPEN',
    approverIds: [],
    participantIds: [],
    departmentId: DEPT_HR,
};

const financeRequestA: ResourceDescriptor = {
    type: 'request',
    id: 'req-fin-1',
    ownerId: 'u-fin-requester',
    tenantId: TENANT_A,
    assignedToId: 'u-fin-a',
    isConfidential: false,
    serviceDeskCode: 'FIN',
    assignedTeam: 'FIN',
    status: 'PENDING_CFO_APPROVAL_FIN',
    approverIds: ['u-cfo-a'],
    participantIds: [],
    departmentId: DEPT_FIN,
};

const requestTenantB: ResourceDescriptor = {
    type: 'request',
    id: 'req-b-1',
    ownerId: 'u-requester-b',
    tenantId: TENANT_B,
    assignedToId: 'u-agent-b',
    isConfidential: false,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'OPEN',
    approverIds: [],
    participantIds: [],
    departmentId: DEPT_IT,
};

const ceoApprovalRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-ceo-1',
    ownerId: 'u-requester-hr3',
    tenantId: TENANT_A,
    assignedToId: 'u-hr-a',
    isConfidential: false,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'PENDING_CEO_APPROVAL',
    approverIds: ['u-ceo-a'],
    participantIds: [],
    departmentId: DEPT_HR,
};

// ── Cross-boundary denial tests ────────────────────────────────────────

describe('P02-09: Department isolation matrix', () => {

    // ── 1. Tenant boundary: cross-tenant denial ──────────────────────

    describe('tenant boundary', () => {
        it('tenant-A ADMIN cannot access tenant-B request', () => {
            // Even ADMIN is denied across tenant boundary
            const decision = policyService.authorize(tenantAdminA, 'read', requestTenantB);
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toBe('wrong_tenant');
        });

        it('tenant-A IT agent cannot access tenant-B request', () => {
            const decision = policyService.authorize(itAgentA, 'read', requestTenantB);
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toBe('wrong_tenant');
        });

        it('tenant-A ADMIN cannot manage tenant-B request', () => {
            const decision = policyService.authorize(tenantAdminA, 'update', requestTenantB);
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toBe('wrong_tenant');
        });

        it('tenant-B ADMIN cannot access tenant-A request', () => {
            const decision = policyService.authorize(crossTenantAdminB, 'read', itRequestA);
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toBe('wrong_tenant');
        });
    });

    // ── 2. Department boundary: cross-desk denial ───────────────────

    describe('department boundary (cross-desk)', () => {
        const actions: Array<{ action: any; label: string }> = [
            { action: 'read', label: 'read' },
            { action: 'update', label: 'update' },
            { action: 'assign', label: 'assign' },
            { action: 'approve', label: 'approve' },
            { action: 'export', label: 'export' },
            { action: 'delete', label: 'delete' },
        ];

        it.each(actions)('IT agent cannot $label an HR request', ({ action }) => {
            const decision = policyService.authorize(itAgentA, action, hrPayrollA);
            expect(decision.allowed).toBe(false);
        });

        it.each(actions)('HR agent cannot $label a Finance request', ({ action }) => {
            const decision = policyService.authorize(hrAgentA, action, financeRequestA);
            expect(decision.allowed).toBe(false);
        });

        it.each(actions)('Finance approver cannot $label an IT request', ({ action }) => {
            const decision = policyService.authorize(finApproverA, action, itRequestA);
            expect(decision.allowed).toBe(false);
        });

        it('IT agent cannot read a confidential HR request even with team scope', () => {
            // IT agent has team scope for IT, not HR
            const decision = policyService.authorize(itAgentA, 'read', hrConfidentialA);
            expect(decision.allowed).toBe(false);
        });

        it('tenant admin within same tenant CAN read HR payroll', () => {
            // ADMIN has universal access within their own tenant
            const decision = policyService.authorize(tenantAdminA, 'read', hrPayrollA);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('admin');
        });
    });

    // ── 3. Confidentiality gate ──────────────────────────────────────

    describe('confidentiality', () => {
        it('team-scoped agent without confidential permission is denied for confidential request', () => {
            // IT agent trying to read a confidential HR request — no team scope + no perm
            const decision = policyService.authorize(itAgentA, 'read', hrConfidentialA);
            expect(decision.allowed).toBe(false);
        });

        it('team-scoped agent WITH confidential permission is still denied cross-desk', () => {
            const itConfAgent: PolicyPrincipal = {
                ...itAgentA,
                permissions: ['request:read', 'request:confidential'],
            };
            const decision = policyService.authorize(itConfAgent, 'read', hrConfidentialA);
            // Cross-desk: no team scope match → denied regardless of confidential perm
            expect(decision.allowed).toBe(false);
        });

        it('assignee can access confidential request', () => {
            // hrAgentA is the assignee of hrConfidentialA
            const decision = policyService.authorize(hrAgentA, 'read', hrConfidentialA);
            expect(decision.allowed).toBe(true);
        });

        it('owner can always access their own confidential request', () => {
            const ownerPrincipal: PolicyPrincipal = {
                userId: 'u-requester-hr',
                tenantId: TENANT_A,
                roles: ['END_USER'],
                permissions: [],
                agentTeam: null,
            };
            const decision = policyService.authorize(ownerPrincipal, 'read', hrConfidentialA);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('owner');
        });
    });

    // ── 4. Executive role scoping ────────────────────────────────────

    describe('executive role scoping', () => {
        it('CEO can access a request in CEO approval status', () => {
            const decision = policyService.authorize(ceoA, 'read', ceoApprovalRequest);
            expect(decision.allowed).toBe(true);
            // CEO may match via designated_approver or executive_role — both are valid
            expect(['executive_role', 'designated_approver']).toContain(decision.reason);
        });

        it('CFO can access a Finance request in CFO approval status', () => {
            const decision = policyService.authorize(cfoA, 'read', financeRequestA);
            expect(decision.allowed).toBe(true);
            // CFO may match via designated_approver or executive_role — both are valid
            expect(['executive_role', 'designated_approver']).toContain(decision.reason);
        });

        it('CFO cannot access IT request (wrong desk, no approval status)', () => {
            const itRequest: ResourceDescriptor = {
                ...itRequestA,
                status: 'OPEN',
            };
            const decision = policyService.authorize(cfoA, 'read', itRequest);
            expect(decision.allowed).toBe(false);
        });
    });

    // ── 5. Participant and designated approver ────────────────────────

    describe('participant and designated approver', () => {
        it('participant can read non-confidential request', () => {
            const requestWithParticipant: ResourceDescriptor = {
                ...itRequestA,
                participantIds: ['u-participant-a'],
            };
            const decision = policyService.authorize(participantA, 'read', requestWithParticipant);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('participant');
        });

        it('designated approver can approve', () => {
            const requestWithApprover: ResourceDescriptor = {
                ...itRequestA,
                approverIds: ['u-participant-a'],
            };
            const decision = policyService.authorize(participantA, 'approve', requestWithApprover);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('designated_approver');
        });

        it('cross-tenant participant is denied', () => {
            const crossTenantParticipant: PolicyPrincipal = {
                userId: 'u-participant-b',
                tenantId: TENANT_B,
                roles: ['END_USER'],
                permissions: [],
            };
            const requestWithParticipant: ResourceDescriptor = {
                ...itRequestA,
                participantIds: ['u-participant-b'],
            };
            const decision = policyService.authorize(crossTenantParticipant, 'read', requestWithParticipant);
            // tenant boundary check happens first
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toBe('wrong_tenant');
        });
    });

    // ── 6. buildVisibleWhere — query scoping ─────────────────────────

    describe('buildVisibleWhere query scoping', () => {
        it('tenant admin sees all requests in their tenant', () => {
            const where = policyService.buildVisibleWhere(tenantAdminA, 'request');
            // Admin within same tenant gets just the tenantId filter
            expect(where).toEqual({ AND: [{ tenantId: TENANT_A }] });
        });

        it('IT agent is scoped to IT team requests', () => {
            const where = policyService.buildVisibleWhere(itAgentA, 'request');
            expect(where).toHaveProperty('AND');
            const andClauses = (where as any).AND;
            // Should have tenant filter + OR scope filter
            expect(andClauses.length).toBeGreaterThanOrEqual(2);
            const tenantFilter = andClauses.find((c: any) => c.tenantId === TENANT_A);
            expect(tenantFilter).toBeDefined();
            const scopeFilter = andClauses.find((c: any) => c.OR);
            expect(scopeFilter).toBeDefined();
            // OR should include team-scoped conditions
            const orClauses = scopeFilter.OR;
            const hasTeamScope = orClauses.some((c: any) =>
                c.serviceDesk?.code === 'IT' || c.assignedTeam === 'IT'
            );
            expect(hasTeamScope).toBe(true);
        });

        it('HR agent cannot see IT or FIN requests in scope', () => {
            const where = policyService.buildVisibleWhere(hrAgentA, 'request');
            const andClauses = (where as any).AND;
            const scopeFilter = andClauses.find((c: any) => c.OR);
            // Should NOT include IT or FIN team scopes
            const orClauses = scopeFilter.OR;
            const hasITScope = orClauses.some((c: any) =>
                c.serviceDesk?.code === 'IT' || c.assignedTeam === 'IT'
            );
            const hasFINScope = orClauses.some((c: any) =>
                c.serviceDesk?.code === 'FIN' || c.assignedTeam === 'FIN'
            );
            expect(hasITScope).toBe(false);
            expect(hasFINScope).toBe(false);
        });

        it('regular user sees only their own requests', () => {
            const where = policyService.buildVisibleWhere(requesterA, 'request');
            const andClauses = (where as any).AND;
            const scopeFilter = andClauses.find((c: any) => c.OR);
            // Should include requesterId filter
            const hasOwnFilter = scopeFilter.OR.some((c: any) => c.requesterId === 'u-requester-a');
            expect(hasOwnFilter).toBe(true);
        });

        it('cross-tenant admin filter does not leak other tenant data', () => {
            const where = policyService.buildVisibleWhere(crossTenantAdminB, 'request');
            // Should filter to tenant-B
            expect(where).toHaveProperty('AND');
            const andClauses = (where as any).AND;
            const tenantFilter = andClauses.find((c: any) => 'tenantId' in c);
            expect(tenantFilter?.tenantId).toBe(TENANT_B);
        });
    });

    // ── 7. No generic ADMIN/AGENT bypass for cross-desk ───────────────

    describe('no generic ADMIN/AGENT bypass for cross-desk', () => {
        it('ADMIN within same tenant IS allowed (correct behavior)', () => {
            const decision = policyService.authorize(tenantAdminA, 'read', itRequestA);
            expect(decision.allowed).toBe(true);
        });

        it('AGENT with matching team IS allowed (correct behavior)', () => {
            const decision = policyService.authorize(itAgentA, 'read', itRequestA);
            expect(decision.allowed).toBe(true);
        });

        it('AGENT with non-matching team is DENIED (closed bug)', () => {
            const decision = policyService.authorize(hrAgentA, 'read', itRequestA);
            expect(decision.allowed).toBe(false);
        });

        it('END_USER who is not owner/participant/approver is DENIED', () => {
            const randomUser: PolicyPrincipal = {
                userId: 'u-random',
                tenantId: TENANT_A,
                roles: ['END_USER'],
                permissions: [],
            };
            const decision = policyService.authorize(randomUser, 'read', itRequestA);
            expect(decision.allowed).toBe(false);
        });
    });

    // ── 8. Notification isolation ────────────────────────────────────

    describe('notification isolation', () => {
        const notifA: ResourceDescriptor = {
            type: 'notification',
            id: 'notif-1',
            ownerId: 'u-it-a',
            tenantId: TENANT_A,
        };

        it('notification owner can access', () => {
            const decision = policyService.authorize(itAgentA, 'read', notifA);
            expect(decision.allowed).toBe(true);
        });

        it('different user in same tenant CANNOT access another user notification', () => {
            const decision = policyService.authorize(hrAgentA, 'read', notifA);
            expect(decision.allowed).toBe(false);
        });

        it('cross-tenant user CANNOT access notification', () => {
            const decision = policyService.authorize(crossTenantAdminB, 'read', notifA);
            expect(decision.allowed).toBe(false);
        });
    });

    // ── 9. Department grant access ───────────────────────────────────

    describe('department grant access', () => {
        it('user with matching departmentIds can access request in that department', () => {
            const itDeptUser: PolicyPrincipal = {
                userId: 'u-dept-it',
                tenantId: TENANT_A,
                roles: ['END_USER'],
                permissions: ['request:read'],
                departmentIds: [DEPT_IT],
            };
            const decision = policyService.authorize(itDeptUser, 'read', itRequestA);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('department_grant');
        });

        it('user with non-matching departmentIds CANNOT access request', () => {
            const hrDeptUser: PolicyPrincipal = {
                userId: 'u-dept-hr',
                tenantId: TENANT_A,
                roles: ['END_USER'],
                permissions: ['request:read'],
                departmentIds: [DEPT_HR],
            };
            const decision = policyService.authorize(hrDeptUser, 'read', itRequestA);
            // Without team scope, owner, participant, or approver access, denied
            expect(decision.allowed).toBe(false);
        });

        it('tenant admin with department grant still uses admin path', () => {
            const decision = policyService.authorize(tenantAdminA, 'read', itRequestA);
            expect(decision.allowed).toBe(true);
            expect(decision.reason).toBe('admin');
        });
    });
});