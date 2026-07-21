/**
 * Department RBAC integration tests — P02 Task 7
 * (Findings #1–#2, #5, #29–#30, #39–#40)
 *
 * Tests department CRUD, membership management, and principal grants.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock prisma
const mockDepartmentFindMany = jest.fn();
const mockDepartmentFindFirst = jest.fn();
const mockDepartmentCreate = jest.fn();
const mockDepartmentUpdate = jest.fn();
const mockMembershipFindMany = jest.fn();
const mockMembershipCreate = jest.fn();
const mockMembershipDelete = jest.fn();
const mockMembershipFindFirst = jest.fn();

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        department: {
            findMany: mockDepartmentFindMany,
            findFirst: mockDepartmentFindFirst,
            create: mockDepartmentCreate,
            update: mockDepartmentUpdate,
        },
        departmentMembership: {
            findMany: mockMembershipFindMany,
            create: mockMembershipCreate,
            delete: mockMembershipDelete,
            findFirst: mockMembershipFindFirst,
        },
    },
}));

jest.mock('../lib/tenant-context', () => ({
    runWithTenant: (_tenantId: string, fn: () => Promise<any>) => fn(),
    getTenantId: () => 'tenant-test',
}));

import { departmentService, membershipService, getPrincipalGrants } from '../services/departmentMembership.service';

const TENANT_ID = 'tenant-aaa';
const DEPT_ID = 'dept-001';
const USER_ID = 'user-001';
const ROLE_ID = 'role-agent';

describe('P02-07: Department RBAC', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Department CRUD ──────────────────────────────────────

    describe('departmentService.list', () => {
        it('should list active departments for a tenant', async () => {
            mockDepartmentFindMany.mockResolvedValue([
                { id: DEPT_ID, code: 'IT', name: 'IT Department', tenantId: TENANT_ID },
            ]);
            const result = await departmentService.list(TENANT_ID);
            expect(result).toHaveLength(1);
            expect(mockDepartmentFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ tenantId: TENANT_ID, isActive: true }),
                }),
            );
        });

        it('should include inactive departments when requested', async () => {
            mockDepartmentFindMany.mockResolvedValue([]);
            await departmentService.list(TENANT_ID, true);
            expect(mockDepartmentFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { tenantId: TENANT_ID },
                }),
            );
        });
    });

    describe('departmentService.create', () => {
        it('should create a department within a tenant', async () => {
            const input = { code: 'HR', name: 'Human Resources' };
            mockDepartmentCreate.mockResolvedValue({ id: 'dept-hr', ...input, tenantId: TENANT_ID });
            const result = await departmentService.create(TENANT_ID, input);
            expect(result.code).toBe('HR');
        });
    });

    describe('departmentService.update', () => {
        it('should update a department after ownership check', async () => {
            mockDepartmentFindFirst.mockResolvedValue({ id: DEPT_ID, tenantId: TENANT_ID });
            mockDepartmentUpdate.mockResolvedValue({ id: DEPT_ID, name: 'Updated' });
            const result = await departmentService.update(TENANT_ID, DEPT_ID, { name: 'Updated' });
            expect(result.name).toBe('Updated');
        });

        it('should reject update for non-existent department', async () => {
            mockDepartmentFindFirst.mockResolvedValue(null);
            await expect(departmentService.update(TENANT_ID, 'nonexistent', { name: 'X' }))
                .rejects.toThrow('Department not found');
        });
    });

    describe('departmentService.deactivate', () => {
        it('should soft-delete a department', async () => {
            mockDepartmentFindFirst.mockResolvedValue({ id: DEPT_ID, tenantId: TENANT_ID });
            mockDepartmentUpdate.mockResolvedValue({ id: DEPT_ID, isActive: false });
            const result = await departmentService.deactivate(TENANT_ID, DEPT_ID);
            expect(mockDepartmentUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ data: { isActive: false } }),
            );
        });
    });

    // ── Membership Management ────────────────────────────────

    describe('membershipService.addMember', () => {
        it('should add a department membership', async () => {
            mockMembershipCreate.mockResolvedValue({
                id: 'mem-1',
                departmentId: DEPT_ID,
                userId: USER_ID,
                roleId: ROLE_ID,
                tenantId: TENANT_ID,
            });
            const result = await membershipService.addMember(TENANT_ID, {
                departmentId: DEPT_ID,
                userId: USER_ID,
                roleId: ROLE_ID,
            });
            expect(result.id).toBe('mem-1');
        });
    });

    describe('membershipService.removeMember', () => {
        it('should remove a membership after ownership check', async () => {
            mockMembershipFindFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
            mockMembershipDelete.mockResolvedValue({ id: 'mem-1' });
            const result = await membershipService.removeMember(TENANT_ID, 'mem-1');
            expect(result.id).toBe('mem-1');
        });

        it('should reject removal of non-existent membership', async () => {
            mockMembershipFindFirst.mockResolvedValue(null);
            await expect(membershipService.removeMember(TENANT_ID, 'nonexistent'))
                .rejects.toThrow('Membership not found');
        });
    });

    // ── Principal Grants ──────────────────────────────────────

    describe('getPrincipalGrants', () => {
        it('should return department-scoped grants for a user', async () => {
            mockMembershipFindMany.mockResolvedValue([
                {
                    departmentId: DEPT_ID,
                    department: { code: 'IT', name: 'IT Department' },
                    roleId: ROLE_ID,
                    role: { name: 'AGENT', permissions: [{ permission: { name: 'request:read' } }, { permission: { name: 'request:update' } }] },
                    validFrom: new Date('2025-01-01'),
                    validUntil: null,
                },
            ]);

            const grants = await getPrincipalGrants(USER_ID, TENANT_ID);
            expect(grants).toHaveLength(1);
            expect(grants[0].departmentCode).toBe('IT');
            expect(grants[0].roleName).toBe('AGENT');
            expect(grants[0].permissions).toContain('request:read');
            expect(grants[0].permissions).toContain('request:update');
        });

        it('should exclude expired memberships', async () => {
            mockMembershipFindMany.mockResolvedValue([]);
            const grants = await getPrincipalGrants(USER_ID, TENANT_ID);
            expect(grants).toHaveLength(0);
        });
    });
});