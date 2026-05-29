import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

/**
 * §2.3 — Optimistic Concurrency Control middleware
 *
 * Expects the request body to include a `version` field (integer).
 * Compares it against the current DB record's `version`.
 * If mismatched, returns 409 Conflict with the server version so the
 * frontend can offer a reconciliation dialog.
 *
 * Usage:
 *   router.put('/:id', requireVersion, controller.update)
 */
export function requireVersion(req: Request, _res: Response, next: NextFunction) {
    const version = req.body?.version;
    if (version === undefined || version === null) {
        return next(new AppError('Optimistic concurrency: version field is required', 400));
    }
    const parsed = Number(version);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return next(new AppError('Optimistic concurrency: version must be a positive integer', 400));
    }
    next();
}

/**
 * Build a version-conflict error with the server-side state for reconciliation.
 * Returns an AppError(409) with structured details for the frontend.
 */
export function versionConflictError(serverVersion: number, serverData?: unknown): AppError {
    return new AppError(
        `Optimistic concurrency conflict: server version is ${serverVersion}`,
        409,
        { code: 'VERSION_CONFLICT', serverVersion, serverData },
    );
}