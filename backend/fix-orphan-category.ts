import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the orphaned category (capital N) with no request types
  const orphan = await prisma.serviceCategory.findFirst({
    where: { name: 'Request New hardware' }
  });

  if (orphan) {
    // Delete its request types first (if any — though it has none)
    await prisma.requestType.deleteMany({
      where: { serviceCategoryId: orphan.id }
    });
    // Delete the category itself
    await prisma.serviceCategory.delete({
      where: { id: orphan.id }
    });
    console.log('✅ Deleted orphaned category: "Request New hardware"');
  } else {
    console.log('No orphan found — already clean');
  }

  // Verify final state
  const itDesk = await prisma.serviceDesk.findUnique({ where: { code: 'IT' } });
  const categories = await prisma.serviceCategory.findMany({
    where: { serviceDeskId: itDesk!.id },
    include: { requestTypes: true },
    orderBy: { displayOrder: 'asc' }
  });

  console.log('\n📊 IT Support categories after cleanup:');
  categories.forEach(c => {
    const rts = c.requestTypes.map(rt => `${rt.name} (${rt.code})`).join(', ');
    console.log(`  ${c.displayOrder}. ${c.name} → ${rts || '(no request types — warning!)'}`);
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
