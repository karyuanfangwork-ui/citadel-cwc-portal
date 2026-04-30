const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  // Set CEO's approverId on IT-8's approval record
  const ceoId = 'd5d7c535-d394-49cf-8aec-ab303daab93f';
  const it8Id = 'a680dd49-fdd0-4fbc-a9d2-bf87914fe3b1';
  
  const updated = await prisma.requestApproval.updateMany({
    where: { 
      requestId: it8Id, 
      approverType: 'CEO', 
      status: 'PENDING',
      approverId: null 
    },
    data: { approverId: ceoId }
  });
  console.log("Updated IT-8 approval records:", updated.count);
  
  // Verify
  const approval = await prisma.requestApproval.findFirst({
    where: { requestId: it8Id, status: 'PENDING' }
  });
  console.log("IT-8 approval now:", approval);
}
main().catch(console.error).finally(() => prisma.$disconnect());