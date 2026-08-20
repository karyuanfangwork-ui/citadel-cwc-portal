import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const salesRepEmail = `crm-authz-rep-${suffix}@test.local`;
const otherOwnerEmail = `crm-authz-other-${suffix}@test.local`;

let salesRepId: string;
let otherOwnerId: string;
let salesRepToken: string;
let otherOwnerToken: string;
let otherOwnersAccountId: string;
let otherOwnersContactId: string;
let otherOwnersLeadId: string;
let otherOwnersOpportunityId: string;
let otherOwnersTrustProductId: string;
let validStageId: string;
let pipelineId: string;
let testTagId: string;
let otherOwnersDuplicateMatchId: string;
let visibleDuplicateMatchId: string;
let visibleDismissDuplicateMatchId: string;
let visibleDuplicateMasterLeadId: string;
let visibleAccountId: string;
let visibleLeadId: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-authz-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

beforeAll(async () => {
  const permissions = await Promise.all(
    ['crm:read', 'crm:write', 'crm:delete', 'crm:export'].map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, resource: 'crm', action: name.split(':')[1] },
      }),
    ),
  );

  const role = await prisma.role.upsert({
    where: { name: `CRM_AUTHZ_TEST_${suffix}` },
    update: {},
    create: { name: `CRM_AUTHZ_TEST_${suffix}` },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const [salesRep, otherOwner] = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: salesRepEmail,
        passwordHash: 'test-hash',
        firstName: 'Visible',
        lastName: 'Rep',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: otherOwnerEmail,
        passwordHash: 'test-hash',
        firstName: 'Other',
        lastName: 'Rep',
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    }),
  ]);

  salesRepId = salesRep.id;
  otherOwnerId = otherOwner.id;
  salesRepToken = signToken(salesRep.id, salesRep.email);
  otherOwnerToken = signToken(otherOwner.id, otherOwner.email);

  const pipeline = await prisma.crmPipeline.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Authz Pipeline ${suffix}`,
      stages: {
        create: [
          {
            name: 'Open',
            displayOrder: 1,
            probability: 25,
          },
          {
            name: 'Review',
            displayOrder: 2,
            probability: 50,
          },
        ],
      },
    },
    include: { stages: true },
  });
  const stage = pipeline.stages.find((item) => item.displayOrder === 1) ?? pipeline.stages[0];
  pipelineId = pipeline.id;
  validStageId = (pipeline.stages.find((item) => item.displayOrder === 2) ?? stage).id;

  const visibleAccount = await prisma.crmAccount.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Visible Owner Account ${suffix}`,
      email: `visible-account-${suffix}@test.local`,
      ownerId: salesRep.id,
    },
  });
  visibleAccountId = visibleAccount.id;

  const otherAccount = await prisma.crmAccount.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Other Owner Account ${suffix}`,
      email: `other-account-${suffix}@test.local`,
      ownerId: otherOwner.id,
    },
  });
  otherOwnersAccountId = otherAccount.id;

  const otherContact = await prisma.crmContact.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      accountId: otherAccount.id,
      firstName: 'Other',
      lastName: `Owner ${suffix}`,
      email: `other-contact-${suffix}@test.local`,
    },
  });
  otherOwnersContactId = otherContact.id;

  const otherLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Other Owner Lead ${suffix}`,
      companyName: `Other Owner Company ${suffix}`,
      ownerId: otherOwner.id,
      accountId: otherAccount.id,
      contactId: otherContact.id,
    },
  });
  otherOwnersLeadId = otherLead.id;
  await prisma.crmLead.update({ where: { id: otherLead.id }, data: { ruleScore: 999 } });

  const otherDuplicateLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Other Owner Duplicate Lead ${suffix}`,
      companyName: `Other Owner Duplicate Company ${suffix}`,
      ownerId: otherOwner.id,
      accountId: otherAccount.id,
    },
  });

  const otherDuplicateMatch = await prisma.crmDuplicateMatch.create({
    data: {
            entityType: 'LEAD',
      entityAId: otherLead.id,
      entityBId: otherDuplicateLead.id,
      confidence: 0.95,
      matchFields: ['email'],
    },
  });
  otherOwnersDuplicateMatchId = otherDuplicateMatch.id;

  const otherOpportunity = await prisma.crmOpportunity.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Other Owner Opportunity ${suffix}`,
      accountId: otherAccount.id,
      contactId: otherContact.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherOwner.id,
      value: 1000,
    },
  });
  otherOwnersOpportunityId = otherOpportunity.id;

  await prisma.crmOpportunity.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: `Visible Opportunity ${suffix}`,
      accountId: visibleAccount.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: salesRep.id,
      value: 2000,
    },
  });

  const otherTrustProduct = await prisma.crmTrustProduct.create({
    data: {
            accountId: otherAccount.id,
      contactId: otherContact.id,
      trustType: 'FAMILY',
      ownerId: otherOwner.id,
    },
  });
  otherOwnersTrustProductId = otherTrustProduct.id;

  await prisma.crmActivity.create({
    data: {
            activityType: 'CALL',
      subject: `Other Owner Activity ${suffix}`,
      accountId: otherAccount.id,
      userId: otherOwner.id,
    },
  });

  await prisma.crmNote.create({
    data: {
            content: `Other Owner Note ${suffix}`,
      accountId: otherAccount.id,
      authorId: otherOwner.id,
    },
  });

  await prisma.crmKycRecord.create({
    data: {
            contactId: otherContact.id,
      status: 'PENDING',
    },
  });

  await prisma.crmBeneficiary.create({
    data: {
            contactId: otherContact.id,
      firstName: 'Other',
      lastName: `Beneficiary ${suffix}`,
      relationship: 'OTHER',
      allocationPct: 50,
    },
  });

  await prisma.crmContactAccountRole.create({
    data: {
            accountId: otherAccount.id,
      contactId: otherContact.id,
      role: 'DECISION_MAKER',
    },
  });

  const tag = await prisma.crmTag.create({
    data: {
            name: `Authz Tag ${suffix}`,
      color: '#111827',
    },
  });
  testTagId = tag.id;

  await prisma.crmTagAssignment.create({
    data: {
            tagId: tag.id,
      entityType: 'ACCOUNT',
      entityId: otherAccount.id,
      assignedBy: otherOwner.id,
    },
  });

  await prisma.crmFieldChange.create({
    data: {
            entityType: 'ACCOUNT',
      entityId: otherAccount.id,
      field: 'name',
      oldValue: 'before',
      newValue: 'after',
      changedBy: otherOwner.id,
    },
  });

  const visibleLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Visible Lead ${suffix}`,
      companyName: `Visible Company ${suffix}`,
      ownerId: salesRep.id,
      accountId: visibleAccount.id,
    },
  });
  visibleDuplicateMasterLeadId = visibleLead.id;
  visibleLeadId = visibleLead.id;

  const visibleDuplicateLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Visible Duplicate Lead ${suffix}`,
      companyName: `Visible Duplicate Company ${suffix}`,
      ownerId: salesRep.id,
      accountId: visibleAccount.id,
    },
  });

  const visibleDuplicateMatch = await prisma.crmDuplicateMatch.create({
    data: {
            entityType: 'LEAD',
      entityAId: visibleLead.id,
      entityBId: visibleDuplicateLead.id,
      confidence: 0.9,
      matchFields: ['name'],
    },
  });
  visibleDuplicateMatchId = visibleDuplicateMatch.id;

  const visibleDismissLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Visible Dismiss Lead ${suffix}`,
      companyName: `Visible Dismiss Company ${suffix}`,
      ownerId: salesRep.id,
      accountId: visibleAccount.id,
    },
  });

  const visibleDismissDuplicateLead = await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `Visible Dismiss Duplicate Lead ${suffix}`,
      companyName: `Visible Dismiss Duplicate Company ${suffix}`,
      ownerId: salesRep.id,
      accountId: visibleAccount.id,
    },
  });

  const visibleDismissDuplicateMatch = await prisma.crmDuplicateMatch.create({
    data: {
            entityType: 'LEAD',
      entityAId: visibleDismissLead.id,
      entityBId: visibleDismissDuplicateLead.id,
      confidence: 0.88,
      matchFields: ['name'],
    },
  });
  visibleDismissDuplicateMatchId = visibleDismissDuplicateMatch.id;

  await prisma.crmLead.create({
    data: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      title: `=HYPERLINK("http://evil.test","x") ${suffix}`,
      companyName: `Formula Company ${suffix}`,
      ownerId: salesRep.id,
      accountId: visibleAccount.id,
    },
  });
});

afterAll(async () => {
  await prisma.crmExportJob.deleteMany({ where: { user: { email: { in: [salesRepEmail, otherOwnerEmail] } } } });
  await prisma.crmDuplicateMatch.deleteMany({ where: { id: { in: [otherOwnersDuplicateMatchId, visibleDuplicateMatchId, visibleDismissDuplicateMatchId].filter(Boolean) } } });
  await prisma.crmTagAssignment.deleteMany({ where: { OR: [{ entityId: otherOwnersAccountId }, { tag: { name: { contains: suffix } } }] } });
  await prisma.crmTag.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.crmFieldChange.deleteMany({ where: { entityId: otherOwnersAccountId } });
  await prisma.crmContactAccountRole.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmTrustProduct.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmBeneficiary.deleteMany({ where: { contact: { email: { contains: suffix } } } });
  await prisma.crmKycRecord.deleteMany({ where: { contact: { email: { contains: suffix } } } });
  await prisma.crmNote.deleteMany({ where: { OR: [{ content: { contains: suffix } }, { account: { name: { contains: suffix } } }] } });
  await prisma.crmActivity.deleteMany({ where: { OR: [{ subject: { contains: suffix } }, { account: { name: { contains: suffix } } }] } });
  await prisma.crmOpportunityStageHistory.deleteMany({ where: { opportunity: { account: { name: { contains: suffix } } } } });
  await prisma.crmOpportunity.deleteMany({ where: { account: { name: { contains: suffix } } } });
  await prisma.crmLead.deleteMany({ where: { OR: [{ title: { contains: suffix } }, { companyName: { contains: suffix } }] } });
  await prisma.crmContact.deleteMany({ where: { email: { contains: suffix } } });
  await prisma.crmAccount.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.crmPipeline.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.userRole.deleteMany({ where: { user: { email: { in: [salesRepEmail, otherOwnerEmail] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [salesRepEmail, otherOwnerEmail] } } });
  await prisma.role.deleteMany({ where: { name: `CRM_AUTHZ_TEST_${suffix}` } });
});

describe('CRM direct read authorization', () => {
  it('returns 404 when a sales rep reads another owner account by id', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/accounts/${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep reads another owner contact by id', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/contacts/${otherOwnersContactId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep reads another owner lead by id', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/leads/${otherOwnersLeadId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep reads another owner opportunity by id', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/opportunities/${otherOwnersOpportunityId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep reads another owner trust product by id', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/trust-products/${otherOwnersTrustProductId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('does not surface other owners records in global search', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/search?q=${encodeURIComponent(`Other Owner Lead ${suffix}`)}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accounts).toHaveLength(0);
    expect(res.body.data.contacts).toHaveLength(0);
    expect(res.body.data.leads).toHaveLength(0);
    expect(res.body.data.opportunities).toHaveLength(0);
  });

  it('does not surface another owner lead in the dashboard hot leads widget', async () => {
    const res = await request(app)
      .get('/api/v1/crm/dashboard')
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hotLeads.map((lead: { id: string }) => lead.id)).not.toContain(otherOwnersLeadId);
  });

  it('caps list page size at 100', async () => {
    const res = await request(app)
      .get('/api/v1/crm/leads?limit=999999')
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.leads.length).toBeLessThanOrEqual(100);
    expect(res.body.data.pagination.limit).toBeLessThanOrEqual(100);
  });

});

describe('CRM direct write authorization', () => {
  it('returns 404 when a sales rep updates another owner lead', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/leads/${otherOwnersLeadId}`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ title: 'tampered' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep deletes another owner opportunity', async () => {
    const res = await request(app)
      .delete(`/api/v1/crm/opportunities/${otherOwnersOpportunityId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a sales rep moves another owner opportunity stage', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/opportunities/${otherOwnersOpportunityId}/move-stage`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ stageId: validStageId });

    expect(res.status).toBe(404);
  });
});

describe('CRM export authorization', () => {
  it('exports only records visible to the requesting user', async () => {
    const createRes = await request(app)
      .post('/api/v1/crm/export')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ entity: 'LEAD', format: 'CSV', filters: {} });

    expect(createRes.status).toBe(200);

    const downloadRes = await request(app)
      .get(`/api/v1/crm/export/${createRes.body.data.jobId}/download`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toContain(`Visible Lead ${suffix}`);
    expect(downloadRes.text).not.toContain(`Other Owner Lead ${suffix}`);
  });

  it('escapes formula-leading spreadsheet values', async () => {
    const createRes = await request(app)
      .post('/api/v1/crm/export')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ entity: 'LEAD', format: 'CSV', filters: {} });

    const downloadRes = await request(app)
      .get(`/api/v1/crm/export/${createRes.body.data.jobId}/download`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toContain("'=HYPERLINK");
  });

  it('does not let a user download another user export job', async () => {
    const createRes = await request(app)
      .post('/api/v1/crm/export')
      .set('Authorization', `Bearer ${otherOwnerToken}`)
      .send({ entity: 'LEAD', format: 'CSV', filters: {} });

    const downloadRes = await request(app)
      .get(`/api/v1/crm/export/${createRes.body.data.jobId}/download`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(downloadRes.status).toBe(404);
  });
});

describe('CRM report authorization', () => {
  it('does not include another owner in sales performance report', async () => {
    const res = await request(app)
      .get('/api/v1/crm/reports/sales-performance')
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byOwner.some((row: { ownerId: string }) => row.ownerId === salesRepId)).toBe(true);
    expect(res.body.data.byOwner.some((row: { ownerId: string }) => row.ownerId === otherOwnerId)).toBe(false);
  });

  it('scopes pipeline forecast values to visible opportunities', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/reports/pipeline-forecast?pipelineId=${pipelineId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalPipelineValue).toBe(2000);
  });
});

describe('CRM parent entity authorization', () => {
  it('returns 404 when creating a contact under another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        accountId: otherOwnersAccountId,
        firstName: 'Blocked',
        lastName: 'Contact',
        email: `blocked-contact-${suffix}@test.local`,
      });

    expect(res.status).toBe(404);
  });

  it('returns 404 when creating an opportunity under another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        name: `Blocked Opportunity ${suffix}`,
        accountId: otherOwnersAccountId,
        contactId: otherOwnersContactId,
        pipelineId,
        stageId: validStageId,
        value: 3000,
      });

    expect(res.status).toBe(404);
  });

  it('does not list activities attached to another owner account', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/activities?accountId=${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activities).toHaveLength(0);
  });

  it('returns 404 when creating an activity on another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/activities')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ activityType: 'CALL', subject: 'Should not attach', accountId: otherOwnersAccountId });

    expect(res.status).toBe(404);
  });

  it('does not list notes attached to another owner account', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/notes?accountId=${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notes).toHaveLength(0);
  });

  it('returns 404 when creating a note on another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/notes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ content: 'Should not attach', accountId: otherOwnersAccountId });

    expect(res.status).toBe(404);
  });

  it('returns 404 when reading another owner contact KYC record', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/contacts/${otherOwnersContactId}/kyc`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('does not list beneficiaries for another owner contact', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/contacts/${otherOwnersContactId}/beneficiaries`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.beneficiaries).toHaveLength(0);
  });

  it('returns 404 when creating a beneficiary for another owner contact', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/contacts/${otherOwnersContactId}/beneficiaries`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ firstName: 'Blocked', lastName: 'Beneficiary', relationship: 'OTHER', allocationPct: 10 });

    expect(res.status).toBe(404);
  });
});

describe('CRM indirect entity authorization', () => {
  it('does not list contact-account roles for another owner account', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/contact-account-roles?accountId=${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 404 when adding a contact-account role on another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/contact-account-roles')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ contactId: otherOwnersContactId, accountId: otherOwnersAccountId, role: 'CHAMPION' });

    expect(res.status).toBe(404);
  });

  it('does not list tags for another owner account', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/tag-assignments?entityType=ACCOUNT&entityId=${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 404 when assigning a tag to another owner account', async () => {
    const res = await request(app)
      .post('/api/v1/crm/tag-assignments')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ tagId: testTagId, entityType: 'ACCOUNT', entityId: otherOwnersAccountId });

    expect(res.status).toBe(404);
  });

  it('does not list field changes for another owner account', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/field-changes?entityType=ACCOUNT&entityId=${otherOwnersAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('CRM duplicate authorization', () => {
  it('does not list duplicate matches for another owner', async () => {
    const res = await request(app)
      .get('/api/v1/crm/duplicates')
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.duplicates.some((match: { id: string }) => match.id === otherOwnersDuplicateMatchId)).toBe(false);
  });

  it('returns 404 when merging another owner duplicate match', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/duplicates/${otherOwnersDuplicateMatchId}/merge`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ masterEntityId: otherOwnersLeadId, fieldSelections: {} });

    expect(res.status).toBe(404);
  });

  it('returns 404 when dismissing another owner duplicate match', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/duplicates/${otherOwnersDuplicateMatchId}/dismiss`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(404);
  });

  it('rejects non-whitelisted merge field selections', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/duplicates/${visibleDuplicateMatchId}/merge`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ masterEntityId: visibleDuplicateMasterLeadId, fieldSelections: { ownerId: otherOwnerId } });

    expect(res.status).toBe(422);
    const lead = await prisma.crmLead.findUnique({ where: { id: visibleDuplicateMasterLeadId } });
    expect(lead?.ownerId).toBe(salesRepId);
  });

  it('audit logs duplicate dismissals', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/duplicates/${visibleDismissDuplicateMatchId}/dismiss`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(res.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: salesRepId,
        action: 'DISMISS_DUPLICATE',
        resourceType: 'CrmDuplicateMatch',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit?.newValues as { matchId?: string } | null)?.matchId).toBe(visibleDismissDuplicateMatchId);
  });
});

describe('CRM owner assignment authorization', () => {
  it('returns 403 when a sales rep assigns a new lead to another owner', async () => {
    const res = await request(app)
      .post('/api/v1/crm/leads')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        title: `Blocked Assigned Lead ${suffix}`,
        companyName: `Blocked Assigned Company ${suffix}`,
        ownerId: otherOwnerId,
      });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a sales rep reassigns a visible lead to another owner', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/leads/${visibleLeadId}`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ ownerId: otherOwnerId });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a sales rep reassigns a visible account to another owner', async () => {
    const res = await request(app)
      .patch(`/api/v1/crm/accounts/${visibleAccountId}`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ ownerId: otherOwnerId });

    expect(res.status).toBe(403);
  });

  it('returns 403 when a sales rep reassigns a visible opportunity to another owner', async () => {
    const visibleOpportunity = await prisma.crmOpportunity.findFirstOrThrow({
      where: { accountId: visibleAccountId, ownerId: salesRepId, deletedAt: null },
      select: { id: true },
    });

    const res = await request(app)
      .patch(`/api/v1/crm/opportunities/${visibleOpportunity.id}`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ ownerId: otherOwnerId });

    expect(res.status).toBe(403);
  });
});
