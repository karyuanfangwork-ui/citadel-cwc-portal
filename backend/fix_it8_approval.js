const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  // Fix IT-8: Create missing RequestApproval record
  const ceoUser = await prisma.user.findFirst({
    where: { executiveRole: 'CEO', isActive: true },
    select: { id: true, email: true }
  });
  console.log("CEO user:", ceoUser);

  const it8 = await prisma.request.findFirst({
    where: { referenceNumber: "IT-8" },
    select: { id: true, status: true }
  });
  console.log("IT-8:", it8);

  if (it8 && it8.status === 'PENDING_CEO_APPROVAL_IT') {
    // Check for existing approval
    const existing = await prisma.requestApproval.findFirst({
      where: { requestId: it8.id, approverType: 'CEO', status: 'PENDING' }
    });
    if (existing) {
      console.log("Approval record already exists:", existing);
    } else {
      const approval = await prisma.requestApproval.create({
        data: {
          requestId: it8.id,
          approverType: 'CEO',
          approverId: ceoUser?.id || null,
          status: 'PENDING',
        }
      });
      console.log("Created approval record:", approval);
    }
  } else {
    console.log("IT-8 is not in PENDING_CEO_APPROVAL_IT status, skipping");
  }

  // Also reset IT-9 back to SUBMITTED for fresh testing
  const it9 = await prisma.request.findFirst({
    where: { referenceNumber: "IT-9" },
    select: { id: true, status: true }
  });
  if (it9) {
    console.log("IT-9 current status:", it9.status);
    // Clean up IT-9's old approvals
    const deleted = await prisma.requestApproval.deleteMany({
      where: { requestId: it9.id }
    });
    console.log("Deleted IT-9 approvals:", deleted.count);
    // Reset to SUBMITTED
    const reset = await prisma.request.update({
      where: { id: it9.id },
      data: { status: 'SUBMITTED' }
    });
    console.log("IT-9 reset to SUBMITTED");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());