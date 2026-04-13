import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const TOKEN_EXPIRY_MINUTES = 15;

function hashToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export const passwordResetService = {
  /**
   * Generate a cryptographically random reset token, store its SHA-256 hash,
   * and return the plain token for emailing. Invalidates any existing tokens for the user.
   */
  async createToken(userId: string): Promise<{ plainToken: string }> {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    logger.info(`Password reset token created for user ${userId}`);
    return { plainToken };
  },

  /**
   * Validate a plain reset token. Returns { id, userId } if valid, null otherwise.
   * Valid = hash matches + not expired + not already used.
   */
  async validateToken(plainToken: string): Promise<{ id: string; userId: string } | null> {
    const tokenHash = hashToken(plainToken);
    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
    return record ? { id: record.id, userId: record.userId } : null;
  },

  /**
   * Mark the token as used and update the user's password.
   * Must be called ONLY after validateToken confirms validity.
   */
  async consumeToken(tokenId: string, userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await Promise.all([
      prisma.passwordResetToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
    ]);

    logger.info(`Password reset completed for user ${userId}`);
  },
};
