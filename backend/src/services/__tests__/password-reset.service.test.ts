import { passwordResetService } from '../password-reset.service';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';

const mockPrisma = prisma as unknown as {
  passwordResetToken: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  user: { update: jest.Mock };
};

describe('passwordResetService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createToken', () => {
    it('returns a plain token and stores its hash', async () => {
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});
      const { plainToken } = await passwordResetService.createToken('user-123');
      expect(typeof plainToken).toBe('string');
      expect(plainToken.length).toBeGreaterThan(20);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const callArg = mockPrisma.passwordResetToken.create.mock.calls[0][0].data;
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
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
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
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
      const result = await passwordResetService.validateToken('bad-token');
      expect(result).toBeNull();
    });
  });

  describe('consumeToken', () => {
    it('marks the token as used and updates the password hash', async () => {
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      await passwordResetService.consumeToken('reset-1', 'user-123', 'NewPassword1!');
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('user-123');
      // Must store a hash, not the plain password
      expect(updateCall.data.passwordHash).not.toBe('NewPassword1!');
      expect(typeof updateCall.data.passwordHash).toBe('string');
    });
  });
});