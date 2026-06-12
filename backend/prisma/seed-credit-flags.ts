import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚩 Seeding credit feature flags...');

  const flags = [
    { key: 'credit:module', description: 'Master toggle for the Credit Assessment Module', enabled: true, category: 'credit' },
    { key: 'credit:borrowers', description: 'Borrower profile management', enabled: true, category: 'credit' },
    { key: 'credit:applications', description: 'Credit application intake and workflow', enabled: true, category: 'credit' },
    { key: 'credit:spreading', description: 'Financial statement spreading (manual)', enabled: true, category: 'credit' },
    { key: 'credit:scoring', description: 'Credit scoring and risk grading', enabled: true, category: 'credit' },
    { key: 'credit:committee', description: 'Committee workflow', enabled: true, category: 'credit' },
    { key: 'credit:collateral', description: 'Collateral and guarantee management', enabled: true, category: 'credit' },
    { key: 'credit:conditions', description: 'Conditions precedent/subsequent tracking', enabled: true, category: 'credit' },
    { key: 'credit:monitoring', description: 'Post-disbursement monitoring and EWS', enabled: true, category: 'credit' },
    { key: 'credit:dashboards', description: 'Credit operational dashboards', enabled: true, category: 'credit' },
    { key: 'credit:ai', description: 'AI advisory features (v2 - deferred)', enabled: true, category: 'credit' },
    { key: 'credit:ecl', description: 'Expected Credit Loss calculation', enabled: false, category: 'credit' },
    { key: 'credit:esg', description: 'ESG risk assessment', enabled: false, category: 'credit' },
    { key: 'credit:sicr', description: 'Significant Increase in Credit Risk tracking', enabled: false, category: 'credit' },
    { key: 'credit:fatca_crs', description: 'FATCA/CRS tax compliance screening', enabled: false, category: 'credit' },
    { key: 'credit:profitability', description: 'Profitability analysis and pricing', enabled: false, category: 'credit' },
    { key: 'credit:counterparties', description: 'Counterparty risk management', enabled: false, category: 'credit' },
    { key: 'credit:account_conduct', description: 'Account conduct and behavioural scoring', enabled: false, category: 'credit' },
    { key: 'credit:advanced_memo', description: 'Advanced credit memo templating and generation', enabled: true, category: 'credit' },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description, category: flag.category, enabled: flag.enabled },
      create: flag,
    });
    console.log(`  ✅ ${flag.key} (enabled: ${flag.enabled})`);
  }

  console.log('✅ Credit feature flags seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });