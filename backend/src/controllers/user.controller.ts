import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PrismaClient, ExecutiveRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { sanitizeString } from '../utils/sanitize';
import { permissionService } from '../services/permission.service';
import { auditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth.middleware';
import { tokenService } from '../services/token.service';
import { validateExecutiveRoleAssignment } from '../utils/executive-role';

const prisma = new PrismaClient();

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
     * Get all users with pagination and filters (Admin only)
     */
    getAllUsers = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const {
            page = '1',
            limit = '10',
            search,
            department,
            isActive,
            role,
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
            ];
        }

        if (department) {
            where.department = department;
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (role) {
            where.roles = {
                some: {
                    role: { name: { equals: role as string, mode: 'insensitive' } },
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

    createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { firstName, lastName, email, department } = req.body;

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

        const TEMP_PASSWORD = 'abc@123';
        const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

        const normalStaffRole = await prisma.role.findFirst({ where: { name: 'NORMAL_STAFF' } });
        if (!normalStaffRole) throw new AppError('NORMAL_STAFF role not found in database', 500);

        const newUser = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: normalizedEmail,
                passwordHash: hashedPassword,
                department: department || null,
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
                    roles: (newUser as any).roles.map((ur: any) => ur.role.name),
                },
                tempPassword: TEMP_PASSWORD,
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

        // Hash the temporary password
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Update the user's password and set passwordChangedAt
        await prisma.user.update({
            where: { id },
            data: {
                passwordHash: hashedPassword,
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
}

export const userController = new UserController();
