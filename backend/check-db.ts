import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        const desks = await prisma.serviceDesk.findMany({
            include: {
                categories: {
                    include: {
                        requestTypes: true
                    }
                }
            }
        });

        for (const desk of desks) {
            console.log(`\nDesk: ${desk.name} (${desk.code})`);
            for (const cat of desk.categories) {
                console.log(`  - Category: ${cat.name} (${cat.id})`);
                for (const rt of cat.requestTypes) {
                    console.log(`    * Request Type: ${rt.name} (${rt.id})`);
                }
                if (cat.requestTypes.length === 0) {
                    console.log(`    !!! NO REQUEST TYPES !!!`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
