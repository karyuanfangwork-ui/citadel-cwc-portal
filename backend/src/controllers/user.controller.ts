import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PrismaClient, ExecutiveRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { sanitizeString } from '../utils/sanitize';
import { permissionService } from '../services/permission.service';
import { auditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth.middleware';
import { tokenService } from '../services/token.service';
import { EXECUTIVE_HIERARCHY, validateExecutiveRoleAssignment } from '../utils/executive-role';
import { validatePassword } from '../utils/password';
import { logger } from '../utils/logger';
import {
  splitName,
  inferExecutiveRole,
  inferDepartment,
  inferAgentTeam,
  parseStaffRows,
  StaffRow,
  resolveEntityCode,
} from '../utils/importStaff';

const prisma = new PrismaClient();

function generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = `${upper}${lower}${digits}${symbols}`;
    const passwordChars = [upper, lower, digits, symbols].map((charset) => charset[crypto.randomInt(0, charset.length)]);

    while (passwordChars.length < 16) {
        passwordChars.push(all[crypto.randomInt(0, all.length)]);
    }

    for (let i = passwordChars.length - 1; i > 0; i -= 1) {
        const swapIndex = crypto.randomInt(0, i + 1);
        [passwordChars[i], passwordChars[swapIndex]] = [passwordChars[swapIndex], passwordChars[i]];
    }

    return passwordChars.join('');
}

function isExcelFileSignature(buffer: Buffer): boolean {
    if (buffer.length < 8) {
        return false;
    }

    const isZipContainer = buffer[0] === 0x50 && buffer[1] === 0x4b;
    const isOleWorkbook =
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0 &&
        buffer[4] === 0xa1 &&
        buffer[5] === 0xb1 &&
        buffer[6] === 0x1a &&
        buffer[7] === 0xe1;

    return isZipContainer || isOleWorkbook;
}

class UserController {
    /**
     * Get current user profile
     */
    getMe = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    entityId: user.entityId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    avatarUrl: user.avatarUrl,
                    department: user.department,
                    jobTitle: user.jobTitle,
                    manager: user.manager,
                    roles: user.roles.map((ur) => ur.role.name),
                    permissions: req.user?.permissions || [],
                    agentTeam: user.agentTeam,
                    createdAt: user.createdAt,
                },
            },
        });
    });

    /**
     * Update current user profile
     */
    updateMe = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { firstName: rawFirstName, lastName: rawLastName, phone, avatarUrl, department, jobTitle } = req.body;

        // Sanitize name fields
        const firstName = sanitizeString(rawFirstName);
        const lastName = sanitizeString(rawLastName);

        const user = await prisma.user.update({
            where: { id: req.user!.id },
            data: {
                firstName,
                lastName,
                phone,
                avatarUrl,
                department,
                jobTitle,
            },
        });

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    avatarUrl: user.avatarUrl,
                    department: user.department,
                    jobTitle: user.jobTitle,
                },
            },
        });
    });

    /**
     * Get user by ID (Admin only)
     */
    getUserById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = String(req.params.id);

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        res.json({
            status: 'success',
            data: { user },
        });
    });

    /**
     * Search users by name/email — lightweight endpoint for participant typeahead.
     * Returns minimal fields (id, firstName, lastName, email, avatarUrl) so any
     * authenticated user can find colleagues to add as participants.
     */
    searchUsers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { q, limit = '8' } = req.query;

        if (!q || typeof q !== 'string' || !q.trim()) {
            res.json({ status: 'success', data: { users: [] } });
            return;
        }

        const limitNum = Math.min(parseInt(limit as string, 10) || 8, 20);
        const search = q.trim();

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                ],
            },
            take: limitNum,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
            },
            orderBy: { firstName: 'asc' },
        });

        res.json({ status: 'success', data: { users } });
    });

    /**
     * Get all users with pagination and filters (Admin only)
     */
    getAllUsers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const {
            page = '1',
            limit = '10',
            search,
            department,
            isActive,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {};

        if (search) {
            where.OR = [
                { email: { contains: search as string, mode: 'insensitive' } },
                { firstName: { contains: search as string, mode: 'insensitive' } },
                { lastName: { contains: search as string, mode: 'insensitive' } },
                { department: { contains: search as string, mode: 'insensitive' } },
                { jobTitle: { contains: search as string, mode: 'insensitive' } },
                { entity: { code: { contains: search as string, mode: 'insensitive' } } },
                { entity: { name: { contains: search as string, mode: 'insensitive' } } },
            ];
        }

        if (department) {
            where.department = department;
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        // Support both ?role=SINGLE_ROLE (backward compat) and ?roles=ROLE1,ROLE2,ROLE3 (multi-role)
        const roleParam = (req.query.roles || req.query.role) as string | undefined;
        if (roleParam) {
            const roleList = roleParam.split(',').map(r => r.trim());
            where.roles = {
                some: {
                    role: { name: { in: roleList } },
                },
            };
        }

        // Get users and total count
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                    entity: {
                        select: { id: true, code: true, name: true },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            status: 'success',
            data: {
                users,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    });

    /**
     * Update user by ID (Admin only)
     */
    updateUser = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = String(req.params.id);
        const { firstName, lastName, email, phone, department, jobTitle, isActive, managerId, agentTeam, executiveRole, entityId } = req.body;

        // Email update logic
        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(normalizedEmail)) {
                throw new AppError('Invalid email format', 400);
            }

            const existing = await prisma.user.findFirst({
                where: { 
                    email: normalizedEmail,
                    NOT: { id } 
                }
            });
            if (existing) {
                throw new AppError('Email already in use by another user', 409);
            }

            // Update the email in the data object for the final update call
            req.body.email = normalizedEmail;
        }

        // Validate executive role assignment if being set/changed
        if (executiveRole !== undefined) {
            const user = await prisma.user.findUnique({
                where: { id },
                select: { department: true, jobTitle: true, email: true },
            });
            if (user && executiveRole) {
                const validation = validateExecutiveRoleAssignment(
                    { department: user.department, jobTitle: user.jobTitle } as any,
                    executiveRole as ExecutiveRole
                );
                if (!validation.valid) {
                    throw new AppError(validation.reason || 'Invalid executive role assignment', 400);
                }
            }
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                firstName: firstName ? sanitizeString(firstName) : undefined,
                lastName: lastName ? sanitizeString(lastName) : undefined,
                email: req.body.email,
                phone,
                department,
                jobTitle,
                isActive,
                managerId,
                agentTeam,
                executiveRole: executiveRole || null,
                ...(entityId !== undefined && { entityId: entityId || null }),
            },
        });

        await auditLog(req, 'USER_UPDATED', 'user', id, {
            firstName,
            lastName,
            email: req.body.email,
            department,
            jobTitle,
            isActive,
            executiveRole,
        });

        res.json({
            status: 'success',
            data: { user },
        });
    });

    /**
     * Get all agents (AGENT or ADMIN roles)
     */
    getAgents = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const agents = await prisma.user.findMany({
            where: {
                roles: { some: { role: { name: { in: ['AGENT', 'ADMIN'] } } } },
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                entityId: true,
            },
            orderBy: { firstName: 'asc' },
        });

        res.json({ success: true, data: { agents } });
    });

    /**
     * Get all active staff (any role) — used by reassignment modal so Agent/Admin
     * can reassign a ticket to any person in the system, not just agents.
     */
    getStaff = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const staff = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                roles: { select: { role: { select: { name: true } } } },
            },
            orderBy: { firstName: 'asc' },
        });

        res.json({ success: true, data: { staff } });
    });

    /**
     * Get active users with a given executiveRole (CEO / CTO / CFO / GROUP_DCEO / etc.)
     * Used by workflow modals (AcknowledgeModal, CeoDecisionModal, etc.) to let the
     * agent override the auto-selected approver before routing.
     *
     * Permission: any authenticated user who can route approvals (AGENT, ADMIN, executives).
     * No PII beyond name/email/role is exposed.
     */
    getExecutives = asyncHandler(async (req: AuthRequest, res: Response) => {
        const role = String(req.query.role || '').toUpperCase().trim();

        if (!role) {
            throw new AppError('Query param "role" is required (e.g. CEO, CTO, CFO, GROUP_DCEO)', 400);
        }
        if (!EXECUTIVE_HIERARCHY.includes(role as ExecutiveRole)) {
            throw new AppError(
                `Invalid executive role "${role}". Allowed: ${EXECUTIVE_HIERARCHY.join(', ')}`,
                400,
            );
        }

        const executives = await prisma.user.findMany({
            where: {
                executiveRole: role as ExecutiveRole,
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: true,
                executiveRole: true,
                entity: {
                    select: { id: true, code: true, name: true },
                },
            },
            orderBy: [{ entity: { code: 'asc' } }, { firstName: 'asc' }],
        });

        res.json({ success: true, data: { executives } });
    });

    /**
     * Delete user by ID (Admin only)
     */
    deleteUser = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = String(req.params.id);

        // Soft delete by deactivating
        await prisma.user.update({
            where: { id },
            data: { isActive: false },
        });

        await auditLog(req, 'USER_DEACTIVATED', 'user', id, { isActive: false });

        res.json({
            status: 'success',
            message: 'User deleted successfully',
        });
    });

    /**
     * Replace a user's roles atomically (Admin only)
     * Body: { roles: string[] } — array of role names e.g. ["NORMAL_STAFF", "CEO"]
     */
    assignRoles = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = req.params['id'] as string;
        const { roles } = req.body as { roles: string[] };

        if (!Array.isArray(roles) || roles.length === 0) {
            throw new AppError('roles must be a non-empty array of role names', 400);
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new AppError('User not found', 404);

        const roleRecords = await prisma.role.findMany({
            where: { name: { in: roles } },
        });

        if (roleRecords.length !== roles.length) {
            const found = roleRecords.map((r) => r.name);
            const invalid = roles.filter((r) => !found.includes(r));
            throw new AppError(`Unknown roles: ${invalid.join(', ')}`, 400);
        }

        // Replace all roles atomically
        await prisma.$transaction([
            prisma.userRole.deleteMany({ where: { userId: id } }),
            prisma.userRole.createMany({
                data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
            }),
        ]);

        // Force-revoke active tokens so new roles take effect immediately
        await tokenService.revokeAllForUser(id);

        // Invalidate RBAC cache for this user since their roles changed
        await permissionService.invalidateUserPermissionsCache(id);

        const updated = await prisma.user.findUnique({
            where: { id },
            include: { roles: { include: { role: true } } },
        });

        if (!updated) throw new AppError('User not found after role update', 500);

        const newRoleNames = updated.roles.map((ur: { role: { name: string } }) => ur.role.name);
        await auditLog(req, 'ROLES_ASSIGNED', 'user', id, {
            roles: newRoleNames,
            targetEmail: updated.email,
        });

        res.json({
            status: 'success',
            data: {
                user: {
                    id: updated.id,
                    email: updated.email,
                    roles: newRoleNames,
                },
            },
        });
    });

    /**
     * List all available roles (Admin only)
     */
    listRoles = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' },
        });
        res.json({ status: 'success', data: { roles } });
    });

    /**
     * List all permissions with which roles currently hold each (Admin only)
     */
    listPermissions = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const [permissions, roles] = await Promise.all([
            prisma.permission.findMany({
                include: { roles: { select: { roleId: true } } },
                orderBy: [{ resource: 'asc' }, { action: 'asc' }],
            }),
            prisma.role.findMany({ orderBy: { name: 'asc' } }),
        ]);
        res.json({ status: 'success', data: { permissions, roles } });
    });

    /**
     * Replace a role's permissions atomically (Admin only)
     * Body: { permissionIds: string[] }
     */
    updateRolePermissions = asyncHandler(async (req: AuthRequest, res: Response) => {
        const roleId = req.params.roleId as string;
        const { permissionIds } = req.body as { permissionIds: string[] };

        if (!Array.isArray(permissionIds)) {
            throw new AppError('permissionIds must be an array', 400);
        }

        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new AppError('Role not found', 404);

        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            ...(permissionIds.length > 0
                ? [prisma.rolePermission.createMany({
                    data: permissionIds.map(pid => ({ roleId, permissionId: pid })),
                    skipDuplicates: true,
                })]
                : []),
        ]);

        // Invalidate all RBAC cache — role permission changes affect every user with this role
        await permissionService.invalidateAllPermissionsCache();

        res.json({ status: 'success', data: { roleId, permissionIds } });
    });

    /**
     * Create a new role (Admin only)
     * Body: { name: string, description?: string }
     */
    createRole = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name: rawName, description } = req.body;

        if (!rawName || typeof rawName !== 'string') {
            throw new AppError('name is required', 400);
        }

        // Normalize to UPPERCASE_SNAKE_CASE
        const name = rawName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

        if (name.length < 2 || name.length > 50) {
            throw new AppError('Role name must be 2-50 characters (letters, digits, underscores)', 400);
        }

        const existing = await prisma.role.findUnique({ where: { name } });
        if (existing) {
            throw new AppError(`Role "${name}" already exists`, 409);
        }

        const role = await prisma.role.create({
            data: { name, description: description || null },
        });

        await auditLog(req, 'ROLE_CREATED', 'role', role.id, { name, description });

        res.status(201).json({ status: 'success', data: { role } });
    });

    /**
     * Update a role's name/description (Admin only)
     * Body: { name?: string, description?: string }
     */
    updateRole = asyncHandler(async (req: AuthRequest, res: Response) => {
        const roleId = req.params.roleId as string;
        const { name: rawName, description } = req.body;

        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) throw new AppError('Role not found', 404);

        const updateData: { name?: string; description?: string | null } = {};

        if (rawName !== undefined) {
            const name = rawName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            if (name.length < 2 || name.length > 50) {
                throw new AppError('Role name must be 2-50 characters (letters, digits, underscores)', 400);
            }
            if (name !== role.name) {
                const existing = await prisma.role.findUnique({ where: { name } });
                if (existing) throw new AppError(`Role "${name}" already exists`, 409);
            }
            updateData.name = name;
        }

        if (description !== undefined) {
            updateData.description = description || null;
        }

        const updated = await prisma.role.update({
            where: { id: roleId },
            data: updateData,
        });

        // Invalidate all RBAC cache since role name affects JWT claims
        await permissionService.invalidateAllPermissionsCache();

        await auditLog(req, 'ROLE_UPDATED', 'role', roleId, { ...updateData, oldName: role.name });

        res.json({ status: 'success', data: { role: updated } });
    });

    /**
     * Delete a role (Admin only)
     * Safeguard: cannot delete if any users are assigned to the role.
     */
    deleteRole = asyncHandler(async (req: AuthRequest, res: Response) => {
        const roleId = req.params.roleId as string;

        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: { users: true },
        });
        if (!role) throw new AppError('Role not found', 404);

        if (role.users.length > 0) {
            throw new AppError(
                `Cannot delete role "${role.name}" — ${role.users.length} user(s) are assigned. Remove role from users first.`,
                400
            );
        }

        // Delete role permissions first, then the role
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            prisma.role.delete({ where: { id: roleId } }),
        ]);

        await permissionService.invalidateAllPermissionsCache();

        await auditLog(req, 'ROLE_DELETED', 'role', roleId, { name: role.name });

        res.json({ status: 'success', message: `Role "${role.name}" deleted` });
    });

    /**
     * Create a new permission (Admin only)
     * Body: { name: string, resource: string, action: string, description?: string }
     */
    createPermission = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, resource, action, description } = req.body;

        if (!name || !resource || !action) {
            throw new AppError('name, resource, and action are required', 400);
        }

        // Auto-normalitize name to resource:action format if not provided
        const normalizedName = name.includes(':') ? name : `${resource}:${action}`;
        // Validate format
        if (!/^[a-z_]+:[a-z_]+$/.test(normalizedName)) {
            throw new AppError('Permission name must follow format "resource:action" (lowercase, underscores)', 400);
        }

        const existing = await prisma.permission.findUnique({ where: { name: normalizedName } });
        if (existing) {
            throw new AppError(`Permission "${normalizedName}" already exists`, 409);
        }

        const permission = await prisma.permission.create({
            data: { name: normalizedName, resource, action, description: description || null },
        });

        await auditLog(req, 'PERMISSION_CREATED', 'permission', permission.id, { name: normalizedName, resource, action });

        res.status(201).json({ status: 'success', data: { permission } });
    });

    /**
     * Delete a permission (Admin only)
     */
    deletePermission = asyncHandler(async (req: AuthRequest, res: Response) => {
        const permissionId = req.params.permissionId as string;

        const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
        if (!permission) throw new AppError('Permission not found', 404);

        // Delete all role-permission links first, then the permission
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { permissionId } }),
            prisma.permission.delete({ where: { id: permissionId } }),
        ]);

        await permissionService.invalidateAllPermissionsCache();

        await auditLog(req, 'PERMISSION_DELETED', 'permission', permissionId, { name: permission.name });

        res.json({ status: 'success', message: `Permission "${permission.name}" deleted` });
    });

    createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { firstName, lastName, email, department, jobTitle, entityId, executiveRole, agentTeam } = req.body;

        if (!firstName || !lastName || !email) {
            throw new AppError('firstName, lastName, and email are required', 400);
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            throw new AppError('Invalid email format', 400);
        }

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            throw new AppError('Email already in use', 409);
        }

        // Validate entityId if provided
        if (entityId) {
            const entity = await prisma.entity.findUnique({ where: { id: entityId } });
            if (!entity) {
                throw new AppError('Entity not found', 400);
            }
        }

        // Validate executive role if provided
        if (executiveRole) {
            const validRoles = ['CEO', 'CTO', 'CFO', 'CMO', 'COO', 'CHRO', 'GROUP_DCEO'];
            if (!validRoles.includes(executiveRole)) {
                throw new AppError(`Invalid executive role. Must be one of: ${validRoles.join(', ')}`, 400);
            }
        }

        const tempPassword = generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        const normalStaffRole = await prisma.role.findFirst({ where: { name: 'NORMAL_STAFF' } });
        if (!normalStaffRole) throw new AppError('NORMAL_STAFF role not found in database', 500);

        const newUser = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: normalizedEmail,
                passwordHash: hashedPassword,
                passwordChangedAt: null,
                department: department || null,
                jobTitle: jobTitle || null,
                entityId: entityId || null,
                executiveRole: executiveRole || null,
                agentTeam: agentTeam || null,
                isActive: true,
                roles: {
                    create: { roleId: normalStaffRole.id },
                },
            },
            include: {
                roles: { include: { role: true } },
            },
        });

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: newUser.id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    department: newUser.department,
                    jobTitle: newUser.jobTitle,
                    entityId: newUser.entityId,
                    executiveRole: newUser.executiveRole,
                    agentTeam: newUser.agentTeam,
                    roles: (newUser as any).roles.map((ur: any) => ur.role.name),
                },
                tempPassword,
            },
        });
    });

    /**
     * Reset a user's password (Admin only)
     * Generates a temporary password, hashes it, updates the user,
     * and revokes all active sessions.
     */
    resetUserPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const id = String(req.params.id);

        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Generate a random 16-char temporary password
        const tempPassword = crypto.randomBytes(12).toString('base64url').slice(0, 16);

        // Hash the temporary password (P0-6: salt rounds 12, was 10)
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        // Update the user's password, set mustResetPassword=true and passwordChangedAt
        await prisma.user.update({
            where: { id },
            data: {
                passwordHash: hashedPassword,
                mustResetPassword: true,
                passwordChangedAt: new Date(),
            },
        });

        // Revoke all active sessions so the user must log in with the new password
        await tokenService.revokeAllForUser(id);

        await auditLog(req, 'PASSWORD_RESET', 'user', id, {
            targetEmail: user.email,
        });

        res.json({
            status: 'success',
            data: { tempPassword },
        });
    });

    /**
     * Change current user's own password
     * PUT /api/v1/users/me/password
     * Requires current password verification. Invalidates all sessions on success.
     */
    changeMyPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new AppError('Current password is incorrect', 401);
        }

        // Validate new password strength (reuses existing policy)
        const validation = validatePassword(newPassword, user.email, user.firstName, user.lastName);
        if (!validation.isValid) {
            throw new AppError(validation.errors.join(', '), 400);
        }

        // Ensure new password is different from current
        const isSameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
        if (isSameAsOld) {
            throw new AppError('New password must be different from your current password', 400);
        }

        // Hash and update
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: hashedPassword,
                passwordChangedAt: new Date(),
            },
        });

        // Revoke all sessions and JWT tokens — forces re-login on all devices
        await prisma.session.deleteMany({ where: { userId } });
        await tokenService.revokeAllForUser(userId);

        await auditLog(req, 'PASSWORD_CHANGE', 'user', userId, {
            targetEmail: user.email,
        });

        logger.info(`User ${user.email} changed their own password`);

        res.json({
            status: 'success',
            message: 'Password changed successfully. Please log in again.',
        });
    });

    /**
     * Bulk import staff from Excel file upload
     * POST /api/v1/users/import
     * Expects multipart/form-data with field "file" containing .xlsx
     */
    importUsers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) {
            throw new AppError('No file uploaded. Please attach an .xlsx file.', 400);
        }

        if (!isExcelFileSignature(file.buffer)) {
            throw new AppError('Uploaded file is not a valid Excel workbook.', 400);
        }

        // Parse the Excel buffer
        let staffData: StaffRow[];
        try {
            const wb = xlsx.read(file.buffer, { type: 'buffer' });

            // Prefer "staff listing" sheet, fallback to first sheet
            const sheetName = wb.SheetNames.find(n =>
                n.toLowerCase().includes('staff listing') || n.toLowerCase().includes('staff'),
            );
            const targetSheet = sheetName || wb.SheetNames[0];
            if (!targetSheet) {
                throw new AppError('Excel file contains no sheets', 400);
            }

            const ws = wb.Sheets[targetSheet];
            const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
            staffData = parseStaffRows(rawData);
        } catch (err: any) {
            if (err instanceof AppError) throw err;
            throw new AppError(`Failed to parse Excel file: ${err.message}`, 400);
        }

        if (staffData.length === 0) {
            throw new AppError('No valid staff data found in Excel file. Ensure columns include: Display Name, Email, Job Title, Company/Entity.', 400);
        }

        // Pre-load required data
        const entities = await prisma.entity.findMany();
        const entityCodeToId: Record<string, string> = {};
        for (const e of entities) {
            entityCodeToId[e.code] = e.id;
        }
        // Build lightweight array for fuzzy entity resolution
        const dbEntityLookup = entities.map(e => ({ code: e.code, name: e.name }));

        const existingUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
                entityId: true,
                executiveRole: true,
                department: true,
                isActive: true,
            },
        });
        const existingByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));

        const normalStaffRole = await prisma.role.findFirst({ where: { name: 'NORMAL_STAFF' } });
        if (!normalStaffRole) throw new AppError('NORMAL_STAFF role not found in database', 500);

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let errorCount = 0;
        const temporaryCredentials: Array<{ email: string; tempPassword: string }> = [];

        const details: {
            email: string;
            displayName: string;
            action: 'created' | 'updated' | 'skipped' | 'error';
            message: string;
        }[] = [];

        for (const staff of staffData) {
            const email = staff.email.toLowerCase();
            const { firstName, lastName } = splitName(staff.displayName);
            const executiveRole = inferExecutiveRole(staff.jobTitle);
            const entityCode = resolveEntityCode(staff.company, dbEntityLookup);
            const entityId = entityCode ? entityCodeToId[entityCode] : null;
            const department = staff.department || inferDepartment(staff.jobTitle);
            const agentTeam = inferAgentTeam(staff.jobTitle);

            const existing = existingByEmail.get(email);

            if (existing) {
                // UPDATE existing user
                const updateData: any = {};

                if (existing.jobTitle !== staff.jobTitle) updateData.jobTitle = staff.jobTitle;
                if (existing.entityId !== entityId && entityId) updateData.entityId = entityId;
                if (existing.executiveRole !== executiveRole && executiveRole) updateData.executiveRole = executiveRole;
                if (existing.department !== department && department) updateData.department = department;

                if (existing.firstName !== firstName || existing.lastName !== lastName) {
                    updateData.firstName = firstName;
                    updateData.lastName = lastName;
                }

                if (staff.isActive !== undefined && existing.isActive !== staff.isActive) {
                    updateData.isActive = staff.isActive;
                }

                if (Object.keys(updateData).length > 0) {
                    try {
                        await prisma.user.update({ where: { id: existing.id }, data: updateData });
                        const changes = Object.keys(updateData).join(', ');
                        details.push({ email, displayName: staff.displayName, action: 'updated', message: `Updated: ${changes}` });
                        updated++;
                    } catch (err: any) {
                        details.push({ email, displayName: staff.displayName, action: 'error', message: err.message });
                        errorCount++;
                    }
                } else {
                    details.push({ email, displayName: staff.displayName, action: 'skipped', message: 'Up-to-date' });
                    skipped++;
                }
                continue;
            }

            // CREATE new user
            try {
                const tempPassword = generateTemporaryPassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 12);

                await prisma.user.create({
                    data: {
                        firstName,
                        lastName,
                        email,
                        passwordHash: hashedPassword,
                        passwordChangedAt: null,
                        jobTitle: staff.jobTitle,
                        department,
                        entityId,
                        executiveRole,
                        agentTeam,
                        isActive: staff.isActive !== undefined ? staff.isActive : true,
                        roles: {
                            create: { roleId: normalStaffRole.id },
                        },
                    },
                });
                details.push({
                    email,
                    displayName: staff.displayName,
                    action: 'created',
                    message: `entity=${entityCode || '?'}, execRole=${executiveRole || 'none'}`,
                });
                temporaryCredentials.push({ email, tempPassword });
                created++;
            } catch (err: any) {
                details.push({ email, displayName: staff.displayName, action: 'error', message: err.message });
                errorCount++;
            }
        }

        await auditLog(req, 'BULK_USER_IMPORT', 'user', 'bulk', {
            total: staffData.length,
            created,
            updated,
            skipped,
            errors: errorCount,
        });

        res.json({
            status: 'success',
            data: {
                summary: {
                    total: staffData.length,
                    created,
                    updated,
                    skipped,
                    errors: errorCount,
                },
                temporaryCredentials,
                details,
            },
        });
    });

    /**
     * Toggle out-of-office status for the current user.
     * PUT /api/v1/users/me/out-of-office
     * Body: { outOfOffice: boolean, outOfOfficeUntil?: string (ISO date), outOfOfficeMessage?: string }
     */
    updateOutOfOffice = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const { outOfOffice, outOfOfficeUntil, outOfOfficeMessage } = req.body;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                outOfOffice: !!outOfOffice,
                outOfOfficeUntil: outOfOfficeUntil ? new Date(outOfOfficeUntil) : null,
                outOfOfficeMessage: outOfOfficeMessage || null,
            },
            select: {
                id: true,
                outOfOffice: true,
                outOfOfficeUntil: true,
                outOfOfficeMessage: true,
                delegationEnabled: true,
                delegatedToId: true,
            },
        });

        res.json({ status: 'success', data: updated });
    });

    /**
     * Update delegation settings for the current user.
     * PUT /api/v1/users/me/delegation
     * Body: { delegationEnabled: boolean, delegatedToId?: string }
     */
    updateDelegation = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const { delegationEnabled, delegatedToId } = req.body;

        // Validate delegatedToId if provided
        if (delegatedToId) {
            const delegate = await prisma.user.findUnique({
                where: { id: delegatedToId },
                select: { id: true, firstName: true, lastName: true, isActive: true },
            });
            if (!delegate || !delegate.isActive) {
                return res.status(400).json({ status: 'error', message: 'Delegate user not found or inactive' });
            }
            // Cannot delegate to yourself
            if (delegatedToId === userId) {
                return res.status(400).json({ status: 'error', message: 'Cannot delegate to yourself' });
            }
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                delegationEnabled: !!delegationEnabled,
                delegatedToId: delegationEnabled ? (delegatedToId || null) : null,
            },
            select: {
                id: true,
                delegationEnabled: true,
                delegatedToId: true,
                delegatedTo: delegationEnabled && delegatedToId
                    ? { select: { id: true, firstName: true, lastName: true, email: true } }
                    : undefined,
            },
        });

        res.json({ status: 'success', data: updated });
    });

    /**
     * Search users for delegation (typeahead).
     * GET /api/v1/users/me/delegation/search?q=term
     */
    searchDelegates = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const { q } = req.query;
        const term = String(q || '').trim();

        if (!term || term.length < 2) {
            return res.json({ status: 'success', data: [] });
        }

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                id: { not: userId },
                OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                ],
            },
            select: { id: true, firstName: true, lastName: true, email: true, department: true },
            take: 10,
            orderBy: [{ firstName: 'asc' }],
        });

        res.json({ status: 'success', data: users });
    });

    /**
     * Get users who have delegated to the current user (incoming delegations).
     * GET /api/v1/users/me/delegation/incoming
     */
    getIncomingDelegations = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;

        const delegators = await prisma.user.findMany({
            where: {
                delegationEnabled: true,
                delegatedToId: userId,
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                outOfOffice: true,
                outOfOfficeUntil: true,
                outOfOfficeMessage: true,
            },
        });

        res.json({ status: 'success', data: delegators });
    });
}

export const userController = new UserController();
