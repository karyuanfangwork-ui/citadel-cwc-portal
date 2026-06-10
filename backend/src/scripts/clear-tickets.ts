// ═══════════════════════════════════════════════════════════════
// CLEAR ALL TICKETS — Removes all requests and dependent data
// Preserves: users, roles, permissions, service desks, categories,
//            request types, workflows, admin config, entities,
//            KB articles, assets, credit data, CRM data
//
// Usage (dev):
//   npx tsx src/scripts/clear-tickets.ts
//
// Dry run (counts only, no deletes):
//   DRY_RUN=true npx tsx src/scripts/clear-tickets.ts
//
// Production (inside Docker):
//   docker exec citadel-cwc-portal-backend-1 node dist/scripts/clear-tickets.js
//   DRY_RUN=true docker exec citadel-cwc-portal-backend-1 node dist/scripts/clear-tickets.js
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
    if (DRY_RUN) {
        console.log('🧹 DRY RUN — counting records that would be deleted (no changes made)\n');
    } else {
        console.log('🧹 Clearing all tickets from database...\n');
    }

    // Count before deletion
    const counts: Record<string, number> = {};

    const countFields = [
        { key: 'requests', model: 'request' },
        { key: 'requestActivities', model: 'requestActivity' },
        { key: 'requestAttachments', model: 'requestAttachment' },
        { key: 'requestApprovals', model: 'requestApproval' },
        { key: 'requestItems', model: 'requestItem' },
        { key: 'requestParticipants', model: 'requestParticipant' },
        { key: 'itHardwareRequests', model: 'iTHardwareRequest' },
        { key: 'hrLeaveRequests', model: 'hRLeaveRequest' },
        { key: 'expenseReimbursements', model: 'financeExpenseReimbursement' },
        { key: 'expenseLineItems', model: 'expenseLineItem' },
        { key: 'candidateResumes', model: 'candidateResume' },
        { key: 'interviewSchedules', model: 'interviewSchedule' },
        { key: 'interviewFeedbacks', model: 'interviewFeedback' },
        { key: 'hrScreenings', model: 'hRScreening' },
        { key: 'letterOfAcceptances', model: 'letterOfAcceptance' },
        { key: 'onboardingRequests', model: 'onboardingRequest' },
        { key: 'onboardingTasks', model: 'onboardingTask' },
        { key: 'offboardingRequests', model: 'offboardingRequest' },
        { key: 'offboardingTasks', model: 'offboardingTask' },
        { key: 'notifications', model: 'notification' },
        { key: 'auditLogs', model: 'auditLog' },
        { key: 'passwordResetTokens', model: 'passwordResetToken' },
        { key: 'sessions', model: 'session' },
    ];

    for (const { key, model } of countFields) {
        try {
            counts[key] = await (prisma as any)[model].count();
        } catch {
            counts[key] = 0;
        }
    }

    console.log('Current record counts:');
    let totalTicketRecords = 0;
    for (const [table, count] of Object.entries(counts)) {
        if (count > 0) {
            console.log(`  ${table}: ${count}`);
            totalTicketRecords += count;
        }
    }

    if (counts.requests === 0) {
        console.log('\n✅ No requests found — database is already clear.');
        return;
    }

    if (DRY_RUN) {
        console.log(`\n⚠️  Would delete ${totalTicketRecords} records across ${Object.values(counts).filter(c => c > 0).length} tables.`);

        console.log('\nPreserved data (will NOT be deleted):');
        const preservedFields = [
            { key: 'users', model: 'user' },
            { key: 'roles', model: 'role' },
            { key: 'permissions', model: 'permission' },
            { key: 'rolePermissions', model: 'rolePermission' },
            { key: 'serviceDesks', model: 'serviceDesk' },
            { key: 'serviceCategories', model: 'serviceCategory' },
            { key: 'requestTypes', model: 'requestType' },
            { key: 'workflowTypes', model: 'workflowType' },
            { key: 'workflowSteps', model: 'workflowStep' },
            { key: 'workflowTransitions', model: 'workflowTransition' },
            { key: 'entities', model: 'entity' },
            { key: 'assets', model: 'asset' },
            { key: 'notificationTemplates', model: 'notificationTemplate' },
            { key: 'bannerConfigs', model: 'bannerConfig' },
            { key: 'statusDefinitions', model: 'requestStatusDefinition' },
            { key: 'escalationRules', model: 'escalationRule' },
            { key: 'onboardingTemplates', model: 'onboardingTaskTemplate' },
            { key: 'offboardingTemplates', model: 'offboardingTaskTemplate' },
            { key: 'kbArticles', model: 'knowledgeBaseArticle' },
        ];

        for (const { key, model } of preservedFields) {
            try {
                const count = await (prisma as any)[model].count();
                if (count > 0) console.log(`  ✅ ${key}: ${count} preserved`);
            } catch {
                // Model doesn't exist in this schema version — skip
            }
        }
        return;
    }

    // Delete in dependency order (child → parent)
    // Prisma deleteMany() does NOT trigger ON CASCADE, so we must
    // delete in reverse FK dependency order.
    console.log('\nDeleting ticket data...');

    const del = async (label: string, model: string) => {
        try {
            const result = await (prisma as any)[model].deleteMany({});
            console.log(`  ✅ ${label}: ${result.count} deleted`);
        } catch (e: any) {
            console.log(`  ⚠️  ${label}: skipped (${e.message?.substring(0, 80)})`);
        }
    };

    // Notifications (reference requestId)
    await del('Notifications', 'notification');
    // Audit logs (may reference request actions)
    await del('Audit logs', 'auditLog');
    // Sessions & password reset tokens (stale auth data)
    await del('Sessions', 'session');
    await del('Password reset tokens', 'passwordResetToken');

    // Child records in reverse FK dependency order
    await del('Onboarding tasks', 'onboardingTask');
    await del('Offboarding tasks', 'offboardingTask');
    await del('Expense line items', 'expenseLineItem');
    await del('Interview feedbacks', 'interviewFeedback');
    await del('Interview schedules', 'interviewSchedule');
    await del('Candidate resumes', 'candidateResume');
    await del('HR screenings', 'hRScreening');
    await del('Letters of acceptance', 'letterOfAcceptance');
    await del('Request participants', 'requestParticipant');
    await del('Request items', 'requestItem');
    await del('IT hardware requests', 'iTHardwareRequest');
    await del('HR leave requests', 'hRLeaveRequest');
    await del('Expense reimbursements', 'financeExpenseReimbursement');
    await del('Onboarding requests', 'onboardingRequest');
    await del('Offboarding requests', 'offboardingRequest');

    // Request direct children
    await del('Request approvals', 'requestApproval');
    await del('Request activities', 'requestActivity');
    await del('Request attachments', 'requestAttachment');

    // Finally, delete all Requests
    const deletedRequests = await prisma.request.deleteMany({});
    console.log(`  ✅ Requests: ${deletedRequests.count} deleted`);

    // Verify
    const remainingRequests = await prisma.request.count();
    console.log(`\n🎉 Done! ${remainingRequests} requests remaining in database.`);

    // Confirm preserved data
    console.log('\nPreserved admin config & reference data:');
    const preserved = [
        { label: 'Users', model: 'user' },
        { label: 'Roles', model: 'role' },
        { label: 'Service desks', model: 'serviceDesk' },
        { label: 'Request types', model: 'requestType' },
        { label: 'Workflow steps', model: 'workflowStep' },
        { label: 'Entities', model: 'entity' },
        { label: 'Assets', model: 'asset' },
    ];
    for (const { label, model } of preserved) {
        try {
            const count = await (prisma as any)[model].count();
            console.log(`  ✅ ${label}: ${count}`);
        } catch {
            // skip
        }
    }
}

main()
    .catch((e) => {
        console.error('❌ Error clearing tickets:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });