/**
 * One-time migration: Update notification templates to use {{requestUuid}} in URLs
 * and ensure {{requestId}} resolves to the human-readable referenceNumber.
 *
 * Run: npx tsx prisma/migrate-notification-templates.ts
 *
 * After running, re-seed with: npm run prisma:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.notificationTemplate.findMany({
    where: {
      emailBody: { contains: '{{appUrl}}/#/requests/{{requestId}}' },
    },
  });

  console.log(`Found ${templates.length} templates with old URL pattern`);

  for (const tpl of templates) {
    const newBody = tpl.emailBody!.replace(
      /{{appUrl}}\/#\/requests\/{{requestId}}/g,
      '{{appUrl}}/#/requests/{{requestUuid}}'
    );

    await prisma.notificationTemplate.update({
      where: { id: tpl.id },
      data: { emailBody: newBody },
    });

    console.log(`  ✅ Updated: ${tpl.name}`);
  }

  console.log('\nDone! All notification template URLs now use {{requestUuid}}.');
  console.log('Display text (e.g. #{{requestId}}) still uses requestId = referenceNumber.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});