const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IT7_ID = 'c78a692b-f1c3-4ea7-b6bd-30d9e64d6fa9';

async function main() {
  // Reset IT-7 back to PENDING_CTO_APPROVAL_IT
  await prisma.request.update({
    where: { id: IT7_ID },
    data: { status: 'PENDING_CTO_APPROVAL_IT' }
  });
  
  // Ensure CTO approval is PENDING
  const ctoApproval = await prisma.requestApproval.findFirst({
    where: { requestId: IT7_ID, approverType: 'CTO' }
  });
  
  if (ctoApproval) {
    await prisma.requestApproval.update({
      where: { id: ctoApproval.id },
      data: { status: 'PENDING', approverId: null }
    });
    console.log('CTO approval reset to PENDING');
  }
  
  const req = await prisma.request.findUnique({
    where: { id: IT7_ID },
    select: { status: true }
  });
  console.log('IT-7 status:', req.status);
  
  const approvals = await prisma.requestApproval.findMany({
    where: { requestId: IT7_ID },
    select: { approverType: true, status: true, approverId: true }
  });
  console.log('Approvals:', JSON.stringify(approvals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());