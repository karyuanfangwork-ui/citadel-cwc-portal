/**
 * Policy Service Tests — P02 Task 8 (Findings #8–#12, #16, #55, #78)
 *
 * Tests the central policy decision table with a complete role × tenant ×
 * department × ownership × classification matrix.
 */

import { describe, it, expect } from '@jest/globals';
import { policyService } from '../../security/policy.service';
import { PolicyPrincipal, PolicyAction, ResourceDescriptor, PolicyDecision } from '../../security/policy.types';

// ── Test Principals ────────────────────────────────────────────────────

const admin: PolicyPrincipal = {
    userId: 'u-admin',
    tenantId: 'tenant-a',
    roles: ['ADMIN'],
    permissions: [],
};

const itAgent: PolicyPrincipal = {
    userId: 'u-it-agent',
    tenantId: 'tenant-a',
    roles: ['AGENT'],
    permissions: ['request:read'],
    agentTeam: 'IT',
};

const hrAgent: PolicyPrincipal = {
    userId: 'u-hr-agent',
    tenantId: 'tenant-a',
    roles: ['AGENT'],
    permissions: ['request:read'],
    agentTeam: 'HR',
};

const requester: PolicyPrincipal = {
    userId: 'u-requester',
    tenantId: 'tenant-a',
    roles: ['END_USER'],
    permissions: ['request:create'],
};

const ceo: PolicyPrincipal = {
    userId: 'u-ceo',
    tenantId: 'tenant-a',
    roles: ['CEO'],
    permissions: [],
};

const cfo: PolicyPrincipal = {
    userId: 'u-cfo',
    tenantId: 'tenant-a',
    roles: ['CFO'],
    permissions: [],
};

const groupDceo: PolicyPrincipal = {
    userId: 'u-gdceo',
    tenantId: 'tenant-a',
    roles: ['GROUP_DCEO'],
    permissions: [],
};

const crossTenantAdmin: PolicyPrincipal = {
    userId: 'u-admin-b',
    tenantId: 'tenant-b',
    roles: ['ADMIN'],
    permissions: [],
};

const userWithConfidentialPerm: PolicyPrincipal = {
    userId: 'u-conf-user',
    tenantId: 'tenant-a',
    roles: ['AGENT'],
    permissions: ['request:confidential'],
    agentTeam: 'IT',
};

// ── Test Resources ─────────────────────────────────────────────────────

const ownItRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-1',
    ownerId: 'u-requester',
    tenantId: 'tenant-a',
    assignedToId: 'u-it-agent',
    isConfidential: false,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

const hrRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-2',
    ownerId: 'u-hr-user',
    tenantId: 'tenant-a',
    assignedToId: 'u-hr-agent',
    isConfidential: false,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

const confidentialRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-3',
    ownerId: 'u-other-user',
    tenantId: 'tenant-a',
    assignedToId: 'u-some-agent',
    isConfidential: true,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

// Confidential request owned by the requester — owner should still have access
const ownConfidentialRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-3b',
    ownerId: 'u-requester',
    tenantId: 'tenant-a',
    assignedToId: 'u-some-agent',
    isConfidential: true,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

// IT request where IT agent is NOT the assignee — tests team_scope specifically
const itRequestOtherAssignee: ResourceDescriptor = {
    type: 'request',
    id: 'req-1b',
    ownerId: 'u-requester',
    tenantId: 'tenant-a',
    assignedToId: 'u-other-agent',  // different agent
    isConfidential: false,
    serviceDeskCode: 'IT',
    assignedTeam: 'IT',
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

const assignedFinance: ResourceDescriptor = {
    type: 'request',
    id: 'req-4',
    ownerId: 'u-finance-user',
    tenantId: 'tenant-a',
    assignedToId: 'u-cfo',
    isConfidential: false,
    serviceDeskCode: 'FIN',
    assignedTeam: 'FIN',
    status: 'PENDING_CFO_APPROVAL_FIN',
    approverIds: ['u-cfo'],
    participantIds: [],
};

// CEO approval request where CEO is NOT in the approverIds — tests executive_role specifically
const pendingCeoNoApprover: ResourceDescriptor = {
    type: 'request',
    id: 'req-5b',
    ownerId: 'u-hr-user',
    tenantId: 'tenant-a',
    assignedToId: 'u-hr-agent',
    isConfidential: false,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'PENDING_CEO_APPROVAL',
    approverIds: [],  // CEO not in approverIds — tests status-based check
    participantIds: [],
};

const pendingCeoApproval: ResourceDescriptor = {
    type: 'request',
    id: 'req-5',
    ownerId: 'u-hr-user',
    tenantId: 'tenant-a',
    assignedToId: 'u-hr-agent',
    isConfidential: false,
    serviceDeskCode: 'HR',
    assignedTeam: 'HR',
    status: 'PENDING_CEO_APPROVAL',
    approverIds: ['u-ceo'],
    participantIds: [],
};

const pendingGroupDceo: ResourceDescriptor = {
    type: 'request',
    id: 'req-6',
    ownerId: 'u-finance-user',
    tenantId: 'tenant-a',
    isConfidential: false,
    status: 'PENDING_GROUP_DCEO_APPROVAL',
    approverIds: ['u-gdceo'],
    participantIds: [],
};

const tenantBRequest: ResourceDescriptor = {
    type: 'request',
    id: 'req-7',
    ownerId: 'u-tenant-b-user',
    tenantId: 'tenant-b',
    isConfidential: false,
    status: 'IN_PROGRESS',
    approverIds: [],
    participantIds: [],
};

// ── Notification resource ──────────────────────────────────────────────

const ownNotification: ResourceDescriptor = {
    type: 'notification',
    id: 'notif-1',
    ownerId: 'u-requester',
    tenantId: 'tenant-a',
};

const otherNotification: ResourceDescriptor = {
    type: 'notification',
    id: 'notif-2',
    ownerId: 'u-it-agent',
    tenantId: 'tenant-a',
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('P02-08: Central Policy Decision Service', () => {
    describe('authorize — request access matrix', () => {
        it.each([
            // [name, principal, action, resource, allowed]
            ['requester reads own IT request', requester, 'read', ownItRequest, true],
            ['IT agent reads IT request (is assignee)', itAgent, 'read', ownItRequest, true],
            ['IT agent cannot read HR request (wrong team)', itAgent, 'read', hrRequest, false],
            ['HR agent reads HR request', hrAgent, 'read', hrRequest, true],
            ['admin reads any request', admin, 'read', hrRequest, true],
            ['CEO reads pending CEO approval (status-based)', ceo, 'read', pendingCeoNoApprover, true],
            ['CFO approves assigned finance request', cfo, 'approve', assignedFinance, true],
            ['GROUP_DCEO reads pending group DCEO approval', groupDceo, 'read', pendingGroupDceo, true],
            ['cross-tenant admin cannot read tenant-a request', crossTenantAdmin, 'read', ownItRequest, false],
            ['assignee reads assigned request', itAgent, 'read', ownItRequest, true],
            ['requester reads own confidential request', requester, 'read', ownConfidentialRequest, true],
            ['agent without confidential perm cannot read confidential request', itAgent, 'read', confidentialRequest, false],
        ] as [string, PolicyPrincipal, PolicyAction, ResourceDescriptor, boolean][]) (
            '%s',
            (_name, principal, action, resource, allowed) => {
                const decision = policyService.authorize(principal, action, resource);
                expect(decision.allowed).toBe(allowed);
            },
        );
    });

    describe('authorize — notification access', () => {
        it('allows owner to read own notification', () => {
            const decision = policyService.authorize(requester, 'read', ownNotification);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) {
                expect(decision.reason).toBe('owner');
            }
        });

        it('denies non-owner from reading notification', () => {
            const decision = policyService.authorize(hrAgent, 'read', otherNotification);
            expect(decision.allowed).toBe(false);
        });

        it('allows admin to read any notification', () => {
            const decision = policyService.authorize(admin, 'read', otherNotification);
            expect(decision.allowed).toBe(true);
        });
    });

    describe('authorize — decision reasons', () => {
        it('returns "admin" reason for admin access', () => {
            const decision = policyService.authorize(admin, 'read', ownItRequest);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('admin');
        });

        it('returns "owner" reason for owner access', () => {
            const decision = policyService.authorize(requester, 'read', ownItRequest);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('owner');
        });

        it('returns "team_scope" reason for agent team access', () => {
            const decision = policyService.authorize(itAgent, 'read', itRequestOtherAssignee);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('team_scope');
        });

        it('returns "executive_role" reason for CEO approval', () => {
            const decision = policyService.authorize(ceo, 'read', pendingCeoNoApprover);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('executive_role');
        });

        it('returns "wrong_tenant" reason for cross-tenant access', () => {
            const decision = policyService.authorize(crossTenantAdmin, 'read', ownItRequest);
            expect(decision.allowed).toBe(false);
            if (!decision.allowed) expect(decision.reason).toBe('wrong_tenant');
        });

        it('returns "insufficient_role" reason for wrong team', () => {
            const decision = policyService.authorize(itAgent, 'read', hrRequest);
            expect(decision.allowed).toBe(false);
            if (!decision.allowed) expect(decision.reason).toBe('insufficient_role');
        });
    });

    describe('buildVisibleWhere — request query scoping', () => {
        it('returns empty object for admin (sees all in tenant)', () => {
            const where = policyService.buildVisibleWhere(admin, 'request');
            expect(where).not.toHaveProperty('OR');
        });

        it('includes tenant filter for non-admin', () => {
            const where = policyService.buildVisibleWhere(itAgent, 'request');
            expect(where.AND).toBeDefined();
        });

        it('includes requesterId in OR conditions for requests', () => {
            const where = policyService.buildVisibleWhere(requester, 'request');
            const orConditions = (where.AND as any[]).find((c: any) => c.OR)?.OR;
            expect(orConditions).toBeDefined();
            expect(orConditions.some((c: any) => 'requesterId' in c)).toBe(true);
        });

        it('includes agent team scope in OR conditions', () => {
            const where = policyService.buildVisibleWhere(itAgent, 'request');
            const orConditions = (where.AND as any[]).find((c: any) => c.OR)?.OR;
            expect(orConditions.some((c: any) => c.serviceDesk)).toBe(true);
        });

        it('scopes notifications to userId only', () => {
            const where = policyService.buildVisibleWhere(requester, 'notification');
            const andConditions = where.AND as any[];
            const userIdFilter = andConditions.find((c: any) => 'userId' in c);
            expect(userIdFilter).toBeDefined();
            expect(userIdFilter.userId).toBe('u-requester');
        });
    });

    describe('authorize — participant access', () => {
        const participantRequest: ResourceDescriptor = {
            type: 'request',
            id: 'req-part',
            ownerId: 'u-other-user',
            tenantId: 'tenant-a',
            status: 'IN_PROGRESS',
            approverIds: [],
            participantIds: ['u-requester'],
        };

        it('allows participant to read', () => {
            const decision = policyService.authorize(requester, 'read', participantRequest);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('participant');
        });
    });

    describe('authorize — designated approver', () => {
        const approvalRequest: ResourceDescriptor = {
            type: 'request',
            id: 'req-approval',
            ownerId: 'u-other-user',
            tenantId: 'tenant-a',
            status: 'PENDING_APPROVAL',
            approverIds: ['u-cfo'],
            participantIds: [],
        };

        it('allows designated approver to approve', () => {
            const decision = policyService.authorize(cfo, 'approve', approvalRequest);
            expect(decision.allowed).toBe(true);
            if (decision.allowed) expect(decision.reason).toBe('designated_approver');
        });
    });
});