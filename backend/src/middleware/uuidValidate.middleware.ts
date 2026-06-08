import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware factory that validates one or more route params as UUIDs.
 * Returns 400 if any specified param is not a valid UUID.
 *
 * Usage:
 *   router.get('/:id', validateUUID('id'), handler);
 *   router.get('/:applicationId/facilities', validateUUID('applicationId'), handler);
 */
export function validateUUID(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const param of params) {
      const value = req.params[param] as string | undefined;
      if (value && !UUID_REGEX.test(value)) {
        res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: `Invalid ${param}: must be a valid UUID`,
        });
        return;
      }
    }
    next();
  };
}