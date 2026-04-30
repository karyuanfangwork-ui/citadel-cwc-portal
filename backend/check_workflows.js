const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const wf = await prisma.workflowType.findFirst({
    where: { code: 'IT_HARDWARE_PROCUREMENT' },
    include: { steps: { orderBy: { displayOrder: 'asc' } } }
  });
  if (wf) {
    console.log("Workflow:", wf.name, "(" + wf.code + ")");
    for (const s of wf.steps) {
      console.log(`  Step ${s.displayOrder}: ${s.label} → ${s.status} (role: ${s.requiredRole || 'none'})`);
    }
  } else {
    console.log("IT_HARDWARE_PROCUREMENT workflow not found");
  }
  
  const wf2 = await prisma.workflowType.findFirst({
    where: { code: 'IT_PROCUREMENT' },
    include: { steps: { orderBy: { displayOrder: 'asc' } } }
  });
  if (wf2) {
    console.log("\nWorkflow:", wf2.name, "(" + wf2.code + ")");
    for (const s of wf2.steps) {
      console.log(`  Step ${s.displayOrder}: ${s.label} → ${s.status} (role: ${s.requiredRole || 'none'})`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());