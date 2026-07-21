/**
 * Policy Types — P02 Task 8 (Findings #8–#12, #16, #55, #78)
 *
 * Defines the type contracts for the central policy decision service.
 * All resource access checks should flow through `authorize()`, producing
 * a stable PolicyDecision with reason codes — never throw directly.
 */

// ── Policy Actions ────────────────────────────────────────────────────

export type PolicyAction =
    | 'read'
    | 'create'
    | 'update'
    | 'delete'
    | 'approve'
    | 'reject'
    | 'assign'
    | 'escalate'
    | 'export'
    | 'manage'
    | 'confidential_read';

// ── Policy Decision ───────────────────────────────────────────────────

export type PolicyDecision =
    | { allowed: true; reason: 'owner' | 'admin' | 'team_scope' | 'participant' | 'designated_approver' | 'executive_role' | 'department_grant' | 'platform'; allowedFields?: string[] }
    | { allowed: false; reason: 'not_owner' | 'not_in_team' | 'confidential' | 'no_grant' | 'wrong_tenant' | 'wrong_department' | 'insufficient_role' };

// ── Principal ─────────────────────────────────────────────────────────

export interface PolicyPrincipal {
    userId: string;
    tenantId?: string;
    roles: string[];
    permissions: string[];
    agentTeam?: string | null;
    departmentIds?: string[];
}

// ── Resource Descriptor ───────────────────────────────────────────────

export interface ResourceDescriptor {
    type: string;            // e.g. 'request', 'notification', 'file', 'report'
    id?: string;             // instance id (for object-level checks)
    ownerId?: string;        // who owns/created this resource
    tenantId?: string;       // which tenant owns this resource
    assignedToId?: string;    // who is assigned
    isConfidential?: boolean;
    serviceDeskCode?: string;
    assignedTeam?: string;
    status?: string;
    approverIds?: string[];
    participantIds?: string[];
    departmentId?: string;   // which department this belongs to
}

// ── Scope Loader ──────────────────────────────────────────────────────

/**
 * A function that loads the resource descriptor from the request.
 * Used by the authorizeResource middleware.
 */
export type ScopeLoader = (req: import('express').Request, principal: PolicyPrincipal) => Promise<ResourceDescriptor>;

// ── Policy Service Interface ──────────────────────────────────────────

export interface IPolicyService {
    authorize(principal: PolicyPrincipal, action: PolicyAction, resource: ResourceDescriptor): PolicyDecision;
    buildVisibleWhere(principal: PolicyPrincipal, resourceType: string): Record<string, any>;
}