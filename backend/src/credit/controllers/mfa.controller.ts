import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { mfaService } from '../services/mfa.service';

class MfaController {
  /** POST /mfa/setup — Generate TOTP secret + QR code */
  setup = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const result = await mfaService.setup(userId);
    res.json({ status: 'success', data: result });
  });

  /** POST /mfa/verify — Verify TOTP code (during login or step-up) */
  verify = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { token } = req.body;
    const valid = await mfaService.verifyTotp(userId, token);
    if (!valid) {
      return res.status(400).json({ status: 'error', message: 'Invalid TOTP code' });
    }
    res.json({ status: 'success', data: { verified: true } });
  });

  /** POST /mfa/enroll — Enable MFA after successful verification */
  enroll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { token } = req.body;
    const result = await mfaService.enroll(userId, token);
    res.json({ status: 'success', data: result });
  });

  /** POST /mfa/recovery-codes — Generate new recovery codes */
  recoveryCodes = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const codes = await mfaService.generateRecoveryCodes(userId);
    res.json({ status: 'success', data: { recoveryCodes: codes } });
  });

  /** POST /mfa/recover — Verify recovery code */
  recover = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { code } = req.body;
    const valid = await mfaService.verifyRecoveryCode(userId, code);
    if (!valid) {
      return res.status(400).json({ status: 'error', message: 'Invalid or already-used recovery code' });
    }
    res.json({ status: 'success', data: { verified: true } });
  });

  /** POST /mfa/admin-reset — Admin resets MFA for a user */
  adminReset = asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminId = req.user!.id;
    const { targetUserId } = req.body;
    await mfaService.adminReset(targetUserId, adminId);
    res.json({ status: 'success', message: 'MFA reset successfully' });
  });
}

export const mfaController = new MfaController();