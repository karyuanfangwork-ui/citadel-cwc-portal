
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.request.updateMany({
    where: { reference_number: 'HR-8' },
    data: { status: 'HR_SCREENING' },
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
