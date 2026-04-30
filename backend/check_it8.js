const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const req = await prisma.request.findFirst({
    where: { referenceNumber: "IT-8" },
    include: {
      approvals: true,
      assignedTo: { select: { id: true, email: true, firstName: true, lastName: true, executiveRole: true } },
      requestType: { select: { name: true, code: true, workflow: { select: { code: true, name: true } } } },
    }
  });
  if (req) {
    console.log("IT-8 id:", req.id);
    console.log("IT-8 status:", req.status);
    console.log("IT-8 assignedTo:", JSON.stringify(req.assignedTo));
    console.log("IT-8 requestType:", JSON.stringify(req.requestType));
    console.log("IT-8 approvals count:", req.approvals.length);
    for (const a of req.approvals) {
      console.log("  approval:", JSON.stringify(a));
    }
  } else {
    console.log("IT-8 not found");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());