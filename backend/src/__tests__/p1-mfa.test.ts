import prisma from '../utils/prisma';
import { mfaService } from '../credit/services/mfa.service';
import { requireMfa } from '../credit/middleware/mfa.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { TOTP, Secret } from 'otpauth';

// ── Test data ──────────────────────────────────────────────────────────────
let testUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `mfa-test-${Date.now()}@test.local`,
      passwordHash: '$2b$10$dummyhash',
      firstName: 'MFA',
      lastName: 'Tester',
      tenantId: '00000000-0000-0000-0000-000000000001',
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  // Prisma is closed by the global Jest teardown.
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('P1-8: MFA for Approver/Disburser Roles', () => {
  describe('mfaService', () => {
    it('should generate a TOTP secret and QR code on setup', async () => {
      const result = await mfaService.setup(testUserId);

      expect(result.secret).toBeDefined();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('CitadelCWC');
      expect(result.qrCodeDataUrl).toContain('data:image/png;base64,');

      // Verify secret was stored on user
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.mfaSecret).toBe(result.secret);
      expect(user?.mfaEnabled).toBe(false);
    });

    it('should verify a valid TOTP token', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const totp = new TOTP({
        issuer: 'CitadelCWC',
        label: user!.email,
        secret: Secret.fromBase32(user!.mfaSecret!),
        period: 30,
        digits: 6,
      });

      const token = totp.generate();
      const valid = await mfaService.verifyTotp(testUserId, token);
      expect(valid).toBe(true);

      // mfaVerifiedAt should be set
      const updated = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updated?.mfaVerifiedAt).toBeDefined();
    });

    it('should reject an invalid TOTP token', async () => {
      const valid = await mfaService.verifyTotp(testUserId, '000000');
      expect(valid).toBe(false);
    });

    it('should enroll MFA after successful verification', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const totp = new TOTP({
        issuer: 'CitadelCWC',
        label: user!.email,
        secret: Secret.fromBase32(user!.mfaSecret!),
        period: 30,
        digits: 6,
      });

      const token = totp.generate();
      const result = await mfaService.enroll(testUserId, token);

      expect(result.enabled).toBe(true);
      expect(result.recoveryCodes).toHaveLength(8);
      expect(result.recoveryCodes[0]).toMatch(/^[0-9A-F]{8}$/);

      // User should now have mfaEnabled = true
      const updated = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updated?.mfaEnabled).toBe(true);
      expect(updated?.mfaBackupCodes).toHaveLength(8);
    });

    it('should not enroll MFA twice', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const totp = new TOTP({
        issuer: 'CitadelCWC',
        label: user!.email,
        secret: Secret.fromBase32(user!.mfaSecret!),
        period: 30,
        digits: 6,
      });

      const token = totp.generate();
      await expect(mfaService.enroll(testUserId, token)).rejects.toThrow(/already enabled/i);
    });

    it('should verify and consume a recovery code', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const codesBefore = user!.mfaBackupCodes.length;

      // Generate a valid recovery code by regenerating
      const newCodes = await mfaService.generateRecoveryCodes(testUserId);
      const code = newCodes[0];

      const valid = await mfaService.verifyRecoveryCode(testUserId, code);
      expect(valid).toBe(true);

      // Code should be consumed
      const userAfter = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(userAfter!.mfaBackupCodes).toHaveLength(newCodes.length - 1);
    });

    it('should reject an already-used recovery code', async () => {
      const newCodes = await mfaService.generateRecoveryCodes(testUserId);
      const code = newCodes[0];

      // Use it once
      await mfaService.verifyRecoveryCode(testUserId, code);

      // Try to use it again
      const valid = await mfaService.verifyRecoveryCode(testUserId, code);
      expect(valid).toBe(false);
    });

    it('should admin-reset MFA for a user', async () => {
      const adminId = 'd116ac9e-80de-426f-bdc2-93dd869e51c8';
      await mfaService.adminReset(testUserId, adminId);

      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.mfaEnabled).toBe(false);
      expect(user?.mfaSecret).toBeNull();
      expect(user?.mfaBackupCodes).toHaveLength(0);
      expect(user?.mfaVerifiedAt).toBeNull();
    });
  });

  describe('requireMfa middleware', () => {
    function makeMockReq(userOverrides: any, path: string): any {
      return {
        user: {
          id: testUserId,
          email: 'test@test.local',
          firstName: 'Test',
          lastName: 'User',
          roles: [],
          permissions: [],
          mfaEnabled: false,
          mustEnrollMfa: false,
          mfaVerifiedAt: null,
          ...userOverrides,
        },
        path,
      } as any;
    }

    it('should block if mustEnrollMfa=true and mfaEnabled=false', () => {
      const req = makeMockReq({ mustEnrollMfa: true, mfaEnabled: false }, '/approvals/123');
      const next = jest.fn();

      requireMfa(req, {} as any, next);

      expect(next).not.toHaveBeenCalledWith();
      // The middleware calls next(error) — we check it was called with an error
      const callArgs = next.mock.calls[0]?.[0];
      expect(callArgs?.message).toContain('MFA enrollment required');
    });

    it('should pass through if mustEnrollMfa=false', () => {
      const req = makeMockReq({ mustEnrollMfa: false, mfaEnabled: false }, '/applications');
      const next = jest.fn();

      requireMfa(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(); // Called with no error
    });

    it('should block protected path if MFA not recently verified', () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago
      const req = makeMockReq(
        { mfaEnabled: true, mfaVerifiedAt: oldDate },
        '/credit/approvals/123'
      );
      const next = jest.fn();

      requireMfa(req, {} as any, next);

      const callArgs = next.mock.calls[0]?.[0];
      expect(callArgs?.message).toContain('MFA verification expired');
    });

    it('should pass protected path if MFA recently verified', () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      const req = makeMockReq(
        { mfaEnabled: true, mfaVerifiedAt: recentDate },
        '/credit/approvals/123'
      );
      const next = jest.fn();

      requireMfa(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(); // No error
    });

    it('should pass non-protected path even without MFA verification', () => {
      const req = makeMockReq(
        { mfaEnabled: true, mfaVerifiedAt: null },
        '/credit/applications'
      );
      const next = jest.fn();

      requireMfa(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(); // No error
    });
  });

  describe('isMfaVerificationFresh', () => {
    it('should return false for null mfaVerifiedAt', () => {
      expect(mfaService.isMfaVerificationFresh(null)).toBe(false);
    });

    it('should return true for recent verification', () => {
      expect(mfaService.isMfaVerificationFresh(new Date())).toBe(true);
    });

    it('should return false for verification older than 15 min', () => {
      const old = new Date(Date.now() - 16 * 60 * 1000);
      expect(mfaService.isMfaVerificationFresh(old)).toBe(false);
    });
  });
});