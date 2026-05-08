import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find PURCHASE_REQUISITION request type
  const purchaseReq = await prisma.requestType.findFirst({
    where: { code: 'PURCHASE_REQUISITION' },
    include: { workflow: true }
  });
  
  if (purchaseReq) {
    console.log('PURCHASE_REQUISITION Request Type:');
    console.log(JSON.stringify(purchaseReq, null, 2));
  } else {
    console.log('PURCHASE_REQUISITION not found');
  }
  
  // Also check the FINANCE-2 request
  const fin2 = await prisma.request.findUnique({
    where: { id: '39c35042-a224-4558-9093-0125e46858b5' },
    include: {
      requestType: { include: { workflow: true } },
      serviceDesk: true
    }
  });
  
  if (fin2) {
    console.log('\n---\nFINANCE-2 Request:');
    console.log('Status:', fin2.status);
    console.log('Request Type:', fin2.requestType?.name, '| Code:', fin2.requestType?.code);
    console.log('Workflow:', fin2.requestType?.workflow?.name, '| Code:', fin2.requestType?.workflow?.code);
    console.log('Service Desk:', fin2.serviceDesk?.name, '| Code:', fin2.serviceDesk?.code);
  }
}

main().finally(() => prisma.$disconnect());