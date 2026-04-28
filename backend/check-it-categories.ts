import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const itDesk = await prisma.serviceDesk.findUnique({ where: { code: 'IT' } });
  if (!itDesk) { console.log('IT desk not found'); return; }

  const categories = await prisma.serviceCategory.findMany({
    where: { serviceDeskId: itDesk.id },
    include: { requestTypes: true },
    orderBy: { displayOrder: 'asc' }
  });

  console.log(JSON.stringify(categories.map(c => ({
    id: c.id,
    name: c.name,
    displayOrder: c.displayOrder,
    requestTypes: c.requestTypes.map(rt => ({ id: rt.id, name: rt.name, code: rt.code }))
  })), null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
