import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create Service Desks
    const itDesk = await prisma.serviceDesk.upsert({
        where: { code: 'IT' },
        update: {},
        create: {
            name: 'IT Support',
            code: 'IT',
            description: 'Technical support for hardware, software, and infrastructure',
            isActive: true,
        },
    });

    const hrDesk = await prisma.serviceDesk.upsert({
        where: { code: 'HR' },
        update: {},
        create: {
            name: 'HR Services',
            code: 'HR',
            description: 'Human resources support for employees',
            isActive: true,
        },
    });

    const financeDesk = await prisma.serviceDesk.upsert({
        where: { code: 'FINANCE' },
        update: {},
        create: {
            name: 'Group Finance',
            code: 'FINANCE',
            description: 'Financial services and expense management',
            isActive: true,
        },
    });

    console.log('✅ Service desks created');

    // Create Roles
    const adminRole = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: {
            name: 'ADMIN',
            description: 'System administrator with full access',
        },
    });

    const agentRole = await prisma.role.upsert({
        where: { name: 'AGENT' },
        update: {},
        create: {
            name: 'AGENT',
            description: 'Service desk agent who handles requests',
        },
    });

    const userRole = await prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: {
            name: 'USER',
            description: 'Regular user who can create requests',
        },
    });

    const ceoRole = await prisma.role.upsert({
        where: { name: 'CEO' },
        update: {},
        create: {
            name: 'CEO',
            description: 'Chief Executive Officer with approval authority',
        },
    });

    const ctoRole = await prisma.role.upsert({
        where: { name: 'CTO' },
        update: {},
        create: {
            name: 'CTO',
            description: 'Chief Technology Officer with IT approval authority',
        },
    });

    const cfoRole = await prisma.role.upsert({
        where: { name: 'CFO' },
        update: {},
        create: {
            name: 'CFO',
            description: 'Chief Financial Officer with finance approval authority',
        },
    });

    await prisma.role.upsert({
        where: { name: 'GROUP_CEO' },
        update: {},
        create: {
            name: 'GROUP_CEO',
            description: 'Group Chief Executive Officer with highest approval authority',
        },
    });

    await prisma.role.upsert({
        where: { name: 'HIRING_MANAGER' },
        update: {},
        create: { name: 'HIRING_MANAGER', description: 'Can raise and manage HR hiring requests' }
    });

    console.log('✅ Roles created');

    // Create Permissions
    const permissions = [
        { name: 'request:create', resource: 'request', action: 'create', description: 'Create new requests' },
        { name: 'request:read', resource: 'request', action: 'read', description: 'View requests' },
        { name: 'request:update', resource: 'request', action: 'update', description: 'Update requests' },
        { name: 'request:delete', resource: 'request', action: 'delete', description: 'Delete requests' },
        { name: 'user:manage', resource: 'user', action: 'manage', description: 'Manage users' },
        { name: 'admin:access', resource: 'admin', action: 'access', description: 'Access admin panel' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }

    console.log('✅ Permissions created');

    // Create Admin User
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@helpdesk.com' },
        update: {},
        create: {
            email: 'admin@helpdesk.com',
            passwordHash: hashedPassword,
            firstName: 'System',
            lastName: 'Administrator',
            department: 'IT',
            jobTitle: 'System Administrator',
            isActive: true,
        },
    });

    // Assign admin role
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            roleId: adminRole.id,
        },
    });

    console.log('✅ Admin user created (email: admin@helpdesk.com, password: admin123)');

    // Create CEO User
    const ceoHashedPassword = await bcrypt.hash('ceo123', 10);

    const ceoUser = await prisma.user.upsert({
        where: { email: 'ceo@company.com' },
        update: {},
        create: {
            email: 'ceo@company.com',
            passwordHash: ceoHashedPassword,
            firstName: 'Chief',
            lastName: 'Executive',
            department: 'Executive',
            jobTitle: 'Chief Executive Officer',
            isActive: true,
        },
    });

    // Assign CEO role
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: ceoUser.id,
                roleId: ceoRole.id,
            },
        },
        update: {},
        create: {
            userId: ceoUser.id,
            roleId: ceoRole.id,
        },
    });

    console.log('✅ CEO user created (email: ceo@company.com, password: ceo123)');

    // Create CTO User
    const ctoHashedPassword = await bcrypt.hash('cto123', 10);
    const ctoUser = await prisma.user.upsert({
        where: { email: 'cto@company.com' },
        update: {},
        create: {
            email: 'cto@company.com',
            firstName: 'Alex',
            lastName: 'Tech',
            passwordHash: ctoHashedPassword,
            isActive: true,
        },
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ctoUser.id, roleId: ctoRole.id } },
        update: {},
        create: { userId: ctoUser.id, roleId: ctoRole.id },
    });

    console.log('✅ CTO user created (email: cto@company.com, password: cto123)');

    // Create CFO User
    const cfoHashedPassword = await bcrypt.hash('cfo123', 10);
    const cfoUser = await prisma.user.upsert({
        where: { email: 'cfo@company.com' },
        update: {},
        create: {
            email: 'cfo@company.com',
            firstName: 'Jordan',
            lastName: 'Finance',
            passwordHash: cfoHashedPassword,
            isActive: true,
        },
    });

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: cfoUser.id, roleId: cfoRole.id } },
        update: {},
        create: { userId: cfoUser.id, roleId: cfoRole.id },
    });

    console.log('✅ CFO user created (email: cfo@company.com, password: cfo123)');

    // Create Test Users
    const testUsers = [
        {
            email: 'john.doe@company.com',
            firstName: 'John',
            lastName: 'Doe',
            department: 'Engineering',
            jobTitle: 'Software Engineer',
        },
        {
            email: 'jane.smith@company.com',
            firstName: 'Jane',
            lastName: 'Smith',
            department: 'Marketing',
            jobTitle: 'Marketing Manager',
        },
        {
            email: 'agent@helpdesk.com',
            firstName: 'Support',
            lastName: 'Agent',
            department: 'IT',
            jobTitle: 'IT Support Specialist',
        },
    ];

    const testPassword = await bcrypt.hash('password123', 10);

    for (const userData of testUsers) {
        const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: {
                ...userData,
                passwordHash: testPassword,
                isActive: true,
            },
        });

        // Assign user role to regular users
        if (userData.email !== 'agent@helpdesk.com') {
            await prisma.userRole.upsert({
                where: {
                    userId_roleId: {
                        userId: user.id,
                        roleId: userRole.id,
                    },
                },
                update: {},
                create: {
                    userId: user.id,
                    roleId: userRole.id,
                },
            });
        } else {
            // Assign agent role
            await prisma.userRole.upsert({
                where: {
                    userId_roleId: {
                        userId: user.id,
                        roleId: agentRole.id,
                    },
                },
                update: {},
                create: {
                    userId: user.id,
                    roleId: agentRole.id,
                },
            });
        }
    }

    console.log('✅ Test users created (password: password123)');

    // Create Service Categories for IT
    const itCategories = [
        { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1 },
        { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2 },
        { name: 'Report System problem', icon: 'report', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3 },
        { name: 'Request Software Installation', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4 },
        { name: 'Request new hardware', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5 },
    ];

    for (const category of itCategories) {
        const cat = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: itDesk.id,
                    name: category.name
                }
            },
            update: {
                icon: category.icon,
                colorClass: category.colorClass,
                displayOrder: category.displayOrder,
                isActive: true
            },
            create: {
                ...category,
                serviceDeskId: itDesk.id,
                isActive: true,
            },
        });

        // Add a default request type with a sample form configuration
        let formConfig: any[] = [];
        if (category.name === 'Request new hardware') {
            formConfig = [
                { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
                { id: 'hardwareModel', label: 'Preferred Model', type: 'text', required: false },
                { id: 'estimatedPrice', label: 'Estimated Price (USD)', type: 'currency', required: false },
                { id: 'preferredVendor', label: 'Preferred Vendor', type: 'text', required: false },
                { id: 'productUrl', label: 'Product URL', type: 'text', required: false },
                { id: 'businessJustification', label: 'Business Justification', type: 'textarea', required: true }
            ];
        } else if (category.name === 'Request Software Installation') {
            formConfig = [
                { id: 'sw_name', label: 'Software Name', type: 'text', required: true },
                { id: 'sw_version', label: 'Version Number', type: 'text', required: false }
            ];
        }

        // Check if request type already exists for this category
        const existingType = await prisma.requestType.findFirst({
            where: {
                serviceCategoryId: cat.id,
                name: `General ${category.name} Request`
            }
        });

        if (!existingType) {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: cat.id,
                    name: `General ${category.name} Request`,
                    description: `Submit a request for ${category.name.toLowerCase()} assistance.`,
                    icon: category.icon,
                    formConfig,
                    isActive: true,
                    ...(category.name === 'Request new hardware' ? { slaHours: 72, requiresApproval: true } : {}),
                }
            });
        } else if (category.name === 'Request new hardware') {
            await prisma.requestType.update({
                where: { id: existingType.id },
                data: { formConfig, slaHours: 72, requiresApproval: true }
            });
        }
    }

    console.log('✅ Service categories created');

    // Create Service Categories for HR
    const hrCategoriesData = [
        { name: 'Leave Management', description: 'Apply for leave, check balance', icon: 'event_available', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1 },
        { name: 'Payroll & Compensation', description: 'Salary queries, tax forms, payslips', icon: 'payments', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2 },
        { name: 'Benefits & Claims', description: 'Medical claims, insurance, benefits enrollment', icon: 'health_and_safety', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 3 },
        { name: 'New Hire Request', description: 'Request to hire for a position', icon: 'person_add', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4 },
    ];

    for (const cat of hrCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: hrDesk.id,
                    name: cat.name
                }
            },
            update: {
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                isActive: true
            },
            create: {
                ...cat,
                serviceDeskId: hrDesk.id,
                isActive: true,
            },
        });

        // Check if request type already exists for this category
        const existingType = await prisma.requestType.findFirst({
            where: {
                serviceCategoryId: category.id,
                name: cat.name
            }
        });

        const newHireFormConfig = cat.name === 'New Hire Request' ? [
            { id: 'position', label: 'Position / Job Title', type: 'text', required: true },
            { id: 'department', label: 'Department', type: 'text', required: true },
            { id: 'candidateName', label: 'Candidate Full Name', type: 'text', required: false },
            { id: 'candidateEmail', label: 'Candidate Email', type: 'text', required: false },
            { id: 'headcount', label: 'Number of Headcount', type: 'text', required: false },
            { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
        ] : [];

        if (!existingType) {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: category.id,
                    name: cat.name,
                    description: cat.description,
                    slaHours: 48,
                    isActive: true,
                    requiredRole: cat.name === 'New Hire Request' ? 'HIRING_MANAGER' : null,
                    ...(cat.name === 'New Hire Request' ? { formConfig: newHireFormConfig } : {}),
                },
            });
        } else if (cat.name === 'New Hire Request') {
            await prisma.requestType.update({
                where: { id: existingType.id },
                data: {
                    requiredRole: 'HIRING_MANAGER',
                    formConfig: newHireFormConfig,
                },
            });
        }
    }

    console.log('✅ HR categories created');

    // Create Service Categories for Finance
    const finCategoriesData = [
        { name: 'Expense Reimbursement', description: 'Submit expense claims for reimbursement', icon: 'receipt_long', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1 },
        { name: 'Invoice Processing', description: 'Submit or query vendor invoices', icon: 'description', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2 },
        { name: 'Budget Approval', description: 'Request budget allocation or transfer', icon: 'account_balance', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 3 },
    ];

    for (const cat of finCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: financeDesk.id,
                    name: cat.name
                }
            },
            update: {
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                isActive: true
            },
            create: {
                ...cat,
                serviceDeskId: financeDesk.id,
                isActive: true,
            },
        });

        // Check if request type already exists for this category
        const existingType = await prisma.requestType.findFirst({
            where: {
                serviceCategoryId: category.id,
                name: cat.name
            }
        });

        if (!existingType) {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: category.id,
                    name: cat.name,
                    description: cat.description,
                    slaHours: 72,
                    isActive: true,
                },
            });
        }
    }

    console.log('✅ Finance categories created');

    // Create Notification Templates
    const templates = [
        {
            name: 'request_created',
            eventType: 'REQUEST_CREATED',
            emailSubject: 'New Request Created - {{referenceNumber}}',
            emailBody: 'Your request {{referenceNumber}} has been created successfully. We will review it shortly.',
            pushTitle: 'Request Created',
            pushBody: 'Your request {{referenceNumber}} has been submitted.',
        },
        {
            name: 'request_status_changed',
            eventType: 'STATUS_CHANGED',
            emailSubject: 'Request {{referenceNumber}} - Status Updated',
            emailBody: 'The status of your request {{referenceNumber}} has been updated to {{newStatus}}.',
            pushTitle: 'Status Updated',
            pushBody: 'Request {{referenceNumber}} is now {{newStatus}}.',
        },
        {
            name: 'request_assigned',
            eventType: 'REQUEST_ASSIGNED',
            emailSubject: 'Request {{referenceNumber}} - Assigned to You',
            emailBody: 'You have been assigned to request {{referenceNumber}}: {{summary}}. Please review and take action.',
            pushTitle: 'New Assignment',
            pushBody: 'Request {{referenceNumber}} assigned to you.',
        },
        {
            name: 'comment_added',
            eventType: 'COMMENT_ADDED',
            emailSubject: 'New Comment on Request {{referenceNumber}}',
            emailBody: 'A new comment has been added to request {{referenceNumber}}. Please check the request for details.',
            pushTitle: 'New Comment',
            pushBody: 'New comment on {{referenceNumber}}.',
        },
        {
            name: 'sla_breached',
            eventType: 'SLA_BREACHED',
            emailSubject: 'SLA Breach Alert - Request {{referenceNumber}}',
            emailBody: 'Request {{referenceNumber}} has exceeded its SLA deadline. Please take immediate action.',
            pushTitle: 'SLA Breach',
            pushBody: 'Request {{referenceNumber}} has breached its SLA.',
        },
    ];

    for (const template of templates) {
        await prisma.notificationTemplate.upsert({
            where: { name: template.name },
            update: {},
            create: template,
        });
    }

    console.log('✅ Notification templates created');

    // Seed onboarding task templates
    const existingTemplates = await prisma.onboardingTaskTemplate.count();
    if (existingTemplates === 0) {
        await prisma.onboardingTaskTemplate.createMany({
            data: [
                { taskName: 'Create Active Directory Account', taskDescription: 'Set up AD account with appropriate permissions', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: -5, displayOrder: 1 },
                { taskName: 'Setup Email Account', taskDescription: 'Create company email account and configure mailbox', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: -5, displayOrder: 2 },
                { taskName: 'Provision Laptop/Desktop', taskDescription: 'Prepare and configure hardware with required software', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: -3, displayOrder: 3 },
                { taskName: 'Create Access Badge', taskDescription: 'Prepare physical access badge for building entry', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: -2, displayOrder: 4 },
                { taskName: 'Setup Desk/Workspace', taskDescription: 'Prepare workstation with necessary equipment', taskCategory: 'ADMIN', priority: 'MEDIUM', dueDayOffset: -1, displayOrder: 5 },
                { taskName: 'Complete I-9 Form', taskDescription: 'Employment eligibility verification', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 6 },
                { taskName: 'Complete W-4 Tax Form', taskDescription: 'Federal tax withholding form', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 7 },
                { taskName: 'Acknowledge Company Policies', taskDescription: 'Review and sign employee handbook', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: 0, displayOrder: 8 },
                { taskName: 'Complete Security Training', taskDescription: 'Mandatory cybersecurity awareness training', taskCategory: 'TRAINING', priority: 'HIGH', dueDayOffset: 7, displayOrder: 9 },
                { taskName: 'Complete Compliance Training', taskDescription: 'Regulatory compliance and ethics training', taskCategory: 'TRAINING', priority: 'HIGH', dueDayOffset: 7, displayOrder: 10 },
                { taskName: 'Department Orientation', taskDescription: 'Introduction to team and department processes', taskCategory: 'TRAINING', priority: 'MEDIUM', dueDayOffset: 7, displayOrder: 11 },
                { taskName: 'Enroll in Benefits', taskDescription: 'Health insurance, 401k, and other benefits enrollment', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: 30, displayOrder: 12 },
            ],
        });
        console.log('✅ Onboarding task templates seeded');
    } else {
        console.log('⏭️  Onboarding task templates already exist, skipping');
    }


    // Banner Configs — default configs matching former hardcoded ActionBanner logic
    const defaultBanners = [
        // Staff role
        { role: 'staff', status: 'SUBMITTED',       icon: 'hourglass_top', title: 'Request Submitted',           description: 'Your request has been received and is waiting to be picked up by our team.', colorScheme: 'blue'    },
        { role: 'staff', status: 'IN_REVIEW',        icon: 'visibility',    title: 'Under Review',                description: '{{assignedToName}} is reviewing your request.',                            colorScheme: 'indigo'  },
        { role: 'staff', status: 'IN_PROGRESS',      icon: 'engineering',   title: 'In Progress',                 description: '{{assignedToName}} is working on your request.',                           colorScheme: 'blue'    },
        { role: 'staff', status: 'ACTION_REQUIRED',  icon: 'warning',       title: 'Action Required From You',    description: 'The team needs more information. Please check the comments below.',         colorScheme: 'orange'  },
        { role: 'staff', status: 'RESOLVED',         icon: 'check_circle',  title: 'Resolved',                    description: 'Your request has been completed.',                                         colorScheme: 'green'   },
        { role: 'staff', status: 'COMPLETED',        icon: 'check_circle',  title: 'Resolved',                    description: 'Your request has been completed.',                                         colorScheme: 'green'   },
        // Agent role
        { role: 'agent', status: 'PENDING_CEO_APPROVAL',       icon: 'hourglass_top',  title: 'Pending CEO Approval',            description: '{{assignedToName}} has routed this request to the CEO for approval.',    colorScheme: 'purple'  },
        { role: 'agent', status: 'CEO_APPROVED',               icon: 'work',           title: 'Next Step: Post the Job',         description: 'CEO has approved. Mark the job as posted to proceed.',                   colorScheme: 'blue'    },
        { role: 'agent', status: 'MANAGER_APPROVED',           icon: 'calendar_month', title: 'Next Step: Schedule Interview',   description: 'Hiring manager selected a candidate. Schedule the interview.',             colorScheme: 'indigo'  },
        { role: 'agent', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'play_arrow',     title: 'Next Step: Start HR Screening',   description: 'Interview feedback received. Begin background and reference checks.',      colorScheme: 'blue'    },
        { role: 'agent', status: 'LOA_APPROVED',               icon: 'send',           title: 'Next Step: Issue LOA to Candidate', description: 'Hiring manager has approved the LOA. Issue it to the candidate.',     colorScheme: 'emerald' },
        { role: 'agent', status: 'PENDING_INVOICE_IT',         icon: 'receipt_long',   title: 'Pending Invoice',                 description: 'Waiting for invoice to be submitted before processing.',                colorScheme: 'amber'   },
        { role: 'agent', status: 'PENDING_CFO_APPROVAL_IT',    icon: 'approval',       title: 'Pending CFO Approval',            description: 'Invoice submitted. Awaiting CFO sign-off.',                             colorScheme: 'purple'  },
        { role: 'agent', status: 'PAYMENT_PROCESSING_IT',      icon: 'payments',       title: 'Payment Processing',              description: 'CFO has approved. Payment is being processed.',                          colorScheme: 'blue'    },
        { role: 'agent', status: 'PAYMENT_DONE_IT',            icon: 'check_circle',   title: 'Payment Completed',               description: 'Payment has been made. Pending delivery.',                               colorScheme: 'green'   },
        // CEO role
        { role: 'ceo', status: 'PENDING_CEO_APPROVAL',         icon: 'approval',       title: 'Your Approval Required',          description: 'This hiring request needs your approval to proceed. Review the details and make a decision.',          colorScheme: 'purple' },
        { role: 'ceo', status: 'PENDING_MANAGER_APPROVAL_IT',  icon: 'approval',       title: 'Your Approval Required',          description: 'This IT request has been routed to you for sign-off. Review the details and approve or reject.',       colorScheme: 'blue'   },
        // Hiring Manager role
        { role: 'hiring_manager', status: 'PENDING_MANAGER_REVIEW',  icon: 'rate_review',   title: 'Your Action: Review Candidates',        description: 'Candidate resumes are ready for your review. Select a candidate to proceed.',                 colorScheme: 'orange'  },
        { role: 'hiring_manager', status: 'INTERVIEW_SCHEDULED',     icon: 'feedback',      title: 'Your Action: Submit Interview Feedback', description: 'The interview has been completed. Please submit your feedback and decision.',                colorScheme: 'indigo'  },
        { role: 'hiring_manager', status: 'PENDING_CEO_APPROVAL',    icon: 'hourglass_top', title: 'Waiting: CEO Approval',                  description: 'Your hiring request is pending CEO approval. You will be notified when a decision is made.',   colorScheme: 'purple'  },
        { role: 'hiring_manager', status: 'HR_SCREENING',            icon: 'fact_check',    title: 'In Progress: HR Screening',              description: 'Background and reference checks are being conducted by HR.',                                  colorScheme: 'blue'    },
        { role: 'hiring_manager', status: 'LOA_PENDING_APPROVAL',    icon: 'approval',      title: 'Your Action: Approve / Reject LOA',      description: 'Review the Letter of Acceptance and make an approval decision.',                              colorScheme: 'indigo'  },
    ];

    for (const banner of defaultBanners) {
        await prisma.bannerConfig.upsert({
            where: { role_status: { role: banner.role, status: banner.status } },
            update: {},
            create: { ...banner, isActive: true },
        });
    }
    console.log(`Seeded ${defaultBanners.length} default banner configs`);

    // Request Status Definitions
    const statusDefinitions = [
        // GENERAL
        { code: 'SUBMITTED',           label: 'Submitted',              category: 'GENERAL', displayOrder: 1 },
        { code: 'IN_REVIEW',           label: 'In Review',              category: 'GENERAL', displayOrder: 2 },
        { code: 'ACTION_REQUIRED',     label: 'Action Required',        category: 'GENERAL', displayOrder: 3 },
        { code: 'APPROVED',            label: 'Approved',               category: 'GENERAL', displayOrder: 4 },
        { code: 'REJECTED',            label: 'Rejected',               category: 'GENERAL', displayOrder: 5 },
        { code: 'RESOLVED',            label: 'Resolved',               category: 'GENERAL', displayOrder: 6 },
        { code: 'IN_PROGRESS',         label: 'In Progress',            category: 'GENERAL', displayOrder: 7 },
        { code: 'WAITING',             label: 'Waiting',                category: 'GENERAL', displayOrder: 8 },
        { code: 'COMPLETED',           label: 'Completed',              category: 'GENERAL', displayOrder: 9 },
        // HR / HIRING
        { code: 'PENDING_CEO_APPROVAL',            label: 'Pending CEO Approval',            category: 'HR', displayOrder: 10 },
        { code: 'CEO_APPROVED',                    label: 'CEO Approved',                    category: 'HR', displayOrder: 11 },
        { code: 'CEO_REJECTED',                    label: 'CEO Rejected',                    category: 'HR', displayOrder: 12 },
        { code: 'JOB_POSTED',                      label: 'Job Posted',                      category: 'HR', displayOrder: 13 },
        { code: 'PENDING_MANAGER_REVIEW',          label: 'Pending Manager Review',          category: 'HR', displayOrder: 14 },
        { code: 'MANAGER_APPROVED',                label: 'Manager Approved',                category: 'HR', displayOrder: 15 },
        { code: 'INTERVIEW_SCHEDULED',             label: 'Interview Scheduled',             category: 'HR', displayOrder: 16 },
        { code: 'INTERVIEW_FEEDBACK_PENDING',      label: 'Interview Feedback Pending',      category: 'HR', displayOrder: 17 },
        { code: 'CANDIDATE_REJECTED_INTERVIEW',    label: 'Candidate Rejected (Interview)',  category: 'HR', displayOrder: 18 },
        { code: 'HR_SCREENING',                    label: 'HR Screening',                    category: 'HR', displayOrder: 19 },
        { code: 'LOA_PENDING_APPROVAL',            label: 'LOA Pending Approval',            category: 'HR', displayOrder: 20 },
        { code: 'LOA_APPROVED',                    label: 'LOA Approved',                    category: 'HR', displayOrder: 21 },
        { code: 'LOA_ISSUED',                      label: 'LOA Issued',                      category: 'HR', displayOrder: 22 },
        { code: 'LOA_ACCEPTED',                    label: 'LOA Accepted',                    category: 'HR', displayOrder: 23 },
        // ONBOARDING
        { code: 'ONBOARDING_SUBMITTED',            label: 'Onboarding Submitted',            category: 'ONBOARDING', displayOrder: 30 },
        { code: 'ONBOARDING_PENDING_HR_APPROVAL',  label: 'Pending HR Approval',             category: 'ONBOARDING', displayOrder: 31 },
        { code: 'ONBOARDING_PRE_ARRIVAL_SETUP',    label: 'Pre-Arrival Setup',               category: 'ONBOARDING', displayOrder: 32 },
        { code: 'ONBOARDING_READY_FOR_DAY_1',      label: 'Ready for Day 1',                 category: 'ONBOARDING', displayOrder: 33 },
        { code: 'ONBOARDING_DAY_1_ORIENTATION',    label: 'Day 1 Orientation',               category: 'ONBOARDING', displayOrder: 34 },
        { code: 'ONBOARDING_WEEK_1_INTEGRATION',   label: 'Week 1 Integration',              category: 'ONBOARDING', displayOrder: 35 },
        { code: 'ONBOARDING_MONTH_1_MILESTONE',    label: 'Month 1 Milestone',               category: 'ONBOARDING', displayOrder: 36 },
        { code: 'ONBOARDING_MONTH_2_MILESTONE',    label: 'Month 2 Milestone',               category: 'ONBOARDING', displayOrder: 37 },
        { code: 'ONBOARDING_MONTH_3_MILESTONE',    label: 'Month 3 Milestone',               category: 'ONBOARDING', displayOrder: 38 },
        { code: 'ONBOARDING_COMPLETED',            label: 'Onboarding Completed',            category: 'ONBOARDING', displayOrder: 39 },
        // IT WORKFLOW
        { code: 'PENDING_MANAGER_APPROVAL_IT',     label: 'Pending Manager Approval (IT)',   category: 'IT', displayOrder: 40 },
        { code: 'MANAGER_APPROVED_IT',             label: 'Manager Approved (IT)',           category: 'IT', displayOrder: 41 },
        { code: 'MANAGER_REJECTED_IT',             label: 'Manager Rejected (IT)',           category: 'IT', displayOrder: 42 },
        { code: 'PENDING_VP_APPROVAL_IT',          label: 'Pending VP Approval (IT)',        category: 'IT', displayOrder: 43 },
        { code: 'VP_APPROVED_IT',                  label: 'VP Approved (IT)',                category: 'IT', displayOrder: 44 },
        { code: 'VP_REJECTED_IT',                  label: 'VP Rejected (IT)',                category: 'IT', displayOrder: 45 },
        { code: 'PROCUREMENT_IN_PROGRESS',         label: 'Procurement In Progress',         category: 'IT', displayOrder: 46 },
        { code: 'HARDWARE_ORDERED',                label: 'Hardware Ordered',                category: 'IT', displayOrder: 47 },
        { code: 'HARDWARE_RECEIVED',               label: 'Hardware Received',               category: 'IT', displayOrder: 48 },
        { code: 'SOFTWARE_PROVISIONED',            label: 'Software Provisioned',            category: 'IT', displayOrder: 49 },
        { code: 'ACKNOWLEDGED_IT',                 label: 'Acknowledged (IT)',               category: 'IT', displayOrder: 50 },
        { code: 'PENDING_CEO_APPROVAL_IT',         label: 'Pending CEO Approval (IT)',       category: 'IT', displayOrder: 51 },
        { code: 'CEO_APPROVED_IT',                 label: 'CEO Approved (IT)',               category: 'IT', displayOrder: 52 },
        { code: 'CEO_REJECTED_IT',                 label: 'CEO Rejected (IT)',               category: 'IT', displayOrder: 53 },
        { code: 'PENDING_CTO_APPROVAL_IT',         label: 'Pending CTO Approval (IT)',       category: 'IT', displayOrder: 54 },
        { code: 'CTO_APPROVED_IT',                 label: 'CTO Approved (IT)',               category: 'IT', displayOrder: 55 },
        { code: 'CTO_REJECTED_IT',                 label: 'CTO Rejected (IT)',               category: 'IT', displayOrder: 56 },
        { code: 'PENDING_INVOICE_IT',              label: 'Pending Invoice (IT)',            category: 'IT', displayOrder: 57 },
        { code: 'PENDING_CFO_APPROVAL_IT',         label: 'Pending CFO Approval (IT)',       category: 'IT', displayOrder: 58 },
        { code: 'CFO_APPROVED_IT',                 label: 'CFO Approved (IT)',               category: 'IT', displayOrder: 59 },
        { code: 'CFO_REJECTED_IT',                 label: 'CFO Rejected (IT)',               category: 'IT', displayOrder: 60 },
        { code: 'PAYMENT_PROCESSING_IT',           label: 'Payment Processing (IT)',         category: 'IT', displayOrder: 61 },
        { code: 'PAYMENT_DONE_IT',                 label: 'Payment Done (IT)',               category: 'IT', displayOrder: 62 },
        { code: 'PENDING_DELIVERY_IT',             label: 'Pending Delivery (IT)',           category: 'IT', displayOrder: 63 },
        // FINANCE WORKFLOW
        { code: 'PENDING_MANAGER_APPROVAL_FIN',    label: 'Pending Manager Approval (Finance)', category: 'FINANCE', displayOrder: 70 },
        { code: 'MANAGER_APPROVED_FIN',            label: 'Manager Approved (Finance)',         category: 'FINANCE', displayOrder: 71 },
        { code: 'MANAGER_REJECTED_FIN',            label: 'Manager Rejected (Finance)',         category: 'FINANCE', displayOrder: 72 },
        { code: 'PENDING_FINANCE_HEAD_APPROVAL',   label: 'Pending Finance Head Approval',      category: 'FINANCE', displayOrder: 73 },
        { code: 'FINANCE_HEAD_APPROVED',           label: 'Finance Head Approved',              category: 'FINANCE', displayOrder: 74 },
        { code: 'FINANCE_HEAD_REJECTED',           label: 'Finance Head Rejected',             category: 'FINANCE', displayOrder: 75 },
        { code: 'PAYMENT_PROCESSING',              label: 'Payment Processing',                 category: 'FINANCE', displayOrder: 76 },
        { code: 'PAYMENT_COMPLETED',               label: 'Payment Completed',                  category: 'FINANCE', displayOrder: 77 },
        { code: 'REIMBURSEMENT_CLOSED',            label: 'Reimbursement Closed',               category: 'FINANCE', displayOrder: 78 },
    ];

    for (const def of statusDefinitions) {
        await prisma.requestStatusDefinition.upsert({
            where: { code: def.code },
            update: { label: def.label, category: def.category, displayOrder: def.displayOrder },
            create: { ...def, isActive: true },
        });
    }
    console.log(`Seeded ${statusDefinitions.length} request status definitions`);
    console.log('🎉 Database seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
