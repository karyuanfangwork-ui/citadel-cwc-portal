import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware';
import { loginSchema } from '../validators/auth.validator';

const router = Router();

// Registration disabled — internal app, accounts created by admin only
// router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Logout requires a valid session — authenticate middleware must run first
router.post('/logout', authenticate, authController.logout);

// Refresh reads from cookie — no body schema needed
router.post('/refresh', authLimiter, authController.refreshToken);

router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

export default router;
