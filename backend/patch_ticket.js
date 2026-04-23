
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.request.updateMany({
    where: { referenceNumber: 'HR-9' },
    data: { status: 'ONBOARDING_SUBMITTED' },
  });
  console.log(`Updated ${result.count} records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
