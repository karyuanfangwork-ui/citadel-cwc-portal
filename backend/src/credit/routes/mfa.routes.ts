import { Router } from 'express';
import { mfaController } from '../controllers/mfa.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All MFA routes require authentication
router.use(authenticate);

/** POST /mfa/setup — Generate TOTP secret + QR code */
router.post('/setup', mfaController.setup);

/** POST /mfa/verify — Verify TOTP code */
router.post('/verify', mfaController.verify);

/** POST /mfa/enroll — Enable MFA after successful verification */
router.post('/enroll', mfaController.enroll);

/** POST /mfa/recovery-codes — Generate new recovery codes */
router.post('/recovery-codes', mfaController.recoveryCodes);

/** POST /mfa/recover — Verify recovery code */
router.post('/recover', mfaController.recover);

/** POST /mfa/admin-reset — Admin resets MFA for a user (requires user:manage) */
router.post('/admin-reset', requirePermission('user:manage'), mfaController.adminReset);

export default router;