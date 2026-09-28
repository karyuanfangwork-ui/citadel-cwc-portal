import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SEED_NOTIFICATION_TEMPLATES } from './seed-admin-config';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEMPLATE_NAME = 'CRM Activity Reminder';
const applyChanges = process.argv.includes('--apply');

async function main() {
  const template = SEED_NOTIFICATION_TEMPLATES.find((candidate) => candidate.name === TEMPLATE_NAME);
  if (!template) throw new Error(`${TEMPLATE_NAME} is missing from seed-admin-config.ts`);

  const existing = await prisma.notificationTemplate.findUnique({
    where: { name: TEMPLATE_NAME },
    select: { id: true, eventType: true, isActive: true },
  });

  if (!applyChanges) {
    console.log(JSON.stringify({
      applyChanges,
      action: existing ? 'would-update' : 'would-create',
      existing,
      target: { eventType: template.eventType, isActive: template.isActive },
    }, null, 2));
    return;
  }

  const saved = await prisma.notificationTemplate.upsert({
    where: { name: TEMPLATE_NAME },
    update: {
      eventType: template.eventType,
      emailSubject: template.emailSubject,
      emailBody: template.emailBody,
      smsBody: template.smsBody,
      pushTitle: template.pushTitle,
      pushBody: template.pushBody,
      isActive: template.isActive,
    },
    create: { ...template, tenantId: DEFAULT_TENANT_ID },
    select: { id: true, name: true, eventType: true, isActive: true },
  });

  console.log(JSON.stringify({ applyChanges, action: existing ? 'updated' : 'created', saved }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
