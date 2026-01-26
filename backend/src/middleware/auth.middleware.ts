import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from './error.middleware';
import { config } from '../config';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        roles: string[];
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401);
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, config.jwt.secret) as {
            userId: string;
            email: string;
        };

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        if (!user || !user.isActive) {
            throw new AppError('User not found or inactive', 401);
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            roles: user.roles.map((ur) => ur.role.name),
        };

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

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.secret) as {
            userId: string;
            email: string;
        };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        if (user && user.isActive) {
            req.user = {
                id: user.id,
                email: user.email,
                roles: user.roles.map((ur) => ur.role.name),
            };
        }

        next();
    } catch (error) {
        // Silently fail for optional auth
        next();
    }
};

// Role-based authorization
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
