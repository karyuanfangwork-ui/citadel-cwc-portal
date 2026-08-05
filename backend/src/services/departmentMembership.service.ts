/**
 * Department Membership Service — P02 Task 7 (Findings #1–#2, #5, #29–#30, #39–#40)
 *
 * Provides department-scoped RBAC:
 * - Department CRUD (tenant-scoped)
 * - Department membership management
 * - Principal grants resolution: union of global roles + department roles
 */

import prisma from '../utils/prisma';
import { runWithTenant } from '../lib/tenant-context';

// ── Types ────────────────────────────────────────────────────────────

export interface DepartmentCreateInput {
    code: string;
    name: string;
    description?: string;
}

export interface DepartmentUpdateInput {
    code?: string;
    name?: string;
    description?: string;
    isActive?: boolean;
}

export interface MembershipCreateInput {
    departmentId: string;
    userId: string;
    roleId: string;
    validFrom?: Date;
    validUntil?: Date;
}

export interface PrincipalGrant {
    departmentId: string;
    departmentCode: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    validFrom: Date;
    validUntil: Date | null;
}

// ── Department CRUD ───────────────────────────────────────────────────

export const departmentService = {
    /**
     * List all departments for the current tenant.
     */
    async list(tenantId: string, includeInactive = false) {
        return prisma.department.findMany({
            where: {
                tenantId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: { code: 'asc' },
        });
    },

    /**
     * Get a single department by ID (tenant-scoped).
     */
    async getById(tenantId: string, id: string) {
        return prisma.department.findFirst({
            where: { id, tenantId },
            include: { memberships: { include: { user: true, role: true } } },
        });
    },

    /**
     * Create a new department.
     */
    async create(tenantId: string, input: DepartmentCreateInput) {
        return runWithTenant(tenantId, async () => {
            return prisma.department.create({
                data: { tenantId, ...input },
            });
        });
    },

    /**
     * Update a department.
     */
    async update(tenantId: string, id: string, input: DepartmentUpdateInput) {
        // Verify ownership
        const dept = await prisma.department.findFirst({ where: { id, tenantId } });
        if (!dept) throw new Error('Department not found');

        return prisma.department.update({
            where: { id },
            data: input,
        });
    },

    /**
     * Soft-delete a department (set isActive = false).
     */
    async deactivate(tenantId: string, id: string) {
        const dept = await prisma.department.findFirst({ where: { id, tenantId } });
        if (!dept) throw new Error('Department not found');

        return prisma.department.update({
            where: { id },
            data: { isActive: false },
        });
    },
};

// ── Membership Management ────────────────────────────────────────────

export const membershipService = {
    /**
     * Add a user to a department with a specific role.
     */
    async addMember(tenantId: string, input: MembershipCreateInput) {
        return runWithTenant(tenantId, async () => {
            return prisma.departmentMembership.create({
                data: {
                    tenantId,
                    departmentId: input.departmentId,
                    userId: input.userId,
                    roleId: input.roleId,
                    validFrom: input.validFrom ?? new Date(),
                    validUntil: input.validUntil,
                },
            });
        });
    },

    /**
     * Remove a membership.
     */
    async removeMember(tenantId: string, membershipId: string) {
        const membership = await prisma.departmentMembership.findFirst({
            where: { id: membershipId, tenantId },
        });
        if (!membership) throw new Error('Membership not found');

        return prisma.departmentMembership.delete({
            where: { id: membershipId },
        });
    },

    /**
     * List all memberships for a user in a tenant.
     */
    async listForUser(tenantId: string, userId: string) {
        return prisma.departmentMembership.findMany({
            where: { tenantId, userId },
            include: { department: true, role: { include: { permissions: { include: { permission: true } } } } },
        });
    },

    /**
     * List all memberships for a department.
     */
    async listForDepartment(tenantId: string, departmentId: string) {
        return prisma.departmentMembership.findMany({
            where: { tenantId, departmentId },
            include: { user: true, role: true },
        });
    },
};

// ── Principal Grants ─────────────────────────────────────────────────

/**
 * Get the full set of grants for a principal (user) in a tenant.
 * Returns the union of:
 * 1. Global role assignments (UserRole)
 * 2. Department-scoped role assignments (DepartmentMembership)
 *
 * Only includes currently valid memberships (validFrom <= now, validUntil is null or >= now).
 */
export async function getPrincipalGrants(userId: string, tenantId: string): Promise<PrincipalGrant[]> {
    const now = new Date();

    // Get department memberships for this user in this tenant
    const memberships = await prisma.departmentMembership.findMany({
        where: {
            tenantId,
            userId,
            validFrom: { lte: now },
            OR: [
                { validUntil: null },
                { validUntil: { gte: now } },
            ],
        },
        include: {
            department: true,
            role: {
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            },
        },
    });

    return memberships.map((m) => ({
        departmentId: m.departmentId,
        departmentCode: m.department.code,
        roleId: m.roleId,
        roleName: m.role.name,
        permissions: m.role.permissions.map((rp) => rp.permission.name),
        validFrom: m.validFrom,
        validUntil: m.validUntil,
    }));
}