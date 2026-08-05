/**
 * Policy Service — P02 Task 8 (Findings #8–#12, #16, #55, #78)
 *
 * Central policy decision service. All access checks flow through
 * `authorize()`, producing a stable PolicyDecision with reason codes.
 * This replaces the hardcoded access logic in requestAccess.service.ts.
 *
 * Design principles:
 * 1. Never throw — return a decision object
 * 2. Deny by default — explicit allow list
 * 3. Tenant-first — wrong tenant → immediate deny
 * 4. Reason codes are stable and auditable
 */

import {
    PolicyAction,
    PolicyDecision,
    PolicyPrincipal,
    ResourceDescriptor,
    IPolicyService,
} from './policy.types';

// ── Executive roles with cross-desk visibility ─────────────────────────

const EXECUTIVE_ROLES = new Set(['CEO', 'CTO', 'CFO', 'GROUP_DCEO']);

// CEO can see these statuses for hiring/approval
const CEO_APPROVAL_STATUSES = new Set([
    'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
    'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
    'PENDING_CEO_APPROVAL_IT',
]);

// CTO can see these statuses
const CTO_APPROVAL_STATUSES = new Set([
    'PENDING_CTO_APPROVAL_IT',
]);

// CFO can see these statuses
const CFO_APPROVAL_STATUSES = new Set([
    'PENDING_CFO_APPROVAL_IT', 'PENDING_CFO_APPROVAL_FIN',
]);

// GROUP_DCEO can see these statuses (chargeback workflows)
const GROUP_DCEO_APPROVAL_STATUSES = new Set([
    'PENDING_GROUP_DCEO_APPROVAL',
    'PENDING_FROM_ENTITY_APPROVAL', 'FROM_ENTITY_REJECTED',
    'PENDING_TO_ENTITY_APPROVAL', 'TO_ENTITY_REJECTED',
    'CHARGEBACK_FINANCE_REVIEW',
    'AWAITING_CHARGEBACK_CONFIRMATION', 'CHARGEBACK_COMPLETED',
]);

// ── Policy Service Implementation ─────────────────────────────────────

class PolicyServiceImpl implements IPolicyService {

    /**
     * Authorize a principal's action on a resource.
     * Returns a PolicyDecision — never throws.
     */
    authorize(principal: PolicyPrincipal, action: PolicyAction, resource: ResourceDescriptor): PolicyDecision {
        // ── 1. Tenant boundary (if both have tenant) ──
        if (principal.tenantId && resource.tenantId && principal.tenantId !== resource.tenantId) {
            return { allowed: false, reason: 'wrong_tenant' };
        }

        // ── 2. Admin has universal access ──
        if (principal.roles.includes('ADMIN')) {
            return { allowed: true, reason: 'admin' };
        }

        // ── 3. Owner always has access ──
        if (resource.ownerId && principal.userId === resource.ownerId) {
            return { allowed: true, reason: 'owner' };
        }

        // ── 4. Assignee always has access ──
        if (resource.assignedToId && principal.userId === resource.assignedToId) {
            return { allowed: true, reason: 'owner' }; // assignee counts as owner
        }

        // ── 5. Participant access ──
        if (resource.participantIds && resource.participantIds.includes(principal.userId)) {
            return { allowed: true, reason: 'participant' };
        }

        // ── 6. Designated approver ──
        if (resource.approverIds && resource.approverIds.includes(principal.userId)) {
            return { allowed: true, reason: 'designated_approver' };
        }

        // ── 7. Team-scoped agent access (only when agent's team matches) ──
        // BUT: confidentiality blocks team scope unless agent is assignee or has explicit permission
        if (principal.roles.includes('AGENT') && principal.agentTeam) {
            const teamMatch = resource.serviceDeskCode === principal.agentTeam
                || resource.assignedTeam === principal.agentTeam;
            if (teamMatch) {
                // Confidentiality gate: team scope doesn't bypass confidentiality
                if (resource.isConfidential && !principal.permissions.includes('request:confidential') && principal.userId !== resource.ownerId && principal.userId !== resource.assignedToId) {
                    // Continue checking — maybe executive role or designated approver grants access
                } else if (action === 'read' || action === 'download' || action === 'update' || action === 'create' || action === 'manage' || action === 'assign') {
                    return { allowed: true, reason: 'team_scope' };
                }
            }
        }

        // ── 8. Executive role approval statuses ──
        if (resource.status) {
            if (principal.roles.includes('CEO') && CEO_APPROVAL_STATUSES.has(resource.status)) {
                return { allowed: true, reason: 'executive_role' };
            }
            if (principal.roles.includes('CTO') && CTO_APPROVAL_STATUSES.has(resource.status)) {
                return { allowed: true, reason: 'executive_role' };
            }
            if (principal.roles.includes('CFO') && CFO_APPROVAL_STATUSES.has(resource.status)) {
                return { allowed: true, reason: 'executive_role' };
            }
            if (principal.roles.includes('GROUP_DCEO') && GROUP_DCEO_APPROVAL_STATUSES.has(resource.status)) {
                return { allowed: true, reason: 'executive_role' };
            }
        }

        // ── 9. Department grant (future: from DepartmentMembership) ──
        if (principal.departmentIds && principal.departmentIds.length > 0 && resource.departmentId) {
            if (principal.departmentIds.includes(resource.departmentId)) {
                return { allowed: true, reason: 'department_grant' };
            }
        }

        // ── 10. Permission-based access (for non-request resources) ──
        // Requests use team scoping above — permissions alone don't grant
        // cross-team access. For other resources (reports, departments, etc.),
        // a matching permission is sufficient.
        if (resource.type !== 'request') {
            const permissionRequired = this.permissionForResource(action, resource.type);
            if (permissionRequired && principal.permissions.includes(permissionRequired)) {
                return { allowed: true, reason: 'admin' };
            }
        }

        // ── 11. Confidentiality gate ──
        if (action === 'confidential_read' || (action === 'read' && resource.isConfidential)) {
            if (!principal.permissions.includes('request:confidential')) {
                return { allowed: false, reason: 'confidential' };
            }
            // Has confidential permission but no other access path → deny
            return { allowed: false, reason: 'confidential' };
        }

        // ── Default: deny ──
        return { allowed: false, reason: 'insufficient_role' };
    }

    /**
     * Build a Prisma WhereInput that restricts queries to only resources
     * visible to the given principal. This replaces ad-hoc tenant filtering
     * in every controller.
     */
    buildVisibleWhere(principal: PolicyPrincipal, resourceType: string): Record<string, any> {
        const conditions: Record<string, any>[] = [];

        // ── Tenant boundary ──
        if (principal.tenantId) {
            conditions.push({ tenantId: principal.tenantId });
        }

        // ── Admin sees everything in their tenant ──
        if (principal.roles.includes('ADMIN')) {
            return conditions.length > 0 ? { AND: conditions } : {};
        }

        // ── For requests: owner, assignee, team, participant, or approver ──
        if (resourceType === 'request') {
            const orConditions: Record<string, any>[] = [
                { requesterId: principal.userId },
                { assignedToId: principal.userId },
            ];

            // Agent team scope
            if (principal.agentTeam) {
                orConditions.push({ serviceDesk: { code: principal.agentTeam } });
                orConditions.push({ assignedTeam: principal.agentTeam });
            }

            // Executive roles
            for (const role of principal.roles) {
                if (EXECUTIVE_ROLES.has(role)) {
                    orConditions.push({ approvals: { some: { approverId: principal.userId } } });
                    orConditions.push({ participants: { some: { userId: principal.userId } } });
                }
            }

            // Participant
            orConditions.push({ participants: { some: { userId: principal.userId } } });

            conditions.push({ OR: orConditions });
        }

        // ── For notifications: owner only ──
        if (resourceType === 'notification') {
            conditions.push({ userId: principal.userId });
        }

        // ── For files/attachments: via request ownership ──
        if (resourceType === 'file' || resourceType === 'attachment') {
            conditions.push({
                OR: [
                    { request: { requesterId: principal.userId } },
                    { request: { assignedToId: principal.userId } },
                    ...(principal.agentTeam ? [
                        { request: { serviceDesk: { code: principal.agentTeam } } },
                        { request: { assignedTeam: principal.agentTeam } },
                    ] : []),
                ],
            });
        }

        // ── For KB articles: department-scoped visibility ──
        // P02-11: KB articles follow request visibility — admin sees all,
        // agents see their service desk's articles, end users see published
        // articles in their department's service desk scope.
        if (resourceType === 'kb_article') {
            // Admin sees everything (tenant boundary already applied)
            if (!principal.roles.includes('ADMIN')) {
                const kbOrConditions: Record<string, any>[] = [];
                // Articles with no serviceDesk restriction (global)
                kbOrConditions.push({ serviceDeskId: null });
                // Articles in the agent's service desk scope
                if (principal.agentTeam) {
                    kbOrConditions.push({ serviceDesk: { code: principal.agentTeam } });
                }
                // End users can also see articles from their own department's desk
                if (principal.departmentIds && principal.departmentIds.length > 0) {
                    kbOrConditions.push({
                        serviceDesk: { departmentId: { in: principal.departmentIds } },
                    });
                }
                conditions.push({ OR: kbOrConditions });
            }
        }

        // ── For reports/search: same scope as requests ──
        // Reports and search results use the same visibility as 'request'
        // type — they query the request table, so they need the same
        // ownership/team/executive conditions.
        if (resourceType === 'report' || resourceType === 'search' || resourceType === 'export') {
            // Same logic as 'request' — reuse the OR conditions
            const orConditions: Record<string, any>[] = [
                { requesterId: principal.userId },
                { assignedToId: principal.userId },
            ];
            if (principal.agentTeam) {
                orConditions.push({ serviceDesk: { code: principal.agentTeam } });
                orConditions.push({ assignedTeam: principal.agentTeam });
            }
            for (const role of principal.roles) {
                if (EXECUTIVE_ROLES.has(role)) {
                    orConditions.push({ approvals: { some: { approverId: principal.userId } } });
                    orConditions.push({ participants: { some: { userId: principal.userId } } });
                }
            }
            orConditions.push({ participants: { some: { userId: principal.userId } } });
            conditions.push({ OR: orConditions });
        }

        return conditions.length > 0 ? { AND: conditions } : {};
    }

    /**
     * Map an action + resource type to the required permission string.
     * Returns undefined if no specific permission is required.
     */
    private permissionForResource(action: PolicyAction, resourceType: string): string | undefined {
        const permissionMap: Record<string, Record<string, string>> = {
            request: { read: 'request:read', create: 'request:create', update: 'request:update', delete: 'request:delete', approve: 'request:approve', reject: 'request:approve', export: 'request:export' },
            notification: { read: 'notification:read', update: 'notification:update', delete: 'notification:delete' },
            report: { read: 'report:read', export: 'report:export' },
            department: { read: 'department:read', manage: 'department:manage' },
            user: { read: 'user:read', create: 'user:manage', update: 'user:manage', delete: 'user:manage' },
            asset: { read: 'asset:read', create: 'asset:create', update: 'asset:update', delete: 'asset:delete' },
            creditApplication: { read: 'credit:read', create: 'credit:create', update: 'credit:update', approve: 'credit:approve', reject: 'credit:approve' },
        };
        return permissionMap[resourceType]?.[action];
    }
}

export const policyService = new PolicyServiceImpl();