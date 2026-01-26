const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database sync...');

    const itDesk = await prisma.serviceDesk.findUnique({
        where: { code: 'IT' }
    });

    if (!itDesk) {
        console.log('IT Desk not found!');
        return;
    }

    // 1. Delete all IT request types and categories to reset
    const categories = await prisma.serviceCategory.findMany({
        where: { serviceDeskId: itDesk.id }
    });

    for (const cat of categories) {
        await prisma.requestType.deleteMany({ where: { serviceCategoryId: cat.id } });
    }
    await prisma.serviceCategory.deleteMany({ where: { serviceDeskId: itDesk.id } });

    // 2. Desired IT Categories
    const itCategories = [
        { name: 'Get IT help', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1 },
        { name: 'Email Management', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2 },
        { name: 'Report System problem', icon: 'key', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3 },
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

        await prisma.requestType.create({
            data: {
                serviceCategoryId: cat.id,
                name: `General ${category.name} Request`,
                description: `Submit a request related to ${category.name}`,
                icon: category.icon,
                isActive: true
            }
        });
    }

    console.log('✅ Synchronized IT Support categories.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
