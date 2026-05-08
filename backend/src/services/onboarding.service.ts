import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create onboarding request from completed hiring workflow
 */
export const createOnboardingFromHiring = async (request: any) => {
    try {
        console.log('📋 createOnboardingFromHiring called with request ID:', request.id);

        // Get hiring data from request
        const candidateResume = await prisma.candidateResume.findFirst({
            where: { requestId: request.id },
        });
        console.log('Candidate Resume found:', candidateResume ? 'Yes' : 'No');

        const loa = await prisma.letterOfAcceptance.findFirst({
            where: { requestId: request.id },
        });
        console.log('LOA found:', loa ? 'Yes' : 'No');

        if (!loa) {
            console.error('❌ Cannot create onboarding: Missing LOA');
            return null;
        }

        // Resolve candidate name from resume, customFields.candidateName, or selectedCandidateName
        const cf = request.customFields as any || {};
        const rawName =
            candidateResume?.candidateName ||
            cf.candidateName ||
            cf.selectedCandidateName ||
            null;
        const nameParts = rawName ? rawName.trim().split(/\s+/) : [];
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

        // Resolve email: candidate email from form > requester email
        const candidateEmail = cf.candidateEmail || request.requesterEmail || 'unknown@example.com';

        // Resolve job title: form field 'position' > 'jobTitle' > fallback
        const jobTitle =
            cf.position ||
            cf.jobTitle ||
            'Not specified';

        // Resolve department: form field > fallback
        const department =
            cf.department ||
            'Not specified';

        // Calculate start date (7 days after LOA acceptance)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        console.log('📅 Calculated start date:', startDate.toISOString());

        // Look up HR service desk and "Onboard a New Hire" request type
        const hrServiceDesk = await prisma.serviceDesk.findFirst({
            where: { name: { contains: 'HR', mode: 'insensitive' } },
        });
        const onboardingRequestType = await prisma.requestType.findFirst({
            where: { name: { contains: 'Onboard', mode: 'insensitive' } },
        });

        // Generate next HR-N reference number
        const lastHrRequest = await prisma.request.findFirst({
            where: { referenceNumber: { startsWith: 'HR-' } },
            orderBy: { createdAt: 'desc' },
        });
        const nextNum = lastHrRequest
            ? parseInt(lastHrRequest.referenceNumber.split('-')[1], 10) + 1
            : 1;
        const referenceNumber = `HR-${nextNum}`;

        // Create a separate onboarding ticket linked back to the hiring request
        const onboardingTicket = await prisma.request.create({
            data: {
                referenceNumber,
                serviceDeskId: hrServiceDesk?.id,
                requestTypeId: onboardingRequestType?.id,
                requesterId: request.requesterId,
                requesterEmail: request.requesterEmail,
                summary: `Onboard New Hire: ${firstName} ${lastName} — ${jobTitle}`,
                description: `Auto-created onboarding ticket from hiring request ${request.referenceNumber}.`,
                priority: 'HIGH',
                status: 'ONBOARDING_SUBMITTED',
                assignedTeam: 'HR',
                parentRequestId: request.id,
            },
        });
        console.log('✅ Onboarding ticket created:', onboardingTicket.referenceNumber);

        // Create onboarding request linked to the NEW ticket (not the hiring ticket)
        const onboarding = await prisma.onboardingRequest.create({
            data: {
                requestId: onboardingTicket.id,
                newHireFirstName: firstName,
                newHireLastName: lastName,
                newHireEmail: candidateEmail,
                newHirePhone: null,
                jobTitle,
                department,
                hiringManagerId: request.requesterId,
                startDate,
                employmentType: 'FULL_TIME',
                overallStatus: 'PENDING',
                currentPhase: 'PRE_ARRIVAL',
            },
        });
        console.log('✅ Onboarding request created:', onboarding.id);

        // Create default onboarding tasks
        console.log('Creating default onboarding tasks...');
        await createDefaultOnboardingTasks(onboarding.id, startDate);
        console.log('✅ Default tasks created');

        // Leave hiring request as COMPLETED — add activity log linking to new ticket
        await prisma.requestActivity.create({
            data: {
                requestId: request.id,
                authorName: 'System',
                authorRole: 'SYSTEM',
                activityType: 'SYSTEM',
                message: `Onboarding ticket ${onboardingTicket.referenceNumber} auto-created for ${firstName} ${lastName}.`,
                isSystemGenerated: true,
            },
        });

        return { onboarding, onboardingTicket };
    } catch (error) {
        console.error('❌ Error creating onboarding from hiring:', error);
        console.error('Error details:', error);
        return null;
    }
};

/**
 * Create default onboarding tasks from DB templates
 */
export const createDefaultOnboardingTasks = async (onboardingId: string, startDate: Date) => {
    const templates = await prisma.onboardingTaskTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (templates.length === 0) {
        console.warn('⚠️  No active onboarding task templates found — no tasks created');
        return;
    }

    await prisma.onboardingTask.createMany({
        data: templates.map(template => ({
            onboardingId,
            taskName: template.taskName,
            taskDescription: template.taskDescription ?? undefined,
            taskCategory: template.taskCategory,
            priority: template.priority,
            dueDate: new Date(startDate.getTime() + template.dueDayOffset * 24 * 60 * 60 * 1000),
        })),
    });

    console.log(`✅ Created ${templates.length} onboarding tasks from templates`);
};

/**
 * Calculate onboarding completion percentage
 */
export const calculateOnboardingProgress = async (onboardingId: string) => {
    const onboarding = await prisma.onboardingRequest.findUnique({
        where: { id: onboardingId },
        include: { tasks: true },
    });

    if (!onboarding) {
        return null;
    }

    const totalTasks = onboarding.tasks.length;
    const completedTasks = onboarding.tasks.filter(t => t.status === 'COMPLETED').length;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
        totalTasks,
        completedTasks,
        completionPercentage: Math.round(completionPercentage),
    };
};

/**
 * Create user account when onboarding reaches PRE_ARRIVAL_SETUP
 */
export const createUserAccountForNewHire = async (onboardingId: string) => {
    try {
        const onboarding = await prisma.onboardingRequest.findUnique({
            where: { id: onboardingId },
        });

        if (!onboarding || onboarding.newHireId) {
            return null; // User already created
        }

        // Create user account (inactive until Day 1)
        const newUser = await prisma.user.create({
            data: {
                email: onboarding.newHireEmail,
                firstName: onboarding.newHireFirstName,
                lastName: onboarding.newHireLastName,
                phone: onboarding.newHirePhone,
                department: onboarding.department,
                jobTitle: onboarding.jobTitle,
                managerId: onboarding.hiringManagerId,
                isActive: false, // Will be activated on Day 1
                passwordHash: '', // Temporary, will be set during first login
            },
        });

        // Update onboarding with new hire user ID
        await prisma.onboardingRequest.update({
            where: { id: onboardingId },
            data: { newHireId: newUser.id },
        });

        return newUser;
    } catch (error) {
        console.error('Error creating user account for new hire:', error);
        return null;
    }
};

export default {
    createOnboardingFromHiring,
    createDefaultOnboardingTasks,
    calculateOnboardingProgress,
    createUserAccountForNewHire,
};
