const mockGetAgentDashboard = jest.fn();
jest.mock('../../services/agent-dashboard.service', () => ({ __esModule: true, getAgentDashboard: mockGetAgentDashboard }));

import { getAgentDashboardController } from '../agent-dashboard.controller';
import { AgentDashboardResponse } from '../../services/agent-dashboard.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const response: AgentDashboardResponse = {
  asOf: '2026-10-10T12:00:00.000Z', scope: 'mine', scopeLabel: 'My work', availableScopes: ['mine'],
  metrics: { open: 0, dueSoon: 0, breached: 0, avgResolutionHours: null, resolutionSampleSize: 0, resolutionWindow: { from: '2026-09-10T12:00:00.000Z', to: '2026-10-10T12:00:00.000Z' } },
  queueCounts: { open: 0, closed: 0, all: 0, unassigned: 0 }, requestTypes: [], attention: { total: 0, tickets: [] }, tickets: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
};

function callController(user: NonNullable<AuthRequest['user']>, query: Record<string, unknown>) {
  return new Promise<{ body?: unknown; error?: Error }>((resolve) => {
    const req = { user, query } as unknown as AuthRequest;
    const res = { json: jest.fn((body: unknown) => resolve({ body })) } as any;
    const next = jest.fn((error?: Error) => resolve({ error }));
    getAgentDashboardController(req, res, next);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAgentDashboard.mockResolvedValue(response);
});

describe('getAgentDashboardController', () => {
  it('allows an agent without report:read and returns the dashboard envelope', async () => {
    const result = await callController({
      id: '00000000-0000-4000-8000-000000000001', email: 'agent@test.local', firstName: 'Agent', lastName: 'Test',
      roles: ['AGENT'], permissions: ['request:read'], agentTeam: 'IT', tenantId: '00000000-0000-4000-8000-000000000010',
    }, { scope: 'mine', queue: 'open', page: 1, limit: 25, sort: 'urgency' });

    expect(result.error).toBeUndefined();
    expect(result.body).toEqual({ status: 'success', data: response });
    expect(mockGetAgentDashboard).toHaveBeenCalledWith(expect.objectContaining({ roles: ['AGENT'] }), expect.objectContaining({ scope: 'mine' }));
  });

  it('denies end users and tampered privileged scopes before service access', async () => {
    const endUser = await callController({
      id: '00000000-0000-4000-8000-000000000002', email: 'user@test.local', firstName: 'End', lastName: 'User',
      roles: ['END_USER'], permissions: [],
    }, { scope: 'mine', queue: 'open', page: 1, limit: 25, sort: 'urgency' });
    expect(endUser.error).toMatchObject({ statusCode: 403 });

    const noTeamAgent = await callController({
      id: '00000000-0000-4000-8000-000000000003', email: 'agent@test.local', firstName: 'Agent', lastName: 'NoTeam',
      roles: ['AGENT'], permissions: [],
    }, { scope: 'accessible', queue: 'open', page: 1, limit: 25, sort: 'urgency' });
    expect(noTeamAgent.error).toMatchObject({ statusCode: 403 });
    expect(mockGetAgentDashboard).not.toHaveBeenCalled();
  });

  it.each(['MET', 'MISSED', 'UNKNOWN'])('passes historical SLA filter %s to the query service', async (slaState) => {
    const result = await callController({
      id: '00000000-0000-4000-8000-000000000004', email: 'agent@test.local', firstName: 'Agent', lastName: 'Test',
      roles: ['AGENT'], permissions: [], agentTeam: 'IT',
    }, { scope: 'mine', queue: 'closed', page: 1, limit: 25, sort: 'urgency', slaState });
    expect(result.error).toBeUndefined();
    expect(result.body).toEqual({ status: 'success', data: response });
    expect(mockGetAgentDashboard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ slaState }));
  });
});
