/**
 * Tests for requestAccess.service — P02 Task 9
 *
 * Tests the policy-based request access service. Uses mocked prisma and
 * policy service to verify that:
 * - Owner access is granted
 * - Tenant-scoped ADMIN access is granted within tenant
 * - Cross-tenant ADMIN is denied
 * - Agent team scope is enforced
 * - Cross-desk agent is denied
 * - Confidentiality gate works with policy decisions
 * - Unaffiliated users are denied
 */

// ---------------------------------------------------------------------------
// Mocks — must come before imports that reference them
// ---------------------------------------------------------------------------

jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: {
            findFirst: jest.fn(),
        },
    },
}));

jest.mock('../security/resource-scope.service', () => ({
    principalFromAuth: jest.fn(),
}));

import { assertRequestAccess, getAuthorizedRequest } from '../services/requestAccess.service';
import { AppError } from '../middleware/error.middleware';
import { principalFromAuth } from '../security/resource-scope.service';
import { policyService } from '../security/policy.service';
import prisma from '../utils/prisma';

const mockFindFirst = prisma.request.findFirst as jest.Mock;
const mockPrincipalFromAuth = principalFromAuth as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Record<string, any> = {}) {
    return {
        id: 'user-1',
        email: 'user@test.local',
        firstName: 'Test',
        lastName: 'User',
        roles: ['END_USER'],
        permissions: [] as string[],
        agentTeam: null as string | null,
        tenantId: 'tenant-a' as string | undefined,
        ...overrides,
    };
}

function makePrincipal(overrides: Record<string, any> = {}) {
    return {
        userId: 'user-1',
        tenantId: 'tenant-a',
        roles: ['END_USER'],
        permissions: [],
        agentTeam: null as string | null,
        ...overrides,
    };
}

function makeRequest(overrides: Record<string, any> = {}) {
    return {
        id: 'req-1',
        tenantId: 'tenant-a',
        referenceNumber: 'IT-00001',
        requesterId: 'user-1',
        assignedToId: null as string | null,
        isConfidential: false,
        status: 'OPEN',
        assignedTeam: 'IT' as string | null,
        serviceDesk: { code: 'IT' },
        approvals: [] as any[],
        participants: [] as any[],
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assertRequestAccess — policy-based (P02-09)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // By default, principalFromAuth returns a basic user principal
        mockPrincipalFromAuth.mockImplementation((user: any) => ({
            userId: user.id,
            tenantId: user.tenantId,
            roles: user.roles,
            permissions: user.permissions,
            agentTeam: user.agentTeam,
        }));
    });

    // ── Basic access gate ──────────────────────────────────────────────

    it('throws 401 if user is null', async () => {
        await expect(assertRequestAccess(null as any, 'req-1')).rejects.toThrow('Authentication required');
    });

    it('throws 404 if request not found', async () => {
        mockFindFirst.mockResolvedValue(null);
        await expect(assertRequestAccess(makeUser(), 'nonexistent')).rejects.toThrow('Request not found');
    });

    it('allows the requester to access their own request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'user-1' }));
        const result = await assertRequestAccess(makeUser({ id: 'user-1' }), 'req-1');
        expect(result.requesterId).toBe('user-1');
    });

    it('allows a tenant ADMIN to access requests within their tenant', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user', tenantId: 'tenant-a' }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'admin-1',
            tenantId: 'tenant-a',
            roles: ['ADMIN'],
        }));
        const result = await assertRequestAccess(makeUser({ id: 'admin-1', roles: ['ADMIN'] }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('denies cross-tenant ADMIN (wrong tenant → 404)', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ tenantId: 'tenant-a', requesterId: 'other-user' }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'admin-b',
            tenantId: 'tenant-b',
            roles: ['ADMIN'],
        }));
        await expect(
            assertRequestAccess(makeUser({ id: 'admin-b', tenantId: 'tenant-b', roles: ['ADMIN'] }), 'req-1')
        ).rejects.toThrow('Request not found');
    });

    it('allows an AGENT with matching team scope', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user', serviceDesk: { code: 'IT' } }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'agent-1',
            tenantId: 'tenant-a',
            roles: ['AGENT'],
            agentTeam: 'IT',
        }));
        const result = await assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('rejects an AGENT with non-matching team scope (cross-desk)', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            serviceDesk: { code: 'HR' },
            assignedTeam: 'HR', // HR desk, HR team — IT agent should be blocked
        }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'agent-1',
            tenantId: 'tenant-a',
            roles: ['AGENT'],
            agentTeam: 'IT',
        }));
        await expect(
            assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1')
        ).rejects.toThrow('Request not found');
    });

    it('rejects an unaffiliated user', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user' }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'random-1',
            tenantId: 'tenant-a',
            roles: ['END_USER'],
        }));
        await expect(
            assertRequestAccess(makeUser({ id: 'random-1' }), 'req-1')
        ).rejects.toThrow('Request not found');
    });

    // ── Confidentiality gate ───────────────────────────────────────────

    it('blocks non-privileged agent from confidential request (cross-desk)', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            serviceDesk: { code: 'HR' },
            assignedToId: null,
        }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'agent-1',
            tenantId: 'tenant-a',
            roles: ['AGENT'],
            agentTeam: 'IT',
            permissions: [],
        }));
        // IT agent cannot access HR confidential request — cross-desk denied
        await expect(
            assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT', permissions: [] }), 'req-1')
        ).rejects.toThrow('Request not found');
    });

    it('allows assigned agent to access confidential request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            serviceDesk: { code: 'IT' },
            assignedToId: 'agent-1',
        }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'agent-1',
            tenantId: 'tenant-a',
            roles: ['AGENT'],
            agentTeam: 'IT',
        }));
        const result = await assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('allows designated approver to access confidential request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            approvals: [{ approverId: 'approver-1' }],
            participants: [{ userId: 'approver-1' }],
            serviceDesk: { code: 'IT' },
        }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'approver-1',
            tenantId: 'tenant-a',
            roles: ['END_USER'],
        }));
        const result = await assertRequestAccess(makeUser({ id: 'approver-1', roles: ['END_USER'] }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('allows participant to access non-confidential request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            participants: [{ userId: 'participant-1' }],
        }));
        mockPrincipalFromAuth.mockReturnValue(makePrincipal({
            userId: 'participant-1',
            tenantId: 'tenant-a',
            roles: ['END_USER'],
        }));
        const result = await assertRequestAccess(makeUser({ id: 'participant-1', roles: ['END_USER'] }), 'req-1');
        expect(result).toBeTruthy();
    });

    // ── getAuthorizedRequest ───────────────────────────────────────────

    describe('getAuthorizedRequest', () => {
        it('returns request and decision for authorized user', async () => {
            mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'user-1' }));
            mockPrincipalFromAuth.mockReturnValue(makePrincipal({
                userId: 'user-1',
                tenantId: 'tenant-a',
                roles: ['END_USER'],
            }));
            const result = await getAuthorizedRequest(makeUser({ id: 'user-1' }), 'req-1');
            expect(result.request).toBeTruthy();
            expect(result.decision.allowed).toBe(true);
            expect(result.decision.reason).toBe('owner');
        });

        it('throws 404 for unauthorized user', async () => {
            mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user', tenantId: 'tenant-a' }));
            mockPrincipalFromAuth.mockReturnValue(makePrincipal({
                userId: 'random-1',
                tenantId: 'tenant-a',
                roles: ['END_USER'],
            }));
            await expect(
                getAuthorizedRequest(makeUser({ id: 'random-1' }), 'req-1')
            ).rejects.toThrow('Request not found');
        });
    });
});