import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminEmail = `crm-timeline-admin-${suffix}@test.local`;
const repEmail = `crm-timeline-rep-${suffix}@test.local`;
const tenantId = '00000000-0000-0000-0000-000000000001';

let adminId: string;
let repId: string;
let adminToken: string;
let repToken: string;
let roleId: string;
let accountId: string;
let pipelineId: string;
let stageId: string;
let opportunityId: string;
let convertedLeadId: string;
let unrelatedLeadId: string;
const activityIds: string[] = [];

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-timeline-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const [crmAdminPermission, crmReadPermission] = await Promise.all([
    prisma.permission.upsert({
      where: { name: 'crm:admin' },
      update: {},
      create: { name: 'crm:admin', resource: 'crm', action: 'admin' },
    }),
    prisma.permission.upsert({
      where: { name: 'crm:read' },
      update: {},
      create: { name: 'crm:read', resource: 'crm', action: 'read' },
    }),
  ]);

  const role = await prisma.role.create({ data: { name: `CRM_TIMELINE_REP_${suffix}` } });
  roleId = role.id;
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: crmReadPermission.id } });

  const [admin, rep] = await Promise.all([
    prisma.user.create({
      data: {
        tenantId,
        email: adminEmail,
        passwordHash: 'test-hash',
        firstName: 'Timeline',
        lastName: 'Admin',
        isActive: true,
        roles: { create: { roleId: (await prisma.role.create({ data: { name: `CRM_TIMELINE_ADMIN_${suffix}` } })).id } },
      },
    }),
    prisma.user.create({
      data: {
        tenantId,
        email: repEmail,
        passwordHash: 'test-hash',
        firstName: 'Timeline',
        lastName: 'Rep',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
  ]);
  adminId = admin.id;
  repId = rep.id;

  const adminRole = await prisma.userRole.findFirstOrThrow({ where: { userId: adminId }, select: { roleId: true } });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: adminRole.roleId, permissionId: crmAdminPermission.id },
      { roleId: adminRole.roleId, permissionId: crmReadPermission.id },
    ],
    skipDuplicates: true,
  });

  adminToken = signToken(admin.id, admin.email);
  repToken = signToken(rep.id, rep.email);

  const account = await prisma.crmAccount.create({
    data: { tenantId, name: `Timeline Account ${suffix}`, ownerId: adminId },
  });
  accountId = account.id;

  const pipeline = await prisma.crmPipeline.create({
    data: { tenantId, name: `Timeline Pipeline ${suffix}`, isActive: true },
  });
  pipelineId = pipeline.id;

  const stage = await prisma.crmPipelineStage.create({
    data: { pipelineId, name: `Timeline Stage ${suffix}`, displayOrder: 1 },
  });
  stageId = stage.id;

  const opportunity = await prisma.crmOpportunity.create({
    data: {
      tenantId,
      name: `Timeline Opportunity ${suffix}`,
      accountId,
      pipelineId,
      stageId,
      ownerId: adminId,
    },
  });
  opportunityId = opportunity.id;

  const [convertedLead, unrelatedLead] = await Promise.all([
    prisma.crmLead.create({
      data: {
        tenantId,
        title: `Converted Lead ${suffix}`,
        source: 'OTHER',
        status: 'CONVERTED',
        accountId,
        ownerId: adminId,
        convertedAt: new Date('2026-09-01T09:00:00.000Z'),
        convertedToOppId: opportunityId,
      },
    }),
    prisma.crmLead.create({
      data: {
        tenantId,
        title: `Unrelated Lead ${suffix}`,
        source: 'OTHER',
        status: 'NEW',
        accountId,
        ownerId: adminId,
      },
    }),
  ]);
  convertedLeadId = convertedLead.id;
  unrelatedLeadId = unrelatedLead.id;

  const activities = await Promise.all([
    prisma.crmActivity.create({
      data: {
        activityType: 'CALL',
        subject: `Lead Call ${suffix}`,
        userId: adminId,
        leadId: convertedLeadId,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
      },
    }),
    prisma.crmActivity.create({
      data: {
        activityType: 'EMAIL',
        subject: `Lead Email ${suffix}`,
        userId: adminId,
        leadId: convertedLeadId,
        createdAt: new Date('2026-09-01T11:00:00.000Z'),
      },
    }),
    prisma.crmActivity.create({
      data: {
        activityType: 'MEETING',
        subject: `Opportunity Meeting ${suffix}`,
        userId: adminId,
        opportunityId,
        createdAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    }),
    prisma.crmActivity.create({
      data: {
        activityType: 'NOTE',
        subject: `Unrelated Lead Activity ${suffix}`,
        userId: adminId,
        leadId: unrelatedLeadId,
        createdAt: new Date('2026-09-01T13:00:00.000Z'),
      },
    }),
  ]);
  activityIds.push(...activities.map((activity) => activity.id));
});

afterAll(async () => {
  await prisma.crmActivity.deleteMany({ where: { id: { in: activityIds } } });
  await prisma.crmLead.deleteMany({ where: { id: { in: [convertedLeadId, unrelatedLeadId] } } });
  await prisma.crmOpportunity.deleteMany({ where: { id: opportunityId } });
  await prisma.crmPipelineStage.deleteMany({ where: { id: stageId } });
  await prisma.crmPipeline.deleteMany({ where: { id: pipelineId } });
  await prisma.crmAccount.deleteMany({ where: { id: accountId } });
  await prisma.userRole.deleteMany({ where: { userId: { in: [adminId, repId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, repId] } } });
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  const adminRole = await prisma.role.findFirst({ where: { name: `CRM_TIMELINE_ADMIN_${suffix}` } });
  if (adminRole) {
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.role.delete({ where: { id: adminRole.id } });
  }
  await prisma.$disconnect();
});

describe('CRM Opportunity combined activity timeline', () => {
  it('aggregates converted Lead and Opportunity activities in detail order', async () => {
    const response = await request(app)
      .get(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const activities = response.body.data.opportunity.activities;
    expect(activities.map((activity: { subject: string }) => activity.subject)).toEqual([
      `Opportunity Meeting ${suffix}`,
      `Lead Email ${suffix}`,
      `Lead Call ${suffix}`,
    ]);
    expect(activities).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: `Unrelated Lead Activity ${suffix}` }),
    ]));
  });

  it('paginates the combined timeline and annotates each activity origin', async () => {
    const firstPage = await request(app)
      .get(`/api/v1/crm/activities?opportunityId=${opportunityId}&page=1&limit=2`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const secondPage = await request(app)
      .get(`/api/v1/crm/activities?opportunityId=${opportunityId}&page=2&limit=2`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(firstPage.body.data.pagination.total).toBe(3);
    expect(firstPage.body.data.activities.map((activity: { subject: string }) => activity.subject)).toEqual([
      `Opportunity Meeting ${suffix}`,
      `Lead Email ${suffix}`,
    ]);
    expect(firstPage.body.data.activities.map((activity: { sourceEntity: string }) => activity.sourceEntity)).toEqual([
      'OPPORTUNITY',
      'LEAD',
    ]);
    expect(secondPage.body.data.activities.map((activity: { subject: string }) => activity.subject)).toEqual([
      `Lead Call ${suffix}`,
    ]);
    expect(secondPage.body.data.activities[0].sourceEntity).toBe('LEAD');
  });

  it('does not expose the combined timeline to a user outside the opportunity owner scope', async () => {
    await request(app)
      .get(`/api/v1/crm/activities?opportunityId=${opportunityId}`)
      .set('Authorization', `Bearer ${repToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.activities).toHaveLength(0);
        expect(response.body.data.pagination.total).toBe(0);
      });

    await request(app)
      .get(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${repToken}`)
      .expect(404);
  });
});
