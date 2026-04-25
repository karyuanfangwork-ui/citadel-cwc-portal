import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Safety flag: Set RETAIN_ADMIN_CONFIG=true to preserve all admin console settings
// Only re-seeds account management (users, roles, permissions)
const RETAIN_ADMIN_CONFIG = process.env.RETAIN_ADMIN_CONFIG === 'true';

async function main() {
    console.log('🌱 Starting database seed...');
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⚠️  RETAIN_ADMIN_CONFIG enabled - preserving admin console settings');
    }

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

    console.log('📋 Creating permission list...');
    const permissions = [
        { name: 'request:create', resource: 'request', action: 'create', description: 'Create new requests' },
        { name: 'request:read', resource: 'request', action: 'read', description: 'View requests' },
        { name: 'request:update', resource: 'request', action: 'update', description: 'Update requests' },
        { name: 'request:delete', resource: 'request', action: 'delete', description: 'Delete requests' },
        { name: 'request:approve', resource: 'request', action: 'approve', description: 'Approve requests' },
        { name: 'request:assign', resource: 'request', action: 'assign', description: 'Assign requests to agents' },
        { name: 'user:manage', resource: 'user', action: 'manage', description: 'Manage users' },
        { name: 'admin:access', resource: 'admin', action: 'access', description: 'Access admin panel' },
        { name: 'admin:settings', resource: 'admin', action: 'settings', description: 'Modify system settings' },
        { name: 'report:read', resource: 'report', action: 'read', description: 'View reports' },
        { name: 'kb:manage', resource: 'kb', action: 'manage', description: 'Manage knowledge base articles' },
        { name: 'notification:manage', resource: 'notification', action: 'manage', description: 'Manage notification templates' },
        { name: 'workflow:manage', resource: 'workflow', action: 'manage', description: 'Manage workflow transitions' },
        { name: 'banner:manage', resource: 'banner', action: 'manage', description: 'Manage banner configurations' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }

    console.log('✅ Permissions created');

    // --- Seed RolePermission assignments ---
    // This maps each role to the permissions they should have at runtime.
    // The requirePermission() middleware reads from this join table to enforce RBAC.
    console.log('🔗 Assigning permissions to roles...');

    // Fetch all roles and create a lookup map
    const allRoles = await prisma.role.findMany();
    const roleMap = new Map<string, string>();
    for (const r of allRoles) {
        roleMap.set(r.name, r.id);
    }

    // Fetch all permissions
    const allPerms = await prisma.permission.findMany();
    const permMap = new Map<string, string>();
    for (const p of allPerms) {
        permMap.set(p.name, p.id);
    }

    // Permission assignment per role
    // ADMIN gets everything
    const adminPerms = [
        'request:create', 'request:read', 'request:update', 'request:delete',
        'request:approve', 'request:assign',
        'user:manage',
        'admin:access', 'admin:settings',
        'report:read',
        'kb:manage',
        'notification:manage',
        'workflow:manage',
        'banner:manage',
    ];

    // AGENT gets full request CRUD + assign, no admin/user/report/banner/workflow
    const agentPerms = [
        'request:create', 'request:read', 'request:update', 'request:delete',
        'request:approve', 'request:assign',
    ];

    // NORMAL_STAFF and USER can create and read their own requests
    const staffPerms = [
        'request:create', 'request:read',
    ];

    // Executive approvers get request:read + request:approve
    const executivePerms = [
        'request:read', 'request:approve',
    ];

    // HIRING_MANAGER gets request:create, request:read + approve
    const hiringManagerPerms = [
        'request:create', 'request:read', 'request:approve',
    ];

    const rolePermissionMap: Record<string, string[]> = {
        ADMIN: adminPerms,
        AGENT: agentPerms,
        USER: staffPerms,
        NORMAL_STAFF: staffPerms,
        CEO: executivePerms,
        CTO: executivePerms,
        CFO: executivePerms,
        GROUP_CEO: executivePerms,
        HIRING_MANAGER: hiringManagerPerms,
    };

    // Upsert RolePermission records: clear existing and recreate
    for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
        const roleId = roleMap.get(roleName);
        if (!roleId) {
            console.log(`  ⚠️ Role not found: ${roleName} — skipping`);
            continue;
        }

        // Delete existing permissions for this role (clean slate)
        await prisma.rolePermission.deleteMany({ where: { roleId } });

        // Create new RolePermission records
        for (const permName of permNames) {
            const permId = permMap.get(permName);
            if (!permId) {
                console.log(`  ⚠️ Permission not found: ${permName} — skipping`);
                continue;
            }
            await prisma.rolePermission.create({
                data: { roleId, permissionId: permId },
            });
        }
        console.log(`  ✅ ${roleName}: ${permNames.length} permissions`);
    }

    console.log('✅ Role permissions assigned');

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
    const hashedPassword = await bcrypt.hash('abc@123', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@test.local' },
        update: {},
        create: {
            email: 'admin@test.local',
            passwordHash: hashedPassword,
            firstName: 'Fang',
            lastName: 'Kar Yuan',
            department: 'IT',
            jobTitle: 'Administrator',
            isActive: true,
        },
    });
    await assignRoles(adminUser.id, [adminRole.id, agentRole.id, hiringManagerRole.id]);
    console.log('✅ Admin user created (email: admin@test.local, password: abc@123)');

    const ceoUser = await prisma.user.upsert({
        where: { email: 'ceo@test.local' },
        update: {},
        create: {
            email: 'ceo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Emily',
            lastName: 'Chow',
            department: 'Executive',
            jobTitle: 'Chief Executive Officer',
            isActive: true,
        },
    });
    await assignRoles(ceoUser.id, [ceoRole.id, hiringManagerRole.id]);
    console.log('✅ CEO user created (email: ceo@test.local, password: abc@123)');

    const ctoUser = await prisma.user.upsert({
        where: { email: 'cto@test.local' },
        update: {},
        create: {
            email: 'cto@test.local',
            passwordHash: hashedPassword,
            firstName: 'Raymond',
            lastName: 'Kueh',
            isActive: true,
        },
    });
    await assignRoles(ctoUser.id, [ctoRole.id]);
    console.log('✅ CTO user created (email: cto@test.local, password: abc@123)');

    const cfoUser = await prisma.user.upsert({
        where: { email: 'cfo@test.local' },
        update: {},
        create: {
            email: 'cfo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Saravanan',
            lastName: 'Ramaiah',
            isActive: true,
        },
    });
    await assignRoles(cfoUser.id, [cfoRole.id]);
    console.log('✅ CFO user created (email: cfo@test.local, password: abc@123)');

    const groupCeoRole = await prisma.role.findUniqueOrThrow({ where: { name: 'GROUP_CEO' } });
    const groupCeoUser = await prisma.user.upsert({
        where: { email: 'groupceo@test.local' },
        update: {},
        create: {
            email: 'groupceo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Alain',
            lastName: 'Boey',
            department: 'Executive',
            jobTitle: 'Group Chief Executive Officer',
            isActive: true,
        },
    });
    await assignRoles(groupCeoUser.id, [groupCeoRole.id]);
    console.log('✅ Group CEO user created (email: groupceo@test.local, password: abc@123)');

    // --- Agent accounts ---
    const agentPassword = await bcrypt.hash('abc@123', 10);

    const agentAccounts = [
        { email: 'finance@test.local',     firstName: 'Zahidah', lastName: 'Zahidah',     department: 'Finance', jobTitle: 'Finance Agent',             roles: [agentRole.id] },
        { email: 'it@test.local',          firstName: 'Tham',    lastName: 'Ming Kai',    department: 'IT',      jobTitle: 'IT Agent',                  roles: [agentRole.id] },
        { email: 'it2@test.local',         firstName: 'Naila',   lastName: 'Naila',       department: 'IT',      jobTitle: 'IT Agent',                  roles: [agentRole.id] },
        { email: 'hr@test.local',          firstName: 'Sasha',   lastName: 'Nair',        department: 'HR',      jobTitle: 'HR Agent',                  roles: [agentRole.id] },
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
    console.log('✅ Agent accounts created (password: abc@123)');

    // --- Regular test users ---
    const testPassword = await bcrypt.hash('abc@123', 10);
    const testUsers = [
        { email: 'john.doe@test.local',   firstName: 'John', lastName: 'Doe',   department: 'Engineering', jobTitle: 'Software Engineer' },
        { email: 'jane.smith@test.local', firstName: 'Jane', lastName: 'Smith', department: 'Marketing',   jobTitle: 'Marketing Manager' },
    ];

    for (const userData of testUsers) {
        const u = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: { ...userData, passwordHash: testPassword, isActive: true },
        });
        await assignRoles(u.id, [normalStaffRole.id]);
    }
    console.log('✅ Test users created with NORMAL_STAFF role (password: abc@123)');

    // --- Legacy USER role test account (for backward compatibility testing) ---
    const legacyUser = await prisma.user.upsert({
        where: { email: 'user@helpdesk.com' },
        update: {},
        create: {
            email: 'user@helpdesk.com',
            passwordHash: await bcrypt.hash('abc@123', 10),
            firstName: 'Regular',
            lastName: 'User',
            department: 'General',
            jobTitle: 'Staff',
            isActive: true,
        },
    });
    await assignRoles(legacyUser.id, [userRole.id]);
    console.log('✅ Legacy USER account created (email: user@helpdesk.com, password: abc@123)');

    // Create Service Categories for IT
    const itCategories = [
        { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1,
          requestTypeName: 'Get IT Help Request', requestTypeCode: 'GET_IT_HELP', workflowType: 'IT_SIMPLE' },
        { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
          requestTypeName: 'Email Management Request', requestTypeCode: 'EMAIL_MANAGEMENT', workflowType: 'IT_SIMPLE' },
        { name: 'Report System problem', icon: 'report', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3,
          requestTypeName: 'Report System Problem Request', requestTypeCode: 'REPORT_SYSTEM_PROBLEM', workflowType: 'IT_SIMPLE' },
        { name: 'Request Software Installation', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4,
          requestTypeName: 'Software Installation Request', requestTypeCode: 'SOFTWARE_INSTALLATION', workflowType: 'IT_PROCUREMENT' },
        { name: 'Request new hardware', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5,
          requestTypeName: 'Request New Hardware Request', requestTypeCode: 'NEW_HARDWARE', workflowType: 'IT_PROCUREMENT' },
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
                    serviceCategory: { connect: { id: cat.id } },
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
                    serviceCategory: { connect: { id: cat.id } },
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
            requestTypeName: 'Question for HR', requestTypeCode: 'HR_QUESTION', workflowType: 'HR_GENERAL',
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
            requestTypeName: 'New Hiring Request', requestTypeCode: 'NEW_HIRING', workflowType: 'HR_RECRUITMENT',
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
            requestTypeName: 'New Employee Onboarding', requestTypeCode: 'EMPLOYEE_ONBOARDING', workflowType: 'ONBOARDING',
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
            requestTypeName: 'Offboard an Employee', requestTypeCode: 'EMPLOYEE_OFFBOARDING', workflowType: 'OFFBOARDING',
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
                data: { serviceCategory: { connect: { id: category.id } }, isActive: true },
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
                    serviceCategory: { connect: { id: category.id } },
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
            requestTypeName: 'Purchase Requisition', requestTypeCode: 'PURCHASE_REQUISITION', workflowType: 'FINANCE',
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
            requestTypeName: 'Inter-Company Chargeback', requestTypeCode: 'INTERCOMPANY_CHARGEBACK', workflowType: 'FINANCE',
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
            requestTypeName: 'Submit Budget Proposal', requestTypeCode: 'BUDGET_PROPOSAL', workflowType: 'FINANCE',
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
                data: { serviceCategory: { connect: { id: category.id } }, isActive: true },
            });
        } else if (existingLegacy) {
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: { code: cat.requestTypeCode, isActive: true },
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategory: { connect: { id: category.id } },
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
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping notification templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        const templates = [
        {
            name: 'request_created',
            eventType: 'REQUEST_CREATED',
            emailSubject: 'New Request #{{requestId}} — {{requestTitle}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Request Submitted</h2><p>Hello {{userName}},</p><p>A new request has been submitted by <strong>{{requesterName}}</strong>:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Category</td><td style='padding:8px 12px;border:1px solid #eee;'>{{categoryName}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Priority</td><td style='padding:8px 12px;border:1px solid #eee;'>{{priority}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Created',
            pushBody: 'Your request #{{requestId}} has been submitted.',
        },
        {
            name: 'request_status_changed',
            eventType: 'STATUS_CHANGED',
            emailSubject: 'Request #{{requestId}} — Status Updated to {{newStatus}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Status Update</h2><p>Hello {{userName}},</p><p>The status of request <strong>#{{requestId}} — {{requestTitle}}</strong> has been updated:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Previous</td><td style='padding:8px 12px;border:1px solid #eee;'>{{oldStatus}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Current</td><td style='padding:8px 12px;border:1px solid #eee;'><span style='display:inline-block;padding:4px 12px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>{{newStatus}}</span></td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Changed By</td><td style='padding:8px 12px;border:1px solid #eee;'>{{changedBy}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Status Updated',
            pushBody: 'Request #{{requestId}} is now {{newStatus}}.',
        },
        {
            name: 'request_assigned',
            eventType: 'REQUEST_ASSIGNED',
            emailSubject: 'Request #{{requestId}} Assigned to You',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Request Assigned</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been assigned to <strong>{{assigneeName}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Assignee</td><td style='padding:8px 12px;border:1px solid #eee;'>{{assigneeName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'New Assignment',
            pushBody: 'Request #{{requestId}} assigned to you.',
        },
        {
            name: 'comment_added',
            eventType: 'COMMENT_ADDED',
            emailSubject: 'New Comment on Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>New Comment</h2><p>Hello {{userName}},</p><p><strong>{{commenterName}}</strong> added a comment on request <strong>#{{requestId}} — {{requestTitle}}</strong>:</p><div style='background:#f4f5f7;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #1a1a2e;'>{{commentText}}</div><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'New Comment',
            pushBody: 'New comment on request #{{requestId}}.',
        },
        {
            name: 'sla_breached',
            eventType: 'SLA_BREACHED',
            emailSubject: '⚠️ SLA Breach — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#e53e3e;'>SLA Breach Alert</h2><p>Hello {{userName}},</p><p>An SLA deadline has been breached on the following request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>SLA Deadline</td><td style='padding:8px 12px;border:1px solid #eee;color:#e53e3e;font-weight:600;'>{{slaDeadline}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Take Action</a></p>",
            pushTitle: 'SLA Breach',
            pushBody: 'Request #{{requestId}} has breached its SLA.',
        },
        {
            name: 'manager_approval_required',
            eventType: 'MANAGER_APPROVAL_REQUIRED',
            emailSubject: 'Approval Needed — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Approval Required</h2><p>Hello {{userName}},</p><p>Your approval is requested for the following IT support request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
            pushTitle: 'Approval Required',
            pushBody: 'Request #{{requestId}} needs your approval.',
        },
        {
            name: 'manager_approved',
            eventType: 'MANAGER_APPROVED',
            emailSubject: 'Request #{{requestId}} — Manager Approved',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>Manager Approved</h2><p>Hello {{userName}},</p><p>The manager has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>APPROVED</span></p><p>The request will proceed to the next stage in the workflow.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Approved',
            pushBody: 'Your request #{{requestId}} was approved by the manager.',
        },
        {
            name: 'manager_rejected',
            eventType: 'MANAGER_REJECTED',
            emailSubject: 'Request #{{requestId}} — Manager Rejected',
            emailBody: "<h2 style='margin:0 0 16px;color:#e53e3e;'>Manager Rejected</h2><p>Hello {{userName}},</p><p>The manager has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Declined',
            pushBody: 'Your request #{{requestId}} was declined by the manager.',
        },
        {
            name: 'procurement_initiated',
            eventType: 'PROCUREMENT_INITIATED',
            emailSubject: 'Procurement Started — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Procurement Initiated</h2><p>Hello {{userName}},</p><p>Procurement has been initiated for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>PROCUREMENT IN PROGRESS</span></p><p>The IT team is now sourcing the required hardware/software.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Procurement Started',
            pushBody: 'Procurement for request #{{requestId}} has begun.',
        },
        {
            name: 'hardware_ordered',
            eventType: 'HARDWARE_ORDERED',
            emailSubject: 'Hardware Ordered — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Ordered</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been ordered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ORDERED</span></p><p>You will be notified when the item is received.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Hardware Ordered',
            pushBody: 'Hardware for request #{{requestId}} has been ordered.',
        },
        {
            name: 'hardware_received',
            eventType: 'HARDWARE_RECEIVED',
            emailSubject: 'Hardware Received — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Hardware Received</h2><p>Hello {{userName}},</p><p>The hardware for request <strong>#{{requestId}} — {{requestTitle}}</strong> has been received and is being prepared for provisioning.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RECEIVED</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Hardware Arrived',
            pushBody: 'Hardware for request #{{requestId}} has arrived.',
        },
        {
            name: 'hardware_delivered',
            eventType: 'HARDWARE_DELIVERED',
            emailSubject: 'Delivered — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>Delivered</h2><p>Hello {{userName}},</p><p>Your request <strong>#{{requestId}} — {{requestTitle}}</strong> has been fulfilled and delivered.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>DELIVERED</span></p><p>If you have any issues, please create a new support ticket.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Hardware Ready',
            pushBody: 'Hardware for request #{{requestId}} is ready.',
        },
        {
            name: 'vp_approval_required',
            eventType: 'VP_APPROVAL_REQUIRED',
            emailSubject: 'VP Approval Needed — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>VP Approval Required</h2><p>Hello {{userName}},</p><p>VICE PRESIDENT approval is required for this high-value IT request:</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Title</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requestTitle}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Requester</td><td style='padding:8px 12px;border:1px solid #eee;'>{{requesterName}}</td></tr></table><p>This request requires VP-level authorization due to the estimated value.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
            pushTitle: 'VP Approval Required',
            pushBody: 'Request #{{requestId}} requires VP approval.',
        },
        {
            name: 'vp_approved',
            eventType: 'VP_APPROVED',
            emailSubject: 'Request #{{requestId}} — VP Approved',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>VP Approved</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>approved</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>VP APPROVED</span></p><p>The request will now proceed to procurement or fulfillment.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'VP Approved',
            pushBody: 'Your request #{{requestId}} was approved by the VP.',
        },
        {
            name: 'vp_rejected',
            eventType: 'VP_REJECTED',
            emailSubject: 'Request #{{requestId}} — VP Rejected',
            emailBody: "<h2 style='margin:0 0 16px;color:#e53e3e;'>VP Rejected</h2><p>Hello {{userName}},</p><p>The Vice President has <strong>rejected</strong> request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>VP REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'VP Declined',
            pushBody: 'Your request #{{requestId}} was declined by the VP.',
        },
        {
            name: 'request_rejected',
            eventType: 'REQUEST_REJECTED',
            emailSubject: 'Request #{{requestId}} — Rejected by {{approverRole}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#e53e3e;'>Request Rejected</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been rejected by <strong>{{approverRole}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fde8e8;color:#e53e3e;border-radius:4px;font-weight:600;'>REJECTED</span></p><p>Reason: {{rejectionReason}}</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Declined',
            pushBody: 'Request #{{requestId}} was declined.',
        },
        {
            name: 'action_required',
            eventType: 'ACTION_REQUIRED',
            emailSubject: 'Action Required — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#f6ad55;'>Action Required</h2><p>Hello {{userName}},</p><p>Action is needed on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#fff3e0;color:#e65100;border-radius:4px;font-weight:600;'>ACTION NEEDED</span></p><p>Please review and take the necessary steps.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Take Action</a></p>",
            pushTitle: 'Action Required',
            pushBody: 'Request #{{requestId}} requires your action.',
        },
        {
            name: 'finance_manager_approval_requested',
            eventType: 'FINANCE_MANAGER_APPROVAL_REQUESTED',
            emailSubject: 'Finance Approval Required — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Approval Required</h2><p>Hello {{userName}},</p><p>Your approval is required for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
            pushTitle: 'Finance Approval Required',
            pushBody: 'Request #{{requestId}} needs finance approval.',
        },
        {
            name: 'finance_manager_decision',
            eventType: 'FINANCE_MANAGER_DECISION',
            emailSubject: 'Finance Manager Decision — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Manager Decision</h2><p>Hello {{userName}},</p><p>The finance manager has made a decision on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
            pushTitle: 'Finance Manager Decision',
            pushBody: 'Finance manager reviewed request #{{requestId}}.',
        },
        {
            name: 'finance_head_approval_requested',
            eventType: 'FINANCE_HEAD_APPROVAL_REQUESTED',
            emailSubject: 'Finance Head Approval Required — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Head Approval Required</h2><p>Hello {{userName}},</p><p>Finance head approval is required for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
            pushTitle: 'Finance Head Approval Required',
            pushBody: 'Request #{{requestId}} needs finance head approval.',
        },
        {
            name: 'finance_head_decision',
            eventType: 'FINANCE_HEAD_DECISION',
            emailSubject: 'Finance Head Decision — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Head Decision</h2><p>Hello {{userName}},</p><p>The finance head has made a decision on request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
            pushTitle: 'Finance Head Decision',
            pushBody: 'Finance head reviewed request #{{requestId}}.',
        },
        {
            name: 'finance_payment_update',
            eventType: 'FINANCE_PAYMENT_UPDATE',
            emailSubject: 'Payment Update — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Payment Update</h2><p>Hello {{userName}},</p><p>There is a payment status update for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Payment Update',
            pushBody: 'Payment update for request #{{requestId}}.',
        },
        {
            name: 'request_resolved',
            eventType: 'REQUEST_RESOLVED',
            emailSubject: 'Resolved — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Resolved</h2><p>Hello {{userName}},</p><p>Request <strong>#{{requestId}} — {{requestTitle}}</strong> has been resolved.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>RESOLVED</span></p><p>If the issue persists, you can reopen this request within 7 days.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Resolved',
            pushBody: 'Request #{{requestId}} has been resolved.',
        },
        {
            name: 'approval_required',
            eventType: 'APPROVAL_REQUIRED',
            emailSubject: '{{approverRole}} Approval Needed — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Executive Approval Required</h2><p>Hello {{userName}},</p><p><strong>{{approverRole}}</strong> approval is required for request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Approval Level</td><td style='padding:8px 12px;border:1px solid #eee;'>{{approvalLevel}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#f6ad55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Review &amp; Approve</a></p>",
            pushTitle: 'Approval Required',
            pushBody: 'Request #{{requestId}} needs {{approverRole}} approval.',
        },
        {
            name: 'finance_acknowledged',
            eventType: 'FINANCE_ACKNOWLEDGED',
            emailSubject: 'Finance Acknowledged — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Finance Acknowledged</h2><p>Hello {{userName}},</p><p>Your finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been acknowledged by the Finance team.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e3f2fd;color:#1565c0;border-radius:4px;font-weight:600;'>ACKNOWLEDGED</span></p><p>The request is being reviewed and will be routed to the appropriate approver.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Finance Request Acknowledged',
            pushBody: 'Finance request #{{requestId}} acknowledged.',
        },
        {
            name: 'finance_routed_cfo',
            eventType: 'FINANCE_ROUTED_CFO',
            emailSubject: 'CFO Review — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Routed to CFO</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been routed to the Chief Financial Officer for approval.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Routed to CFO',
            pushBody: 'Request #{{requestId}} routed to CFO.',
        },
        {
            name: 'finance_cfo_decision',
            eventType: 'FINANCE_CFO_DECISION',
            emailSubject: 'CFO Decision — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>CFO Decision</h2><p>Hello {{userName}},</p><p>The CFO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
            pushTitle: 'CFO Decision',
            pushBody: 'CFO reviewed request #{{requestId}}.',
        },
        {
            name: 'finance_group_ceo_decision',
            eventType: 'FINANCE_GROUP_CEO_DECISION',
            emailSubject: 'Group CEO Decision — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Group CEO Decision</h2><p>Hello {{userName}},</p><p>The Group CEO has made a decision on finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><p>This request was escalated to Group CEO level due to the amount exceeding the CFO approval threshold.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Request ID</td><td style='padding:8px 12px;border:1px solid #eee;'>#{{requestId}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr></table><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Decision</a></p>",
            pushTitle: 'Group CEO Decision',
            pushBody: 'Group CEO reviewed request #{{requestId}}.',
        },
        {
            name: 'finance_payment_complete',
            eventType: 'FINANCE_PAYMENT_COMPLETE',
            emailSubject: 'Payment Complete — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>Payment Complete</h2><p>Hello {{userName}},</p><p>Payment has been completed for finance request <strong>#{{requestId}} — {{requestTitle}}</strong>.</p><table style='width:100%;border-collapse:collapse;margin:16px 0;'><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;width:140px;'>Amount</td><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;'>{{currency}} {{amount}}</td></tr><tr><td style='padding:8px 12px;border:1px solid #eee;font-weight:600;background:#f8f9fa;'>Payment Ref</td><td style='padding:8px 12px;border:1px solid #eee;'>{{paymentRef}}</td></tr></table><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>PAID</span></p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Payment Complete',
            pushBody: 'Payment for request #{{requestId}} completed.',
        },
        {
            name: 'finance_ticket_closed',
            eventType: 'FINANCE_TICKET_CLOSED',
            emailSubject: 'Closed — Request #{{requestId}}',
            emailBody: "<h2 style='margin:0 0 16px;color:#2e7d32;'>Request Closed</h2><p>Hello {{userName}},</p><p>Finance request <strong>#{{requestId}} — {{requestTitle}}</strong> has been formally closed.</p><p style='margin:8px 0;'><span style='display:inline-block;padding:6px 16px;background:#e8f5e9;color:#2e7d32;border-radius:4px;font-weight:600;'>CLOSED</span></p><p>All approvals and payments for this request have been completed.</p><p style='margin:24px 0 0;'><a href='{{appUrl}}/#/requests/{{requestId}}' style='display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>View Request</a></p>",
            pushTitle: 'Request Closed',
            pushBody: 'Finance request #{{requestId}} closed.',
        },
        {
            name: 'password_reset',
            eventType: 'PASSWORD_RESET',
            emailSubject: 'Password Reset Request — Citadel Help Center',
            emailBody: "<h2 style='margin:0 0 16px;color:#1a1a2e;'>Password Reset</h2><p>Hello {{userName}},</p><p>You requested a password reset for your Citadel Help Center account.</p><p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p><p style='margin:24px 0;'><a href='{{resetUrl}}' style='display:inline-block;padding:12px 24px;background:#e53e3e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>Reset Password</a></p><p style='font-size:13px;color:#666;'>If the button doesn't work, copy and paste this URL into your browser:<br/><a href='{{resetUrl}}' style='color:#1a1a2e;word-break:break-all;'>{{resetUrl}}</a></p><p style='margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:13px;color:#999;'>If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>",
            pushTitle: 'Password Reset',
            pushBody: 'Password reset requested for your account.',
        },
    ];

        for (const template of templates) {
            await prisma.notificationTemplate.upsert({
                where: { name: template.name },
                update: { emailSubject: template.emailSubject, emailBody: template.emailBody },
                create: template,
            });
        }

        console.log('✅ Notification templates created');
    }

    // Seed onboarding task templates
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping onboarding task templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
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
    }

    // Seed offboarding task templates
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping offboarding task templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
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
    }

    // Banner Configs — default configs matching former hardcoded ActionBanner logic
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping banner configs (RETAIN_ADMIN_CONFIG enabled)');
    } else {
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
    }

    // Request Status Definitions
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping request status definitions (RETAIN_ADMIN_CONFIG enabled)');
    } else {
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
        // FINANCE WORKFLOW - PURCHASE REQUISITION
        { code: 'FINANCE_PENDING_ACK',             label: 'Pending Finance Acknowledgement',     category: 'FINANCE', displayOrder: 70 },
        { code: 'FINANCE_ACKNOWLEDGED',            label: 'Finance Acknowledged',                category: 'FINANCE', displayOrder: 71 },
        { code: 'FINANCE_IN_PROGRESS',             label: 'Finance In Progress',                 category: 'FINANCE', displayOrder: 72 },
        { code: 'PENDING_CFO_APPROVAL_FIN',        label: 'Pending CFO Approval (Finance)',      category: 'FINANCE', displayOrder: 73 },
        { code: 'CFO_APPROVED_FIN',                label: 'CFO Approved (Finance)',              category: 'FINANCE', displayOrder: 74 },
        { code: 'CFO_REJECTED_FIN',                label: 'CFO Rejected (Finance)',              category: 'FINANCE', displayOrder: 75 },
        { code: 'PENDING_GROUP_CEO_APPROVAL',      label: 'Pending Group CEO Approval',          category: 'FINANCE', displayOrder: 76 },
        { code: 'GROUP_CEO_APPROVED',              label: 'Group CEO Approved',                  category: 'FINANCE', displayOrder: 77 },
        { code: 'GROUP_CEO_REJECTED',              label: 'Group CEO Rejected',                  category: 'FINANCE', displayOrder: 78 },
        { code: 'PAYMENT_PROCESSING_FIN',          label: 'Payment Processing (Finance)',        category: 'FINANCE', displayOrder: 79 },
        { code: 'AWAITING_PAYMENT_CONFIRMATION',   label: 'Awaiting Payment Confirmation',        category: 'FINANCE', displayOrder: 80 },
        { code: 'PAYMENT_CONFIRMED_FIN',           label: 'Payment Confirmed (Finance)',         category: 'FINANCE', displayOrder: 81 },
        { code: 'TICKET_CLOSED_FIN',               label: 'Ticket Closed (Finance)',             category: 'FINANCE', displayOrder: 82 },
    ];

        for (const def of statusDefinitions) {
            await prisma.requestStatusDefinition.upsert({
                where: { code: def.code },
                update: {},
                create: { ...def, isActive: true },
            });
        }
        console.log(`Seeded ${statusDefinitions.length} request status definitions`);
    }
    // ── Seed Knowledge Base Articles ──
    const kbArticles = [
        // IT Support articles
        {
            serviceDeskId: itDesk.id,
            title: 'How to Reset Your Password',
            slug: 'how-to-reset-your-password',
            content: `## Password Reset Guide\n\nIf you have forgotten your password or your account has been locked, follow these steps to regain access.\n\n### Self-Service Password Reset\n\n1. Go to the login page and click **"Forgot Password"**\n2. Enter your company email address\n3. Check your inbox for the reset link (valid for 30 minutes)\n4. Click the link and set a new password\n5. Password requirements: minimum 8 characters, at least one uppercase, one lowercase, and one number\n\n### Contact IT Support\n\nIf self-service reset is unavailable:\n- Submit an IT Support request under the **Account & Access** category\n- An agent will verify your identity and reset your password\n- New temporary credentials will be sent to your registered email\n\n### Common Issues\n\n- **Reset link expired**: Request a new one — links expire after 30 minutes\n- **Didn't receive email**: Check spam/junk folder, or contact IT\n- **Account locked**: Wait 15 minutes before retrying, or contact IT Support`,
            excerpt: 'Step-by-step guide to resetting your company password via self-service or IT Support.',
            category: 'Account & Access',
            tags: ['password', 'reset', 'account', 'login'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'VPN Setup and Troubleshooting',
            slug: 'vpn-setup-and-troubleshooting',
            content: `## VPN Configuration Guide\n\nAll remote workers must use the company VPN to access internal resources securely.\n\n### Installing the VPN Client\n\n1. Download the VPN client from the IT Downloads portal\n2. Run the installer with default settings\n3. When prompted, enter the server address: **vpn.citadelgroup.local**\n4. Use your standard company credentials to authenticate\n\n### Connecting to the VPN\n\n1. Launch the VPN client\n2. Select **"Corporate Network"** profile\n3. Enter your username and password\n4. Click **Connect**\n5. Wait for the status to show **"Connected"**\n\n### Troubleshooting\n\n- **Connection timeout**: Check your internet connection, then try an alternate server (vpn2.citadelgroup.local)\n- **Authentication failed**: Ensure you are using your current credentials — try resetting your password first\n- **Slow performance**: Switch to the nearest server region in client settings\n- **Client won't start**: Reinstall the client or run the repair tool from IT Downloads`,
            excerpt: 'Configure and troubleshoot the company VPN for secure remote access.',
            category: 'Network & Connectivity',
            tags: ['vpn', 'remote', 'network', 'security'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'Requesting New Software or Hardware',
            slug: 'requesting-new-software-or-hardware',
            content: `## Software & Hardware Procurement\n\nNeed new software or equipment? Follow the procurement process below.\n\n### Software Requests\n\n1. Check the **Approved Software Catalog** first — if the software is listed, submit an IT request under **Software & Applications**\n2. For software NOT in the catalog, submit an **IT Procurement** request with:\n   - Software name and version\n   - Business justification\n   - Number of licenses needed\n   - Approximate cost (if known)\n3. The request will go through manager approval, then IT review\n\n### Hardware Requests\n\n1. Submit an **IT Procurement** request under the **Hardware & Devices** category\n2. Include:\n   - Type of hardware (laptop, monitor, peripherals)\n   - Preferred specifications\n   - Business justification\n3. Standard hardware configurations are pre-approved — custom specs require additional review\n\n### Turnaround Time\n\n- **Standard software**: 1–2 business days after approval\n- **New software (not in catalog)**: 5–10 business days\n- **Standard hardware**: 3–5 business days after approval\n- **Custom hardware**: 2–4 weeks`,
            excerpt: 'How to request new software licenses or hardware through the procurement workflow.',
            category: 'Software & Applications',
            tags: ['procurement', 'software', 'hardware', 'request'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'Setting Up Multi-Factor Authentication (MFA)',
            slug: 'setting-up-multi-factor-authentication',
            content: `## MFA Setup Guide\n\nMFA is mandatory for all company accounts. Set it up using Microsoft Authenticator or your preferred TOTP app.\n\n### Step-by-Step Setup\n\n1. Log in to the **Security Settings** portal\n2. Click **"Enable MFA"**\n3. Scan the QR code with Microsoft Authenticator (or Google Authenticator)\n4. Enter the 6-digit verification code to confirm setup\n5. Save your **recovery codes** in a secure location — you will need these if you lose access to your authenticator app\n\n### Using MFA Daily\n\n- You will be prompted for a verification code each time you log in\n- Codes refresh every 30 seconds\n- Some applications support "Remember this device for 30 days"\n\n### Lost or Broken Device\n\n1. Use one of your **recovery codes** to log in\n2. Go to Security Settings → MFA → **"Reset MFA Device"**\n3. Set up MFA on your new device\n4. If you have no recovery codes, contact IT Support immediately`,
            excerpt: 'Configure MFA on your account for enhanced security compliance.',
            category: 'Account & Access',
            tags: ['mfa', 'security', 'authentication', '2fa'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // HR articles
        {
            serviceDeskId: hrDesk.id,
            title: 'Leave of Absence (LOA) Policy and Application',
            slug: 'leave-of-absence-policy-and-application',
            content: `## Leave of Absence Guide\n\nEmployees may apply for various types of leave through the HR Services portal.\n\n### Leave Types\n\n| Type | Entitlement | Approval |\n|------|-------------|----------|\n| Annual Leave | 14 days/year | Manager |\n| Medical Leave | 14 days/year | Manager + MC |\n| Emergency Leave | As needed | Manager |\n| Unpaid Leave | Case-by-case | Manager + HR |\n\n### How to Apply\n\n1. Navigate to **HR Services** → **Leave Management**\n2. Select the leave type\n3. Fill in the dates and reason\n4. Upload supporting documents (e.g., medical certificate)\n5. Submit for manager approval\n\n### Important Notes\n\n- Annual leave must be applied **at least 3 days in advance**\n- Medical leave requires a valid MC submitted within **24 hours**\n- Leave balance can be checked on your HR dashboard\n- Unconsumed annual leave may be carried forward (max 5 days) to the next year`,
            excerpt: 'Understand leave types, entitlements, and how to apply through the HR portal.',
            category: 'Leave Management',
            tags: ['leave', 'loa', 'vacation', 'hr', 'policy'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: hrDesk.id,
            title: 'Employee Benefits Overview',
            slug: 'employee-benefits-overview',
            content: `## Benefits Package\n\nCitadel Group offers a comprehensive benefits package for all permanent employees.\n\n### Medical & Insurance\n\n- **Group Hospitalization**: Full coverage under company panel hospitals\n- **Outpatient**: RM 500/year reimbursement for non-panel visits\n- **Dental**: RM 300/year for basic dental procedures\n\n### Allowances\n\n- **Transport**: RM 200/month for eligible roles\n- **Meal**: RM 15/day for overtime beyond 7:30 PM\n- **Communication**: RM 50/month mobile allowance\n\n### Professional Development\n\n- **Training Budget**: RM 3,000/year per employee\n- **Certification Fee**: One professional certification per year (full reimbursement)\n- **Conference Attendance**: Subject to manager approval\n\n### How to Claim\n\nSubmit a request through **HR Services** → **Benefits & Claims** with supporting receipts. Claims are processed within 5 business days.`,
            excerpt: 'Overview of medical, insurance, allowances, and professional development benefits.',
            category: 'Benefits & Compensation',
            tags: ['benefits', 'insurance', 'allowance', 'medical', 'hr'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // Finance articles
        {
            serviceDeskId: financeDesk.id,
            title: 'How to Submit an Expense Claim',
            slug: 'how-to-submit-an-expense-claim',
            content: `## Expense Claim Process\n\nFollow these steps to submit and track your business expense claims.\n\n### Eligible Expenses\n\n- Business travel (flights, hotels, transport)\n- Client entertainment (meals, events)\n- Office supplies (when procured independently)\n- Training and certifications\n\n### Submitting a Claim\n\n1. Navigate to **Group Finance** → **Expense Claims**\n2. Click **"New Claim"**\n3. Fill in expense details:\n   - Category and sub-category\n   - Amount and currency\n   - Date of expense\n   - Business justification\n4. Upload supporting receipts (PDF or image)\n5. Submit for manager approval\n\n### Approval Workflow\n\n1. **Manager Review** — Verifies business justification\n2. **Finance Review** — Validates receipts and compliance\n3. **CFO Approval** — For claims above RM 5,000\n4. **Payment Processing** — 5–7 business days after final approval\n\n### Claim Limits\n\n- Maximum per claim: RM 50,000\n- Receipt required for any item above RM 50\n- Claims must be submitted within **30 days** of the expense date`,
            excerpt: 'Step-by-step guide for submitting and tracking business expense claims.',
            category: 'Expense Management',
            tags: ['expense', 'claim', 'reimbursement', 'finance'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: financeDesk.id,
            title: 'Purchase Requisition Guide',
            slug: 'purchase-requisition-guide',
            content: `## Purchase Requisition (PR) Process\n\nAll departmental purchases must go through the formal requisition workflow.\n\n### When to Submit a PR\n\n- Office equipment and furniture\n- Software subscriptions and licenses\n- Consulting and professional services\n- Any purchase exceeding RM 500\n\n### PR Workflow\n\n1. **Submit Request** via Group Finance → Purchase Requisition\n2. **Finance Acknowledgement** — Finance verifies budget allocation\n3. **Finance Processing** — PO created and sent to vendor\n4. **CFO Approval** — Required for purchases above RM 10,000\n5. **Group CEO Approval** — Required for purchases above RM 50,000\n6. **Payment** — Processed after goods/services received\n\n### Required Information\n\n- Item description and specifications\n- Quantity and estimated unit cost\n- Preferred vendor (if any)\n- Budget code / cost center\n- Expected delivery date\n- Business justification\n\n### Turnaround Time\n\n- Under RM 10,000: 5–7 business days\n- RM 10,000–50,000: 10–15 business days\n- Above RM 50,000: 15–20 business days`,
            excerpt: 'Complete guide for submitting and tracking purchase requisitions through approval workflow.',
            category: 'Procurement',
            tags: ['purchase', 'requisition', 'procurement', 'finance', 'approval'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
    ];

    for (const article of kbArticles) {
        await prisma.knowledgeBaseArticle.upsert({
            where: { slug: article.slug },
            update: {},
            create: article,
        });
    }
    console.log(`✅ Seeded ${kbArticles.length} knowledge base articles`);

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
