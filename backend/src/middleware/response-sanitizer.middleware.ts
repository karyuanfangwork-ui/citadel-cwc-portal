/**
 * Response Sanitization Middleware — P01 Task 3 (Finding #35)
 *
 * Strips sensitive user fields (passwordHash, mfaSecret, etc.) from ALL JSON
 * responses as a defense-in-depth measure. Individual controllers should still
 * use select clauses and sanitizeUser(), but this catches any accidental leaks.
 *
 * This intercepts res.json() and recursively removes sensitive keys from the
 * response payload before sending it to the client.
 */

import { Response, Request, NextFunction } from 'express';

const SENSITIVE_KEYS = new Set([
    'passwordHash',
    'mfaSecret',
    'mfaBackupCodes',
    'resetToken',
    'resetTokenExpiry',
    'verificationToken',
    'lockoutUntil',
    'failedLoginAttempts',
]);

/**
 * Recursively strip sensitive keys from an object or array.
 * Returns a new object — never mutates the input.
 * Exported for testing.
 */
export function stripSensitive<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj as T;
    if (Array.isArray(obj)) return obj.map(stripSensitive) as T;
    if (typeof obj !== 'object') return obj;

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(key)) continue;
        result[key] = stripSensitive(value);
    }
    return result as T;
}

/**
 * Express middleware that wraps res.json() to strip sensitive fields.
 */
export function responseSanitizer(_req: Request, res: Response, next: NextFunction): void {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
        const sanitized = stripSensitive(body);
        return originalJson(sanitized);
    };

    next();
}