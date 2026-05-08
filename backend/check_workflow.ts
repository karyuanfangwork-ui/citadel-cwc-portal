import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const hwWorkflow = await prisma.workflow.findFirst({ where: { code: "IT_HARDWARE_PROCUREMENT" } });
  console.log("IT_HARDWARE_PROCUREMENT workflow:", JSON.stringify(hwWorkflow, null, 2));
  
  const hwType = await prisma.requestType.findFirst({ where: { code: "NEW_HARDWARE" }, include: { workflow: true } });
  console.log("NEW_HARDWARE type:", JSON.stringify(hwType, null, 2));
  
  const procWorkflow = await prisma.workflow.findFirst({ where: { code: "IT_PROCUREMENT" }, include: { steps: true } });
  console.log("IT_PROCUREMENT workflow:", procWorkflow?.id, "steps:", procWorkflow?.steps?.length);
  
  await prisma.$disconnect();
}
main().catch(console.error);
