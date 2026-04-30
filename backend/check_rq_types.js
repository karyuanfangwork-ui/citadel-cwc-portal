const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const types = await prisma.requestType.findMany({
    where: { code: { in: ["NEW_HARDWARE", "SOFTWARE_INSTALLATION"] } },
    include: { workflow: true, serviceCategory: true }
  });
  console.log(JSON.stringify(types, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());