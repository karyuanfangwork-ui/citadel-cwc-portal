import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createMissingTypes() {
    try {
        const categories = await prisma.serviceCategory.findMany({
            include: {
                requestTypes: true
            }
        });

        console.log(`Checking ${categories.length} categories...`);

        for (const cat of categories) {
            if (cat.requestTypes.length === 0) {
                console.log(`Creating default request type for category: ${cat.name}`);
                await prisma.requestType.create({
                    data: {
                        serviceCategoryId: cat.id,
                        name: `General ${cat.name} Request`,
                        description: `Submit a request related to ${cat.name}`,
                        icon: cat.icon || 'bolt',
                        isActive: true,
                        requiresApproval: false
                    }
                });
            }
        }

        console.log('✅ All categories now have at least one request type.');
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

createMissingTypes();
