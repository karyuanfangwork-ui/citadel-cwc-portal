import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fixturePrefix = '[TEST] Forecast Category ';
const pipelinePrefix = `${fixturePrefix}Pipeline `;
const otherPipelinePrefix = `${fixturePrefix}Other Pipeline `;
const accountPrefix = `${fixturePrefix}Account `;
const opportunityPrefix = `${fixturePrefix}Opportunity `;
const testEmailPrefix = 'crm-test-forecast-category-';
// Roles are varchar(50); keep the test-only marker short enough for the run ID.
const rolePrefix = 'TEST_FC_';
const email = `${testEmailPrefix}${suffix}@test.local`;
const categories = ['PIPELINE', 'BEST_CASE', 'COMMIT', 'OMITTED'] as const;

let userId: string;
let token: string;
let accountId: string;
let pipelineId: string;
let stageId: string;
let alternateStageId: string;
let wonStageId: string;
let lostStageId: string;
let otherPipelineStageId: string;
let opportunityId: string;
let lostOpportunityId: string;

/**
 * This suite uses the local development database today.  Clean only its
 * unmistakably named fixture graph so a previously interrupted run cannot
 * leave visible CRM records behind.  Every operation is idempotent.
 */
async function cleanupForecastCategoryFixtures() {
  const accounts = await prisma.crmAccount.findMany({
    where: { name: { startsWith: accountPrefix } }, select: { id: true },
  });
  const accountIds = accounts.map((account) => account.id);
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: testEmailPrefix } },
    select: { id: true },
  });
  const userIds = testUsers.map((user) => user.id);

  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  }
  await prisma.crmActivity.deleteMany({ where: { accountId: { in: accountIds } } });
  await prisma.crmNote.deleteMany({ where: { opportunity: { accountId: { in: accountIds } } } });
  await prisma.crmOpportunityStageHistory.deleteMany({
    where: { opportunity: { accountId: { in: accountIds } } },
  });
  await prisma.crmOpportunity.deleteMany({
    where: { accountId: { in: accountIds } },
  });
  await prisma.crmAccount.deleteMany({ where: { id: { in: accountIds } } });
  await prisma.crmPipeline.deleteMany({
    where: { OR: [{ name: { startsWith: pipelinePrefix } }, { name: { startsWith: otherPipelinePrefix } }] },
  });
  if (userIds.length) {
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.role.deleteMany({ where: { name: { startsWith: rolePrefix } } });
}

const createPayload = (name: string, forecastCategory?: typeof categories[number]) => ({
  name,
  accountId,
  pipelineId,
  value: 1000,
  ...(forecastCategory === undefined ? {} : { forecastCategory }),
});

beforeAll(async () => {
  await cleanupForecastCategoryFixtures();
  const permissions = await Promise.all(
    ['crm:read', 'crm:write', 'crm:admin'].map((name) => prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, resource: 'crm', action: name.split(':')[1] },
    })),
  );
  const role = await prisma.role.create({ data: { name: `${rolePrefix}${suffix}` } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });
  const user = await prisma.user.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      email,
      passwordHash: 'test-hash',
      firstName: 'Forecast',
      lastName: 'Category',
      isActive: true,
      roles: { create: { roleId: role.id } },
    },
  });
  userId = user.id;
  token = jwt.sign({ userId, email, jti: `crm-forecast-category-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

  const pipeline = await prisma.crmPipeline.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `${pipelinePrefix}${suffix}`,
      stages: {
        create: [
          { name: 'Open', displayOrder: 1, probability: 20 },
          { name: 'Review', displayOrder: 2, probability: 45 },
          { name: 'Closed Won', displayOrder: 3, probability: 87, isWonStage: true },
          { name: 'Closed Lost', displayOrder: 4, probability: 4, isLostStage: true },
        ],
      },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  stageId = pipeline.stages[0].id;
  alternateStageId = pipeline.stages[1].id;
  wonStageId = pipeline.stages[2].id;
  lostStageId = pipeline.stages[3].id;
  const otherPipeline = await prisma.crmPipeline.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `${otherPipelinePrefix}${suffix}`,
      stages: { create: [{ name: 'Other', displayOrder: 1, probability: 99 }] },
    },
    include: { stages: true },
  });
  otherPipelineStageId = otherPipeline.stages[0].id;
  const account = await prisma.crmAccount.create({
    data: { tenantId: '00000000-0000-0000-0000-000000000001', name: `${accountPrefix}${suffix}`, ownerId: userId },
  });
  accountId = account.id;
});

afterAll(async () => {
  await cleanupForecastCategoryFixtures();
});

describe('Opportunity forecast category persistence', () => {
  it.each(categories)('creates an opportunity with %s and returns the same category', async (forecastCategory) => {
    const res = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
    .send(createPayload(`${opportunityPrefix}${forecastCategory} ${suffix}`, forecastCategory));

    expect(res.status).toBe(201);
    expect(res.body.data.opportunity.forecastCategory).toBe(forecastCategory);
    expect(res.body.data.opportunity.probability).toBe(20);
    const stored = await prisma.crmOpportunity.findUniqueOrThrow({ where: { id: res.body.data.opportunity.id } });
    expect(stored.forecastCategory).toBe(forecastCategory);
    expect(stored.probability).toBe(20);
  });

  it('uses the existing PIPELINE default when category is omitted during create', async () => {
    const res = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
      .send(createPayload(`${opportunityPrefix}default ${suffix}`));

    expect(res.status).toBe(201);
    expect(res.body.data.opportunity.forecastCategory).toBe('PIPELINE');
    expect(res.body.data.opportunity.probability).toBe(20);
    opportunityId = res.body.data.opportunity.id;
  });

  it('rejects a client-supplied probability rather than accepting a manual override', async () => {
    const res = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...createPayload(`Manual probability ${suffix}`), probability: 99 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('rejects a client-supplied create stage instead of allowing an arbitrary starting stage', async () => {
    const res = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...createPayload(`Mismatched stage ${suffix}`), stageId: otherPipelineStageId });

    expect(res.status).toBe(400);
  });

  it.each(categories)('PATCH persists %s through response, database, and reload', async (forecastCategory) => {
    const patch = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forecastCategory });

    expect(patch.status).toBe(200);
    expect(patch.body.data.opportunity.forecastCategory).toBe(forecastCategory);
    const stored = await prisma.crmOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    expect(stored.forecastCategory).toBe(forecastCategory);

    const reload = await request(app)
      .get(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reload.status).toBe(200);
    expect(reload.body.data.opportunity.forecastCategory).toBe(forecastCategory);
  });

  it('preserves the category when PATCH updates an unrelated field', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Renamed ${suffix}` });

    expect(res.status).toBe(200);
    expect(res.body.data.opportunity.forecastCategory).toBe('OMITTED');
    const stored = await prisma.crmOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    expect(stored.forecastCategory).toBe('OMITTED');
    expect(stored.probability).toBe(20);
  });

  it('rejects a client-supplied probability on PATCH', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ probability: 99 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('rejects generic PATCH stage changes', async () => {
    const moved = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: alternateStageId });

    expect(moved.status).toBe(400);
  });

  it('rejects generic PATCH stages from another pipeline', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: otherPipelineStageId });

    expect(res.status).toBe(400);
  });

  it('uses configured terminal-stage probabilities without hardcoded 100/0 overrides', async () => {
    const skipped = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
      .send(createPayload(`${opportunityPrefix}skip ${suffix}`));
    expect(skipped.status).toBe(201);
    const skipAttempt = await request(app)
      .post(`/api/v1/crm/opportunities/${skipped.body.data.opportunity.id}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: wonStageId });
    expect(skipAttempt.status).toBe(400);

    const review = await request(app)
      .post(`/api/v1/crm/opportunities/${opportunityId}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: alternateStageId });
    expect(review.status).toBe(200);
    const won = await request(app)
      .post(`/api/v1/crm/opportunities/${opportunityId}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: wonStageId });
    expect(won.status).toBe(200);
    expect(won.body.data.opportunity.probability).toBe(87);

    const lostCandidate = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${token}`)
      .send(createPayload(`${opportunityPrefix}lost ${suffix}`));
    expect(lostCandidate.status).toBe(201);
    lostOpportunityId = lostCandidate.body.data.opportunity.id;
    const lost = await request(app)
      .post(`/api/v1/crm/opportunities/${lostOpportunityId}/mark-lost`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Test outcome' });
    expect(lost.status).toBe(200);
    expect(lost.body.data.opportunity.probability).toBe(4);
    expect(lost.body.data.opportunity.lostReason).toBe('Test outcome');

    const lostMove = await request(app)
      .post(`/api/v1/crm/opportunities/${lostOpportunityId}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: alternateStageId });
    expect(lostMove.status).toBe(400);
  });

  it('synchronizes only opportunities in an explicitly updated stage', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stages: [{ id: stageId, probability: 35 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.pipeline.stages.find((stage: { id: string }) => stage.id === stageId)?.probability).toBe(35);
    const updated = await prisma.crmOpportunity.findFirstOrThrow({ where: { pipelineId, stageId } });
    expect(updated.probability).toBe(35);
    const untouched = await prisma.crmOpportunity.findFirstOrThrow({
      where: { id: lostOpportunityId, pipelineId, stageId: lostStageId },
    });
    expect(untouched.probability).toBe(4);
  });

  it('requires a reason to reopen Closed Lost and restores the first active stage', async () => {
    const blankReason = await request(app)
      .post(`/api/v1/crm/opportunities/${lostOpportunityId}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '  ' });
    expect(blankReason.status).toBe(400);

    const reopened = await request(app)
      .post(`/api/v1/crm/opportunities/${lostOpportunityId}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Customer asked to revisit' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.opportunity.stageId).toBe(stageId);
    expect(reopened.body.data.opportunity.probability).toBe(35);
    expect(reopened.body.data.opportunity.lostAt).toBeNull();
    expect(reopened.body.data.opportunity.lostReason).toBeNull();
  });

  it('does not permit Closed Won opportunities to move or reopen', async () => {
    const move = await request(app)
      .post(`/api/v1/crm/opportunities/${opportunityId}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: lostStageId });
    expect(move.status).toBe(400);
    const reopen = await request(app)
      .post(`/api/v1/crm/opportunities/${opportunityId}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Not allowed' });
    expect(reopen.status).toBe(400);
  });

  it.each(['OMIT', 'INVALID'])('rejects unsupported category %s', async (forecastCategory) => {
    const res = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forecastCategory });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});
