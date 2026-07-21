/**
 * Integration test: Privileged MFA enforcement.
 *
 * P01 Task 5 (Findings #75–#77): Verify that requireMfa middleware
 * rejects requests from users with MFA enabled but not verified,
 * and allows requests from users without MFA or with verified MFA.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { requireMfa } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { Response, NextFunction } from 'express';

describe('P01-75/77: Privileged MFA enforcement', () => {
    let mockNext: NextFunction;
    let mockRes: Partial<Response>;
    let mockReq: Partial<AuthRequest>;

    beforeEach(() => {
        mockNext = jest.fn();
        mockRes = {};
    });

    it('should reject unauthenticated requests with 401', () => {
        mockReq = { user: undefined };
        requireMfa(mockReq as AuthRequest, mockRes as Response, mockNext);

        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Not authenticated');
    });

    it('should allow users without MFA enabled', () => {
        mockReq = {
            user: {
                id: 'u-1',
                email: 'test@test.com',
                firstName: 'Test',
                lastName: 'User',
                roles: ['AGENT'],
                permissions: [],
                mfaEnabled: false,
                mustEnrollMfa: false,
                mfaVerifiedAt: null,
            },
        };
        requireMfa(mockReq as AuthRequest, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject MFA-enabled users who have not verified', () => {
        mockReq = {
            user: {
                id: 'u-2',
                email: 'admin@test.com',
                firstName: 'Admin',
                lastName: 'User',
                roles: ['ADMIN'],
                permissions: ['admin:settings'],
                mfaEnabled: true,
                mustEnrollMfa: false,
                mfaVerifiedAt: null,
            },
        };
        requireMfa(mockReq as AuthRequest, mockRes as Response, mockNext);

        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(403);
        expect(error.message).toContain('MFA verification required');
    });

    it('should allow MFA-enabled users who have verified', () => {
        mockReq = {
            user: {
                id: 'u-3',
                email: 'admin@test.com',
                firstName: 'Admin',
                lastName: 'User',
                roles: ['ADMIN'],
                permissions: ['admin:settings'],
                mfaEnabled: true,
                mustEnrollMfa: false,
                mfaVerifiedAt: new Date(),
            },
        };
        requireMfa(mockReq as AuthRequest, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledWith();
    });
});