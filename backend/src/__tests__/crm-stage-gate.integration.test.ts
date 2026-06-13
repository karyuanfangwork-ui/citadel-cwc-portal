import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerEmail = `crm-sg-owner-${suffix}@test.local`;
const otherEmail = `crm-sg-other-${suffix}@test.local`;

let ownerId: string;
let ownerToken: string;
let stage1Id: string;
let stage2Id: string;
let stage3Id: string;
let stage4Id: string;
let oppAtStage2Id: string;
let oppForwardId: string;
let oppMissingFieldId: string;
let oppHighValueId: string;
let otherOppId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-sg-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

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
    where: { name: `CRM_SG_TEST_${suffix}` },
    update: {},
    create: { name: `CRM_SG_TEST_${suffix}` },
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
        firstName: 'SG',
        lastName: 'Owner',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
    prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: 'test-hash',
        firstName: 'SG',
        lastName: 'Other',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
  ]);

  ownerId = owner.id;
  ownerToken = signToken(owner.id, owner.email);

  const pipeline = await prisma.crmPipeline.create({
    data: {
      name: `SG Pipeline ${suffix}`,
      stages: {
        create: [
          {
            name: 'Open',
            displayOrder: 1,
            probability: 10,
            enforceForwardOnly: true,
            requiredFields: [],
            requiresApproval: false,
            approvalThreshold: null,
          },
          {
            name: 'Review',
            displayOrder: 2,
            probability: 30,
            enforceForwardOnly: true,
            requiredFields: [],
            requiresApproval: false,
            approvalThreshold: null,
          },
          {
            name: 'Negotiate',
            displayOrder: 3,
            probability: 60,
            enforceForwardOnly: true,
            requiredFields: ['expectedCloseDate'],
            requiresApproval: false,
            approvalThreshold: null,
          },
          {
            name: 'Close',
            displayOrder: 4,
            probability: 90,
            enforceForwardOnly: true,
            requiredFields: [],
            requiresApproval: true,
            approvalThreshold: 10000,
          },
        ],
      },
    },
    include: { stages: { orderBy: { displayOrder: 'asc' } } },
  });

  [stage1Id, stage2Id, stage3Id, stage4Id] = pipeline.stages.map((stage) => stage.id);

  const ownerAccount = await prisma.crmAccount.create({
    data: { name: `SG Owner Account ${suffix}`, ownerId: owner.id },
  });

  const otherAccount = await prisma.crmAccount.create({
    data: { name: `SG Other Account ${suffix}`, ownerId: other.id },
  });

  const oppAtStage2 = await prisma.crmOpportunity.create({
    data: {
      name: `SG At Stage2 ${suffix}`,
      accountId: ownerAccount.id,
      pipelineId: pipeline.id,
      stageId: stage2Id,
      ownerId: owner.id,
      value: 1000,
    },
  });
  oppAtStage2Id = oppAtStage2.id;

  const oppForward = await prisma.crmOpportunity.create({
    data: {
      name: `SG Forward ${suffix}`,
      accountId: ownerAccount.id,
      pipelineId: pipeline.id,
      stageId: stage1Id,
      ownerId: owner.id,
      value: 1000,
    },
  });
  oppForwardId = oppForward.id;

  const oppMissingField = await prisma.crmOpportunity.create({
    data: {
      name: `SG Missing Field ${suffix}`,
      accountId: ownerAccount.id,
      pipelineId: pipeline.id,
      stageId: stage2Id,
      ownerId: owner.id,
      value: 1000,
      expectedCloseDate: null,
    },
  });
  oppMissingFieldId = oppMissingField.id;

  const oppHighValue = await prisma.crmOpportunity.create({
    data: {
      name: `SG High Value ${suffix}`,
      accountId: ownerAccount.id,
      pipelineId: pipeline.id,
      stageId: stage1Id,
      ownerId: owner.id,
      value: 50000,
    },
  });
  oppHighValueId = oppHighValue.id;

  const otherOpp = await prisma.crmOpportunity.create({
    data: {
      name: `SG Other Owner Opp ${suffix}`,
      accountId: otherAccount.id,
      pipelineId: pipeline.id,
      stageId: stage1Id,
      ownerId: other.id,
      value: 1000,
    },
  });
  otherOppId = otherOpp.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: ownerId } });
  await prisma.crmOpportunityStageHistory.deleteMany({
    where: { opportunity: { name: { contains: suffix } } },
  });
  await prisma.crmActivity.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmOpportunity.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.crmAccount.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.crmPipeline.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.userRole.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  await prisma.role.deleteMany({ where: { name: `CRM_SG_TEST_${suffix}` } });
});

describe('Stage gate - forward move', () => {
  it('moves opportunity to the next stage and returns 200', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${oppForwardId}/move-stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: stage2Id });

    expect(res.status).toBe(200);
    expect(res.body.data.opportunity.stageId).toBe(stage2Id);
  });

  it('records a stage history entry after the move', async () => {
    const history = await prisma.crmOpportunityStageHistory.findFirst({
      where: { opportunityId: oppForwardId, toStageName: 'Review' },
    });

    expect(history).not.toBeNull();
    expect(history?.fromStageName).toBe('Open');
    expect(history?.movedByUserId).toBe(ownerId);
  });

  it('creates an audit log entry for the stage move', async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: ownerId,
        action: 'UPDATE',
        resourceType: 'CrmOpportunity',
        resourceId: oppForwardId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).not.toBeNull();
    expect((audit?.newValues as { stageId?: string } | null)?.stageId).toBe(stage2Id);
  });
});

describe('Stage gate - forward-only enforcement', () => {
  it('returns 422 when moving backward to a stage with enforceForwardOnly', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${oppAtStage2Id}/move-stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: stage1Id });

    expect(res.status).toBe(422);
    expect(res.body.needsApproval).toBe(false);
  });
});

describe('Stage gate - required fields', () => {
  it('returns 422 when required field expectedCloseDate is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${oppMissingFieldId}/move-stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: stage3Id });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/expectedCloseDate/);
  });
});

describe('Stage gate - approval gate', () => {
  it('returns 403 with needsApproval: true for high-value deal entering a gated stage', async () => {
    await prisma.crmOpportunity.update({
      where: { id: oppHighValueId },
      data: { stageId: stage3Id, expectedCloseDate: new Date('2026-12-31') },
    });

    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${oppHighValueId}/move-stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: stage4Id });

    expect(res.status).toBe(403);
    expect(res.body.needsApproval).toBe(true);
  });
});

describe('Stage gate - IDOR', () => {
  it('returns 404 when moving another owner opportunity', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${otherOppId}/move-stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stageId: stage2Id });

    expect(res.status).toBe(404);
  });
});
