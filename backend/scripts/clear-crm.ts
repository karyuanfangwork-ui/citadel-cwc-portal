import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete in dependency order (children first, parents last)
  // Using deleteMany to skip "not found" errors on empty tables

  const tables = [
    'CrmOpportunityStageHistory',
    'CrmActivity',
    'CrmNote',
    'CrmFieldChange',
    'CrmTagAssignment',
    'CrmOpportunity',
    'CrmLeadScoringRule',
    'CrmLead',
    'CrmContactAccountRole',
    'CrmContact',
    'CrmAccountRequest',
    'CrmBeneficiary',
    'CrmKycRecord',
    'CrmAccount',
    'CrmPipelineStage',
    'CrmPipeline',
    'CrmQuota',
    'CrmTerritoryMember',
    'CrmTerritory',
    'CrmAssignmentRule',
    'CrmTag',
    'CrmImportJob',
    'CrmExportJob',
  ];

  for (const model of tables) {
    try {
      const result = await (prisma as any)[model].deleteMany({});
      console.log(`✓ ${model}: ${result.count} records deleted`);
    } catch (e: any) {
      console.log(`✗ ${model}: ${e.message}`);
    }
  }

  // Reset auto-increment sequences
  const resetTables = [
    'crm_opportunity_stage_history', 'crm_activities', 'crm_notes',
    'crm_field_changes', 'crm_tag_assignments', 'crm_opportunities',
    'crm_lead_scoring_rules', 'crm_leads', 'crm_contact_account_roles',
    'crm_contacts', 'crm_account_requests', 'crm_beneficiaries',
    'crm_kyc_records', 'crm_accounts', 'crm_pipeline_stages',
 'crm_pipelines', 'crm_quotas', 'crm_territory_members', 'crm_territories',
 'crm_assignment_rules', 'crm_tags',
    'crm_import_jobs', 'crm_export_jobs',
  ];

  for (const table of resetTables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "${table}_id_seq" RESTART WITH 1`);
    } catch {
      // sequence may not exist for some tables, ignore
    }
  }
  console.log('\n✓ Sequences reset');

  await prisma.$disconnect();
  console.log('\nDone. All CRM records cleared.');
}

main().catch((e) => { console.error(e); process.exit(1); });
