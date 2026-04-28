// Builds the complete seed.ts by combining the main seed file
// with the admin config data and seeding logic
import * as fs from 'fs';

const seedPath = '/Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/seed.ts';
const configPath = '/Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/seed-admin-config.ts';

const seedContent = fs.readFileSync(seedPath, 'utf-8');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Split the seed file at the KB articles section marker
const kbMarker = '    // ── Seed Knowledge Base Articles ──';
const kbIndex = seedContent.indexOf(kbMarker);
if (kbIndex === -1) {
  console.error('ERROR: Could not find KB articles section marker');
  process.exit(1);
}

const beforeKB = seedContent.substring(0, kbIndex);
const kBSectionAndAfter = seedContent.substring(kbIndex);

// Remove the header comment from config content (first 6 lines)
const configLines = configContent.split('\n');
const configBody = configLines.slice(6).join('\n'); // Skip the header comment block (5 lines) + blank line

// ====== Insert data constants after imports ======
const prismaClientLine = 'const prisma = new PrismaClient();';
const afterPrismaIdx = beforeKB.indexOf(prismaClientLine) + prismaClientLine.length;

const part1 = beforeKB.substring(0, afterPrismaIdx);
const part2 = beforeKB.substring(afterPrismaIdx);

const adminDataSection = `

type AdminNotificationTemplate = {
  name: string; eventType: string; emailSubject: string | null; emailBody: string | null;
  smsBody: string | null; pushTitle: string | null; pushBody: string | null; isActive: boolean;
};
type AdminStatusDef = { code: string; label: string; description: string | null; category: string | null; displayOrder: number; isActive: boolean; };
type AdminTransition = { fromStatus: string; toStatus: string; transitionLabel: string | null; requiresComment: boolean; autoAssignRole: string | null; autoAssignUserId: string | null; isActive: boolean; };
type AdminBanner = { role: string; status: string; icon: string; title: string; description: string; colorScheme: string; isActive: boolean; };
type AdminTaskTemplate = { taskName: string; taskDescription: string | null; taskCategory: string; priority: string; dueDayOffset: number; displayOrder: number; isActive: boolean; };
type AdminEscalationRule = { requestTypeCode: string; triggerHoursAfterBreach: number; notifyRoles: string[]; label: string | null; isActive: boolean; };

// ═══════════════════════════════════════════════════════════════
// ADMIN CONFIG DATA — preserved from local database
// Re-generated via \`npx tsx dump-admin-config.ts\`
// ═══════════════════════════════════════════════════════════════
${configBody}
`;

const seedWithData = part1 + adminDataSection + part2;

// ====== Add seeding logic before KB articles ======
const seedingLogic = `
    // ═════════════════════════════════════════════════════════════
    // ADMIN CONFIG SEEDING — preserves existing settings via upsert
    // If RETAIN_ADMIN_CONFIG is true, admin config is skipped
    // ═════════════════════════════════════════════════════════════

    if (!RETAIN_ADMIN_CONFIG) {
        console.log('Seeding notification templates...');
        for (const tpl of SEED_NOTIFICATION_TEMPLATES) {
            await prisma.notificationTemplate.upsert({
                where: { name: tpl.name },
                update: {},
                create: {
                    name: tpl.name,
                    eventType: tpl.eventType,
                    emailSubject: tpl.emailSubject,
                    emailBody: tpl.emailBody,
                    smsBody: tpl.smsBody,
                    pushTitle: tpl.pushTitle,
                    pushBody: tpl.pushBody,
                    isActive: tpl.isActive,
                },
            });
        }
        console.log(\`✅ Seeded \${SEED_NOTIFICATION_TEMPLATES.length} notification templates\`);

        console.log('Seeding request status definitions...');
        for (const sd of SEED_STATUS_DEFINITIONS) {
            await prisma.requestStatusDefinition.upsert({
                where: { code: sd.code },
                update: {},
                create: sd,
            });
        }
        console.log(\`✅ Seeded \${SEED_STATUS_DEFINITIONS.length} status definitions\`);

        console.log('Seeding workflow transitions...');
        for (const tr of SEED_WORKFLOW_TRANSITIONS) {
            await prisma.workflowTransition.upsert({
                where: { fromStatus_toStatus: { fromStatus: tr.fromStatus, toStatus: tr.toStatus } },
                update: {},
                create: tr,
            });
        }
        console.log(\`✅ Seeded \${SEED_WORKFLOW_TRANSITIONS.length} workflow transitions\`);

        console.log('Seeding banner configs...');
        for (const bc of SEED_BANNER_CONFIGS) {
            await prisma.bannerConfig.upsert({
                where: { role_status: { role: bc.role, status: bc.status } },
                update: {},
                create: bc,
            });
        }
        console.log(\`✅ Seeded \${SEED_BANNER_CONFIGS.length} banner configs\`);

        console.log('Seeding onboarding task templates...');
        for (const ot of SEED_ONBOARDING_TEMPLATES) {
            await prisma.onboardingTaskTemplate.create({ data: ot }).catch(() => {
                // Duplicate — already seeded, skip
            });
        }
        console.log(\`✅ Seeded \${SEED_ONBOARDING_TEMPLATES.length} onboarding templates\`);

        console.log('Seeding offboarding task templates...');
        for (const oft of SEED_OFFBOARDING_TEMPLATES) {
            await prisma.offboardingTaskTemplate.create({ data: oft }).catch(() => {
                // Duplicate — already seeded, skip
            });
        }
        console.log(\`✅ Seeded \${SEED_OFFBOARDING_TEMPLATES.length} offboarding templates\`);

        console.log('Seeding escalation rules...');
        for (const rule of SEED_ESCALATION_RULES) {
            const rt = await prisma.requestType.findFirst({
                where: { code: rule.requestTypeCode }
            });
            if (rt) {
                await prisma.escalationRule.create({
                    data: {
                        requestTypeId: rt.id,
                        triggerHoursAfterBreach: rule.triggerHoursAfterBreach,
                        notifyRoles: rule.notifyRoles,
                        label: rule.label,
                        isActive: rule.isActive,
                    },
                }).catch(() => {
                    // Duplicate — already seeded, skip
                });
            }
        }
        console.log(\`✅ Seeded \${SEED_ESCALATION_RULES.length} escalation rules\`);
    }

`;

// Find KB marker again in modified content and insert before it
const finalKbIndex = seedWithData.indexOf(kbMarker);
const finalSeed = seedWithData.substring(0, finalKbIndex) + seedingLogic + seedWithData.substring(finalKbIndex);

fs.writeFileSync(seedPath, finalSeed, 'utf-8');
console.log('✅ seed.ts built successfully');
console.log(`   Total size: ${finalSeed.length} bytes`);
