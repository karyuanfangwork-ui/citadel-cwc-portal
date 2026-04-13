import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';
import { tokenService } from '../services/token.service';
import { passwordResetService } from '../services/password-reset.service';
import { sendEmail } from '../services/email.service';

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateAccessToken(userId: string, email: string): { token: string; jti: string } {
    const jti = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = jwt.sign({ userId, email, jti }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any,
        algorithm: 'HS256',
    });
    return { token, jti };
}

function generateRefreshToken(userId: string, email: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign({ userId, email }, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn as any,
        algorithm: 'HS256',
    });
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const cookieBase = {
        httpOnly: true,
        secure: config.cookie.secure,
        sameSite: config.cookie.sameSite,
        domain: config.cookie.domain,
    };

    res.cookie('access_token', accessToken, {
        ...cookieBase,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
        ...cookieBase,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth/refresh',
    });
}

function clearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}

// ─── Controller ─────────────────────────────────────────────────────────────

class AuthController {
    register = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email, password, firstName, lastName, department, jobTitle } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError('User with this email already exists', 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { email, passwordHash, firstName, lastName, department, jobTitle },
        });

        const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
        if (userRole) {
            await prisma.userRole.create({ data: { userId: user.id, roleId: userRole.id } });
        }

        const { token: accessToken } = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        await prisma.session.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });

        setAuthCookies(res, accessToken, refreshToken);
        logger.info(`New user registered: ${user.email}`);

        res.status(201).json({
            status: 'success',
            data: {
                user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
            },
        });
    });

    login = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive) {
            throw new AppError('Invalid email or password', 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        const { token: accessToken } = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        await prisma.session.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        setAuthCookies(res, accessToken, refreshToken);
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
            },
        });
    });

    logout = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        if (req.user) {
            if (req.jti) {
                const remainingTtl = req.tokenExp
                    ? Math.max(0, Math.floor((req.tokenExp * 1000 - Date.now()) / 1000))
                    : 900;
                await tokenService.revokeJti(req.jti, remainingTtl);
            }

            const refreshToken = req.cookies?.refresh_token;
            if (refreshToken) {
                await prisma.session.deleteMany({ where: { token: refreshToken, userId: req.user.id } });
            }
        }

        clearAuthCookies(res);
        res.json({ status: 'success', message: 'Logged out successfully' });
    });

    refreshToken = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            throw new AppError('Refresh token is required', 401);
        }

        let decoded: { userId: string; email: string };
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string; email: string };
        } catch {
            clearAuthCookies(res);
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const session = await prisma.session.findFirst({
            where: {
                token: refreshToken,
                userId: decoded.userId,
                expiresAt: { gt: new Date() },
            },
        });

        if (!session) {
            clearAuthCookies(res);
            throw new AppError('Session not found or expired', 401);
        }

        // Rotate: delete old session, create new one with new refresh token
        const newRefreshToken = generateRefreshToken(decoded.userId, decoded.email);
        await prisma.session.delete({ where: { id: session.id } });
        await prisma.session.create({
            data: {
                userId: decoded.userId,
                token: newRefreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });

        const { token: newAccessToken } = generateAccessToken(decoded.userId, decoded.email);
        setAuthCookies(res, newAccessToken, newRefreshToken);

        res.json({ status: 'success', message: 'Token refreshed' });
    });

    forgotPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email } = req.body;

        // Always return success to avoid user enumeration
        res.json({
            status: 'success',
            message: 'If the email exists, a password reset link has been sent',
        });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return;

        const { plainToken } = await passwordResetService.createToken(user.id);
        const resetUrl = `${config.app.url}/#/reset-password?token=${plainToken}`;

        await sendEmail(
            user.email,
            'Password Reset Request',
            `
                <p>You requested a password reset for your Help Center account.</p>
                <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>If you did not request this, you can safely ignore this email.</p>
            `,
        );

        logger.info(`Password reset email sent to: ${email}`);
    });

    resetPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { token, newPassword } = req.body;

        const record = await passwordResetService.validateToken(token);
        if (!record) {
            throw new AppError('Invalid or expired password reset token', 400);
        }

        await passwordResetService.consumeToken(record.id, record.userId, newPassword);

        // Invalidate all existing sessions and Redis tokens for this user after password change
        await prisma.session.deleteMany({ where: { userId: record.userId } });
        await tokenService.revokeAllForUser(record.userId);

        res.json({ status: 'success', message: 'Password reset successful. Please log in again.' });
    });
}

export const authController = new AuthController();
