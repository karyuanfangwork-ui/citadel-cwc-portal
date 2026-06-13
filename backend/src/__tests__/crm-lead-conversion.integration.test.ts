import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerEmail = `crm-conv-owner-${suffix}@test.local`;
const otherEmail = `crm-conv-other-${suffix}@test.local`;

let ownerId: string;
let otherOwnerId: string;
let ownerToken: string;
let pipelineId: string;
let stageId: string;
let ownedLeadId: string;
let otherLeadId: string;
let alreadyConvertedLeadId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-conv-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const permissions = await Promise.all(
    ['crm:read', 'crm:write', 'crm:delete'].map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, resource: 'crm', action: name.split(':')[1] },
      }),
    ),
  );

  const role = await prisma.role.upsert({
    where: { name: `CRM_CONV_TEST_${suffix}` },
    update: {},
    create: { name: `CRM_CONV_TEST_${suffix}` },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const [owner, other] = await Promise.all([
    prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: 'test-hash',
        firstName: 'Conv',
        lastName: 'Owner',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
    prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: 'test-hash',
        firstName: 'Conv',
        lastName: 'Other',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
  ]);

  ownerId = owner.id;
  otherOwnerId = other.id;
  ownerToken = signToken(owner.id, owner.email);

  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: `Conv Pipeline ${suffix}`,
      stages: {
        create: [{ name: 'Prospect', displayOrder: 1, probability: 10 }],
      },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  stageId = pipeline.stages[0].id;

  const ownerAccount = await prisma.crmAccount.create({
    data: { name: `Conv Owner Account ${suffix}`, ownerId: owner.id },
  });

  const ownedLead = await prisma.crmLead.create({
    data: {
      title: `Conv Owned Lead ${suffix}`,
      companyName: `Conv Owned Co ${suffix}`,
      ownerId: owner.id,
      accountId: ownerAccount.id,
    },
  });
  ownedLeadId = ownedLead.id;

  const otherAccount = await prisma.crmAccount.create({
    data: { name: `Conv Other Account ${suffix}`, ownerId: other.id },
  });

  const otherLead = await prisma.crmLead.create({
    data: {
      title: `Conv Other Lead ${suffix}`,
      companyName: `Conv Other Co ${suffix}`,
      ownerId: other.id,
      accountId: otherAccount.id,
    },
  });
  otherLeadId = otherLead.id;

  const alreadyConverted = await prisma.crmLead.create({
    data: {
      title: `Conv Already Converted ${suffix}`,
      companyName: `Conv Converted Co ${suffix}`,
      ownerId: owner.id,
      accountId: ownerAccount.id,
      status: 'CONVERTED',
      convertedAt: new Date(),
    },
  });
  alreadyConvertedLeadId = alreadyConverted.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { OR: [{ userId: ownerId }, { userId: otherOwnerId }, { resourceId: { in: [ownedLeadId, otherLeadId, alreadyConvertedLeadId].filter(Boolean) } }] },
  });
  await prisma.crmOpportunityStageHistory.deleteMany({
    where: { opportunity: { account: { name: { contains: suffix } } } },
  });
  await prisma.crmActivity.deleteMany({
    where: { OR: [{ subject: { contains: suffix } }, { account: { name: { contains: suffix } } }] },
  });
  await prisma.crmOpportunity.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmLead.deleteMany({ where: { companyName: { contains: suffix } } });
  await prisma.crmContact.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmAccount.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.crmPipeline.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.userRole.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  await prisma.role.deleteMany({ where: { name: `CRM_CONV_TEST_${suffix}` } });
});

describe('Lead conversion - happy path', () => {
  let createdOpportunityId: string;

  it('returns 200 with a new opportunity when converting an owned lead', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${ownedLeadId}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        opportunityName: `Conv Opp ${suffix}`,
        pipelineId,
        stageId,
        value: 5000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.opportunity.id).toBeDefined();
    expect(res.body.data.opportunity.pipelineId).toBe(pipelineId);
    expect(res.body.data.opportunity.stageId).toBe(stageId);
    createdOpportunityId = res.body.data.opportunity.id;
  });

  it('marks the source lead as CONVERTED after conversion', async () => {
    const lead = await prisma.crmLead.findUnique({ where: { id: ownedLeadId } });
    expect(lead?.status).toBe('CONVERTED');
    expect(lead?.convertedAt).not.toBeNull();
    expect(lead?.convertedToOppId).toBe(createdOpportunityId);
  });

  it('writes a CONVERT audit log entry', async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: ownerId,
        action: 'CONVERT',
        resourceType: 'CrmLead',
        resourceId: ownedLeadId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).not.toBeNull();
    expect((audit?.newValues as { opportunityId?: string } | null)?.opportunityId).toBe(
      createdOpportunityId,
    );
  });

  it('writes a conversion activity for the created opportunity', async () => {
    const activity = await prisma.crmActivity.findFirst({
      where: {
        userId: ownerId,
        opportunityId: createdOpportunityId,
        subject: { contains: `Conv Opp ${suffix}` },
      },
    });

    expect(activity).not.toBeNull();
  });
});

describe('Lead conversion - authorization and idempotency', () => {
  it('returns 404 when converting another owner lead', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${otherLeadId}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        opportunityName: `Hijacked Opp ${suffix}`,
        pipelineId,
        stageId,
      });

    expect(res.status).toBe(404);
  });

  it('returns an error when re-converting an already-converted lead', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${alreadyConvertedLeadId}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        opportunityName: `Double Conv Opp ${suffix}`,
        pipelineId,
        stageId,
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
