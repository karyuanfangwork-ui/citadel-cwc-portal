import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

export function requireUser(req: AuthRequest) {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  return req.user;
}
