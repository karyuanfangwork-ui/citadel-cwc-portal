import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config';
import prisma from '../utils/prisma';

const tenantId = '00000000-0000-0000-0000-000000000001';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const roleNames = {
  admin: `CRM_HIER_ADMIN_${suffix}`,
  rep: 'SALES_REP',
  manager: 'SALES_MANAGER',
};

let adminId: string;
let repId: string;
let managerId: string;
let inactiveManagerId: string;
let adminToken: string;
let repToken: string;
let managerToken: string;
let adminRoleId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-hierarchy-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const permissions = await Promise.all([
    prisma.permission.upsert({ where: { name: 'crm:admin' }, update: {}, create: { name: 'crm:admin', resource: 'crm', action: 'admin' } }),
    prisma.permission.upsert({ where: { name: 'crm:read' }, update: {}, create: { name: 'crm:read', resource: 'crm', action: 'read' } }),
  ]);
  const [adminRole, repRole, managerRole] = await Promise.all([
    prisma.role.create({ data: { name: roleNames.admin } }),
    prisma.role.upsert({ where: { name: roleNames.rep }, update: {}, create: { name: roleNames.rep } }),
    prisma.role.upsert({ where: { name: roleNames.manager }, update: {}, create: { name: roleNames.manager } }),
  ]);
  adminRoleId = adminRole.id;
  await Promise.all([
    prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permissions[0].id } }, update: {}, create: { roleId: adminRole.id, permissionId: permissions[0].id } }),
    prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: repRole.id, permissionId: permissions[1].id } }, update: {}, create: { roleId: repRole.id, permissionId: permissions[1].id } }),
    prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permissions[1].id } }, update: {}, create: { roleId: managerRole.id, permissionId: permissions[1].id } }),
  ]);

  const [admin, rep, manager, inactiveManager] = await Promise.all([
    prisma.user.create({ data: { tenantId, email: `crm-hier-admin-${suffix}@test.local`, passwordHash: 'test', firstName: 'Hierarchy', lastName: 'Admin', isActive: true, roles: { create: { roleId: adminRole.id } } } }),
    prisma.user.create({ data: { tenantId, email: `crm-hier-rep-${suffix}@test.local`, passwordHash: 'test', firstName: 'Hierarchy', lastName: 'Rep', isActive: true, roles: { create: { roleId: repRole.id } } } }),
    prisma.user.create({ data: { tenantId, email: `crm-hier-manager-${suffix}@test.local`, passwordHash: 'test', firstName: 'Hierarchy', lastName: 'Manager', isActive: true, roles: { create: { roleId: managerRole.id } } } }),
    prisma.user.create({ data: { tenantId, email: `crm-hier-inactive-${suffix}@test.local`, passwordHash: 'test', firstName: 'Inactive', lastName: 'Manager', isActive: false, roles: { create: { roleId: managerRole.id } } } }),
  ]);
  adminId = admin.id;
  repId = rep.id;
  managerId = manager.id;
  inactiveManagerId = inactiveManager.id;
  adminToken = signToken(admin.id, admin.email);
  repToken = signToken(rep.id, rep.email);
  managerToken = signToken(manager.id, manager.email);
});

afterAll(async () => {
  const userIds = [adminId, repId, managerId, inactiveManagerId].filter(Boolean);
  await prisma.auditLog.deleteMany({ where: { resourceType: 'User', resourceId: repId } }).catch(() => {});
  if (userIds.length) await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  if (adminRoleId) await prisma.rolePermission.deleteMany({ where: { roleId: adminRoleId } }).catch(() => {});
  if (adminRoleId) await prisma.role.delete({ where: { id: adminRoleId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('CRM sales hierarchy integration', () => {
  it('requires authentication and crm:admin for the hierarchy endpoint', async () => {
    await request(app).get('/api/v1/crm/sales-hierarchy').expect(401);
    await request(app).get('/api/v1/crm/sales-hierarchy').set('Authorization', `Bearer ${repToken}`).expect(403);
    await request(app).get('/api/v1/crm/sales-hierarchy').set('Authorization', `Bearer ${managerToken}`).expect(403);
  });

  it('returns safe hierarchy data to a CRM admin', async () => {
    const response = await request(app)
      .get('/api/v1/crm/sales-hierarchy')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.summary.salesRepCount).toBeGreaterThanOrEqual(1);
    expect(response.body.data.managerOptions.some((manager: { id: string }) => manager.id === managerId)).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('mfaSecret');
  });

  it('reassigns and unassigns a representative without changing ownership records', async () => {
    await request(app)
      .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId })
      .expect(200);

    expect((await prisma.user.findUnique({ where: { id: repId }, select: { managerId: true } }))?.managerId).toBe(managerId);
    const assignmentAudit = await prisma.auditLog.findFirst({ where: { resourceType: 'User', resourceId: repId, action: 'CRM_SALES_MANAGER_CHANGED' }, orderBy: { createdAt: 'desc' } });
    expect(assignmentAudit?.newValues).toEqual(expect.objectContaining({ managerId }));
    expect(assignmentAudit?.userId).toBe(adminId);
    expect(assignmentAudit?.tenantId).toBe(tenantId);

    await request(app)
      .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: null })
      .expect(200);
    expect((await prisma.user.findUnique({ where: { id: repId }, select: { managerId: true } }))?.managerId).toBeNull();
  });

  it('rejects an inactive manager assignment', async () => {
    const response = await request(app)
      .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: inactiveManagerId })
      .expect(422);
    expect(response.body.message).toMatch(/active/i);
  });

  it('rejects self, cross-tenant, and circular assignments', async () => {
    await request(app)
      .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: repId })
      .expect(422);

    await request(app)
      .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: '00000000-0000-4000-8000-000000000099' })
      .expect(404);

    const salesRepRole = await prisma.role.findUnique({ where: { name: 'SALES_REP' }, select: { id: true } });
    await prisma.userRole.create({ data: { userId: managerId, roleId: salesRepRole!.id } });
    await prisma.user.update({ where: { id: managerId }, data: { managerId: repId } });
    try {
      await request(app)
        .put(`/api/v1/crm/sales-hierarchy/reps/${repId}/manager`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ managerId })
        .expect(422);
    } finally {
      await prisma.user.update({ where: { id: managerId }, data: { managerId: null } });
      await prisma.userRole.delete({ where: { userId_roleId: { userId: managerId, roleId: salesRepRole!.id } } }).catch(() => {});
    }
  });
});
