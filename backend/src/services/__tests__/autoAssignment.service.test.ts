import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Mock prisma before importing the module under test
const mockRequestFindUnique = jest.fn();
const mockRequestUpdate = jest.fn();
const mockServiceDeskUpdate = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserFindUnique = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock('../../utils/prisma', () => ({
    __esModule: true,
    default: {
        request: {
            findUnique: mockRequestFindUnique,
            update: mockRequestUpdate,
        },
        serviceDesk: {
            update: mockServiceDeskUpdate,
        },
        user: {
            findMany: mockUserFindMany,
            findUnique: mockUserFindUnique,
        },
        $transaction: mockPrismaTransaction,
    },
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { autoAssignRequest } from '../../services/autoAssignment.service';

describe('autoAssignRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Base request template ──────────────────────────────────────────
    const baseDesk = {
        id: 'desk-1',
        autoAssignTeam: 'FINANCE',
        assignmentStrategy: 'ROUND_ROBIN',
        lastAssignedIndex: 0,
        autoAssignUserId: null,
        autoAssignUser: null,
    };

    const baseRequest = {
        id: 'req-1',
        referenceNumber: 'FIN-0001',
        serviceDeskId: 'desk-1',
        assignedToId: null,
        serviceDesk: { ...baseDesk },
    };

    const makeAgent = (overrides: Partial<{ id: string; firstName: string; lastName: string; agentTeam: string | null }> = {}) => ({
        id: overrides.id || 'agent-1',
        firstName: overrides.firstName || 'Shah',
        lastName: overrides.lastName || 'Rezza',
        agentTeam: overrides.agentTeam || 'FINANCE',
    });

    // ── FIXED_AGENT strategy ───────────────────────────────────────────

    describe('FIXED_AGENT strategy', () => {
        it('assigns to the configured fixed agent', async () => {
            const fixedAgent = {
                id: 'agent-fixed',
                firstName: 'Shah',
                lastName: 'Rezza',
                email: 'shah@test.local',
                agentTeam: 'FINANCE',
                isActive: true,
                roles: [{ role: { name: 'AGENT' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-fixed',
                    autoAssignUser: fixedAgent,
                },
            });

            mockRequestUpdate.mockResolvedValue({ id: 'req-1', assignedToId: 'agent-fixed' });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(true);
            expect(result.assignedToId).toBe('agent-fixed');
            expect(result.strategy).toBe('FIXED_AGENT');
            expect(result.agentName).toBe('Shah Rezza');
        });

        it('returns NO_FIXED_AGENT_CONFIGURED when strategy is FIXED_AGENT but no user ID', async () => {
            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: null,
                    autoAssignUser: null,
                },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('NO_FIXED_AGENT_CONFIGURED');
        });

        it('returns INVALID_FIXED_AGENT when the user does not exist', async () => {
            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-nonexistent',
                    autoAssignUser: null, // user lookup returns null
                },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('INVALID_FIXED_AGENT');
        });

        it('returns FIXED_AGENT_INACTIVE when the user is inactive', async () => {
            const inactiveAgent = {
                id: 'agent-inactive',
                firstName: 'Inactive',
                lastName: 'User',
                email: 'inactive@test.local',
                agentTeam: 'FINANCE',
                isActive: false,
                roles: [{ role: { name: 'AGENT' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-inactive',
                    autoAssignUser: inactiveAgent,
                },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('FIXED_AGENT_INACTIVE');
        });

        it('returns FIXED_AGENT_INELIGIBLE_ROLE when user lacks AGENT/ADMIN role', async () => {
            const noRoleAgent = {
                id: 'agent-norole',
                firstName: 'Normal',
                lastName: 'User',
                email: 'normal@test.local',
                agentTeam: 'FINANCE',
                isActive: true,
                roles: [{ role: { name: 'NORMAL_STAFF' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-norole',
                    autoAssignUser: noRoleAgent,
                },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('FIXED_AGENT_INELIGIBLE_ROLE');
        });

        it('returns FIXED_AGENT_TEAM_MISMATCH when user team does not match desk team (case-insensitive)', async () => {
            const wrongTeamAgent = {
                id: 'agent-it',
                firstName: 'IT',
                lastName: 'Agent',
                email: 'it@test.local',
                agentTeam: 'IT',
                isActive: true,
                roles: [{ role: { name: 'AGENT' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-it',
                    autoAssignUser: wrongTeamAgent,
                },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('FIXED_AGENT_TEAM_MISMATCH');
        });

        it('matches team case-insensitively (Finance vs FINANCE)', async () => {
            const mixedCaseAgent = {
                id: 'agent-shah',
                firstName: 'Shah',
                lastName: 'Rezza',
                email: 'shah@test.local',
                agentTeam: 'Finance', // mixed case
                isActive: true,
                roles: [{ role: { name: 'AGENT' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-shah',
                    autoAssignUser: mixedCaseAgent,
                },
            });

            mockRequestUpdate.mockResolvedValue({ id: 'req-1', assignedToId: 'agent-shah' });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(true);
            expect(result.assignedToId).toBe('agent-shah');
            expect(result.strategy).toBe('FIXED_AGENT');
        });

        it('does not update lastAssignedIndex for FIXED_AGENT', async () => {
            const fixedAgent = {
                id: 'agent-fixed',
                firstName: 'Shah',
                lastName: 'Rezza',
                email: 'shah@test.local',
                agentTeam: 'FINANCE',
                isActive: true,
                roles: [{ role: { name: 'AGENT' } }],
            };

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'FIXED_AGENT',
                    autoAssignUserId: 'agent-fixed',
                    autoAssignUser: fixedAgent,
                },
            });

            mockRequestUpdate.mockResolvedValue({ id: 'req-1', assignedToId: 'agent-fixed' });

            await autoAssignRequest('req-1');

            // FIXED_AGENT uses a simple update, not $transaction
            // Verify serviceDesk.update was NOT called (no index update)
            expect(mockServiceDeskUpdate).not.toHaveBeenCalled();
        });
    });

    // ── Existing team strategies remain unchanged ─────────────────────

    describe('ROUND_ROBIN strategy (existing behavior)', () => {
        it('cycles through agents in order', async () => {
            const agents = [makeAgent({ id: 'a1' }), makeAgent({ id: 'a2' }), makeAgent({ id: 'a3' })];

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: { ...baseDesk, lastAssignedIndex: 1 },
            });
            mockUserFindMany.mockResolvedValue(agents);
            mockPrismaTransaction.mockImplementation(async (ops: any[]) => {
                return ops.map((op: any) => op);
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(true);
            expect(result.assignedToId).toBe('a3'); // lastAssignedIndex=1 → next index (1+1)%3=2 → a3
            expect(result.strategy).toBe('ROUND_ROBIN');
        });

        it('matches mixed-case team data for rotating strategies', async () => {
            const agents = [makeAgent({ id: 'finance-1', agentTeam: 'Finance' })];

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: { ...baseDesk, autoAssignTeam: 'FINANCE' },
            });
            mockUserFindMany.mockResolvedValue(agents);
            mockPrismaTransaction.mockImplementation(async (ops: any[]) => ops.map((op: any) => op));

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(true);
            expect(result.assignedToId).toBe('finance-1');
        });

        it('does not use a stale fixed user when the strategy is not FIXED_AGENT', async () => {
            const agents = [makeAgent({ id: 'round-robin-agent' })];

            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: {
                    ...baseDesk,
                    assignmentStrategy: 'ROUND_ROBIN',
                    autoAssignUserId: 'stale-fixed-agent',
                    autoAssignUser: { id: 'stale-fixed-agent' },
                },
            });
            mockUserFindMany.mockResolvedValue(agents);
            mockPrismaTransaction.mockImplementation(async (ops: any[]) => ops.map((op: any) => op));

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(true);
            expect(result.assignedToId).toBe('round-robin-agent');
            expect(result.strategy).toBe('ROUND_ROBIN');
        });
    });

    // ── Edge cases ─────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('returns REQUEST_NOT_FOUND when request does not exist', async () => {
            mockRequestFindUnique.mockResolvedValue(null);

            const result = await autoAssignRequest('nonexistent');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('REQUEST_NOT_FOUND');
        });

        it('returns ALREADY_ASSIGNED when request already has an assignee', async () => {
            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                assignedToId: 'existing-agent',
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('ALREADY_ASSIGNED');
        });

        it('returns NO_SERVICE_DESK when request has no service desk', async () => {
            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: null,
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('NO_SERVICE_DESK');
        });

        it('returns NO_TEAM_CONFIGURED when team is NONE', async () => {
            mockRequestFindUnique.mockResolvedValue({
                ...baseRequest,
                serviceDesk: { ...baseDesk, autoAssignTeam: 'NONE' },
            });

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('NO_TEAM_CONFIGURED');
        });

        it('returns NO_ELIGIBLE_AGENTS when no agents match the team', async () => {
            mockRequestFindUnique.mockResolvedValue(baseRequest);
            mockUserFindMany.mockResolvedValue([]);

            const result = await autoAssignRequest('req-1');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('NO_ELIGIBLE_AGENTS');
        });
    });
});