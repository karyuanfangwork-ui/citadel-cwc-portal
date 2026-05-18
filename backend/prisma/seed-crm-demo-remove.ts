/**
 * Removes all CRM demo data tagged with [DEMO].
 * Safe to run multiple times — only deletes records matching the [DEMO] tag.
 *
 * ⚡ RUN:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo-remove.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_TAG = '[DEMO]';

async function main() {
  console.log(`🗑️  Removing all CRM records tagged "${DEMO_TAG}"...\n`);

  // Delete in dependency order (children first)

  // 1. Trust products linked to demo accounts
  const demoAccounts = await prisma.crmAccount.findMany({
    where: { name: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const demoAccountIds = demoAccounts.map(a => a.id);
  console.log(`   Found ${demoAccountIds.length} demo accounts`);

  // 2. Delete activities linked to demo accounts
  const delActivities = await prisma.crmActivity.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delActivities.count} activities`);

  // 3. Delete notes linked to demo accounts
  const delNotes = await prisma.crmNote.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delNotes.count} notes`);

  // 4. Delete opportunities linked to demo accounts and demo pipeline
  const demoPipeline = await prisma.crmPipeline.findFirst({
    where: { name: { startsWith: DEMO_TAG } },
    include: { stages: { select: { id: true } } },
  });
  const demoStageIds = demoPipeline?.stages.map(s => s.id) || [];

  const delOpps = await prisma.crmOpportunity.deleteMany({
    where: {
      OR: [
        { accountId: { in: demoAccountIds } },
        { name: { startsWith: DEMO_TAG } },
        ...(demoStageIds.length > 0 ? [{ stageId: { in: demoStageIds } }] : []),
      ],
    },
  });
  console.log(`   ✓ Deleted ${delOpps.count} opportunities`);

  // 5. Delete demo leads
  const delLeads = await prisma.crmLead.deleteMany({
    where: { title: { startsWith: DEMO_TAG } },
  });
  console.log(`   ✓ Deleted ${delLeads.count} leads`);

  // 6. Delete KYC records for demo contacts
  const demoContacts = await prisma.crmContact.findMany({
    where: { account: { name: { startsWith: DEMO_TAG } } },
    select: { id: true },
  });
  const demoContactIds = demoContacts.map(c => c.id);

  const delKyc = await prisma.crmKycRecord.deleteMany({
    where: { contactId: { in: demoContactIds } },
  });
  console.log(`   ✓ Deleted ${delKyc.count} KYC records`);

  // 7. Delete beneficiaries for demo contacts
  const delBeneficiaries = await prisma.crmBeneficiary.deleteMany({
    where: { contactId: { in: demoContactIds } },
  });
  console.log(`   ✓ Deleted ${delBeneficiaries.count} beneficiaries`);

  // 8. Delete demo pipeline stages then pipeline
  if (demoPipeline) {
    await prisma.crmPipelineStage.deleteMany({
      where: { pipelineId: demoPipeline.id },
    });
    await prisma.crmPipeline.delete({ where: { id: demoPipeline.id } });
    console.log(`   ✓ Deleted demo pipeline and stages`);
  } else {
    console.log(`   ℹ No demo pipeline found`);
  }

  // 9. Delete leads from demo accounts (also catches any with accountId set)
  const delLeads2 = await prisma.crmLead.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delLeads2.count} additional leads by account`);

  // 10. Delete contacts
  const delContacts = await prisma.crmContact.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delContacts.count} contacts`);

  // 11. Delete accounts
  const delAccounts = await prisma.crmAccount.deleteMany({
    where: { name: { startsWith: DEMO_TAG } },
  });
  console.log(`   ✓ Deleted ${delAccounts.count} accounts`);

  console.log('\n✅ All CRM demo data removed!');
  console.log('\n💡 You can re-seed by running:');
  console.log('   npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/seed-crm-demo.ts');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });