import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware';
import { loginSchema } from '../validators/auth.validator';
import { systemScope } from '../middleware/system-scope.middleware';

const router = Router();

// Registration disabled — internal app, accounts created by admin only
// router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), systemScope('auth:login'), authController.login);

// Logout requires a valid session — authenticate middleware must run first
router.post('/logout', authenticate, authController.logout);

// Refresh reads from cookie — no body schema needed
router.post('/refresh', authLimiter, systemScope('auth:refresh'), authController.refreshToken);

router.post('/forgot-password', passwordResetLimiter, systemScope('auth:forgot-password'), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, systemScope('auth:reset-password'), authController.resetPassword);

/**
 * POST /api/v1/auth/admin-unlock
 * P0-4: Admin unlocks a locked-out account by email
 * @access  Private (user:manage permission required)
 */
router.post('/admin-unlock', authenticate, requirePermission('user:manage'), authController.adminUnlock);

export default router;