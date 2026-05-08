
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result: Record<string, any[]> = {};

  // Tables that are admin-configurable
  const tables = [
    'serviceDesk', 'serviceCategory', 'requestType', 'entity',
    'notificationTemplate', 'requestStatusDefinition', 'workflowTransition',
    'bannerConfig', 'onboardingTaskTemplate', 'offboardingTaskTemplate',
    'escalationRule', 'workflowType', 'workflowStep',
    'requestTypeEntityRouting', 'knowledgeBaseArticle',
  ];

  for (const table of tables) {
    try {
      const data = await (prisma as any)[table].findMany({ orderBy: { createdAt: 'asc' } });
      result[table] = data;
      console.log(`${table}: ${data.length} records`);
    } catch (e: any) {
      console.log(`${table}: ERROR - ${e.message}`);
    }
  }

  // Write full JSON dump
  const fs = await import('fs');
  fs.writeFileSync('prisma/db-dump.json', JSON.stringify(result, null, 2));
  console.log('Written prisma/db-dump.json');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
