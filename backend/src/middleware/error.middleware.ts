import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    details?: unknown;

    constructor(message: string, statusCode: number = 500, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        if (details) this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Default error values
    let statusCode = 500;
    let message = 'Internal Server Error';

    // Check if it's our custom AppError
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        statusCode = 404;
        message = 'Resource not found';
    }

    // Strip leaked env-var names and secret values from error messages visible to clients.
    // Only redact identifiers that look like code (SNAKE_CASE or camelCase containing a
    // sensitive keyword), NOT plain English words like "password" in "Invalid email or password".
    // E.g. redacts: JWT_SECRET, DATABASE_PASSWORD, refreshToken, clientSecret
    //      keeps:  "Invalid email or password", "Token expired", "Reset token is required"
    const sanitizeMessage = (msg: string): string =>
        msg
            // SNAKE_CASE identifiers containing a sensitive keyword (e.g. JWT_SECRET, DATABASE_PASSWORD)
            .replace(/\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL|API_KEY)[A-Z0-9_]*\b/g, '[REDACTED]')
            // camelCase identifiers containing a sensitive keyword (e.g. refreshToken, clientSecret)
            .replace(/\b[a-z]+(?:Key|Secret|Password|Token|Credential)\b/g, '[REDACTED]')
            // .env file paths
            .replace(/\/\.env\S*/g, '[REDACTED_PATH]');

    const safeMessage = sanitizeMessage(message);

    // Log error (full detail for server logs)
    if (statusCode >= 500) {
        logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
            error: err,
            stack: err.stack,
        });
    } else {
        logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    }

    // Send error response (sanitized for client)
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: safeMessage,
        // §2.3 — Include structured details for version conflicts and other rich errors
        ...(err instanceof AppError && err.details ? { details: err.details } : {}),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
        }),
    });
};

// Async error wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
