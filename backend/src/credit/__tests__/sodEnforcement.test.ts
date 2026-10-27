// LOS-022 — Segregation of duties: the analyst cannot approve, the approver can.
import crypto from 'crypto';
import prisma from '../../utils/prisma';

const RUN = process.env.DATABASE_URL;

const mockRes = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnThis();
  r.json = jest.fn().mockReturnThis();
  r.send = jest.fn().mockReturnThis();
  return r;
};

const describeIf = RUN ? describe : describe.skip;

describeIf('LOS-022 — SOD enforcement', () => {
  const suffix = crypto.randomUUID();
  const analystEmail = `sod-analyst-${suffix}@test.local`;
  const approverEmail = `sod-approver-${suffix}@test.local`;

  let analystUser: any;
  let approverUser: any;
  let analystPerms: Set<string>;
  let approverPerms: Set<string>;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirstOrThrow({ select: { id: true } });
    const [analystRole, approverRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: 'CREDIT_ANALYST' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'CREDIT_MANAGER' } }),
    ]);
    [analystUser, approverUser] = await Promise.all([
      prisma.user.create({ data: {
        tenantId: tenant.id, email: analystEmail, passwordHash: 'test-only-no-login',
        firstName: 'SOD', lastName: 'Analyst', isActive: true,
      } }),
      prisma.user.create({ data: {
        tenantId: tenant.id, email: approverEmail, passwordHash: 'test-only-no-login',
        firstName: 'SOD', lastName: 'Approver', isActive: true,
      } }),
    ]);
    await prisma.userRole.createMany({ data: [
      { userId: analystUser.id, roleId: analystRole.id },
      { userId: approverUser.id, roleId: approverRole.id },
    ] });

    // Collect permissions through role
    const loadPerms = async (userId: string) => {
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const perms = new Set<string>();
      for (const ur of userRoles) {
        for (const rp of ur.role.permissions) {
          perms.add(rp.permission.name);
        }
      }
      return perms;
    };

    analystPerms = await loadPerms(analystUser.id);
    approverPerms = await loadPerms(approverUser.id);
  });

  afterAll(async () => {
    const userIds = [analystUser?.id, approverUser?.id].filter((id): id is string => !!id);
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('creates a distinct analyst fixture', () => {
    expect(analystUser).toBeTruthy();
  });

  it('creates a distinct approver fixture', () => {
    expect(approverUser).toBeTruthy();
  });

  it('analyst LACKS credit:approve', () => {
    expect(analystPerms.has('credit:approve')).toBe(false);
  });

  it('approver HAS credit:approve', () => {
    expect(approverPerms.has('credit:approve')).toBe(true);
  });

  it('analyst and approver are distinct users', () => {
    expect(analystUser!.id).not.toBe(approverUser!.id);
  });
});