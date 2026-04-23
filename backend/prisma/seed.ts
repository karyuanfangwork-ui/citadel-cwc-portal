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

    const normalStaffRole = await prisma.role.upsert({
        where: { name: 'NORMAL_STAFF' },
        update: {},
        create: {
            name: 'NORMAL_STAFF',
            description: 'Normal staff member who can create requests and access knowledge base',
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

    const hiringManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'HIRING_MANAGER' } });

    // Helper: assign roles to a user (create-only, never removes existing roles)
    const assignRoles = async (userId: string, roleIds: string[]) => {
        for (const roleId of roleIds) {
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId, roleId } },
                update: {},
                create: { userId, roleId },
            });
        }
    };

    // --- System accounts ---
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
    await assignRoles(adminUser.id, [adminRole.id, agentRole.id, hiringManagerRole.id]);
    console.log('✅ Admin user created (email: admin@helpdesk.com, password: admin123)');

    const ceoUser = await prisma.user.upsert({
        where: { email: 'ceo@company.com' },
        update: {},
        create: {
            email: 'ceo@company.com',
            passwordHash: await bcrypt.hash('ceo123', 10),
            firstName: 'Chief',
            lastName: 'Executive',
            department: 'Executive',
            jobTitle: 'Chief Executive Officer',
            isActive: true,
        },
    });
    await assignRoles(ceoUser.id, [ceoRole.id, hiringManagerRole.id]);
    console.log('✅ CEO user created (email: ceo@company.com, password: ceo123)');

    const ctoUser = await prisma.user.upsert({
        where: { email: 'cto@company.com' },
        update: {},
        create: {
            email: 'cto@company.com',
            passwordHash: await bcrypt.hash('cto123', 10),
            firstName: 'Alex',
            lastName: 'Tech',
            isActive: true,
        },
    });
    await assignRoles(ctoUser.id, [ctoRole.id]);
    console.log('✅ CTO user created (email: cto@company.com, password: cto123)');

    const cfoUser = await prisma.user.upsert({
        where: { email: 'cfo@company.com' },
        update: {},
        create: {
            email: 'cfo@company.com',
            passwordHash: await bcrypt.hash('cfo123', 10),
            firstName: 'Jordan',
            lastName: 'Finance',
            isActive: true,
        },
    });
    await assignRoles(cfoUser.id, [cfoRole.id]);
    console.log('✅ CFO user created (email: cfo@company.com, password: cfo123)');

    // --- Agent accounts ---
    const agentPassword = await bcrypt.hash('password123', 10);

    const agentAccounts = [
        { email: 'agent@helpdesk.com',     firstName: 'Support', lastName: 'Agent',       department: 'IT',      jobTitle: 'IT Support Specialist',    roles: [agentRole.id] },
        { email: 'itagent@company.com',     firstName: 'Agent',   lastName: 'IT one',      department: '',        jobTitle: '',                          roles: [agentRole.id, userRole.id] },
        { email: 'hr@company.com',          firstName: 'Agent',   lastName: 'HR one',      department: '',        jobTitle: '',                          roles: [agentRole.id, userRole.id] },
        { email: 'finance@company.com',     firstName: 'Agent',   lastName: 'Finance one', department: '',        jobTitle: '',                          roles: [agentRole.id, userRole.id] },
    ];

    for (const acc of agentAccounts) {
        const u = await prisma.user.upsert({
            where: { email: acc.email },
            update: {},
            create: {
                email: acc.email,
                passwordHash: agentPassword,
                firstName: acc.firstName,
                lastName: acc.lastName,
                department: acc.department || null,
                jobTitle: acc.jobTitle || null,
                isActive: true,
            },
        });
        await assignRoles(u.id, acc.roles);
    }
    console.log('✅ Agent accounts created (password: password123)');

    // --- Regular test users ---
    const testPassword = await bcrypt.hash('password123', 10);
    const testUsers = [
        { email: 'john.doe@company.com',   firstName: 'John', lastName: 'Doe',   department: 'Engineering', jobTitle: 'Software Engineer' },
        { email: 'jane.smith@company.com', firstName: 'Jane', lastName: 'Smith', department: 'Marketing',   jobTitle: 'Marketing Manager' },
    ];

    for (const userData of testUsers) {
        const u = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: { ...userData, passwordHash: testPassword, isActive: true },
        });
        await assignRoles(u.id, [normalStaffRole.id]);
    }
    console.log('✅ Test users created with NORMAL_STAFF role (password: password123)');

    // --- Legacy USER role test account (for backward compatibility testing) ---
    const legacyUser = await prisma.user.upsert({
        where: { email: 'user@helpdesk.com' },
        update: {},
        create: {
            email: 'user@helpdesk.com',
            passwordHash: await bcrypt.hash('user123', 10),
            firstName: 'Regular',
            lastName: 'User',
            department: 'General',
            jobTitle: 'Staff',
            isActive: true,
        },
    });
    await assignRoles(legacyUser.id, [userRole.id]);
    console.log('✅ Legacy USER account created (email: user@helpdesk.com, password: user123)');

    // Create Service Categories for IT
    const itCategories = [
        { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1,
          requestTypeName: 'Get IT Help Request', requestTypeCode: 'GET_IT_HELP' },
        { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
          requestTypeName: 'Email Management Request', requestTypeCode: 'EMAIL_MANAGEMENT' },
        { name: 'Report System problem', icon: 'report', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3,
          requestTypeName: 'Report System Problem Request', requestTypeCode: 'REPORT_SYSTEM_PROBLEM' },
        { name: 'Request Software Installation', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4,
          requestTypeName: 'Software Installation Request', requestTypeCode: 'SOFTWARE_INSTALLATION' },
        { name: 'Request new hardware', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5,
          requestTypeName: 'Request New Hardware Request', requestTypeCode: 'NEW_HARDWARE' },
    ];

    for (const category of itCategories) {
        const cat = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: itDesk.id,
                    name: category.name
                }
            },
            update: {},
            create: {
                name: category.name,
                icon: category.icon,
                colorClass: category.colorClass,
                displayOrder: category.displayOrder,
                serviceDeskId: itDesk.id,
                isActive: true,
            },
        });

        // Add a default request type with a sample form configuration
        let formConfig: any[] = [];
        if (category.requestTypeCode === 'NEW_HARDWARE') {
            formConfig = [
                { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
                { id: 'estimatedPrice', label: 'Estimated Price  ', type: 'currency', required: false },
                { id: 'productUrl', label: 'Product URL', type: 'text', required: false },
                { id: 'businessJustification', label: 'Business Justification', type: 'textarea', required: true },
            ];
        } else if (category.requestTypeCode === 'SOFTWARE_INSTALLATION') {
            formConfig = [
                { id: 'sw_name', label: 'Software Name', type: 'text', required: true },
                { id: 'sw_version', label: 'Version Number', type: 'text', required: false }
            ];
        }

        // Upsert by code so the name can be freely changed without duplicates
        const existingByCode = await prisma.requestType.findFirst({
            where: { code: category.requestTypeCode }
        });
        // Also find any old record without a code for this category (legacy)
        const existingLegacy = !existingByCode ? await prisma.requestType.findFirst({
            where: { serviceCategoryId: cat.id }
        }) : null;

        if (existingByCode) {
            // Only backfill structural fields — never overwrite name, description, or formConfig
            // so Admin UI edits are preserved across re-seeds
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: {
                    serviceCategoryId: cat.id,
                    isActive: true,
                    ...(category.requestTypeCode === 'NEW_HARDWARE' ? { slaHours: 72, requiresApproval: true } : {}),
                }
            });
        } else if (existingLegacy) {
            // Backfill code onto legacy record without touching name/formConfig
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: {
                    code: category.requestTypeCode,
                    isActive: true,
                    ...(category.requestTypeCode === 'NEW_HARDWARE' ? { slaHours: 72, requiresApproval: true } : {}),
                }
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: cat.id,
                    code: category.requestTypeCode,
                    name: category.requestTypeName,
                    description: `Submit a request for ${category.name.toLowerCase()} assistance.`,
                    icon: category.icon,
                    formConfig,
                    isActive: true,
                    ...(category.requestTypeCode === 'NEW_HARDWARE' ? { slaHours: 72, requiresApproval: true } : {}),
                }
            });
        }
    }

    console.log('✅ Service categories created');

    // Create Service Categories for HR
    const hrCategoriesData = [
        {
            name: 'Question for HR', description: 'Ask HR a question or request general HR assistance',
            icon: 'contact_support', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1,
            requestTypeName: 'Question for HR', requestTypeCode: 'HR_QUESTION',
            formConfig: [
                { id: 'field_1776666757696', label: 'What is your question ?', type: 'text', required: true },
                { id: 'field_1776666848303', label: 'Provide as much detail as possible about your question', type: 'textarea', required: true },
                { id: 'field_1776666972796', label: 'Attachment', type: 'file', required: false },
            ],
            requiredRole: null, slaHours: 24,
        },
        {
            name: 'New Hiring Request', description: 'Request to open a new position and hire a candidate',
            icon: 'person_add', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 2,
            requestTypeName: 'New Hiring Request', requestTypeCode: 'NEW_HIRING',
            formConfig: [
                { id: 'position', label: 'Job Title', type: 'text', required: true },
                { id: 'department', label: 'Department', type: 'text', required: true },
                { id: 'headcount', label: 'Role Category', type: 'select', required: true, options: ['Junior Executive', 'Senior Executive', 'Head of Department', 'C-Level'] },
                { id: 'field_1776667989723', label: 'Proposed Salary', type: 'currency', required: false },
                { id: 'field_1776668042538', label: 'Attach Org Chart', type: 'file', required: false },
                { id: 'field_1776668064979', label: 'Attach Job Description', type: 'file', required: false },
            ],
            requiredRole: 'HIRING_MANAGER', slaHours: 48,
        },
        {
            name: 'New Employee Onboarding', description: 'Initiate onboarding process for a new hire',
            icon: 'how_to_reg', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 3,
            requestTypeName: 'New Employee Onboarding', requestTypeCode: 'EMPLOYEE_ONBOARDING',
            formConfig: [
                { id: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
                { id: 'employeeEmail', label: 'Employee Email', type: 'text', required: true },
                { id: 'startDate', label: 'Start Date', type: 'text', required: true },
                { id: 'department', label: 'Department', type: 'text', required: true },
                { id: 'jobTitle', label: 'Job Title', type: 'text', required: true },
            ],
            requiredRole: null, slaHours: 48,
        },
        {
            name: 'Offboard an Employee', description: 'Initiate offboarding process for a departing employee',
            icon: 'person_remove', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 4,
            requestTypeName: 'Offboard an Employee', requestTypeCode: 'EMPLOYEE_OFFBOARDING',
            formConfig: [
                { id: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
                { id: 'employeeEmail', label: 'Employee Email', type: 'text', required: true },
                { id: 'lastDay', label: 'Last Working Day', type: 'text', required: true },
                { id: 'reason', label: 'Reason for Departure', type: 'text', required: false },
            ],
            requiredRole: null, slaHours: 48,
        },
    ];

    for (const cat of hrCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: hrDesk.id,
                    name: cat.name
                }
            },
            update: {},
            create: {
                name: cat.name,
                description: cat.description,
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                serviceDeskId: hrDesk.id,
                isActive: true,
            },
        });

        // Upsert by code — only create if missing, never overwrite admin-editable fields
        const existingByCode = await prisma.requestType.findFirst({
            where: { code: cat.requestTypeCode }
        });
        const existingLegacy = !existingByCode
            ? await prisma.requestType.findFirst({ where: { serviceCategoryId: category.id } })
            : null;

        if (existingByCode) {
            // Backfill structural fields only
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: { serviceCategoryId: category.id, isActive: true },
            });
        } else if (existingLegacy) {
            // Assign code to legacy record without touching name/formConfig
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: { code: cat.requestTypeCode, isActive: true },
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: category.id,
                    code: cat.requestTypeCode,
                    name: cat.requestTypeName,
                    description: cat.description,
                    slaHours: cat.slaHours,
                    isActive: true,
                    requiredRole: cat.requiredRole,
                    formConfig: cat.formConfig,
                },
            });
        }
    }

    console.log('✅ HR categories created');

    // Create Service Categories for Finance
    const finCategoriesData = [
        {
            name: 'Purchase Requisition', description: 'Submit a request to purchase goods or services',
            icon: 'shopping_cart', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1,
            requestTypeName: 'Purchase Requisition', requestTypeCode: 'PURCHASE_REQUISITION',
            formConfig: [
                { id: 'itemName', label: 'Item / Service Name', type: 'text', required: true },
                { id: 'quantity', label: 'Quantity', type: 'number', required: true },
                { id: 'estimatedCost', label: 'Estimated Cost (RM)', type: 'currency', required: true },
                { id: 'vendor', label: 'Preferred Vendor', type: 'text', required: false },
                { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
            ],
        },
        {
            name: 'Inter-Company Chargeback', description: 'Request a chargeback between internal company entities',
            icon: 'swap_horiz', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
            requestTypeName: 'Inter-Company Chargeback', requestTypeCode: 'INTERCOMPANY_CHARGEBACK',
            formConfig: [
                { id: 'chargeFromEntity', label: 'Charge From Entity', type: 'text', required: true },
                { id: 'chargeToEntity', label: 'Charge To Entity', type: 'text', required: true },
                { id: 'amount', label: 'Amount (RM)', type: 'currency', required: true },
                { id: 'costCenter', label: 'Cost Center', type: 'text', required: false },
                { id: 'description', label: 'Description / Reason', type: 'textarea', required: true },
            ],
        },
        {
            name: 'Submit Budget Proposal', description: 'Submit a budget proposal for approval',
            icon: 'account_balance', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 3,
            requestTypeName: 'Submit Budget Proposal', requestTypeCode: 'BUDGET_PROPOSAL',
            formConfig: [
                { id: 'department', label: 'Department', type: 'text', required: true },
                { id: 'budgetPeriod', label: 'Budget Period (e.g. Q1 2026)', type: 'text', required: true },
                { id: 'totalAmount', label: 'Total Amount Requested (RM)', type: 'currency', required: true },
                { id: 'breakdown', label: 'Budget Breakdown', type: 'textarea', required: true },
                { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
            ],
        },
    ];

    for (const cat of finCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: financeDesk.id,
                    name: cat.name
                }
            },
            update: {},
            create: {
                name: cat.name,
                description: cat.description,
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                serviceDeskId: financeDesk.id,
                isActive: true,
            },
        });

        const existingByCode = await prisma.requestType.findFirst({
            where: { code: cat.requestTypeCode }
        });
        const existingLegacy = !existingByCode
            ? await prisma.requestType.findFirst({ where: { serviceCategoryId: category.id } })
            : null;

        if (existingByCode) {
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: { serviceCategoryId: category.id, isActive: true },
            });
        } else if (existingLegacy) {
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: { code: cat.requestTypeCode, isActive: true },
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategoryId: category.id,
                    code: cat.requestTypeCode,
                    name: cat.requestTypeName,
                    description: cat.description,
                    slaHours: 72,
                    isActive: true,
                    formConfig: cat.formConfig,
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
        {
            name: 'manager_approval_required',
            eventType: 'MANAGER_APPROVAL_REQUIRED',
            emailSubject: 'Request {{requestId}} Requires Your Approval',
            emailBody: 'A request ({{requestId}}) has been submitted for manager approval. Please review and take action.',
            pushTitle: 'Approval Required',
            pushBody: 'Request {{requestId}} needs your approval.',
        },
        {
            name: 'manager_approved',
            eventType: 'MANAGER_APPROVED',
            emailSubject: 'Your Request {{requestId}} Was Approved',
            emailBody: 'Your request ({{requestId}}) has been approved by the manager. It is now being processed.',
            pushTitle: 'Request Approved',
            pushBody: 'Your request {{requestId}} was approved.',
        },
        {
            name: 'manager_rejected',
            eventType: 'MANAGER_REJECTED',
            emailSubject: 'Your Request {{requestId}} Was Declined',
            emailBody: 'Your request ({{requestId}}) has been declined by the manager. Please contact your HR representative for more information.',
            pushTitle: 'Request Declined',
            pushBody: 'Your request {{requestId}} was declined.',
        },
        {
            name: 'procurement_initiated',
            eventType: 'PROCUREMENT_INITIATED',
            emailSubject: 'Procurement Started - Request {{requestId}}',
            emailBody: 'Procurement has been initiated for your IT hardware request ({{requestId}}). We will update you once the items are ordered.',
            pushTitle: 'Procurement Started',
            pushBody: 'Procurement for {{requestId}} has begun.',
        },
        {
            name: 'hardware_ordered',
            eventType: 'HARDWARE_ORDERED',
            emailSubject: 'Hardware Ordered - Request {{requestId}}',
            emailBody: 'Your hardware for request ({{requestId}}) has been ordered{{orderNumber ? ". Order number: " + orderNumber : ""}}. We will notify you when it arrives.',
            pushTitle: 'Hardware Ordered',
            pushBody: 'Hardware for {{requestId}} has been ordered.',
        },
        {
            name: 'hardware_received',
            eventType: 'HARDWARE_RECEIVED',
            emailSubject: 'Hardware Arrived - Request {{requestId}}',
            emailBody: 'Your hardware for request ({{requestId}}) has arrived and is being set up. You will be notified when it is ready.',
            pushTitle: 'Hardware Arrived',
            pushBody: 'Hardware for {{requestId}} has arrived.',
        },
        {
            name: 'hardware_delivered',
            eventType: 'HARDWARE_DELIVERED',
            emailSubject: 'Hardware Ready - Request {{requestId}}',
            emailBody: 'Your hardware for request ({{requestId}}) is ready for pickup or delivery. Please contact IT to arrange collection.',
            pushTitle: 'Hardware Ready',
            pushBody: 'Hardware for {{requestId}} is ready for pickup.',
        },
        {
            name: 'vp_approval_required',
            eventType: 'VP_APPROVAL_REQUIRED',
            emailSubject: 'High-Value Request {{requestId}} Requires VP Approval',
            emailBody: 'A high-value hardware request ({{requestId}}, ${{price}}) requires VP approval. Please review and take action.',
            pushTitle: 'VP Approval Required',
            pushBody: 'Request {{requestId}} requires VP approval.',
        },
        {
            name: 'vp_approved',
            eventType: 'VP_APPROVED',
            emailSubject: 'Request {{requestId}} VP Approved',
            emailBody: 'Your request ({{requestId}}) has been approved by the VP. Procurement will proceed.',
            pushTitle: 'VP Approved',
            pushBody: 'Request {{requestId}} VP approved.',
        },
        {
            name: 'vp_rejected',
            eventType: 'VP_REJECTED',
            emailSubject: 'Request {{requestId}} Declined by VP',
            emailBody: 'Your request ({{requestId}}) has been declined by the VP{{comments ? ". Reason: " + comments : ""}}.',
            pushTitle: 'VP Declined',
            pushBody: 'Request {{requestId}} was declined by VP.',
        },
        {
            name: 'request_rejected',
            eventType: 'REQUEST_REJECTED',
            emailSubject: 'Request {{requestId}} Was Declined',
            emailBody: 'Your request ({{requestId}}) has been declined{{rejectedBy ? " by " + rejectedBy : ""}}{{comments ? ". Reason: " + comments : ""}}.',
            pushTitle: 'Request Declined',
            pushBody: 'Request {{requestId}} was declined.',
        },
        {
            name: 'action_required',
            eventType: 'ACTION_REQUIRED',
            emailSubject: 'Action Required - Request {{requestId}}',
            emailBody: 'An action is required for request ({{requestId}}){{action ? ": " + action : ""}}. Please log in to take the required action.',
            pushTitle: 'Action Required',
            pushBody: 'Request {{requestId}} requires your action.',
        },
        {
            name: 'finance_manager_approval_requested',
            eventType: 'FINANCE_MANAGER_APPROVAL_REQUESTED',
            emailSubject: 'Finance Approval Required - Request {{requestId}}',
            emailBody: 'Request {{requestId}} has been submitted for finance manager approval. Please review and take action.',
            pushTitle: 'Finance Approval Required',
            pushBody: 'Request {{requestId}} needs finance manager approval.',
        },
        {
            name: 'finance_manager_decision',
            eventType: 'FINANCE_MANAGER_DECISION',
            emailSubject: 'Finance Manager Decision - Request {{requestId}}',
            emailBody: 'Your request {{requestId}} has been reviewed by the finance manager. Decision: {{decision}}.',
            pushTitle: 'Finance Manager Decision',
            pushBody: 'Finance manager reviewed {{requestId}}: {{decision}}.',
        },
        {
            name: 'finance_head_approval_requested',
            eventType: 'FINANCE_HEAD_APPROVAL_REQUESTED',
            emailSubject: 'Finance Head Approval Required - Request {{requestId}}',
            emailBody: 'Request {{requestId}} requires finance head approval. Please review and take action.',
            pushTitle: 'Finance Head Approval Required',
            pushBody: 'Request {{requestId}} needs finance head approval.',
        },
        {
            name: 'finance_head_decision',
            eventType: 'FINANCE_HEAD_DECISION',
            emailSubject: 'Finance Head Decision - Request {{requestId}}',
            emailBody: 'Your request {{requestId}} has been reviewed by the finance head. Decision: {{decision}}.',
            pushTitle: 'Finance Head Decision',
            pushBody: 'Finance head reviewed {{requestId}}: {{decision}}.',
        },
        {
            name: 'finance_payment_update',
            eventType: 'FINANCE_PAYMENT_UPDATE',
            emailSubject: 'Payment Update - Request {{requestId}}',
            emailBody: 'Payment status update for request {{requestId}}: {{paymentStatus}}.',
            pushTitle: 'Payment Update',
            pushBody: 'Payment update for {{requestId}}: {{paymentStatus}}.',
        },
        {
            name: 'request_resolved',
            eventType: 'REQUEST_RESOLVED',
            emailSubject: 'Request Resolved - {{referenceNumber}}',
            emailBody: 'Your request {{referenceNumber}} has been resolved. Thank you for contacting us.',
            pushTitle: 'Request Resolved',
            pushBody: 'Request {{referenceNumber}} has been resolved.',
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

    // Seed offboarding task templates
    const existingOffboardingTemplates = await prisma.offboardingTaskTemplate.count();
    if (existingOffboardingTemplates === 0) {
        await prisma.offboardingTaskTemplate.createMany({
            data: [
                { taskName: 'Notify IT of Departure', taskDescription: 'Alert IT team of employee last working day to schedule account deactivation', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: -10, displayOrder: 1 },
                { taskName: 'Schedule Exit Interview', taskDescription: 'Arrange exit interview with HR to gather feedback', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: -7, displayOrder: 2 },
                { taskName: 'Knowledge Transfer Plan', taskDescription: 'Create and execute knowledge transfer documentation for key responsibilities', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: -7, displayOrder: 3 },
                { taskName: 'Revoke System Access', taskDescription: 'Disable all system accounts, VPN, and application access on last day', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 4 },
                { taskName: 'Disable Email Account', taskDescription: 'Deactivate email and set up forwarding/out-of-office', taskCategory: 'IT', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 5 },
                { taskName: 'Collect Company Hardware', taskDescription: 'Collect laptop, phone, access badge, and other company equipment', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: 0, displayOrder: 6 },
                { taskName: 'Process Final Payroll', taskDescription: 'Ensure final paycheck includes all outstanding pay, bonuses, and leave', taskCategory: 'HR', priority: 'CRITICAL', dueDayOffset: 0, displayOrder: 7 },
                { taskName: 'Terminate Benefits', taskDescription: 'Cancel health insurance, 401k contributions, and other benefits', taskCategory: 'HR', priority: 'HIGH', dueDayOffset: 0, displayOrder: 8 },
                { taskName: 'Conduct Exit Interview', taskDescription: 'Conduct and document exit interview with departing employee', taskCategory: 'HR', priority: 'MEDIUM', dueDayOffset: -1, displayOrder: 9 },
                { taskName: 'Update Org Chart & Directory', taskDescription: 'Remove employee from org chart, team directories, and mailing lists', taskCategory: 'ADMIN', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 10 },
                { taskName: 'Reassign Open Tasks & Projects', taskDescription: 'Transition all open work items to appropriate team members', taskCategory: 'ADMIN', priority: 'HIGH', dueDayOffset: -3, displayOrder: 11 },
                { taskName: 'Return Physical Access Badge', taskDescription: 'Collect and deactivate physical building access badge', taskCategory: 'IT', priority: 'HIGH', dueDayOffset: 0, displayOrder: 12 },
            ],
        });
        console.log('✅ Offboarding task templates seeded');
    } else {
        console.log('⏭️  Offboarding task templates already exist, skipping');
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
        // OFFBOARDING
        { code: 'OFFBOARDING_SUBMITTED',           label: 'Offboarding Submitted',           category: 'OFFBOARDING', displayOrder: 36 },
        { code: 'OFFBOARDING_NOTICE_PERIOD',        label: 'Notice Period',                   category: 'OFFBOARDING', displayOrder: 37 },
        { code: 'OFFBOARDING_KNOWLEDGE_TRANSFER',   label: 'Knowledge Transfer',              category: 'OFFBOARDING', displayOrder: 38 },
        { code: 'OFFBOARDING_FINAL_WEEK',           label: 'Final Week',                      category: 'OFFBOARDING', displayOrder: 39 },
        { code: 'OFFBOARDING_EXIT_PROCEDURES',      label: 'Exit Procedures',                 category: 'OFFBOARDING', displayOrder: 40 },
        { code: 'OFFBOARDING_COMPLETED',            label: 'Offboarding Completed',           category: 'OFFBOARDING', displayOrder: 41 },
        // ONBOARDING
        { code: 'ONBOARDING_SUBMITTED',            label: 'Onboarding Submitted',            category: 'ONBOARDING', displayOrder: 30 },
        { code: 'ONBOARDING_PRE_ARRIVAL_SETUP',    label: 'Pre-Arrival Setup',               category: 'ONBOARDING', displayOrder: 31 },
        { code: 'ONBOARDING_READY_FOR_DAY_1',      label: 'Ready for Day 1',                 category: 'ONBOARDING', displayOrder: 32 },
        { code: 'ONBOARDING_DAY_1_ORIENTATION',    label: 'Day 1 Orientation',               category: 'ONBOARDING', displayOrder: 33 },
        { code: 'ONBOARDING_WEEK_1_INTEGRATION',   label: 'Week 1 Integration',              category: 'ONBOARDING', displayOrder: 34 },
        { code: 'ONBOARDING_COMPLETED',            label: 'Onboarding Completed',            category: 'ONBOARDING', displayOrder: 35 },
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
            update: {},
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
