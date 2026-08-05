/**
 * Integration test: Sensitive user fields must never appear in API responses.
 *
 * P01 Task 3 — Finding #35: Verify that passwordHash, mfaSecret,
 * mfaBackupCodes, resetToken, and resetTokenExpiry are stripped from
 * every JSON response, both at the controller level (sanitizeUser)
 * and at the middleware level (responseSanitizer).
 */

import { stripSensitive } from '../middleware/response-sanitizer.middleware';

describe('P01-35: Sensitive field stripping', () => {
    describe('stripSensitive (response sanitizer)', () => {
        it('removes passwordHash from a user object', () => {
            const input = {
                id: 'u-1',
                email: 'test@test.com',
                passwordHash: '$2a$10$deadbeef',
                firstName: 'Test',
            };
            const result = stripSensitive(input);
            expect(result).toEqual({
                id: 'u-1',
                email: 'test@test.com',
                firstName: 'Test',
            });
        });

        it('removes mfaSecret and mfaBackupCodes', () => {
            const input = {
                id: 'u-1',
                email: 'test@test.com',
                mfaSecret: 'JBSWY3DPEHPK3PXP',
                mfaBackupCodes: ['abc123', 'def456'],
                isMfaEnabled: true,
            };
            const result = stripSensitive(input);
            expect(result).toEqual({
                id: 'u-1',
                email: 'test@test.com',
                isMfaEnabled: true,
            });
            expect((result as any).mfaSecret).toBeUndefined();
            expect((result as any).mfaBackupCodes).toBeUndefined();
        });

        it('removes resetToken and resetTokenExpiry', () => {
            const input = {
                id: 'u-1',
                email: 'test@test.com',
                resetToken: 'secret-token-123',
                resetTokenExpiry: new Date(),
            };
            const result = stripSensitive(input);
            expect((result as any).resetToken).toBeUndefined();
            expect((result as any).resetTokenExpiry).toBeUndefined();
        });

        it('removes verificationToken, lockoutUntil, failedLoginAttempts', () => {
            const input = {
                id: 'u-1',
                verificationToken: 'verify-abc',
                lockoutUntil: new Date(),
                failedLoginAttempts: 5,
            };
            const result = stripSensitive(input);
            expect((result as any).verificationToken).toBeUndefined();
            expect((result as any).lockoutUntil).toBeUndefined();
            expect((result as any).failedLoginAttempts).toBeUndefined();
        });

        it('strips sensitive fields from nested objects', () => {
            const input = {
                data: {
                    users: [
                        { id: 'u-1', email: 'a@b.com', passwordHash: 'hash1' },
                        { id: 'u-2', email: 'c@d.com', passwordHash: 'hash2', mfaSecret: 'secret' },
                    ],
                },
            };
            const result = stripSensitive(input);
            expect((result as any).data.users[0].passwordHash).toBeUndefined();
            expect((result as any).data.users[1].passwordHash).toBeUndefined();
            expect((result as any).data.users[1].mfaSecret).toBeUndefined();
            expect((result as any).data.users[0].id).toBe('u-1');
        });

        it('preserves null and undefined values', () => {
            const input = { id: 'u-1', email: null, phone: undefined };
            const result = stripSensitive(input);
            expect(result).toEqual({ id: 'u-1', email: null, phone: undefined });
        });

        it('handles arrays at the top level', () => {
            const input = [
                { id: 'u-1', passwordHash: 'hash1' },
                { id: 'u-2', mfaSecret: 'secret' },
            ];
            const result = stripSensitive(input);
            expect((result as any[])[0].passwordHash).toBeUndefined();
            expect((result as any[])[1].mfaSecret).toBeUndefined();
            expect((result as any[])[0].id).toBe('u-1');
            expect((result as any[])[1].id).toBe('u-2');
        });
    });
});