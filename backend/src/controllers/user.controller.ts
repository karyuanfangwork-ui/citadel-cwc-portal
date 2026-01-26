import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

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
        const { firstName, lastName, phone, department, jobTitle, isActive, managerId } = req.body;

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
            },
        });

        res.json({
            status: 'success',
            data: { user },
        });
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
}

export const userController = new UserController();
