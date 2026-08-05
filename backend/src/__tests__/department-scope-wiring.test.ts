/**
 * Task 7 integration-contract tests for canonical department scope wiring.
 *
 * These tests cover the gaps that pure policy matrix tests cannot prove:
 * authenticated principals must carry active department memberships, and
 * department-scoped role permissions must participate in coarse permission
 * checks before object policy evaluates the canonical resource department.
 */

const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('../utils/redis', () => ({
    createRedisClient: () => ({
        get: mockRedisGet,
        setex: mockRedisSetex,
        del: jest.fn(),
        scan: jest.fn(),
    }),
}));

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: mockUserFindUnique,
        },
    },
}));

jest.mock('../utils/logger', () => ({
    logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { getUserPermissions } from '../services/permission.service';
import { principalFromAuth } from '../security/resource-scope.service';

describe('P02-07 canonical department scope wiring', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisGet.mockResolvedValue(null);
        mockRedisSetex.mockResolvedValue('OK');
    });

    it('propagates authenticated department memberships into the policy principal', () => {
        const principal = principalFromAuth({
            id: 'user-1',
            tenantId: 'tenant-1',
            roles: ['AGENT'],
            permissions: ['request:read'],
            agentTeam: 'IT',
            departmentIds: ['department-it'],
        });

        expect(principal.departmentIds).toEqual(['department-it']);
    });

    it('includes active department-role permissions in the coarse permission set', async () => {
        mockUserFindUnique.mockResolvedValue({
            roles: [],
            departmentMemberships: [
                {
                    departmentId: 'department-it',
                    role: {
                        permissions: [
                            { permission: { name: 'request:read' } },
                            { permission: { name: 'request:update' } },
                        ],
                    },
                },
            ],
        });

        const permissions = await getUserPermissions('user-1');

        expect(permissions).toEqual(expect.arrayContaining(['request:read', 'request:update']));
        expect(mockUserFindUnique).toHaveBeenCalledWith(expect.objectContaining({
            include: expect.objectContaining({
                departmentMemberships: expect.objectContaining({
                    where: expect.objectContaining({
                        validFrom: expect.any(Object),
                    }),
                }),
            }),
        }));
    });
});
