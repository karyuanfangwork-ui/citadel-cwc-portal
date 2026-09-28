import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerEmail = `crm-conv-owner-${suffix}@test.local`;
const otherEmail = `crm-conv-other-${suffix}@test.local`;
const conversionEmailPrefixes = ['crm-conv-owner-', 'crm-conv-other-'];

let ownerId: string;
let otherOwnerId: string;
let ownerToken: string;
let pipelineId: string;
let stageId: string;
let otherPipelineStageId: string;
let ownedLeadId: string;
let nullEstimatedValueLeadId: string;
let otherLeadId: string;
let alreadyConvertedLeadId: string;
let lostLeadId: string;
let unqualifiedLeadId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-conv-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

async function cleanupLeadConversionFixtures() {
  const users = await prisma.user.findMany({
    where: { OR: conversionEmailPrefixes.map((prefix) => ({ email: { startsWith: prefix } })) },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.crmOpportunityStageHistory.deleteMany({ where: { opportunity: { ownerId: { in: userIds } } } });
    await prisma.crmActivity.deleteMany({ where: { account: { ownerId: { in: userIds } } } });
    await prisma.crmOpportunity.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.crmLead.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.crmContact.deleteMany({ where: { account: { ownerId: { in: userIds } } } });
    await prisma.crmAccount.deleteMany({ where: { ownerId: { in: userIds } } });
  }
  await prisma.crmPipeline.deleteMany({ where: { OR: [{ name: { startsWith: 'Conv Pipeline ' } }, { name: { startsWith: 'Conv Other Pipeline ' } }] } });
  if (userIds.length) {
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.role.deleteMany({ where: { name: { startsWith: 'CRM_CONV_TEST_' } } });
}

beforeAll(async () => {
  await cleanupLeadConversionFixtures();
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
        tenantId: '00000000-0000-0000-0000-000000000001',
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
        tenantId: '00000000-0000-0000-0000-000000000001',
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
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Conv Pipeline ${suffix}`,
      stages: {
        create: [{ name: 'Prospect', displayOrder: 1, probability: 10 }],
      },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  stageId = pipeline.stages[0].id;
  const otherPipeline = await prisma.crmPipeline.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Conv Other Pipeline ${suffix}`,
      stages: { create: [{ name: 'Other Prospect', displayOrder: 1, probability: 80 }] },
    },
    include: { stages: true },
  });
  otherPipelineStageId = otherPipeline.stages[0].id;

  const ownerAccount = await prisma.crmAccount.create({
    data: { tenantId: '00000000-0000-0000-0000-000000000001', name: `Conv Owner Account ${suffix}`, ownerId: owner.id },
  });

  const ownedLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Conv Owned Lead ${suffix}`,
      companyName: `Conv Owned Co ${suffix}`,
      ownerId: owner.id,
      accountId: ownerAccount.id,
    },
  });
  ownedLeadId = ownedLead.id;

  const nullEstimatedValueLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Conv Null Estimate Lead ${suffix}`,
      companyName: `Conv Null Estimate Co ${suffix}`,
      ownerId: owner.id,
      accountId: ownerAccount.id,
      estimatedValue: null,
    },
  });
  nullEstimatedValueLeadId = nullEstimatedValueLead.id;

  const otherAccount = await prisma.crmAccount.create({
    data: { tenantId: '00000000-0000-0000-0000-000000000001', name: `Conv Other Account ${suffix}`, ownerId: other.id },
  });

  const otherLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Conv Other Lead ${suffix}`,
      companyName: `Conv Other Co ${suffix}`,
      ownerId: other.id,
      accountId: otherAccount.id,
    },
  });
  otherLeadId = otherLead.id;

  const alreadyConverted = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Conv Already Converted ${suffix}`,
      companyName: `Conv Converted Co ${suffix}`,
      ownerId: owner.id,
      accountId: ownerAccount.id,
      status: 'CONVERTED',
      convertedAt: new Date(),
    },
  });
  alreadyConvertedLeadId = alreadyConverted.id;

  const [lostLead, unqualifiedLead] = await Promise.all([
    prisma.crmLead.create({ data: { tenantId: '00000000-0000-0000-0000-000000000001', title: `Conv Lost ${suffix}`, companyName: `Conv Lost Co ${suffix}`, ownerId: owner.id, accountId: ownerAccount.id, status: 'LOST', lostAt: new Date(), lostReason: 'Test loss' } }),
    prisma.crmLead.create({ data: { tenantId: '00000000-0000-0000-0000-000000000001', title: `Conv Unqualified ${suffix}`, companyName: `Conv Unqualified Co ${suffix}`, ownerId: owner.id, accountId: ownerAccount.id, status: 'UNQUALIFIED' } }),
  ]);
  lostLeadId = lostLead.id;
  unqualifiedLeadId = unqualifiedLead.id;
});

afterAll(async () => {
  await cleanupLeadConversionFixtures();
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
        value: 5000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.opportunity.id).toBeDefined();
    expect(res.body.data.opportunity.pipelineId).toBe(pipelineId);
    expect(res.body.data.opportunity.stageId).toBe(stageId);
    expect(res.body.data.opportunity.probability).toBe(10);
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

  it('rejects a client-supplied conversion stage', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${nullEstimatedValueLeadId}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        opportunityName: `Conv Mismatched Stage Opp ${suffix}`,
        pipelineId,
        stageId: otherPipelineStageId,
      });

    expect(res.status).toBe(400);
  });

  it('keeps the existing zero fallback when a lead with no estimate is converted without a value', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${nullEstimatedValueLeadId}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        opportunityName: `Conv Null Estimate Opp ${suffix}`,
        pipelineId,
    });

    expect(res.status).toBe(200);
    const opportunity = await prisma.crmOpportunity.findUnique({
      where: { id: res.body.data.opportunity.id },
      select: { value: true },
    });
    expect(opportunity?.value.toString()).toBe('0');
  });

  it.each(['CONTACTED', 'QUALIFIED'] as const)('allows conversion from active %s leads', async (status) => {
    const lead = await prisma.crmLead.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        title: `Conv ${status} ${suffix}`,
        companyName: `Conv ${status} Co ${suffix}`,
        ownerId,
        accountId: (await prisma.crmLead.findUniqueOrThrow({ where: { id: ownedLeadId }, select: { accountId: true } })).accountId,
        status,
      },
    });
    const res = await request(app)
      .post(`/api/v1/crm/leads/${lead.id}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ opportunityName: `Conv ${status} Opp ${suffix}`, pipelineId });
    expect(res.status).toBe(200);
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
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it.each([
    ['lost', () => lostLeadId],
    ['unqualified', () => unqualifiedLeadId],
  ])('rejects conversion from a %s lead', async (_label, leadId) => {
    const res = await request(app)
      .post(`/api/v1/crm/leads/${leadId()}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ opportunityName: `Terminal conversion ${suffix}`, pipelineId });

    expect(res.status).toBe(400);
  });
});
