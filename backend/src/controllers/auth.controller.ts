import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { permissionService } from '../services/permission.service';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';
import { tokenService } from '../services/token.service';
import { passwordResetService } from '../services/password-reset.service';
import { notify } from '../services/notification.service';
import { validatePassword, checkPasswordBreach } from '../utils/password';
import { createRedisClient, ensureConnected } from '../utils/redis';

const prisma = new PrismaClient();
const lockoutRedis = createRedisClient({ maxRetriesPerRequest: 1 });

type LockoutEntry = {
    attempts: number;
    lockUntil: number | null;
};

const loginLockouts = new Map<string, LockoutEntry>();

function lockoutKey(email: string): string {
    return `auth:lockout:${email}`;
}

function getLockoutTtlSeconds(): number {
    return Math.max(1, Math.ceil(config.security.accountLockoutWindowMs / 1000));
}

function getFallbackLockoutEntry(email: string): LockoutEntry {
    return loginLockouts.get(email) || { attempts: 0, lockUntil: null };
}

async function getLockoutEntry(email: string): Promise<LockoutEntry> {
    try {
        await ensureConnected(lockoutRedis);
        const raw = await lockoutRedis.get(lockoutKey(email));
        if (!raw) {
            return { attempts: 0, lockUntil: null };
        }

        const parsed = JSON.parse(raw) as LockoutEntry;
        return {
            attempts: Number(parsed.attempts) || 0,
            lockUntil: parsed.lockUntil ? Number(parsed.lockUntil) : null,
        };
    } catch {
        return getFallbackLockoutEntry(email);
    }
}

async function isLockedOut(email: string): Promise<boolean> {
    const entry = await getLockoutEntry(email);
    if (!entry.lockUntil) {
        return false;
    }

    if (entry.lockUntil <= Date.now()) {
        await clearFailedLogin(email);
        return false;
    }

    return true;
}

async function recordFailedLogin(email: string): Promise<void> {
    const current = await getLockoutEntry(email);
    const attempts = current.attempts + 1;
    const lockUntil = attempts >= config.security.accountLockoutMaxAttempts
        ? Date.now() + config.security.accountLockoutWindowMs
        : null;
    const entry = { attempts, lockUntil };

    loginLockouts.set(email, entry);

    try {
        await ensureConnected(lockoutRedis);
        await lockoutRedis.set(lockoutKey(email), JSON.stringify(entry), 'EX', getLockoutTtlSeconds());
    } catch {
        // In-memory fallback already updated above.
    }

    // P0-4: Audit log when account gets locked
    if (lockUntil) {
        logger.warn(`Account locked: ${email} after ${attempts} failed attempts (locked for ${Math.ceil(config.security.accountLockoutWindowMs / 60000)} min)`);
    }
}

async function clearFailedLogin(email: string): Promise<void> {
    loginLockouts.delete(email);

    try {
        await ensureConnected(lockoutRedis);
        await lockoutRedis.del(lockoutKey(email));
    } catch {
        // In-memory fallback already cleared above.
    }
}

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
    const jti = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign({ userId, email, jti }, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn as any,
        algorithm: 'HS256',
    });
}

/** SHA-256 hash a refresh token before storing/querying in the DB. */
function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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
        path: '/api/v1/auth',
    });
}

function clearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
}

// ─── Controller ─────────────────────────────────────────────────────────────

class AuthController {
    register = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email, password, firstName, lastName, department, jobTitle } = req.body;

        // Password validation
        const validation = validatePassword(password, email, firstName, lastName);
        if (!validation.isValid) {
            throw new AppError(validation.errors.join(', '), 400);
        }

        // Optional: Breach check (can be disabled in config)
        if (config.security?.checkPasswordBreach) {
            const breachCheck = await checkPasswordBreach(password);
            if (breachCheck.isPwned) {
                throw new AppError(
                    `This password has been found in ${breachCheck.count} data breaches. Please choose a different password.`,
                    400
                );
            }
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError('User with this email already exists', 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { email, passwordHash, firstName, lastName, department, jobTitle },
        });

        const normalStaffRole = await prisma.role.findUnique({ where: { name: 'NORMAL_STAFF' } });
        if (normalStaffRole) {
            await prisma.userRole.create({ data: { userId: user.id, roleId: normalStaffRole.id } });
        }

        const { token: accessToken } = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        await prisma.session.create({
            data: {
                userId: user.id,
                token: hashRefreshToken(refreshToken),
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
                user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, agentTeam: user.agentTeam },
            },
        });
    });

    login = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        if (await isLockedOut(normalizedEmail)) {
            throw new AppError('Account temporarily locked due to repeated failed login attempts. Please try again later.', 429);
        }

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive) {
            await recordFailedLogin(normalizedEmail);
            throw new AppError('Invalid email or password', 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            await recordFailedLogin(normalizedEmail);
            throw new AppError('Invalid email or password', 401);
        }

        await clearFailedLogin(normalizedEmail);

        // P0-2: Enforce mustResetPassword — block login until user changes password
        if (user.mustResetPassword) {
            // Generate a one-time reset token so the frontend can redirect to /reset-password
            const { plainToken } = await passwordResetService.createToken(user.id);
            throw new AppError(
                'PASSWORD_RESET_REQUIRED',
                403,
                { resetToken: plainToken, email: user.email },
            );
        }

        const { token: accessToken } = generateAccessToken(user.id, user.email);
        const refreshToken = generateRefreshToken(user.id, user.email);

        await prisma.session.create({
            data: {
                userId: user.id,
                token: hashRefreshToken(refreshToken),
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
                    agentTeam: user.agentTeam,
                    permissions: await permissionService.getUserPermissions(user.id),
                },
                accessToken, // exposed for SSE EventSource auth
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
                await prisma.session.deleteMany({ where: { token: hashRefreshToken(refreshToken), userId: req.user.id } });
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
                token: hashRefreshToken(refreshToken),
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

        await prisma.session.deleteMany({
            where: {
                id: session.id,
                userId: decoded.userId,
            },
        });

        await prisma.session.create({
            data: {
                userId: decoded.userId,
                token: hashRefreshToken(newRefreshToken),
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

        // Always return success immediately to prevent user enumeration
        res.json({
            status: 'success',
            message: 'If the email exists, a password reset link has been sent',
        });

        // Fire-and-forget: errors here are logged but cannot affect the response
        Promise.resolve().then(async () => {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return;

            const { plainToken } = await passwordResetService.createToken(user.id);
            const resetUrl = `${config.app.url}/reset-password?token=${plainToken}`;

            await notify({
                userId: user.id,
                eventType: 'PASSWORD_RESET',
                variables: {
                    userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
                    resetUrl,
                },
            });

            logger.info(`Password reset email sent to: ${email}`);
        }).catch((err) => {
            logger.error(`Failed to process password reset for ${email}:`, err);
        });
    });

    resetPassword = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { token, newPassword } = req.body;

        // Password validation
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            throw new AppError(validation.errors.join(', '), 400);
        }

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

    /**
     * P0-4: Admin unlocks a locked-out account.
     * POST /api/v1/auth/admin-unlock  { email: string }
     * Requires: user:manage permission
     */
    adminUnlock = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            // Don't reveal whether user exists
            res.json({ status: 'success', message: 'Unlock processed' });
            return;
        }

        await clearFailedLogin(normalizedEmail);
        logger.info(`Admin ${req.user?.email} unlocked account: ${normalizedEmail}`);
        res.json({ status: 'success', message: 'Account unlocked successfully' });
    });
}

export const authController = new AuthController();
