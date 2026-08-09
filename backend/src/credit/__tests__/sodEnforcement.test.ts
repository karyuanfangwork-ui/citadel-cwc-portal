// LOS-022 — Segregation of duties: the analyst cannot approve, the approver can.
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
  const analystEmail = 'e2e-analyst@test.local';
  const approverEmail = 'e2e-approver@test.local';

  let analystUser: any;
  let approverUser: any;
  let analystPerms: Set<string>;
  let approverPerms: Set<string>;

  beforeAll(async () => {
    analystUser = await prisma.user.findUnique({ where: { email: analystEmail } });
    approverUser = await prisma.user.findUnique({ where: { email: approverEmail } });

    if (!analystUser || !approverUser) return; // seeded later; test assertions will fail gracefully

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

  afterAll(() => prisma.$disconnect());

  it('the analyst identity was seeded', () => {
    expect(analystUser).toBeTruthy();
  });

  it('the approver identity was seeded', () => {
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