import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

// Routes that require fresh MFA verification (within 15 min)
const MFA_PROTECTED_PATHS = ['/approvals', '/disburse', '/approve', '/disbursement'];

/**
 * P1-8 — requireMfa middleware
 *
 * 1. If user has mustEnrollMfa=true but mfaEnabled=false → 403 MFA_ENROLLMENT_REQUIRED
 * 2. If user has mfaEnabled=true and the route is MFA-protected → verify MFA was recently verified (within 15 min)
 * 3. Otherwise → pass through
 */
export function requireMfa(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  const user = authReq.user;

  if (!user) {
    return next(new AppError('Authentication required', 401));
  }

  // Check if enrollment is required but not completed
  if (user.mustEnrollMfa && !user.mfaEnabled) {
    return next(new AppError('MFA enrollment required before performing this action', 403, {
      code: 'MFA_ENROLLMENT_REQUIRED',
      mustEnrollMfa: true,
    }));
  }

  // If MFA is enabled and this is a protected route, verify freshness
  if (user.mfaEnabled) {
    const isProtectedPath = MFA_PROTECTED_PATHS.some(p => req.path.includes(p));

    if (isProtectedPath) {
      if (!user.mfaVerifiedAt) {
        return next(new AppError('MFA verification required', 403, {
          code: 'MFA_VERIFICATION_REQUIRED',
        }));
      }

      const mfaAge = Date.now() - user.mfaVerifiedAt.getTime();
      if (mfaAge > 15 * 60 * 1000) {
        return next(new AppError('MFA verification expired — please re-verify', 403, {
          code: 'MFA_VERIFICATION_EXPIRED',
        }));
      }
    }
  }

  next();
}