import { Request, Response, NextFunction } from 'express';
import { dlpService } from '../services/dlp.service';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

// ---------------------------------------------------------------------------
// §2.5 — DLP Middleware for Credit Exports
// ---------------------------------------------------------------------------
// Provides:
//   1. `requireExportToken` — validates short-lived Redis export tokens
//   2. `redactExportResponse` — redacts PII from JSON/CSV export responses
//   3. `watermarkExport` — injects watermark metadata into exports
// ---------------------------------------------------------------------------

/**
 * Middleware that requires a valid export token in the `X-Export-Token` header.
 * The token is consumed (single-use) after validation.
 *
 * Usage: router.get('/export', authenticate, requireExportToken, controller.exportData);
 */
export const requireExportToken = asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = req.headers['x-export-token'] as string | undefined;

  if (!token) {
    throw new AppError('Export token required. Request a token from /export-tokens first.', 401);
  }

  const payload = await dlpService.consumeExportToken(token);

  if (!payload) {
    throw new AppError('Invalid or expired export token. Request a new one from /export-tokens.', 401);
  }

  // Verify the token belongs to the current user
  if (payload.userId !== req.user?.id) {
    throw new AppError('Export token does not belong to the current user.', 403);
  }

  // Attach export metadata for downstream use
  (req as any).exportMeta = payload;
  next();
});

/**
 * Response wrapper that redacts PII from JSON export responses.
 * Non-admin users get full field redaction; admin users get pattern-based redaction.
 *
 * Usage: After controller sends JSON response, this middleware wraps res.json
 * to apply redaction. Use as post-processing middleware.
 */
export function redactExportResponse(isAdmin: boolean) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    (res as any).json = function (body: any) {
      if (body?.data) {
        if (Array.isArray(body.data)) {
          body.data = dlpService.redactArray(body.data, isAdmin);
        } else if (typeof body.data === 'object' && body.data !== null) {
          body.data = dlpService.redactObject(body.data, isAdmin);
        }
      } else if (Array.isArray(body)) {
        body = dlpService.redactArray(body, isAdmin);
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Middleware that injects watermark metadata into export responses.
 * Adds `_watermark` and `_warning` fields to JSON exports.
 * For CSV exports, appends a watermark comment row.
 *
 * For CSV watermarking, the controller should call `dlpService.injectCsvWatermark()`.
 * This middleware only handles JSON watermarking via response wrapping.
 */
export function watermarkExport() {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const userId = req.user?.id ?? 'unknown';
    const originalJson = _res.json.bind(_res);

    (_res as any).json = function (body: any) {
      if (body?.status === 'success' && body?.data) {
        body.data = dlpService.injectJsonWatermark(body.data, userId);
      }
      return originalJson(body);
    };

    next();
  };
}