import { passwordResetService } from '../password-reset.service';

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const prismaMock = new (require('@prisma/client').PrismaClient)();

describe('passwordResetService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createToken', () => {
    it('returns a plain token and stores its hash', async () => {
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.passwordResetToken.create.mockResolvedValue({});
      const { plainToken } = await passwordResetService.createToken('user-123');
      expect(typeof plainToken).toBe('string');
      expect(plainToken.length).toBeGreaterThan(20);
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const callArg = prismaMock.passwordResetToken.create.mock.calls[0][0].data;
      expect(callArg.userId).toBe('user-123');
      expect(typeof callArg.tokenHash).toBe('string');
      // Stored hash must NOT equal the plain token
      expect(callArg.tokenHash).not.toBe(plainToken);
    });
  });

  describe('validateToken', () => {
    it('returns the record when token is valid', async () => {
      const plain = 'valid-token-abc123';
      const hash = require('crypto').createHash('sha256').update(plain).digest('hex');
      prismaMock.passwordResetToken.findFirst.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-123',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
      });
      const result = await passwordResetService.validateToken(plain);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
      expect(result!.id).toBe('reset-1');
    });

    it('returns null when token not found', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);
      const result = await passwordResetService.validateToken('bad-token');
      expect(result).toBeNull();
    });
  });

  describe('consumeToken', () => {
    it('marks the token as used and updates the password hash', async () => {
      prismaMock.passwordResetToken.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});
      await passwordResetService.consumeToken('reset-1', 'user-123', 'NewPassword1!');
      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('user-123');
      // Must store a hash, not the plain password
      expect(updateCall.data.passwordHash).not.toBe('NewPassword1!');
      expect(typeof updateCall.data.passwordHash).toBe('string');
    });
  });
});
