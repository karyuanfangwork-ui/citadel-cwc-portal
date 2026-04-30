const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  // Find CEO user by role
  const ceoByRole = await prisma.user.findFirst({
    where: { 
      isActive: true,
      roles: { some: { role: { name: 'CEO' } } }
    },
    select: { id: true, email: true, executiveRole: true }
  });
  console.log("CEO by role:", ceoByRole);

  // Find CEO user by executive role  
  const ceoByExecRole = await prisma.user.findMany({
    where: { executiveRole: { not: null } },
    select: { id: true, email: true, executiveRole: true }
  });
  console.log("Users with executiveRole:", ceoByExecRole);

  // Find CEO by email
  const ceoByEmail = await prisma.user.findFirst({
    where: { email: 'ceo@test.local' },
    select: { id: true, email: true, executiveRole: true }
  });
  console.log("CEO by email:", ceoByEmail);
}
main().catch(console.error).finally(() => prisma.$disconnect());