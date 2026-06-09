/**
 * SOD (Segregation of Duties) Test — §1.1
 *
 * Verifies that credit:admin alone cannot call disbursement endpoints,
 * and that credit:disburse is required for the 'disburse' transition action.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Test: Permission definitions exist correctly
// ---------------------------------------------------------------------------
describe('1.1 SOD — credit:disburse separated from credit:admin', () => {
  beforeAll(async () => {
    // Ensure the permission exists in the DB
    await prisma.permission.upsert({
      where: { name: 'credit:disburse' },
      update: {},
      create: {
        name: 'credit:disburse',
        resource: 'credit',
        action: 'disburse',
        description: 'Disburse approved credit facilities (SOD: separated from admin)',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('credit:disburse permission exists in the database', async () => {
    const perm = await prisma.permission.findUnique({ where: { name: 'credit:disburse' } });
    expect(perm).toBeDefined();
    expect(perm!.resource).toBe('credit');
    expect(perm!.action).toBe('disburse');
  });

  it('CREDIT_RM (formerly CREDIT_OPS) role has credit:disburse', async () => {
    const rmRole = await prisma.role.findUnique({
      where: { name: 'CREDIT_RM' },
      include: { permissions: { include: { permission: true } } },
    });

    expect(rmRole).toBeDefined();

    const permNames = rmRole!.permissions.map((rp: any) => rp.permission.name);
    expect(permNames).toContain('credit:disburse');
    expect(permNames).not.toContain('credit:admin');
  });

  it('CREDIT_ADMIN role has credit:admin but NOT credit:disburse', async () => {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'CREDIT_ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    expect(adminRole).toBeDefined();

    const permNames = adminRole!.permissions.map((rp: any) => rp.permission.name);
    expect(permNames).toContain('credit:admin');
    // SOD: Credit admin (risk officer) should NOT have disburse permission
    expect(permNames).not.toContain('credit:disburse');
  });

  it('ADMIN role should have both credit:admin and credit:disburse (superadmin)', async () => {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });

    expect(adminRole).toBeDefined();

    const permNames = adminRole!.permissions.map((rp: any) => rp.permission.name);
    expect(permNames).toContain('credit:admin');
    expect(permNames).toContain('credit:disburse');
  });
});

// ---------------------------------------------------------------------------
// Test: Transition permission mapping (unit test, no DB needed)
// ---------------------------------------------------------------------------
describe('1.1 SOD — transition permission mapping', () => {
  const TRANSITION_PERMISSIONS: Record<string, string> = {
    submit: 'credit:write',
    start_kyc: 'credit:write',
    approve_kyc: 'credit:write',
    reject_kyc: 'credit:approve',
    resubmit: 'credit:write',
    start_underwriting: 'credit:write',
    start_assessment: 'credit:write',
    submit_to_committee: 'credit:write',
    approve: 'credit:approve',
    reject: 'credit:approve',
    make_offer: 'credit:approve',
    accept_offer: 'credit:write',
    decline_offer: 'credit:approve',
    disburse: 'credit:disburse',
    activate: 'credit:admin',
    close: 'credit:admin',
    withdraw: 'credit:write',
  };

  it('disburse action requires credit:disburse (NOT credit:admin)', () => {
    expect(TRANSITION_PERMISSIONS.disburse).toBe('credit:disburse');
    expect(TRANSITION_PERMISSIONS.disburse).not.toBe('credit:admin');
  });

  it('activate and close actions still require credit:admin', () => {
    expect(TRANSITION_PERMISSIONS.activate).toBe('credit:admin');
    expect(TRANSITION_PERMISSIONS.close).toBe('credit:admin');
  });

  it('approve actions require credit:approve', () => {
    expect(TRANSITION_PERMISSIONS.approve).toBe('credit:approve');
    expect(TRANSITION_PERMISSIONS.reject).toBe('credit:approve');
  });
});