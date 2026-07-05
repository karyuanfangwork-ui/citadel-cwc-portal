/**
 * Tests for requestAccess.service — P2-02/P2-03 access enforcement
 *
 * We mock prisma and the hasRole function to isolate the access logic.
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

jest.mock('../middleware/auth.middleware', () => ({
    hasRole: jest.fn(),
}));

import { assertRequestAccess } from '../services/requestAccess.service';
import { AppError } from '../middleware/error.middleware';
import { hasRole } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';

const mockFindFirst = prisma.request.findFirst as jest.Mock;
const mockHasRole = hasRole as jest.Mock;

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
        tenantId: undefined as string | undefined,
        ...overrides,
    };
}

function makeRequest(overrides: Record<string, any> = {}) {
    return {
        id: 'req-1',
        referenceNumber: 'IT-1',
        requesterId: 'user-1',
        assignedToId: null as string | null,
        isConfidential: false,
        status: 'OPEN',
        assignedTeam: null as string | null,
        serviceDesk: { code: 'IT' },
        approvals: [] as any[],
        participants: [] as any[],
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assertRequestAccess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // By default, hasRole returns false for every call
        mockHasRole.mockReturnValue(false);
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

    it('allows an ADMIN to access any request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user' }));
        mockHasRole.mockImplementation((_req: any, ...roles: string[]) => roles.includes('ADMIN'));
        const result = await assertRequestAccess(makeUser({ id: 'admin-1', roles: ['ADMIN'] }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('allows an AGENT with matching team scope', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user', serviceDesk: { code: 'IT' } }));
        mockHasRole.mockImplementation((_req: any, role: string) => role === 'AGENT');
        const result = await assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('rejects an AGENT with non-matching team scope', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user', serviceDesk: { code: 'HR' } }));
        mockHasRole.mockImplementation((_req: any, role: string) => role === 'AGENT');
        await expect(
            assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1')
        ).rejects.toThrow('You do not have permission');
    });

    it('rejects an unaffiliated user', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({ requesterId: 'other-user' }));
        mockHasRole.mockReturnValue(false);
        await expect(
            assertRequestAccess(makeUser({ id: 'random-1' }), 'req-1')
        ).rejects.toThrow('You do not have permission');
    });

    // ── Confidentiality gate ───────────────────────────────────────────
    //  These tests need a user who PASSES the base access gate but FAILS
    //  the confidentiality gate. The simplest way: make the user an AGENT
    //  (passes base gate via team scope) but without request:confidential
    //  permission and not the assignee/approver.

    it('blocks non-privileged user from confidential request', async () => {
        // Agent passes the base gate (team scope match) but has no confidential access
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            serviceDesk: { code: 'IT' },
            assignedToId: null,
            approvals: [],
            participants: [],
        }));
        mockHasRole.mockImplementation((_req: any, role: string) => role === 'AGENT');
        await expect(
            assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT', permissions: [] }), 'req-1')
        ).rejects.toThrow('confidential');
    });

    it('allows assigned agent to access confidential request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            serviceDesk: { code: 'IT' },
            assignedToId: 'agent-1',
        }));
        mockHasRole.mockImplementation((_req: any, role: string) => role === 'AGENT');
        const result = await assertRequestAccess(makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT' }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('allows user with request:confidential permission', async () => {
        // AGENT with team scope (passes base gate) + request:confidential
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            serviceDesk: { code: 'IT' },
            assignedToId: null,
            approvals: [],
        }));
        mockHasRole.mockImplementation((_req: any, role: string) => role === 'AGENT');
        const result = await assertRequestAccess(
            makeUser({ id: 'agent-1', roles: ['AGENT'], agentTeam: 'IT', permissions: ['request:confidential'] }),
            'req-1'
        );
        expect(result).toBeTruthy();
    });

    it('allows designated approver to access confidential request', async () => {
        // Approver passes base gate via isDesignatedApprover and confidentiality gate
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            isConfidential: true,
            approvals: [{ approverId: 'approver-1' }],
            participants: [{ userId: 'approver-1' }], // also a participant so base gate passes
            serviceDesk: { code: 'IT' },
        }));
        mockHasRole.mockReturnValue(false);
        const result = await assertRequestAccess(makeUser({ id: 'approver-1', roles: ['END_USER'] }), 'req-1');
        expect(result).toBeTruthy();
    });

    it('allows participant to access non-confidential request', async () => {
        mockFindFirst.mockResolvedValue(makeRequest({
            requesterId: 'other-user',
            participants: [{ userId: 'participant-1' }],
        }));
        mockHasRole.mockReturnValue(false);
        const result = await assertRequestAccess(makeUser({ id: 'participant-1', roles: ['END_USER'] }), 'req-1');
        expect(result).toBeTruthy();
    });
});