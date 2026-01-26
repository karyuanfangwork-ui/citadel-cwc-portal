const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupAndReseed() {
    try {
        console.log('🧹 Cleaning up IT Support categories...');

        const itDesk = await prisma.serviceDesk.findUnique({
            where: { code: 'IT' }
        });

        if (!itDesk) {
            console.log('❌ IT Desk not found!');
            return;
        }

        // Delete all IT categories and their request types
        const categories = await prisma.serviceCategory.findMany({
            where: { serviceDeskId: itDesk.id }
        });

        for (const cat of categories) {
            await prisma.requestType.deleteMany({
                where: { serviceCategoryId: cat.id }
            });
        }

        await prisma.serviceCategory.deleteMany({
            where: { serviceDeskId: itDesk.id }
        });

        console.log('✅ Deleted all IT categories and request types');

        // Now create the correct categories
        const itCategories = [
            { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1 },
            { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2 },
            { name: 'Report System problem', icon: 'report', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3 },
            { name: 'Request Software Installation', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4 },
            { name: 'Request new hardware', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5 },
        ];

        for (const category of itCategories) {
            const cat = await prisma.serviceCategory.create({
                data: {
                    ...category,
                    serviceDeskId: itDesk.id,
                },
            });

            // Create default request type
            let formConfig = [];
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

            await prisma.requestType.create({
                data: {
                    serviceCategoryId: cat.id,
                    name: `General ${category.name}`,
                    description: `Submit a request related to ${category.name}`,
                    icon: category.icon,
                    formConfig,
                    isActive: true
                }
            });
        }

        console.log('✅ Created clean IT categories with correct names');
        console.log('\n📊 Final state:');

        const finalCategories = await prisma.serviceCategory.findMany({
            where: { serviceDeskId: itDesk.id },
            include: { requestTypes: true },
            orderBy: { displayOrder: 'asc' }
        });

        for (const cat of finalCategories) {
            console.log(`   ${cat.displayOrder}. ${cat.name} (${cat.requestTypes.length} request types)`);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAndReseed();
