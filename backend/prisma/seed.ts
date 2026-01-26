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
                { id: 'hw_name', label: 'Hardware Name', type: 'text', required: true },
                { id: 'hw_model', label: 'Preferred Model', type: 'text', required: false },
                { id: 'hw_reason', label: 'Business Justification', type: 'textarea', required: true }
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
                    isActive: true
                }
            });
        }
    }

    console.log('✅ Service categories created');

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
    ];

    for (const template of templates) {
        await prisma.notificationTemplate.upsert({
            where: { name: template.name },
            update: {},
            create: template,
        });
    }

    console.log('✅ Notification templates created');

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
