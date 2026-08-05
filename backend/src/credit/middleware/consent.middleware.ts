import { Request, Response, NextFunction } from 'express';
import { ConsentPurpose } from '@prisma/client';
import { consentService } from '../services/consent.service';
import { AppError } from '../../middleware/error.middleware';

/**
 * Middleware factory: requireConsent(purpose)
 *
 * Blocks the route unless an ACTIVE consent of the specified purpose exists
 * for the borrower specified in req.params.borrowerProfileId or req.body.borrowerProfileId.
 *
 * Usage:
 *   router.post('/bureau-check/:borrowerProfileId', requireConsent('BUREAU_PULL'), handler);
 */
export function requireConsent(purpose: ConsentPurpose) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const rawSubjectId =
        req.params.borrowerProfileId ??
        req.params.subjectId ??
        req.body.borrowerProfileId ??
        req.body.subjectId;

      const subjectId = String(rawSubjectId);

      if (!subjectId) {
        throw new AppError(
          `Cannot check consent: no subject ID provided in params or body`,
          400,
          { code: 'CONSENT_SUBJECT_REQUIRED' },
        );
      }

      const hasConsent = await consentService.checkConsent(subjectId, purpose);

      if (!hasConsent) {
        throw new AppError(
          `Active ${purpose} consent is required but not found for this subject. Please obtain consent before proceeding.`,
          403,
          { code: 'CONSENT_REQUIRED', purpose },
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}