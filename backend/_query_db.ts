import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workflows = await prisma.workflow.findMany({ select: { id: true, code: true, name: true } });
  console.log('All workflows:', JSON.stringify(workflows, null, 2));
  
  const hwType = await prisma.requestType.findFirst({ where: { code: 'NEW_HARDWARE' }, include: { workflow: true } });
  console.log('NEW_HARDWARE type:', JSON.stringify(hwType, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
