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

  it('allows an agent when the transition sets no explicit restrictions', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: [], allowedExecutiveRoles: [],
    });
    await expect(canActorTransition({ actor: agent, ...base })).resolves.toEqual({ allowed: true });
  });

  it('denies normal staff when the transition sets no explicit restrictions', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: [], allowedExecutiveRoles: [],
    });
    const result = await canActorTransition({
      actor: { userId: 'u4', roles: ['NORMAL_STAFF'], executiveRole: null },
      ...base,
    });
    expect(result).toEqual({
      allowed: false,
      reason: 'Workflow transitions require the AGENT or ADMIN role',
    });
  });

  it('allows a CFO on a legacy Finance approval transition with empty allow-lists', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: [], allowedExecutiveRoles: [],
    });
    await expect(canActorTransition({
      actor: { userId: 'u5', roles: ['CFO', 'NORMAL_STAFF'], executiveRole: null },
      ...base,
      fromStatus: 'PENDING_CFO_APPROVAL_FIN',
      toStatus: 'CFO_APPROVED_FIN',
    })).resolves.toEqual({ allowed: true });
  });

  it('does not allow a CFO to use an ordinary legacy transition', async () => {
    mockPrisma.workflowTransition.findFirst.mockResolvedValue({
      allowedRoles: [], allowedExecutiveRoles: [],
    });
    const result = await canActorTransition({
      actor: { userId: 'u5', roles: ['CFO', 'NORMAL_STAFF'], executiveRole: null },
      ...base,
    });
    expect(result).toEqual({
      allowed: false,
      reason: 'Workflow transitions require the AGENT or ADMIN role',
    });
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
    mockPrisma.workflowTransition.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        allowedRoles: ['AGENT'], allowedExecutiveRoles: [],
      });
    await canActorTransition({ actor: agent, ...base });
    expect(mockPrisma.workflowTransition.findFirst.mock.calls.map(([args]: any[]) => args.where)).toEqual([
      { fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS', isActive: true, tenantId: 't1', workflowTypeId: 'wf1' },
      { fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS', isActive: true, tenantId: 't1', workflowTypeId: null },
      { fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS', isActive: true, tenantId: null, workflowTypeId: 'wf1' },
    ]);
  });
});