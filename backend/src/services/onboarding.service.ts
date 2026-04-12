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

        if (!candidateResume || !loa) {
            console.error('❌ Cannot create onboarding: Missing candidate resume or LOA');
            console.error('  - Candidate Resume:', candidateResume ? 'Found' : 'Missing');
            console.error('  - LOA:', loa ? 'Found' : 'Missing');
            return null;
        }

        // Calculate start date (7 days after LOA acceptance)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        console.log('📅 Calculated start date:', startDate.toISOString());

        console.log('Creating onboarding request with data:', {
            requestId: request.id,
            newHireFirstName: candidateResume.candidateName?.split(' ')[0] || 'Unknown',
            newHireLastName: candidateResume.candidateName?.split(' ').slice(1).join(' ') || 'Unknown',
            newHireEmail: request.requesterEmail || 'unknown@example.com',
            jobTitle: request.customFields?.jobTitle || 'Not specified',
            department: request.customFields?.department || 'Not specified',
            hiringManagerId: request.requesterId,
        });

        // Create onboarding request
        const onboarding = await prisma.onboardingRequest.create({
            data: {
                requestId: request.id,
                newHireFirstName: candidateResume.candidateName?.split(' ')[0] || 'Unknown',
                newHireLastName: candidateResume.candidateName?.split(' ').slice(1).join(' ') || 'Unknown',
                newHireEmail: request.requesterEmail || 'unknown@example.com',
                newHirePhone: null,
                jobTitle: request.customFields?.jobTitle || 'Not specified',
                department: request.customFields?.department || 'Not specified',
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

        // Update request status
        console.log('Updating request status to ONBOARDING_SUBMITTED...');
        await prisma.request.update({
            where: { id: request.id },
            data: { status: 'ONBOARDING_SUBMITTED' },
        });
        console.log('✅ Request status updated');

        return onboarding;
    } catch (error) {
        console.error('❌ Error creating onboarding from hiring:', error);
        console.error('Error details:', error);
        return null;
    }
};

/**
 * Create default onboarding tasks
 */
export const createDefaultOnboardingTasks = async (onboardingId: string, startDate: Date) => {
    const tasks = [
        // IT Tasks (Pre-Arrival)
        {
            taskName: 'Create Active Directory Account',
            taskDescription: 'Set up AD account with appropriate permissions',
            taskCategory: 'IT',
            priority: 'CRITICAL',
            dueDate: new Date(startDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days before
        },
        {
            taskName: 'Setup Email Account',
            taskDescription: 'Create company email account and configure mailbox',
            taskCategory: 'IT',
            priority: 'CRITICAL',
            dueDate: new Date(startDate.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        {
            taskName: 'Provision Laptop/Desktop',
            taskDescription: 'Prepare and configure hardware with required software',
            taskCategory: 'IT',
            priority: 'HIGH',
            dueDate: new Date(startDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        },
        {
            taskName: 'Create Access Badge',
            taskDescription: 'Prepare physical access badge for building entry',
            taskCategory: 'IT',
            priority: 'HIGH',
            dueDate: new Date(startDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
        },
        {
            taskName: 'Setup Desk/Workspace',
            taskDescription: 'Prepare workstation with necessary equipment',
            taskCategory: 'ADMIN',
            priority: 'MEDIUM',
            dueDate: new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
        },
        // HR Tasks (Day 1)
        {
            taskName: 'Complete I-9 Form',
            taskDescription: 'Employment eligibility verification',
            taskCategory: 'HR',
            priority: 'CRITICAL',
            dueDate: startDate,
        },
        {
            taskName: 'Complete W-4 Tax Form',
            taskDescription: 'Federal tax withholding form',
            taskCategory: 'HR',
            priority: 'CRITICAL',
            dueDate: startDate,
        },
        {
            taskName: 'Acknowledge Company Policies',
            taskDescription: 'Review and sign employee handbook',
            taskCategory: 'HR',
            priority: 'HIGH',
            dueDate: startDate,
        },
        // Training Tasks (Week 1)
        {
            taskName: 'Complete Security Training',
            taskDescription: 'Mandatory cybersecurity awareness training',
            taskCategory: 'TRAINING',
            priority: 'HIGH',
            dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week after
        },
        {
            taskName: 'Complete Compliance Training',
            taskDescription: 'Regulatory compliance and ethics training',
            taskCategory: 'TRAINING',
            priority: 'HIGH',
            dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        {
            taskName: 'Department Orientation',
            taskDescription: 'Introduction to team and department processes',
            taskCategory: 'TRAINING',
            priority: 'MEDIUM',
            dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        // Benefits Enrollment (30 days)
        {
            taskName: 'Enroll in Benefits',
            taskDescription: 'Health insurance, 401k, and other benefits enrollment',
            taskCategory: 'HR',
            priority: 'HIGH',
            dueDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days after
        },
    ];

    await prisma.onboardingTask.createMany({
        data: tasks.map(task => ({
            onboardingId,
            ...task,
        })),
    });
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
