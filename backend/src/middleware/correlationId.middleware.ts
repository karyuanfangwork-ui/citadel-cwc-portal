/**
 * P3-02: Request Correlation ID Middleware
 *
 * Generates or accepts a correlation ID for every request.
 * - If the client sends an X-Correlation-ID header, it is reused.
 * - Otherwise, a new UUID v4 is generated.
 * - The ID is attached to Express's Request object and set on the response.
 * - It is also injected into the logger context so all log entries for the
 *   request include the correlation ID.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

declare global {
    namespace Express {
        interface Request {
            correlationId: string;
        }
    }
}

const HEADER = 'x-correlation-id';

export function correlationId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers[HEADER] as string | undefined)?.trim() || randomUUID();
    req.correlationId = id;
    res.setHeader(HEADER, id);

    // Inject correlation ID into logger context for downstream log entries
    logger.defaultMeta = { ...logger.defaultMeta, correlationId: id };

    next();
}