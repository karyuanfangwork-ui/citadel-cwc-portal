/**
 * Seed: Credit Notification Templates
 *
 * Upserts NotificationTemplates for credit application lifecycle events:
 *   - credit_application_submitted
 *   - credit_application_approved
 *   - credit_application_rejected
 *   - credit_approval_requested
 *   - credit_application_withdrawn
 *
 * Run: npx tsx prisma/seed-credit-notifications.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CREDIT_TEMPLATES = [
  {
    name: 'credit_application_submitted',
    eventType: 'credit_application_submitted',
    emailSubject: 'Credit Application {{applicationNo}} Submitted',
    emailBody: `<p>Hi {{userName}},</p>
<p>A new credit application <strong>{{applicationNo}}</strong> has been submitted for borrower <strong>{{borrowerName}}</strong> with a requested amount of <strong>{{currency}} {{requestedAmount}}</strong>.</p>
<p>Please review the application at your earliest convenience.</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} submitted for {{borrowerName}} ({{currency}} {{requestedAmount}}). Review at {{appUrl}}/credit/applications/{{applicationId}}',
    pushTitle: 'New Credit Application Submitted',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} — {{currency}} {{requestedAmount}}',
  },
  {
    name: 'credit_application_approved',
    eventType: 'credit_application_approved',
    emailSubject: 'Credit Application {{applicationNo}} Approved',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong style="color: green;">approved</strong>.</p>
<p>Approved amount: <strong>{{currency}} {{approvedAmount}}</strong></p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} APPROVED for {{borrowerName}}. Amount: {{currency}} {{approvedAmount}}.',
    pushTitle: 'Credit Application Approved',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been approved ({{currency}} {{approvedAmount}})',
  },
  {
    name: 'credit_application_rejected',
    eventType: 'credit_application_rejected',
    emailSubject: 'Credit Application {{applicationNo}} Rejected',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong style="color: red;">rejected</strong>.</p>
<p>Reason: {{rejectionReason}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} REJECTED for {{borrowerName}}. Reason: {{rejectionReason}}.',
    pushTitle: 'Credit Application Rejected',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been rejected. Reason: {{rejectionReason}}',
  },
  {
    name: 'credit_approval_requested',
    eventType: 'credit_approval_requested',
    emailSubject: 'Approval Requested — Credit Application {{applicationNo}}',
    emailBody: `<p>Hi {{userName}},</p>
<p>Your approval is requested for credit application <strong>{{applicationNo}}</strong> (borrower: <strong>{{borrowerName}}</strong>, amount: <strong>{{currency}} {{requestedAmount}}</strong>).</p>
<p>Current status: <strong>{{applicationState}}</strong></p>
<p>Approvals collected: {{approvalsCollected}} / {{approvalsRequired}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">Review & Approve</a></p>`,
    smsBody: 'Approval requested: Credit app {{applicationNo}} ({{borrowerName}}, {{currency}} {{requestedAmount}}). {{approvalsCollected}}/{{approvalsRequired}} approvals. Review at {{appUrl}}',
    pushTitle: 'Approval Requested',
    pushBody: 'Application {{applicationNo}} — {{borrowerName}}, {{currency}} {{requestedAmount}}. Your approval is needed.',
  },
  {
    name: 'credit_application_withdrawn',
    eventType: 'credit_application_withdrawn',
    emailSubject: 'Credit Application {{applicationNo}} Withdrawn',
    emailBody: `<p>Hi {{userName}},</p>
<p>Credit application <strong>{{applicationNo}}</strong> for borrower <strong>{{borrowerName}}</strong> has been <strong>withdrawn</strong>.</p>
<p>Withdrawn by: {{withdrawnBy}}</p>
<p><a href="{{appUrl}}/credit/applications/{{applicationId}}">View Application</a></p>`,
    smsBody: 'Credit app {{applicationNo}} for {{borrowerName}} has been withdrawn by {{withdrawnBy}}.',
    pushTitle: 'Credit Application Withdrawn',
    pushBody: 'Application {{applicationNo}} for {{borrowerName}} has been withdrawn.',
  },
];

async function main() {
  console.log('🌱 Seeding credit notification templates...');

  for (const tpl of CREDIT_TEMPLATES) {
    const result = await prisma.notificationTemplate.upsert({
      where: { name: tpl.name },
      update: {
        eventType: tpl.eventType,
        emailSubject: tpl.emailSubject,
        emailBody: tpl.emailBody,
        smsBody: tpl.smsBody,
        pushTitle: tpl.pushTitle,
        pushBody: tpl.pushBody,
        isActive: true,
      },
      create: {
        name: tpl.name,
        eventType: tpl.eventType,
        emailSubject: tpl.emailSubject,
        emailBody: tpl.emailBody,
        smsBody: tpl.smsBody,
        pushTitle: tpl.pushTitle,
        pushBody: tpl.pushBody,
        isActive: true,
      },
    });

    console.log(`  ✅ ${tpl.name} (id: ${result.id})`);
  }

  console.log('✅ Credit notification templates seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());