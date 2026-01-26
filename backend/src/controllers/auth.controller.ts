import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

class AuthController {
    /**
     * Register a new user
     */
    register = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { email, password, firstName, lastName, department, jobTitle } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new AppError('User with this email already exists', 400);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                department,
                jobTitle,
            },
        });

        // Assign default USER role
        const userRole = await prisma.role.findUnique({
            where: { name: 'USER' },
        });

        if (userRole) {
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: userRole.id,
                },
            });
        }

        // Generate tokens
        const accessToken = this.generateAccessToken(user.id, user.email);
        const refreshToken = this.generateRefreshToken(user.id, user.email);

        // Create session
        await prisma.session.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });

        logger.info(`New user registered: ${user.email}`);

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
                accessToken,
                refreshToken,
            },
        });
    });

    /**
     * Login user
     */
    login = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { email, password } = req.body;

        // Find user with roles
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        if (!user.isActive) {
            throw new AppError('Account is inactive', 401);
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        // Generate tokens
        const accessToken = this.generateAccessToken(user.id, user.email);
        const refreshToken = this.generateRefreshToken(user.id, user.email);

        // Create session
        await prisma.session.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        logger.info(`User logged in: ${user.email}`);

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    roles: user.roles.map((ur) => ur.role.name),
                },
                accessToken,
                refreshToken,
            },
        });
    });

    /**
     * Logout user
     */
    logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            // Delete session
            await prisma.session.deleteMany({
                where: { token },
            });
        }

        res.json({
            status: 'success',
            message: 'Logged out successfully',
        });
    });

    /**
     * Refresh access token
     */
    refreshToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError('Refresh token is required', 400);
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
                userId: string;
                email: string;
            };
        } catch (error) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        // Check if session exists
        const session = await prisma.session.findFirst({
            where: {
                token: refreshToken,
                userId: decoded.userId,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!session) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        // Generate new access token
        const accessToken = this.generateAccessToken(decoded.userId, decoded.email);

        res.json({
            status: 'success',
            data: {
                accessToken,
            },
        });
    });

    /**
     * Forgot password
     */
    forgotPassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { email } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        // Don't reveal if user exists
        res.json({
            status: 'success',
            message: 'If the email exists, a password reset link has been sent',
        });

        if (!user) {
            return;
        }

        // TODO: Generate reset token and send email
        // This would typically involve:
        // 1. Generate a unique reset token
        // 2. Store it in database with expiry
        // 3. Send email with reset link
        logger.info(`Password reset requested for: ${email}`);
    });

    /**
     * Reset password
     */
    resetPassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { token, newPassword } = req.body;

        // TODO: Verify reset token and update password
        // This would typically involve:
        // 1. Verify token is valid and not expired
        // 2. Hash new password
        // 3. Update user password
        // 4. Invalidate reset token

        res.json({
            status: 'success',
            message: 'Password reset successful',
        });
    });

    /**
     * Generate access token
     */
    private generateAccessToken(userId: string, email: string): string {
        return jwt.sign(
            { userId, email },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );
    }

    /**
     * Generate refresh token
     */
    private generateRefreshToken(userId: string, email: string): string {
        return jwt.sign(
            { userId, email },
            config.jwt.refreshSecret,
            { expiresIn: config.jwt.refreshExpiresIn }
        );
    }
}

export const authController = new AuthController();
