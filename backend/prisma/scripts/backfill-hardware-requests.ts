import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hardwareRequests = await prisma.request.findMany({
    where: {
      requestType: {
        name: { contains: 'hardware', mode: 'insensitive' },
      },
    },
    include: {
      itHardwareRequest: true,
      requestType: true,
    },
  });

  console.log(`Found ${hardwareRequests.length} hardware requests to check`);
  let created = 0;

  for (const req of hardwareRequests) {
    if (req.itHardwareRequest) {
      continue; // already has a record
    }

    const cf = (req.customFields || {}) as Record<string, any>;
    const hardwareName =
      cf.hardwareName || cf.hw_name || cf.hardwareType || 'Unknown';
    const businessJustification =
      cf.businessJustification || cf.hw_reason || cf.reason || '';

    const rawPrice = cf.estimatedPrice;
    const estimatedPrice =
      rawPrice != null && rawPrice !== '' && !isNaN(Number(rawPrice))
        ? parseFloat(String(rawPrice))
        : null;

    await prisma.iTHardwareRequest.create({
      data: {
        requestId: req.id,
        hardwareName,
        hardwareModel: cf.hardwareModel || cf.hw_model || cf.model || null,
        estimatedPrice,
        preferredVendor: cf.preferredVendor || null,
        productUrl: cf.productUrl || null,
        businessJustification,
      },
    });

    created++;
    console.log(`Created ITHardwareRequest for request ${req.referenceNumber}`);
  }

  console.log(`Done. Created ${created} ITHardwareRequest records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
