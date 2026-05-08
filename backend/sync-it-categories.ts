import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database sync...');

    // 1. Service Desks
    const itDesk = await prisma.serviceDesk.upsert({
        where: { code: 'IT' },
        update: {},
        create: {
            name: 'IT Support',
            code: 'IT',
            description: 'Technical support for hardware, software, and infrastructure',
        },
    });

    // 2. Clear stale IT categories and types to ensure sync
    // We only do this for the sync script to ensure names match the user's image
    await prisma.requestType.deleteMany({
        where: { serviceCategory: { serviceDeskId: itDesk.id } }
    });
    await prisma.serviceCategory.deleteMany({
        where: { serviceDeskId: itDesk.id }
    });

    // 3. User's Desired IT Categories (Matching the Image)
    const itCategories = [
        { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1,
          requestTypeName: 'Get IT Help Request', requestTypeCode: 'GET_IT_HELP' },
        { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
          requestTypeName: 'General Email Management Request', requestTypeCode: 'EMAIL_MANAGEMENT' },
        { name: 'Report System problem', icon: 'key', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3,
          requestTypeName: 'General Report System Problem Request', requestTypeCode: 'REPORT_SYSTEM_PROBLEM' },
        { name: 'Request Software Installation', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4,
          requestTypeName: 'General Request Software Installation Request', requestTypeCode: 'SOFTWARE_INSTALLATION' },
        { name: 'Request new hardware', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5,
          requestTypeName: 'General Request New Hardware Request', requestTypeCode: 'NEW_HARDWARE' },
    ];

    for (const category of itCategories) {
        const cat = await prisma.serviceCategory.create({
            data: {
                name: category.name,
                icon: category.icon,
                colorClass: category.colorClass,
                displayOrder: category.displayOrder,
                serviceDeskId: itDesk.id,
            },
        });

        // Add a primary request type for each category
        let formConfig: any[] = [];
        if (category.requestTypeCode === 'NEW_HARDWARE') {
            formConfig = [
                { id: 'hw_name', label: 'Hardware Name', type: 'text', required: true },
                { id: 'hw_model', label: 'Preferred Model', type: 'text', required: false },
                { id: 'hw_reason', label: 'Business Justification', type: 'textarea', required: true }
            ];
        } else if (category.requestTypeCode === 'SOFTWARE_INSTALLATION') {
            formConfig = [
                { id: 'sw_name', label: 'Software Name', type: 'text', required: true },
                { id: 'sw_version', label: 'Version Number', type: 'text', required: false }
            ];
        }

        await prisma.requestType.create({
            data: {
                serviceCategoryId: cat.id,
                code: category.requestTypeCode,
                name: category.requestTypeName,
                description: `Submit a request related to ${category.name}`,
                icon: category.icon,
                formConfig,
                isActive: true
            }
        });
    }

    console.log('✅ IT Support synchronized perfectly with user vision.');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
