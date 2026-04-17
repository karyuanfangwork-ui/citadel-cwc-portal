import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { tokenService } from '../services/token.service';

const prisma = new PrismaClient();

class UserController {
    /**
     * Get current user profile
     */
    getMe = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
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
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    avatarUrl: user.avatarUrl,
                    department: user.department,
                    jobTitle: user.jobTitle,
                    manager: user.manager,
                    roles: user.roles.map((ur) => ur.role.name),
                    createdAt: user.createdAt,
                },
            },
        });
    });

    /**
     * Update current user profile
     */
    updateMe = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { firstName, lastName, phone, avatarUrl, department, jobTitle } = req.body;

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
    getUserById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

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
    getAllUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    updateUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { firstName, lastName, phone, department, jobTitle, isActive, managerId, agentTeam } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                phone,
                department,
                jobTitle,
                isActive,
                managerId,
                agentTeam,
            },
        });

        res.json({
            status: 'success',
            data: { user },
        });
    });

    /**
     * Get all agents (AGENT or ADMIN roles)
     */
    getAgents = asyncHandler(async (req: AuthRequest, res: Response) => {
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
            },
            orderBy: { firstName: 'asc' },
        });

        res.json({ success: true, data: { agents } });
    });

    /**
     * Delete user by ID (Admin only)
     */
    deleteUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { id } = req.params;

        // Soft delete by deactivating
        await prisma.user.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            status: 'success',
            message: 'User deleted successfully',
        });
    });

    /**
     * Replace a user's roles atomically (Admin only)
     * Body: { roles: string[] } — array of role names e.g. ["USER", "CEO"]
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

        const updated = await prisma.user.findUnique({
            where: { id },
            include: { roles: { include: { role: true } } },
        });

        if (!updated) throw new AppError('User not found after role update', 500);

        res.json({
            status: 'success',
            data: {
                user: {
                    id: updated.id,
                    email: updated.email,
                    roles: updated.roles.map((ur: { role: { name: string } }) => ur.role.name),
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
}

export const userController = new UserController();
