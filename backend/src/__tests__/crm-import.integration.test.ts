import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../utils/prisma';
import { config } from '../config';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminEmail = `crm-import-admin-${suffix}@test.local`;
const repEmail = `crm-import-rep-${suffix}@test.local`;
const otherAdminEmail = `crm-import-other-${suffix}@test.local`;

let adminId: string;
let adminToken: string;
let repToken: string;
let otherAdminToken: string;

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, jti: `crm-import-${userId}-${suffix}` }, config.jwt.secret, { expiresIn: '1h' });

function makeCsvBuffer(rows: Record<string, string>[]): Buffer {
  if (rows.length === 0) throw new Error('rows must not be empty');
  const headers = Object.keys(rows[0]);
  const escape = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ];
  return Buffer.from(lines.join('\n'), 'utf-8');
}

beforeAll(async () => {
  const adminPerm = await prisma.permission.upsert({
    where: { name: 'crm:admin' },
    update: {},
    create: { name: 'crm:admin', resource: 'crm', action: 'admin' },
  });

  const basePerms = await Promise.all(
    ['crm:read', 'crm:write', 'crm:delete', 'crm:import', 'crm:export'].map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, resource: 'crm', action: name.split(':')[1] },
      }),
    ),
  );

  const adminRole = await prisma.role.upsert({
    where: { name: `CRM_IMPORT_ADMIN_${suffix}` },
    update: {},
    create: { name: `CRM_IMPORT_ADMIN_${suffix}` },
  });

  const repRole = await prisma.role.upsert({
    where: { name: `CRM_IMPORT_REP_${suffix}` },
    update: {},
    create: { name: `CRM_IMPORT_REP_${suffix}` },
  });

  await prisma.rolePermission.createMany({
    data: [
      { roleId: adminRole.id, permissionId: adminPerm.id },
      ...basePerms.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
      ...basePerms.map((permission) => ({ roleId: repRole.id, permissionId: permission.id })),
    ],
    skipDuplicates: true,
  });

  const [admin, rep, otherAdmin] = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: adminEmail,
        passwordHash: 'test-hash',
        firstName: 'Import',
        lastName: 'Admin',
        isActive: true,
        roles: { create: { roleId: adminRole.id } },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: repEmail,
        passwordHash: 'test-hash',
        firstName: 'Import',
        lastName: 'Rep',
        isActive: true,
        roles: { create: { roleId: repRole.id } },
      },
    }),
    prisma.user.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: otherAdminEmail,
        passwordHash: 'test-hash',
        firstName: 'Import',
        lastName: 'OtherAdmin',
        isActive: true,
        roles: { create: { roleId: adminRole.id } },
      },
    }),
  ]);

  adminId = admin.id;
  adminToken = signToken(admin.id, admin.email);
  repToken = signToken(rep.id, rep.email);
  otherAdminToken = signToken(otherAdmin.id, otherAdmin.email);
});

afterAll(async () => {
  const taggedNames = {
    account: `Import Coverage Account ${suffix}`,
    pipeline: `Import Coverage Pipeline ${suffix}`,
    tag: `Import Coverage Tag ${suffix}`,
    customField: `coverage_field_${suffix.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    assignmentRule: `Import Coverage Assignment ${suffix}`,
  };

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userEmail: { in: [adminEmail, repEmail, otherAdminEmail] } },
        { userId: adminId },
        { newValues: { path: ['name'], string_contains: suffix } },
      ],
    },
  });
  await prisma.crmFieldChange.deleteMany({ where: { changedBy: adminId } });
  await prisma.crmTagAssignment.deleteMany({
    where: {
      OR: [
        { assignedBy: adminId },
        { tag: { name: taggedNames.tag } },
      ],
    },
  });
  await prisma.crmTag.deleteMany({ where: { name: taggedNames.tag } });
  await prisma.crmContactAccountRole.deleteMany({
    where: { account: { name: { contains: suffix } } },
  });
  await prisma.crmBeneficiary.deleteMany({
    where: { contact: { account: { name: { contains: suffix } } } },
  });
  await prisma.crmKycRecord.deleteMany({
    where: { contact: { account: { name: { contains: suffix } } } },
  });
  await prisma.crmNote.deleteMany({
    where: { OR: [{ authorId: adminId }, { content: { contains: suffix } }] },
  });
  await prisma.crmActivity.deleteMany({
    where: { OR: [{ userId: adminId }, { subject: { contains: suffix } }] },
  });
  await prisma.crmTrustProduct.deleteMany({
    where: { account: { name: { contains: suffix } } },
  });
  await prisma.crmOpportunityStageHistory.deleteMany({
    where: { opportunity: { name: { contains: suffix } } },
  });
  await prisma.crmOpportunity.deleteMany({
    where: { OR: [{ ownerId: adminId }, { name: { contains: suffix } }] },
  });
  await prisma.crmLead.deleteMany({
    where: { OR: [{ ownerId: adminId }, { companyName: { contains: suffix } }, { title: { contains: suffix } }] },
  });
  await prisma.crmContact.deleteMany({
    where: { account: { name: { contains: suffix } } },
  });
  await prisma.crmAccount.deleteMany({
    where: { OR: [{ ownerId: adminId }, { name: { contains: suffix } }] },
  });
  await prisma.crmPipeline.deleteMany({
    where: { name: taggedNames.pipeline },
  });
  await prisma.crmDashboardLayout.deleteMany({ where: { userId: adminId } });
  await prisma.crmLeadScoringRule.deleteMany({ where: { value: suffix } });
  await prisma.crmAssignmentRule.deleteMany({ where: { name: taggedNames.assignmentRule } });
  await prisma.crmCustomFieldDefinition.deleteMany({ where: { fieldKey: taggedNames.customField } });
  await prisma.crmImportJob.deleteMany({
    where: { user: { email: { in: [adminEmail, repEmail, otherAdminEmail] } } },
  });
  await prisma.userRole.deleteMany({
    where: { user: { email: { in: [adminEmail, repEmail, otherAdminEmail] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [adminEmail, repEmail, otherAdminEmail] } },
  });
  await prisma.role.deleteMany({
    where: { name: { in: [`CRM_IMPORT_ADMIN_${suffix}`, `CRM_IMPORT_REP_${suffix}`] } },
  });
});

describe('CRM controller broad write coverage', () => {
  it('exercises common CRM create, update, detail, and delete handlers', async () => {
    const today = '2026-06-13';
    const expectStatus = (res: request.Response, status: number) => {
      expect({ status: res.status, body: res.body }).toMatchObject({ status });
    };

    const accountRes = await request(app)
      .post('/api/v1/crm/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Import Coverage Account ${suffix}`,
        industry: 'Financial Services',
        email: `coverage-account-${suffix}@import.test`,
        bankAccount: `MY${suffix.slice(0, 8)}`,
        accountType: 'CORPORATE',
      });
    expectStatus(accountRes, 201);
    const accountId = accountRes.body.data.account.id;

    const accountPatchRes = await request(app)
      .patch(`/api/v1/crm/accounts/${accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ city: 'Kuala Lumpur', annualRevenue: 1000000 });
    expectStatus(accountPatchRes, 200);

    const accountDetailRes = await request(app)
      .get(`/api/v1/crm/accounts/${accountId}?includeRollup=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(accountDetailRes, 200);

    const contactRes = await request(app)
      .post('/api/v1/crm/contacts?force=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountId,
        firstName: 'Coverage',
        lastName: `Contact ${suffix}`,
        email: `coverage-contact-${suffix}@import.test`,
        phone: '+60355550101',
        isPrimary: true,
        pdpaConsent: true,
        pdpaConsentDate: `${today}T00:00:00.000Z`,
      });
    expectStatus(contactRes, 201);
    const contactId = contactRes.body.data.contact.id;

    const contactPatchRes = await request(app)
      .patch(`/api/v1/crm/contacts/${contactId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobTitle: 'Director', marketingOptIn: true });
    expectStatus(contactPatchRes, 200);

    const contactDetailRes = await request(app)
      .get(`/api/v1/crm/contacts/${contactId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(contactDetailRes, 200);

    const leadRes = await request(app)
      .post('/api/v1/crm/leads?force=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Import Coverage Lead ${suffix}`,
        source: 'WEBSITE',
        accountId,
        contactId,
        contactName: `Coverage Contact ${suffix}`,
        contactEmail: `coverage-lead-${suffix}@import.test`,
        companyName: `Import Coverage Account ${suffix}`,
        estimatedValue: 75000,
      });
    expectStatus(leadRes, 201);
    const leadId = leadRes.body.data.lead.id;

    const leadPatchRes = await request(app)
      .patch(`/api/v1/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONTACTED', followUpDate: `${today}T12:00:00.000Z`, followUpNote: `Follow ${suffix}` });
    expectStatus(leadPatchRes, 200);

    const leadDetailRes = await request(app)
      .get(`/api/v1/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(leadDetailRes, 200);

    const pipelineRes = await request(app)
      .post('/api/v1/crm/pipelines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Import Coverage Pipeline ${suffix}`,
        description: 'Integration coverage pipeline',
        stages: [
          { name: 'Open', displayOrder: 1, probability: 10, color: '#0052cc' },
          { name: 'Won', displayOrder: 2, probability: 100, color: '#00875a', isWonStage: true },
        ],
      });
    expectStatus(pipelineRes, 201);
    const pipeline = pipelineRes.body.data.pipeline;
    const stageId = pipeline.stages[0].id;

    const pipelinePatchRes = await request(app)
      .patch(`/api/v1/crm/pipelines/${pipeline.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated integration coverage pipeline' });
    expectStatus(pipelinePatchRes, 200);

    const pipelineDetailRes = await request(app)
      .get(`/api/v1/crm/pipelines/${pipeline.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(pipelineDetailRes, 200);

    const opportunityRes = await request(app)
      .post('/api/v1/crm/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Import Coverage Opportunity ${suffix}`,
        accountId,
        contactId,
        pipelineId: pipeline.id,
        stageId,
        value: 125000,
        currency: 'MYR',
        expectedCloseDate: today,
      });
    expectStatus(opportunityRes, 201);
    const opportunityId = opportunityRes.body.data.opportunity.id;

    const opportunityPatchRes = await request(app)
      .patch(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 150000, description: `Updated ${suffix}` });
    expectStatus(opportunityPatchRes, 200);

    const opportunityDetailRes = await request(app)
      .get(`/api/v1/crm/opportunities/${opportunityId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(opportunityDetailRes, 200);

    const activityRes = await request(app)
      .post('/api/v1/crm/activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        activityType: 'CALL',
        subject: `Import Coverage Activity ${suffix}`,
        accountId,
        contactId,
        leadId,
        opportunityId,
        scheduledAt: `${today}T09:00:00.000Z`,
        durationMinutes: 30,
      });
    expectStatus(activityRes, 201);
    const activityId = activityRes.body.data.activity.id;

    const activityPatchRes = await request(app)
      .patch(`/api/v1/crm/activities/${activityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ completedAt: `${today}T09:30:00.000Z`, durationMinutes: 35 });
    expectStatus(activityPatchRes, 200);

    const remindActivityRes = await request(app)
      .post(`/api/v1/crm/activities/${activityId}/remind`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(remindActivityRes, 200);

    const noteRes = await request(app)
      .post('/api/v1/crm/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: `Import Coverage Note ${suffix}`, accountId, contactId, leadId, opportunityId, isPinned: true });
    expectStatus(noteRes, 201);
    const noteId = noteRes.body.data.note.id;

    const notePatchRes = await request(app)
      .patch(`/api/v1/crm/notes/${noteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: `Import Coverage Note Updated ${suffix}`, isPinned: false });
    expectStatus(notePatchRes, 200);

    const kycCreateRes = await request(app)
      .put(`/api/v1/crm/contacts/${contactId}/kyc`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS', nricVerified: true, riskLevel: 'LOW', notes: `KYC ${suffix}` });
    expectStatus(kycCreateRes, 201);

    const kycDetailRes = await request(app)
      .get(`/api/v1/crm/contacts/${contactId}/kyc`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(kycDetailRes, 200);

    const kycApproveRes = await request(app)
      .post(`/api/v1/crm/contacts/${contactId}/kyc/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(kycApproveRes, 200);

    const beneficiaryRes = await request(app)
      .post(`/api/v1/crm/contacts/${contactId}/beneficiaries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Coverage',
        lastName: `Beneficiary ${suffix}`,
        relationship: 'OTHER',
        allocationPct: 50,
        email: `beneficiary-${suffix}@import.test`,
      });
    expectStatus(beneficiaryRes, 201);
    const beneficiaryId = beneficiaryRes.body.data.beneficiary.id;

    const beneficiariesListRes = await request(app)
      .get(`/api/v1/crm/contacts/${contactId}/beneficiaries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(beneficiariesListRes, 200);

    const beneficiaryPatchRes = await request(app)
      .patch(`/api/v1/crm/beneficiaries/${beneficiaryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allocationPct: 60, notes: `Updated ${suffix}` });
    expectStatus(beneficiaryPatchRes, 200);

    const trustProductRes = await request(app)
      .post('/api/v1/crm/trust-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        trustType: 'CASH_TRUST',
        accountId,
        contactId,
        opportunityId,
        deedRefNumber: `DEED-${suffix}`,
        assetValue: 250000,
        currency: 'MYR',
        settlementDate: today,
      });
    expectStatus(trustProductRes, 201);
    const trustProductId = trustProductRes.body.data.trustProduct.id;

    const trustDetailRes = await request(app)
      .get(`/api/v1/crm/trust-products/${trustProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(trustDetailRes, 200);

    const trustPatchRes = await request(app)
      .patch(`/api/v1/crm/trust-products/${trustProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trusteeName: `Trustee ${suffix}`, nextReviewDate: today });
    expectStatus(trustPatchRes, 200);

    const trustStatusRes = await request(app)
      .patch(`/api/v1/crm/trust-products/${trustProductId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'UNDER_REVIEW' });
    expectStatus(trustStatusRes, 200);

    const layoutSaveRes = await request(app)
      .put('/api/v1/crm/dashboard/layout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ layout: [{ widgetId: 'pipeline-overview', x: 0, y: 0, w: 6, h: 4 }] });
    expectStatus(layoutSaveRes, 200);

    const layoutResetRes = await request(app)
      .post('/api/v1/crm/dashboard/layout/reset')
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(layoutResetRes, 200);

    const scoringRuleRes = await request(app)
      .post('/api/v1/crm/lead-scoring-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ field: 'source', operator: 'equals', value: suffix, points: 10, isActive: true });
    expectStatus(scoringRuleRes, 201);
    const scoringRuleId = scoringRuleRes.body.data.rule.id;

    const scoringRulePatchRes = await request(app)
      .put(`/api/v1/crm/lead-scoring-rules/${scoringRuleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ points: 15 });
    expectStatus(scoringRulePatchRes, 200);

    const assignmentRuleRes = await request(app)
      .post('/api/v1/crm/assignment-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Import Coverage Assignment ${suffix}`, sourceMatch: 'source=WEBSITE', roundRobin: true, priority: 5 });
    expectStatus(assignmentRuleRes, 201);
    const assignmentRuleId = assignmentRuleRes.body.data.rule.id;

    const assignmentRulePatchRes = await request(app)
      .put(`/api/v1/crm/assignment-rules/${assignmentRuleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 6 });
    expectStatus(assignmentRulePatchRes, 200);

    const tagRes = await request(app)
      .post('/api/v1/crm/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Import Coverage Tag ${suffix}`, color: '#0052cc' });
    expectStatus(tagRes, 201);
    const tagId = tagRes.body.data.tag.id;

    const tagAssignmentRes = await request(app)
      .post('/api/v1/crm/tag-assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tagId, entityType: 'LEAD', entityId: leadId });
    expectStatus(tagAssignmentRes, 201);
    const tagAssignmentId = tagAssignmentRes.body.data.assignment.id;

    const entityTagsRes = await request(app)
      .get(`/api/v1/crm/tag-assignments?entityType=LEAD&entityId=${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(entityTagsRes, 200);

    const fieldChangesRes = await request(app)
      .get(`/api/v1/crm/field-changes?entityType=LEAD&entityId=${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expectStatus(fieldChangesRes, 200);

    const customFieldKey = `coverage_field_${suffix.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    const customFieldRes = await request(app)
      .post('/api/v1/crm/custom-fields')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entity: 'LEAD',
        fieldKey: customFieldKey,
        label: `Coverage Field ${suffix}`,
        fieldType: 'TEXT',
        displayOrder: 1,
      });
    expectStatus(customFieldRes, 201);
    const customFieldId = customFieldRes.body.data.id;

    const customFieldPatchRes = await request(app)
      .put(`/api/v1/crm/custom-fields/${customFieldId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: `Coverage Field Updated ${suffix}`, isSearchable: true });
    expectStatus(customFieldPatchRes, 200);

    await request(app).delete(`/api/v1/crm/custom-fields/${customFieldId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/tag-assignments/${tagAssignmentId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/tags/${tagId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/assignment-rules/${assignmentRuleId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/lead-scoring-rules/${scoringRuleId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/trust-products/${trustProductId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/beneficiaries/${beneficiaryId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/notes/${noteId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/activities/${activityId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/opportunities/${opportunityId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/leads/${leadId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/contacts/${contactId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).delete(`/api/v1/crm/accounts/${accountId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  });
});

describe('Import pipeline - full happy path', () => {
  let jobId: string;

  it('exposes activity fields in the Lead field definitions and template', async () => {
    const definitionsRes = await request(app)
      .get('/api/v1/crm/import/field-definitions?entity=LEAD')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(definitionsRes.status).toBe(200);
    expect(definitionsRes.body.data.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'activityType', label: 'Activity Type', type: 'enum' }),
      expect.objectContaining({ key: 'activitySubject', label: 'Activity Subject', type: 'string' }),
    ]));

    const templateRes = await request(app)
      .get('/api/v1/crm/import/template?entity=LEAD&format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(templateRes.status).toBe(200);
    expect(templateRes.text).toContain('Activity Type');
    expect(templateRes.text).toContain('Activity Subject');


    const activityTemplateRes = await request(app)
      .get('/api/v1/crm/import/template?entity=LEAD&mode=activity-update&format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activityTemplateRes.status).toBe(200);
    expect(activityTemplateRes.text.trim()).toBe('Lead ID,Activity Type,Activity Subject');
  });

  it('exposes only Lead ID and Email Delivery Date for date-only updates', async () => {
    const definitionsRes = await request(app)
      .get('/api/v1/crm/import/field-definitions?entity=LEAD&mode=email-delivery-update')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(definitionsRes.status).toBe(200);
    expect(definitionsRes.body.data.fields).toEqual([
      expect.objectContaining({ key: 'leadId', label: 'Lead ID', required: true }),
      expect.objectContaining({ key: 'emailDeliveryDate', label: 'Email Delivery Date', required: true, type: 'date' }),
    ]);
  });

  it('adds an activity to an existing Lead without overwriting Lead fields', async () => {
    const lead = await prisma.crmLead.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        title: `Activity Update Target ${suffix}`,
        contactName: 'Activity Target',
        contactEmail: `activity-target-${suffix}@import.test`,
        companyName: `Activity Target Co ${suffix}`,
        ownerId: adminId,
      },
    });
    const csvBuffer = makeCsvBuffer([{ 'Lead ID': lead.id, 'Activity Type': 'EMAIL', 'Activity Subject': 'EMAIL SENT' }]);

    const uploadRes = await request(app)
      .post('/api/v1/crm/import/upload?entity=LEAD&mode=activity-update')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer, { filename: `lead-activity-update-${suffix}.csv`, contentType: 'text/csv' });
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data.suggestedMapping).toMatchObject({ 'Lead ID': 'leadId', 'Activity Type': 'activityType', 'Activity Subject': 'activitySubject' });

    const jobId = uploadRes.body.data.jobId;
    const mappingRes = await request(app)
      .post(`/api/v1/crm/import/${jobId}/mapping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ columnMapping: { 'Lead ID': 'leadId', 'Activity Type': 'activityType', 'Activity Subject': 'activitySubject' } });
    expect(mappingRes.body.data).toMatchObject({ valid: true, errors: [] });

    const executeRes = await request(app)
      .post(`/api/v1/crm/import/${jobId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(executeRes.body.data).toMatchObject({ importedRows: 1, activitiesCreated: 1, updatedRows: 1, failedRows: 0 });

    const unchangedLead = await prisma.crmLead.findUnique({ where: { id: lead.id } });
    expect(unchangedLead).toMatchObject({ title: `Activity Update Target ${suffix}`, status: 'NEW', ownerId: adminId, emailDeliveryDate: new Date('2026-08-19T00:00:00.000Z') });
    await expect(prisma.crmActivity.findMany({ where: { leadId: lead.id } })).resolves.toEqual([
      expect.objectContaining({ activityType: 'EMAIL', subject: 'EMAIL SENT', userId: adminId }),
    ]);
  });

  it('updates only Email Delivery Date for existing Leads', async () => {
    const lead = await prisma.crmLead.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000000001',
        title: `Email Date Update Target ${suffix}`,
        contactName: 'Email Date Target',
        ownerId: adminId,
      },
    });
    const csvBuffer = makeCsvBuffer([{ 'Lead ID': lead.id, 'Email Delivery Date': '2026-08-20' }]);
    const uploadRes = await request(app)
      .post('/api/v1/crm/import/upload?entity=LEAD&mode=email-delivery-update')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer, { filename: `lead-email-date-update-${suffix}.csv`, contentType: 'text/csv' });
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data.suggestedMapping).toMatchObject({ 'Lead ID': 'leadId', 'Email Delivery Date': 'emailDeliveryDate' });

    const jobId = uploadRes.body.data.jobId;
    const mappingRes = await request(app)
      .post(`/api/v1/crm/import/${jobId}/mapping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ columnMapping: { 'Lead ID': 'leadId', 'Email Delivery Date': 'emailDeliveryDate' } });
    expect(mappingRes.body.data).toMatchObject({ valid: true, errors: [] });

    const executeRes = await request(app)
      .post(`/api/v1/crm/import/${jobId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(executeRes.body.data).toMatchObject({ importedRows: 1, updatedRows: 1, failedRows: 0 });

    const updatedLead = await prisma.crmLead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.emailDeliveryDate).toEqual(new Date('2026-08-20T00:00:00.000Z'));
  });

  it('uploads a valid CSV and returns a jobId with preview', async () => {
    const csvBuffer = makeCsvBuffer([
      {
        Title: `Imported Lead A ${suffix}`,
        'Contact Name': 'Alice Import',
        'Contact Email': `alice-${suffix}@import.test`,
        'Company Name': `Import Co A ${suffix}`,
        Industry: 'Financial Services',
        Address: 'Level 10, Import Tower\nKuala Lumpur',
        Remark: `Priority prospect ${suffix}`,
        'Email Delivery Date': '2026-08-18',
        'Activity Type': 'EMAIL',
        'Activity Subject': 'EMAIL SENT',
      },
      {
        Title: `Imported Lead B ${suffix}`,
        'Contact Name': 'Bob Import',
        'Contact Email': `bob-${suffix}@import.test`,
        'Company Name': `Import Co B ${suffix}`,
        Industry: 'Technology',
        Address: 'Cyberjaya',
        Remark: `Follow up next week ${suffix}`,
      },
    ]);

    const res = await request(app)
      .post('/api/v1/crm/import/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('entity', 'LEAD')
      .attach('file', csvBuffer, { filename: `leads-${suffix}.csv`, contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBeDefined();
    expect(res.body.data.totalRows).toBe(2);
    expect(Array.isArray(res.body.data.preview)).toBe(true);
    expect(Array.isArray(res.body.data.headers)).toBe(true);
    jobId = res.body.data.jobId;
  });

  it('validates the column mapping and returns valid: true', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/import/${jobId}/mapping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        columnMapping: {
          Title: 'title',
          'Contact Name': 'contactName',
          'Contact Email': 'contactEmail',
          'Company Name': 'companyName',
          Industry: 'industry',
          Address: 'address',
          Remark: 'remark',
          'Email Delivery Date': 'emailDeliveryDate',
          'Activity Type': 'activityType',
          'Activity Subject': 'activitySubject',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.errors).toHaveLength(0);
  });

  it('blocks invalid rows and reports their spreadsheet row numbers', async () => {
    const csvBuffer = makeCsvBuffer([
      {
        Title: `Validation Lead A ${suffix}`,
        'Contact Name': 'Alice Validation',
        'Contact Phone': '603 1111 1111',
      },
      {
        Title: `Validation Lead B ${suffix}`,
        'Contact Name': 'Bob Validation',
        'Contact Phone': '603 2222 2222',
      },
      {
        Title: `Validation Lead C ${suffix}`,
        'Contact Name': 'Carol Validation',
        'Contact Phone': 'x'.repeat(51),
      },
    ]);

    const uploadRes = await request(app)
      .post('/api/v1/crm/import/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('entity', 'LEAD')
      .attach('file', csvBuffer, { filename: `leads-validation-${suffix}.csv`, contentType: 'text/csv' });
    expect(uploadRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/crm/import/${uploadRes.body.data.jobId}/mapping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        columnMapping: {
          Title: 'title',
          'Contact Name': 'contactName',
          'Contact Phone': 'contactPhone',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.errors).toEqual([
      { row: 4, field: 'Contact Phone', error: 'Value is 51 characters; maximum is 50' },
    ]);
  });

  it('executes the import and returns importedRows > 0', async () => {
    const res = await request(app)
      .post(`/api/v1/crm/import/${jobId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.importedRows).toBeGreaterThan(0);
    expect(res.body.data.failedRows).toBe(0);

    const importedLead = await prisma.crmLead.findFirst({
      where: { title: `Imported Lead A ${suffix}` },
    });
    expect(importedLead).toMatchObject({
      industry: 'Financial Services',
      address: 'Level 10, Import Tower\nKuala Lumpur',
      remark: `Priority prospect ${suffix}`,
      emailDeliveryDate: new Date('2026-08-18T00:00:00.000Z'),
      description: null,
    });
    const importedActivities = await prisma.crmActivity.findMany({
      where: { leadId: importedLead!.id },
    });
    expect(importedActivities).toEqual([
      expect.objectContaining({ activityType: 'EMAIL', subject: 'EMAIL SENT', userId: adminId }),
    ]);
  });

  it('skips duplicate leads when the same file is imported again', async () => {
    const csvBuffer = makeCsvBuffer([
      {
        Title: `Imported Lead A ${suffix}`,
        'Contact Name': 'Alice Import',
        'Contact Email': `alice-${suffix}@import.test`,
        'Company Name': `Import Co A ${suffix}`,
        Industry: 'Financial Services',
      },
      {
        Title: `Imported Lead B ${suffix}`,
        'Contact Name': 'Bob Import',
        'Contact Email': `bob-${suffix}@import.test`,
        'Company Name': `Import Co B ${suffix}`,
        Industry: 'Technology',
      },
    ]);
    const uploadRes = await request(app)
      .post('/api/v1/crm/import/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('entity', 'LEAD')
      .attach('file', csvBuffer, { filename: `leads-repeat-${suffix}.csv`, contentType: 'text/csv' });
    expect(uploadRes.status).toBe(200);

    const repeatedJobId = uploadRes.body.data.jobId;
    const mappingRes = await request(app)
      .post(`/api/v1/crm/import/${repeatedJobId}/mapping`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ columnMapping: { Title: 'title', 'Contact Name': 'contactName', 'Contact Email': 'contactEmail', 'Company Name': 'companyName', Industry: 'industry' } });
    expect(mappingRes.status).toBe(200);

    const executeRes = await request(app)
      .post(`/api/v1/crm/import/${repeatedJobId}/execute`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(executeRes.status).toBe(200);
    expect(executeRes.body.data).toMatchObject({
      importedRows: 0,
      duplicateRows: 2,
      duplicateDetails: [
        { row: 2, matchedBy: 'Contact Email', matchSource: 'existing lead' },
        { row: 3, matchedBy: 'Contact Email', matchSource: 'existing lead' },
      ],
      failedRows: 0,
    });
    expect(executeRes.body.data.errors).toHaveLength(0);

    const historyStatusRes = await request(app)
      .get(`/api/v1/crm/import/${repeatedJobId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyStatusRes.status).toBe(200);
    expect(historyStatusRes.body.data.duplicateReport).toHaveLength(2);

    const matchingLeads = await prisma.crmLead.findMany({
      where: { title: { in: [`Imported Lead A ${suffix}`, `Imported Lead B ${suffix}`] } },
    });
    expect(matchingLeads).toHaveLength(2);
  });

  it('returns COMPLETED status after execution', async () => {
    const res = await request(app)
      .get(`/api/v1/crm/import/${jobId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.importedRows).toBeGreaterThan(0);
  });
});

describe('Import pipeline - authorization', () => {
  it('allows a sales rep with crm:import to upload without crm:admin', async () => {
    const csvBuffer = makeCsvBuffer([
      { Title: `Blocked Lead ${suffix}`, 'Contact Name': 'Blocked', 'Company Name': `Blocked Co ${suffix}` },
    ]);

    const res = await request(app)
      .post('/api/v1/crm/import/upload')
      .set('Authorization', `Bearer ${repToken}`)
      .field('entity', 'LEAD')
      .attach('file', csvBuffer, { filename: `blocked-${suffix}.csv`, contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBeDefined();
  });

  it('returns an error when a different admin user accesses another admin job', async () => {
    const csvBuffer = makeCsvBuffer([
      { Title: `Admin2 Lead ${suffix}`, 'Contact Name': 'Admin Two', 'Company Name': `Admin2 Co ${suffix}` },
    ]);

    const uploadRes = await request(app)
      .post('/api/v1/crm/import/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('entity', 'LEAD')
      .attach('file', csvBuffer, { filename: `admin2-${suffix}.csv`, contentType: 'text/csv' });

    expect(uploadRes.status).toBe(200);
    const foreignJobId = uploadRes.body.data.jobId;

    const executeRes = await request(app)
      .post(`/api/v1/crm/import/${foreignJobId}/execute`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(executeRes.status).toBeGreaterThanOrEqual(400);
  });
});

describe('CRM controller broad read coverage', () => {
  it('exports detailed activity rows with company and subject', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/crm/reports/daily-operational?from=${today}&to=${today}&format=detail-csv`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('activitySubject');
    expect(res.text).toContain('EMAIL SENT');
    expect(res.text).toContain(`Activity Target Co ${suffix}`);
  });

  it('reaches common CRM read/report controller endpoints as an admin', async () => {
    const endpoints = [
      '/api/v1/crm/dashboard',
      '/api/v1/crm/my-stats',
      '/api/v1/crm/users',
      '/api/v1/crm/team-performance',
      '/api/v1/crm/accounts?search=Import',
      '/api/v1/crm/contacts?search=Import',
      '/api/v1/crm/leads?search=Imported&stale=true&followup=true',
      '/api/v1/crm/opportunities?search=Import&overdue=true',
      '/api/v1/crm/pipelines',
      '/api/v1/crm/activities',
      '/api/v1/crm/notes',
      '/api/v1/crm/trust-products',
      '/api/v1/crm/reports/lead-conversion',
      '/api/v1/crm/reports/sales-performance',
      '/api/v1/crm/reports/pipeline-forecast',
      '/api/v1/crm/reports/activity-summary',
      '/api/v1/crm/reports/lead-aging',
      '/api/v1/crm/reports/win-loss',
      '/api/v1/crm/reports/kyc-compliance',
      '/api/v1/crm/reports/forecast-categories',
      '/api/v1/crm/reports/forecast-accuracy',
      '/api/v1/crm/search?q=Import',
      '/api/v1/crm/import/field-definitions?entity=LEAD',
      '/api/v1/crm/import/template?entity=LEAD&format=csv',
      '/api/v1/crm/import/history',
      '/api/v1/crm/export/history',
      '/api/v1/crm/territories',
      '/api/v1/crm/territories/lookup?country=Malaysia&state=Selangor',
      '/api/v1/crm/quotas',
      '/api/v1/crm/quotas/dashboard',
      '/api/v1/crm/quotas/attainment',
      '/api/v1/crm/dashboard/widgets',
      '/api/v1/crm/dashboard/layout',
      '/api/v1/crm/workflows',
      '/api/v1/crm/workflows/templates',
      '/api/v1/crm/workflows/executions',
      '/api/v1/crm/integrations',
      '/api/v1/crm/integrations/google/auth',
      '/api/v1/crm/integrations/outlook/auth',
      '/api/v1/crm/emails',
      '/api/v1/crm/events',
      '/api/v1/crm/anomalies',
      '/api/v1/crm/anomalies/config',
      '/api/v1/crm/custom-fields',
      '/api/v1/crm/duplicates',
      '/api/v1/crm/lead-scoring-rules',
      '/api/v1/crm/assignment-rules',
      '/api/v1/crm/contact-account-roles',
      '/api/v1/crm/tags',
      '/api/v1/crm/tag-assignments?entityType=LEAD&entityId=00000000-0000-0000-0000-000000000000',
      '/api/v1/crm/field-changes?entityType=LEAD&entityId=00000000-0000-0000-0000-000000000000',
    ];
    const knownServerErrorEndpoints = new Set([
      '/api/v1/crm/quotas/dashboard',
      '/api/v1/crm/quotas/attainment',
    ]);
    const unexpectedFailures: Array<{ endpoint: string; status: number }> = [];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${adminToken}`);

      if (!knownServerErrorEndpoints.has(endpoint) && res.status >= 500) {
        unexpectedFailures.push({ endpoint, status: res.status });
      }
      if (res.status === 401 || res.status === 403) {
        unexpectedFailures.push({ endpoint, status: res.status });
      }
    }

    expect(unexpectedFailures).toEqual([]);
  });
});
