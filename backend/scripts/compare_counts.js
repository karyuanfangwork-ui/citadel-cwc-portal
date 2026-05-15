const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    const counts = {
        roles: await prisma.role.count(),
        users: await prisma.user.count(),
        workflowTransitions: await prisma.workflowTransition.count(),
        requestStatusDefinitions: await prisma.requestStatusDefinition.count(),
        notificationTemplates: await prisma.notificationTemplate.count(),
        bannerConfigs: await prisma.bannerConfig.count(),
        escalationRules: await prisma.escalationRule.count(),
        entities: await prisma.entity.count(),
        onboardingTaskTemplates: await prisma.onboardingTaskTemplate.count(),
        offboardingTaskTemplates: await prisma.offboardingTaskTemplate.count(),
        serviceDesks: await prisma.serviceDesk.count(),
        serviceCategories: await prisma.serviceCategory.count(),
        requestTypes: await prisma.requestType.count(),
        workflowTypes: await prisma.workflowType.count(),
        workflowSteps: await prisma.workflowStep.count(),
    };
    console.log(JSON.stringify(counts));
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });