import { PrismaClient } from '@prisma/client';

async function main() {
    const p = new PrismaClient();
    const counts = {
        roles: await p.role.count(),
        permissions: await p.permission.count(),
        users: await p.user.count(),
        workflowTransitions: await p.workflowTransition.count(),
        statusDefinitions: await p.statusDefinition.count(),
        notificationTemplates: await p.notificationTemplate.count(),
        bannerConfigs: await p.bannerConfig.count(),
        escalationRules: await p.escalationRule.count(),
        entityConfigs: await p.entityConfig.count(),
        onboardingTemplates: await p.onboardingTemplate.count(),
        offboardingTemplates: await p.offboardingTemplate.count(),
    };
    console.log(JSON.stringify(counts));
    await p.$disconnect();
}
main();