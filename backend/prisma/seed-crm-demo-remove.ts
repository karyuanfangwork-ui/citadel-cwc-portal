/**
 * Removes all CRM demo data tagged with [DEMO].
 * Updated for V2 — also removes BorrowerProfiles, Directors, Shareholders,
 * Territories, Quotas, Workflows, AnomalyConfigs, CustomFieldDefinitions,
 * DashboardLayouts, and AccountRequest links.
 *
 * Safe to run multiple times — only deletes records matching the [DEMO] tag.
 *
 * ⚡ RUN:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-crm-demo-remove.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_TAG = '[DEMO]';

async function main() {
  console.log(`🗑️  Removing all CRM records tagged "${DEMO_TAG}"...\n`);

  // Find demo accounts
  const demoAccounts = await prisma.crmAccount.findMany({
    where: { name: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const demoAccountIds = demoAccounts.map(a => a.id);
  console.log(`   Found ${demoAccountIds.length} demo accounts`);

  // Find demo contacts
  const demoContacts = await prisma.crmContact.findMany({
    where: { account: { name: { startsWith: DEMO_TAG } } },
    select: { id: true },
  });
  const demoContactIds = demoContacts.map(c => c.id);

  // ── Phase 1: Child records (referencing accounts/contacts/leads/opportunities) ──

  // 1. Delete account-request links
  const delAcctReq = await prisma.crmAccountRequest.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delAcctReq.count} account-request links`);

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

  // 4. Delete opportunity stage history
  const demoPipeline = await prisma.crmPipeline.findFirst({
    where: { name: { startsWith: DEMO_TAG } },
    include: { stages: { select: { id: true } } },
  });
  const demoStageIds = demoPipeline?.stages.map(s => s.id) || [];

  // Find demo opportunity IDs first
  const demoOpportunities = await prisma.crmOpportunity.findMany({
    where: {
      OR: [
        { accountId: { in: demoAccountIds } },
        { name: { startsWith: DEMO_TAG } },
        ...(demoStageIds.length > 0 ? [{ stageId: { in: demoStageIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const demoOpportunityIds = demoOpportunities.map(o => o.id);

  const delStageHistory = await prisma.crmOpportunityStageHistory.deleteMany({
    where: { opportunityId: { in: demoOpportunityIds } },
  });
  console.log(`   ✓ Deleted ${delStageHistory.count} opportunity stage history records`);

  // 5. Delete trust products linked to demo accounts
  const delTrustProducts = await prisma.crmTrustProduct.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delTrustProducts.count} trust products`);

  // 6. Delete opportunities
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

  // 7. Delete demo leads
  const delLeads = await prisma.crmLead.deleteMany({
    where: {
      OR: [
        { title: { startsWith: DEMO_TAG } },
        { accountId: { in: demoAccountIds } },
      ],
    },
  });
  console.log(`   ✓ Deleted ${delLeads.count} leads`);

  // 8. Delete KYC records for demo contacts
  const delKyc = await prisma.crmKycRecord.deleteMany({
    where: { contactId: { in: demoContactIds } },
  });
  console.log(`   ✓ Deleted ${delKyc.count} KYC records`);

  // 9. Delete beneficiaries for demo contacts
  const delBeneficiaries = await prisma.crmBeneficiary.deleteMany({
    where: { contactId: { in: demoContactIds } },
  });
  console.log(`   ✓ Deleted ${delBeneficiaries.count} beneficiaries`);

  // ── Phase 2: BorrowerProfile, Directors, Shareholders (credit bridge) ──

  // 10. Delete Directors linked to demo borrower profiles
  const demoBorrowerProfiles = await prisma.borrowerProfile.findMany({
    where: { accountId: { in: demoAccountIds } },
    select: { id: true },
  });
  const demoBorrowerProfileIds = demoBorrowerProfiles.map(bp => bp.id);

  const delDirectors = await prisma.director.deleteMany({
    where: { borrowerProfileId: { in: demoBorrowerProfileIds } },
  });
  console.log(`   ✓ Deleted ${delDirectors.count} directors`);

  const delShareholders = await prisma.shareholder.deleteMany({
    where: { borrowerProfileId: { in: demoBorrowerProfileIds } },
  });
  console.log(`   ✓ Deleted ${delShareholders.count} shareholders`);

  // Delete borrower profiles linked to demo accounts or contacts
  const delBorrowerProfiles = await prisma.borrowerProfile.deleteMany({
    where: {
      OR: [
        { accountId: { in: demoAccountIds } },
        { contactId: { in: demoContactIds } },
      ],
    },
  });
  console.log(`   ✓ Deleted ${delBorrowerProfiles.count} borrower profiles`);

  // ── Phase 3: Pipeline ──

  // 11. Delete demo pipeline stages then pipeline
  if (demoPipeline) {
    await prisma.crmPipelineStage.deleteMany({
      where: { pipelineId: demoPipeline.id },
    });
    await prisma.crmPipeline.delete({ where: { id: demoPipeline.id } });
    console.log(`   ✓ Deleted demo pipeline and stages`);
  } else {
    console.log(`   ℹ No demo pipeline found`);
  }

  // ── Phase 4: Contacts & Accounts ──

  // 12. Delete contacts
  const delContacts = await prisma.crmContact.deleteMany({
    where: { accountId: { in: demoAccountIds } },
  });
  console.log(`   ✓ Deleted ${delContacts.count} contacts`);

  // 13. Delete accounts
  const delAccounts = await prisma.crmAccount.deleteMany({
    where: { name: { startsWith: DEMO_TAG } },
  });
  console.log(`   ✓ Deleted ${delAccounts.count} accounts`);

  // ── Phase 5: V2 new entities (Territories, Quotas, Workflows, etc.) ──

  // 14. Delete demo territory members and territories
  const demoTerritories = await prisma.crmTerritory.findMany({
    where: { name: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const demoTerritoryIds = demoTerritories.map(t => t.id);

  for (const tid of demoTerritoryIds) {
    await prisma.crmTerritoryMember.deleteMany({ where: { territoryId: tid } });
  }
  const delTerritories = await prisma.crmTerritory.deleteMany({
    where: { name: { startsWith: DEMO_TAG } },
  });
  console.log(`   ✓ Deleted ${delTerritories.count} territories (with members)`);

  // 15. Delete quotas for demo territories
  const delQuotas = await prisma.crmQuota.deleteMany({
    where: { territoryId: { in: demoTerritoryIds } },
  });
  console.log(`   ✓ Deleted ${delQuotas.count} territory quotas`);

  // 16. Delete demo workflows
  const delWorkflows = await prisma.crmWorkflow.deleteMany({
    where: { name: { startsWith: DEMO_TAG } },
  });
  console.log(`   ✓ Deleted ${delWorkflows.count} workflows`);

  // 17. Delete custom field definitions — only if they're clearly demo-specific
  //    (We keep these since they're useful beyond demo data — no [DEMO] prefix on field keys)
  //    If you want to remove them, uncomment below:
  // const demoFields = ['trust_type_required', 'referral_source_detail', 'trust_deed_number',
  //   'mandate_letter_signed', 'company_domicile', 'client_tier', 'preferred_meeting_time'];
  // for (const fk of demoFields) {
  //   await prisma.crmCustomFieldDefinition.deleteMany({ where: { fieldKey: fk } }).catch(() => {});
  // }
  console.log(`   ℹ Custom field definitions kept (useful beyond demo)`);

  // 18. Anomaly configs — these are global, not demo-tagged. Keep them.
  console.log(`   ℹ Anomaly configs kept (global config, not demo-specific)`);

  // 19. Dashboard layouts — remove for demo owner(s)
  const DEMO_OWNER_EMAIL = 'emily.chow@citadelgroup.com.my';
  const demoOwner = await prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL } });
  if (demoOwner) {
    const delDashboard = await prisma.crmDashboardLayout.deleteMany({
      where: { userId: demoOwner.id },
    });
    console.log(`   ✓ Deleted ${delDashboard.count} dashboard layouts`);
  }

  console.log('\n✅ All CRM demo data removed!');
  console.log('\n💡 You can re-seed by running:');
  console.log('   npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/seed-crm-demo-v2.ts');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });