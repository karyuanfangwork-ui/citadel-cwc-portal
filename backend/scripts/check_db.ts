import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, firstName: true, lastName: true, jobTitle: true, executiveRole: true, entityId: true }, orderBy: { email: 'asc' } });
  console.log('=== USERS ===');
  users.forEach(u => console.log(`${u.email} | ${u.firstName} ${u.lastName} | jobTitle=${u.jobTitle} | execRole=${u.executiveRole} | entityId=${u.entityId}`));
  const entities = await prisma.entity.findMany({ orderBy: { code: 'asc' } });
  console.log('\n=== ENTITIES ===');
  entities.forEach(e => console.log(`${e.id} | ${e.code} | ${e.name}`));
  await prisma.$disconnect();
}
main();
