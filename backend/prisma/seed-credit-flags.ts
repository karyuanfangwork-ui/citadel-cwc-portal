import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚩 Seeding credit feature flags...');

  const flags = [
    { key: 'credit:module', description: 'Master toggle for the Credit Assessment Module', enabled: true, category: 'credit' },
    { key: 'credit:borrowers', description: 'Borrower profile management', enabled: false, category: 'credit' },
    { key: 'credit:applications', description: 'Credit application intake and workflow', enabled: false, category: 'credit' },
    { key: 'credit:spreading', description: 'Financial statement spreading (manual)', enabled: false, category: 'credit' },
    { key: 'credit:scoring', description: 'Credit scoring and risk grading', enabled: false, category: 'credit' },
    { key: 'credit:committee', description: 'Committee workflow', enabled: false, category: 'credit' },
    { key: 'credit:collateral', description: 'Collateral and guarantee management', enabled: false, category: 'credit' },
    { key: 'credit:conditions', description: 'Conditions precedent/subsequent tracking', enabled: false, category: 'credit' },
    { key: 'credit:monitoring', description: 'Post-disbursement monitoring and EWS', enabled: false, category: 'credit' },
    { key: 'credit:dashboards', description: 'Credit operational dashboards', enabled: false, category: 'credit' },
    { key: 'credit:ai', description: 'AI advisory features (v2 - deferred)', enabled: false, category: 'credit' },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description, category: flag.category },
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
