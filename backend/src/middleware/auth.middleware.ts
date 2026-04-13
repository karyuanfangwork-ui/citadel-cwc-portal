import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from './error.middleware';
import { config } from '../config';
import { tokenService } from '../services/token.service';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        roles: string[];
    };
    jti?: string;
    tokenExp?: number;
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // Prefer cookie; fall back to Authorization header for API clients / tests
        let token: string | undefined;
        if (req.cookies?.access_token) {
            token = req.cookies.access_token;
        } else {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            throw new AppError('No token provided', 401);
        }

        const decoded = jwt.verify(token, config.jwt.secret) as {
            userId: string;
            email: string;
            jti?: string;
            exp?: number;
            iat?: number;
        };

        // Check Redis blocklist — catches revoked tokens post-logout
        if (decoded.jti) {
            const revoked = await tokenService.isJtiRevoked(decoded.jti);
            if (revoked) {
                throw new AppError('Token has been revoked', 401);
            }

            // Check user-level revocation (password change / admin force-logout)
            const revokedAt = await tokenService.getUserRevocationTimestamp(decoded.userId);
            const tokenIssuedAt = decoded.iat ? decoded.iat * 1000 : 0;
            if (revokedAt > 0 && tokenIssuedAt < revokedAt) {
                throw new AppError('Token has been revoked', 401);
            }
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive) {
            throw new AppError('User not found or inactive', 401);
        }

        req.user = {
            id: user.id,
            email: user.email,
            roles: user.roles.map((ur) => ur.role.name),
        };
        // Populate jti and tokenExp so logout can revoke the specific token
        req.jti = decoded.jti;
        req.tokenExp = decoded.exp;

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new AppError('Invalid token', 401));
        } else if (error instanceof jwt.TokenExpiredError) {
            next(new AppError('Token expired', 401));
        } else {
            next(error);
        }
    }
};

export const optionalAuth = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        let token: string | undefined;
        if (req.cookies?.access_token) {
            token = req.cookies.access_token;
        } else {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) return next();

        const decoded = jwt.verify(token, config.jwt.secret) as {
            userId: string;
            email: string;
            jti?: string;
        };

        if (decoded.jti) {
            const revoked = await tokenService.isJtiRevoked(decoded.jti);
            if (revoked) return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { roles: { include: { role: true } } },
        });

        if (user?.isActive) {
            req.user = {
                id: user.id,
                email: user.email,
                roles: user.roles.map((ur) => ur.role.name),
            };
        }

        next();
    } catch {
        next();
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401));
        }
        const hasRole = roles.some((role) => req.user!.roles.includes(role));
        if (!hasRole) {
            return next(new AppError('Insufficient permissions', 403));
        }
        next();
    };
};
