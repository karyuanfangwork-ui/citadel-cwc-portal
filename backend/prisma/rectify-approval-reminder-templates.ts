import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SEED_NOTIFICATION_TEMPLATES } from './seed-admin-config';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TARGET_NAMES = ['approval_reminder_first', 'approval_reminder_second'] as const;
const applyChanges = process.argv.includes('--apply');

async function main() {
  const templates = SEED_NOTIFICATION_TEMPLATES.filter((template) =>
    TARGET_NAMES.includes(template.name as (typeof TARGET_NAMES)[number]),
  );

  if (templates.length !== TARGET_NAMES.length) {
    throw new Error('Approval reminder templates are incomplete in seed-admin-config.ts');
  }

  const results: Array<Record<string, unknown>> = [];

  for (const template of templates) {
    const existing = await prisma.notificationTemplate.findUnique({
      where: { name: template.name },
      select: { id: true, eventType: true, isActive: true },
    });

    if (!applyChanges) {
      results.push({
        name: template.name,
        eventType: template.eventType,
        action: existing ? 'would-update' : 'would-create',
        existing,
      });
      continue;
    }

    const saved = await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: {
        eventType: template.eventType,
        emailSubject: template.emailSubject,
        emailBody: template.emailBody,
        smsBody: template.smsBody,
        pushTitle: template.pushTitle,
        pushBody: template.pushBody,
        isActive: template.isActive,
      },
      create: {
        ...template,
        tenantId: DEFAULT_TENANT_ID,
      },
      select: { id: true, name: true, eventType: true, isActive: true },
    });

    results.push({ name: saved.name, action: existing ? 'updated' : 'created', saved });
  }

  console.log(JSON.stringify({ applyChanges, templates: results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
