import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

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
    }

    // Strip env-var names and secrets from error messages visible to clients
    const sanitizeMessage = (msg: string): string =>
        msg
            .replace(/[\w_]*(KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL|API_KEY)[\w_]*/gi, '[REDACTED]')
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
