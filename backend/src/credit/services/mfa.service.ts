import crypto from 'crypto';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

// ── Config ─────────────────────────────────────────────────────────────────

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const MFA_VERIFICATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RECOVERY_CODE_COUNT = 8;
const ISSUER = 'CitadelCWC';

// ── Service ────────────────────────────────────────────────────────────────

class MfaService {
  /** Generate a TOTP secret for a user (does not enable MFA yet) */
  async setup(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: ISSUER,
      label: user.email,
      secret,
      period: TOTP_PERIOD,
      digits: TOTP_DIGITS,
    });

    // Store secret temporarily (not yet enabled)
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /** Verify a TOTP token against the user's stored secret */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) return false;

    const totp = new TOTP({
      issuer: ISSUER,
      label: user.email,
      secret: Secret.fromBase32(user.mfaSecret),
      period: TOTP_PERIOD,
      digits: TOTP_DIGITS,
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) {
      // Update last verification timestamp
      await prisma.user.update({
        where: { id: userId },
        data: { mfaVerifiedAt: new Date() },
      });
      return true;
    }

    return false;
  }

  /** Enroll MFA — enable after first successful verification */
  async enroll(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.mfaEnabled) throw new AppError('MFA already enabled', 400);
    if (!user.mfaSecret) throw new AppError('MFA not set up — call setup first', 400);

    const valid = await this.verifyTotp(userId, token);
    if (!valid) throw new AppError('Invalid TOTP code', 400);

    // Generate recovery codes before enabling
    const recoveryCodes = await this.generateRecoveryCodes(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mustEnrollMfa: false },
    });

    logger.info('MFA enrolled', { userId });
    return { enabled: true, recoveryCodes };
  }

  /** Generate recovery codes (hashed, stored on user) */
  async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
      codes.push(code);
      hashedCodes.push(hashRecoveryCode(code));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedCodes },
    });

    return codes; // Return plain codes (shown once)
  }

  /** Verify a recovery code (one-time use, consumed) */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled) return false;

    const hashedInput = hashRecoveryCode(code);
    const codeIndex = user.mfaBackupCodes.indexOf(hashedInput);

    if (codeIndex === -1) return false;

    // Consume the code — remove from array
    const updatedCodes = [...user.mfaBackupCodes];
    updatedCodes.splice(codeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: updatedCodes,
        mfaVerifiedAt: new Date(),
      },
    });

    logger.info('MFA recovery code used', { userId, codesRemaining: updatedCodes.length });
    return true;
  }

  /** Admin resets MFA for a user */
  async adminReset(targetUserId: string, adminId: string) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new AppError('User not found', 404);

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaVerifiedAt: null,
        // If user still has approve/disburse permissions, they must re-enroll
      },
    });

    logger.info('MFA admin reset', { targetUserId, adminId });
  }

  /** Check if MFA verification is fresh (within 15 min) */
  isMfaVerificationFresh(mfaVerifiedAt: Date | null): boolean {
    if (!mfaVerifiedAt) return false;
    const age = Date.now() - mfaVerifiedAt.getTime();
    return age <= MFA_VERIFICATION_WINDOW_MS;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const mfaService = new MfaService();