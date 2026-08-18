import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { SEED_NOTIFICATION_TEMPLATES } from './seed-admin-config';

const prisma = new PrismaClient();
const TARGET_NAME = 'approval_required';
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const applyChanges = process.argv.includes('--apply');
const expectedHashIndex = process.argv.indexOf('--expected-hash');
const expectedHash = expectedHashIndex >= 0 ? process.argv[expectedHashIndex + 1] : undefined;

type TemplateSnapshot = {
  id: string;
  name: string;
  eventType: string;
  tenantId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
};

function contentHash(emailSubject: string | null, emailBody: string | null): string {
  return crypto
    .createHash('sha256')
    .update(`${emailSubject ?? ''}\n${emailBody ?? ''}`)
    .digest('hex');
}

async function loadCurrent(): Promise<TemplateSnapshot> {
  const current = await prisma.notificationTemplate.findUnique({
    where: { name: TARGET_NAME },
    select: {
      id: true,
      name: true,
      eventType: true,
      tenantId: true,
      emailSubject: true,
      emailBody: true,
    },
  });

  if (!current) {
    throw new Error(`Notification template '${TARGET_NAME}' was not found; refusing to create it automatically`);
  }
  if (current.eventType !== 'APPROVAL_REQUIRED') {
    throw new Error(`Template '${TARGET_NAME}' has unexpected event type '${current.eventType}'`);
  }

  return current;
}

async function main() {
  const desired = SEED_NOTIFICATION_TEMPLATES.find((template) => template.name === TARGET_NAME);
  if (!desired) {
    throw new Error(`Canonical '${TARGET_NAME}' template is missing from seed-admin-config.ts`);
  }

  const current = await loadCurrent();
  const currentHash = contentHash(current.emailSubject, current.emailBody);
  const desiredHash = contentHash(desired.emailSubject, desired.emailBody);
  const changedFields = [
    ...(current.emailSubject !== desired.emailSubject ? ['emailSubject'] : []),
    ...(current.emailBody !== desired.emailBody ? ['emailBody'] : []),
  ];

  if (!applyChanges) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      target: TARGET_NAME,
      tenantId: current.tenantId,
      currentHash,
      desiredHash,
      changedFields,
      willUpdate: changedFields.length > 0,
      protectedFields: ['isActive', 'smsBody', 'pushTitle', 'pushBody', 'eventType', 'tenantId'],
      applyCommand: `npx tsx prisma/rectify-approval-required-template.ts --apply --expected-hash ${currentHash}`,
    }, null, 2));
    return;
  }

  if (!expectedHash) {
    throw new Error('--apply requires --expected-hash from the reviewed dry-run output');
  }
  if (expectedHash !== currentHash) {
    throw new Error(`Template changed after dry-run (expected ${expectedHash}, current ${currentHash}); refusing to overwrite admin edits`);
  }
  if (changedFields.length === 0) {
    console.log(JSON.stringify({ mode: 'apply', target: TARGET_NAME, action: 'no-op', currentHash }, null, 2));
    return;
  }

  const saved = await prisma.$transaction(async (tx) => {
    const latest = await tx.notificationTemplate.findUnique({
      where: { id: current.id },
      select: { emailSubject: true, emailBody: true, eventType: true },
    });
    if (!latest || latest.eventType !== 'APPROVAL_REQUIRED') {
      throw new Error(`Template '${TARGET_NAME}' changed or disappeared during apply`);
    }
    const latestHash = contentHash(latest.emailSubject, latest.emailBody);
    if (latestHash !== expectedHash) {
      throw new Error(`Template changed during apply (expected ${expectedHash}, current ${latestHash})`);
    }

    return tx.notificationTemplate.update({
      where: { id: current.id },
      data: {
        emailSubject: desired.emailSubject,
        emailBody: desired.emailBody,
      },
      select: {
        id: true,
        name: true,
        eventType: true,
        tenantId: true,
        emailSubject: true,
        emailBody: true,
      },
    });
  });

  console.log(JSON.stringify({
    mode: 'apply',
    target: saved.name,
    tenantId: saved.tenantId,
    action: 'updated',
    updatedFields: changedFields,
    newHash: contentHash(saved.emailSubject, saved.emailBody),
    protectedFields: ['isActive', 'smsBody', 'pushTitle', 'pushBody', 'eventType', 'tenantId'],
    tenantSafetyNote: `Expected default tenant is ${DEFAULT_TENANT_ID}; existing tenant was preserved`,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
