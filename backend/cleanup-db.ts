import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    try {
        console.log('🧹 Cleaning up database duplicates...');

        // Delete all request types first (children)
        await prisma.requestType.deleteMany({});

        // Delete all categories (parents)
        await prisma.serviceCategory.deleteMany({});

        // We keep ServiceDesks and Users as they use upsert

        console.log('✅ Deleted all Categories and Request Types.');
        console.log('🚀 Now run: npm run prisma:seed');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
