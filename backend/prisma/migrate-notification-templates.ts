/**
 * One-time migration: Update notification templates to replace
 * hash-style routing URLs (#/) with proper BrowserRouter paths.
 *
 * Before: {{appUrl}}/#/requests/{{requestUuid}}  or  {{appUrl}}/#/requests/{{requestId}}
 * After:  {{appUrl}}/request/{{requestUuid}}
 *
 * Also fixes the password reset URL pattern if present.
 *
 * Run: npx tsx prisma/migrate-notification-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Fix request view links: /#/requests/ → /request/ ──
  const templatesWithHashRoutes = await prisma.notificationTemplate.findMany({
    where: {
      emailBody: { contains: '/#/requests/' },
    },
  });

  console.log(`Found ${templatesWithHashRoutes.length} templates with old /#/requests/ URL pattern`);

  let updated = 0;
  for (const tpl of templatesWithHashRoutes) {
    const newBody = tpl.emailBody!
      .replace(/\/#\/requests\/{{requestId}}/g, '/request/{{requestUuid}}')
      .replace(/\/#\/requests\/{{requestUuid}}/g, '/request/{{requestUuid}}');

    if (newBody !== tpl.emailBody) {
      await prisma.notificationTemplate.update({
        where: { id: tpl.id },
        data: { emailBody: newBody },
      });
      console.log(`  ✅ Updated: ${tpl.name} (${tpl.eventType})`);
      updated++;
    }
  }

  // ── Fix password reset links: /#/reset-password → /reset-password ──
  const templatesWithHashReset = await prisma.notificationTemplate.findMany({
    where: {
      emailBody: { contains: '/#/reset-password' },
    },
  });

  console.log(`\nFound ${templatesWithHashReset.length} templates with old /#/reset-password URL pattern`);

  for (const tpl of templatesWithHashReset) {
    const newBody = tpl.emailBody!.replace(/\/#\/reset-password/g, '/reset-password');
    if (newBody !== tpl.emailBody) {
      await prisma.notificationTemplate.update({
        where: { id: tpl.id },
        data: { emailBody: newBody },
      });
      console.log(`  ✅ Updated: ${tpl.name} (${tpl.eventType})`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated} notification templates from hash routing to BrowserRouter paths.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});