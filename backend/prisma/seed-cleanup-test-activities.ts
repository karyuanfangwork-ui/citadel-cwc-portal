import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deletedActivities = await prisma.crmActivity.deleteMany({
    where: {
      OR: [
        { subject: { in: ['a', 'a1'] } },
        { description: { in: ['a', 'a1'] } },
      ],
    },
  });

  const deletedLeads = await prisma.crmLead.deleteMany({
    where: { title: { in: ['a', 'a1'] } },
  });

  console.log(`Deleted ${deletedActivities.count} test activities`);
  console.log(`Deleted ${deletedLeads.count} test leads`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());