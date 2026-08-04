/**
 * Tests for canActorTransition — data-driven transition authorization.
 */
const mockPrisma = { workflowTransition: { findFirst: jest.fn() } };
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { canActorTransition } from '../transitionPolicy.service';

const agent = { userId: 'u1', roles: ['AGENT'], executiveRole: null };
const ceo = { userId: 'u2', roles: ['END_USER'], executiveRole: 'CEO' };
const admin = { userId: 'u3', roles: ['ADMIN'], executiveRole: null };

const base = { tenantId: 't1', workflowTypeId: 'wf1', fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS' };

describe('canActorTransition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows any actor when the transition sets no restrictions', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: [], allowedExecutiveRoles: [],
    });
    await expect(canActorTransition({ actor: agent, ...base })).resolves.toEqual({ allowed: true });
  });

  it('allows an actor holding a listed role', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: ['AGENT', 'ADMIN'], allowedExecutiveRoles: [],
    });
    await expect(canActorTransition({ actor: agent, ...base })).resolves.toEqual({ allowed: true });
  });

  it('denies an actor holding none of the listed roles', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: ['ADMIN'], allowedExecutiveRoles: [],
    });
    const result = await canActorTransition({ actor: agent, ...base });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('ADMIN');
  });

  it('allows an actor by executive role even without a listed system role', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: ['ADMIN'], allowedExecutiveRoles: ['CEO'],
    });
    await expect(canActorTransition({ actor: ceo, ...base })).resolves.toEqual({ allowed: true });
  });

  it('denies when no transition row matches the scope', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue(null);
    const result = await canActorTransition({ actor: admin, ...base });
    expect(result.allowed).toBe(false);
  });

  it('prefers the most specific scope over the global default', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: ['AGENT'], allowedExecutiveRoles: [],
    });
    await canActorTransition({ actor: agent, ...base });
    const where = mockPrisma.workflowTransition.findFirst.mock.calls[0][0];
    // Most-specific-first ordering: NULLs sort last under `desc`.
    expect(where.orderBy).toEqual([{ tenantId: 'desc' }, { workflowTypeId: 'desc' }]);
  });
});