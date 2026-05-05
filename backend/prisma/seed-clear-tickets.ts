// ═══════════════════════════════════════════════════════════════
// CLEAR ALL TICKETS — Removes all requests and dependent data
// Preserves: users, roles, permissions, service desks, categories,
//           request types, workflows, admin config, entities, KB articles
//
// Usage:
//   npx tsx prisma/seed-clear-tickets.ts
//
// Dry run (shows what would be deleted without actually deleting):
//   DRY_RUN=true npx tsx prisma/seed-clear-tickets.ts
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
    const counts = {
        requests: await prisma.request.count(),
        requestActivities: await prisma.requestActivity.count(),
        requestAttachments: await prisma.requestAttachment.count(),
        requestApprovals: await prisma.requestApproval.count(),
        itHardwareRequests: await prisma.iTHardwareRequest.count(),
        hrLeaveRequests: await prisma.hRLeaveRequest.count(),
        expenseReimbursements: await prisma.financeExpenseReimbursement.count(),
        expenseLineItems: await prisma.expenseLineItem.count(),
        candidateResumes: await prisma.candidateResume.count(),
        interviewSchedules: await prisma.interviewSchedule.count(),
        interviewFeedbacks: await prisma.interviewFeedback.count(),
        hrScreenings: await prisma.hRScreening.count(),
        letterOfAcceptances: await prisma.letterOfAcceptance.count(),
        onboardingRequests: await prisma.onboardingRequest.count(),
        onboardingTasks: await prisma.onboardingTask.count(),
        offboardingRequests: await prisma.offboardingRequest.count(),
        offboardingTasks: await prisma.offboardingTask.count(),
        notifications: await prisma.notification.count(),
        auditLogs: await prisma.auditLog.count(),
        passwordResetTokens: await prisma.passwordResetToken.count(),
        sessions: await prisma.session.count(),
    };

    console.log('Current record counts:');
    for (const [table, count] of Object.entries(counts)) {
        if (count > 0) {
            console.log(`  ${table}: ${count}`);
        }
    }

    if (counts.requests === 0) {
        console.log('\n✅ No requests found — database is already clear.');
        return;
    }

    if (DRY_RUN) {
        console.log(`\n⚠️  Would delete ${counts.requests} requests and all related records above.`);
        return;
    }

    // Delete in dependency order (child → parent)
    // Some of these are cascade-deleted by Request, but we delete explicitly
    // to avoid FK violations in edge cases and to get accurate counts.

    console.log('\nDeleting ticket data...');

    // Notifications (reference requestId)
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`  ✅ Notifications: ${deletedNotifications.count} deleted`);

    // Audit logs (may reference request actions)
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`  ✅ Audit logs: ${deletedAuditLogs.count} deleted`);

    // Sessions & password reset tokens (stale auth data)
    const deletedSessions = await prisma.session.deleteMany({});
    console.log(`  ✅ Sessions: ${deletedSessions.count} deleted`);

    const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({});
    console.log(`  ✅ Password reset tokens: ${deletedPasswordTokens.count} deleted`);

    // Delete child records first — Prisma deleteMany() does NOT trigger ON CASCADE,
    // so we must delete in reverse FK dependency order.

    // Onboarding tasks → OnboardingRequest → Request
    const deletedOnboardingTasks = await prisma.onboardingTask.deleteMany({});
    console.log(`  ✅ Onboarding tasks: ${deletedOnboardingTasks.count} deleted`);

    // Offboarding tasks → OffboardingRequest → Request
    const deletedOffboardingTasks = await prisma.offboardingTask.deleteMany({});
    console.log(`  ✅ Offboarding tasks: ${deletedOffboardingTasks.count} deleted`);

    // Expense line items → FinanceExpenseReimbursement → Request
    const deletedLineItems = await prisma.expenseLineItem.deleteMany({});
    console.log(`  ✅ Expense line items: ${deletedLineItems.count} deleted`);

    // Interview feedback → InterviewSchedule → CandidateResume → Request
    // (InterviewSchedule has FK to CandidateResume, so delete feedback → schedule → resume)
    const deletedInterviewFeedbacks = await prisma.interviewFeedback.deleteMany({});
    console.log(`  ✅ Interview feedbacks: ${deletedInterviewFeedbacks.count} deleted`);

    const deletedInterviewSchedules = await prisma.interviewSchedule.deleteMany({});
    console.log(`  ✅ Interview schedules: ${deletedInterviewSchedules.count} deleted`);

    // Candidate resumes (InterviewSchedule FK removed above)
    const deletedCandidateResumes = await prisma.candidateResume.deleteMany({});
    console.log(`  ✅ Candidate resumes: ${deletedCandidateResumes.count} deleted`);

    // HR screening → Request
    const deletedHrScreenings = await prisma.hRScreening.deleteMany({});
    console.log(`  ✅ HR screenings: ${deletedHrScreenings.count} deleted`);

    // Letter of acceptance → Request
    const deletedLoa = await prisma.letterOfAcceptance.deleteMany({});
    console.log(`  ✅ Letters of acceptance: ${deletedLoa.count} deleted`);

    // IT hardware request, HR leave request, expense reimbursement → Request
    const deletedItHardware = await prisma.iTHardwareRequest.deleteMany({});
    console.log(`  ✅ IT hardware requests: ${deletedItHardware.count} deleted`);

    const deletedHrLeaveReqs = await prisma.hRLeaveRequest.deleteMany({});
    console.log(`  ✅ HR leave requests: ${deletedHrLeaveReqs.count} deleted`);

    const deletedExpenseReimbs = await prisma.financeExpenseReimbursement.deleteMany({});
    console.log(`  ✅ Expense reimbursements: ${deletedExpenseReimbs.count} deleted`);

    // Onboarding/Offboarding requests → Request
    const deletedOnboardingReqs = await prisma.onboardingRequest.deleteMany({});
    console.log(`  ✅ Onboarding requests: ${deletedOnboardingReqs.count} deleted`);

    const deletedOffboardingReqs = await prisma.offboardingRequest.deleteMany({});
    console.log(`  ✅ Offboarding requests: ${deletedOffboardingReqs.count} deleted`);

    // Request approvals, activities, attachments → Request
    const deletedApprovals = await prisma.requestApproval.deleteMany({});
    console.log(`  ✅ Request approvals: ${deletedApprovals.count} deleted`);

    const deletedActivities = await prisma.requestActivity.deleteMany({});
    console.log(`  ✅ Request activities: ${deletedActivities.count} deleted`);

    const deletedAttachments = await prisma.requestAttachment.deleteMany({});
    console.log(`  ✅ Request attachments: ${deletedAttachments.count} deleted`);

    // Finally, delete all Requests
    const deletedRequests = await prisma.request.deleteMany({});
    console.log(`  ✅ Requests: ${deletedRequests.count} deleted`);

    // Verify
    const remainingRequests = await prisma.request.count();
    console.log(`\n🎉 Done! ${remainingRequests} requests remaining in database.`);

    // Confirm preserved data
    const preserved = {
        users: await prisma.user.count(),
        serviceDesks: await prisma.serviceDesk.count(),
        serviceCategories: await prisma.serviceCategory.count(),
        requestTypes: await prisma.requestType.count(),
        workflowTypes: await prisma.workflowType.count(),
        workflowSteps: await prisma.workflowStep.count(),
        entities: await prisma.entity.count(),
        notificationTemplates: await prisma.notificationTemplate.count(),
        bannerConfigs: await prisma.bannerConfig.count(),
        statusDefinitions: await prisma.requestStatusDefinition.count(),
        workflowTransitions: await prisma.workflowTransition.count(),
        escalationRules: await prisma.escalationRule.count(),
        onboardingTemplates: await prisma.onboardingTaskTemplate.count(),
        offboardingTemplates: await prisma.offboardingTaskTemplate.count(),
        kbArticles: await prisma.knowledgeBaseArticle.count(),
        assets: await prisma.asset.count(),
    };

    console.log('\nPreserved admin config & reference data:');
    for (const [table, count] of Object.entries(preserved)) {
        if (count > 0) {
            console.log(`  ✅ ${table}: ${count} preserved`);
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