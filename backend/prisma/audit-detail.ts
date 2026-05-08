import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Entities
  const entities = await prisma.entity.findMany({
    select: { code: true, name: true, approverId: true, displayOrder: true, isActive: true },
    orderBy: { displayOrder: 'asc' }
  });
  console.log('=== ENTITIES ===');
  console.log(JSON.stringify(entities, null, 2));

  // Workflow transitions summary
  const transitions = await prisma.workflowTransition.findMany({
    select: { fromStatus: true, toStatus: true, transitionLabel: true, requiresComment: true, autoAssignRole: true, isActive: true },
    orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }]
  });
  console.log('\n=== WORKFLOW TRANSITIONS ===');
  console.log(JSON.stringify(transitions, null, 2));

  // Escalation rules
  const rules = await prisma.escalationRule.findMany({
    select: { requestTypeId: true, triggerHoursAfterBreach: true, notifyRoles: true, isActive: true }
  });
  console.log('\n=== ESCALATION RULES ===');
  console.log(JSON.stringify(rules, null, 2));

  // Banner configs
  const banners = await prisma.bannerConfig.findMany({
    select: { role: true, status: true, title: true, icon: true, colorScheme: true, description: true, isActive: true },
    orderBy: [{ role: 'asc' }, { status: 'asc' }]
  });
  console.log('\n=== BANNER CONFIGS ===');
  console.log(JSON.stringify(banners, null, 2));

  // Offboarding task templates
  const offTemplates = await prisma.offboardingTaskTemplate.findMany({
    select: { taskName: true, taskCategory: true, priority: true, dueDayOffset: true, displayOrder: true, isActive: true },
    orderBy: { displayOrder: 'asc' }
  });
  console.log('\n=== OFFBOARDING TASK TEMPLATES ===');
  console.log(JSON.stringify(offTemplates, null, 2));

  await prisma.$disconnect();
}

main();