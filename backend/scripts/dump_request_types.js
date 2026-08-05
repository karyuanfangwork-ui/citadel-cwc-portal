const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    const rts = await prisma.requestType.findMany({
        orderBy: { code: 'asc' },
        select: {
            code: true, name: true, description: true, formConfig: true,
            slaHours: true, requiresApproval: true, isActive: true, requiredRole: true,
            serviceCategory: { select: { name: true, description: true, icon: true, colorClass: true, displayOrder: true, isActive: true, serviceDesk: { select: { code: true } } } }
        }
    });
    for (const rt of rts) {
        console.log('=== ' + rt.code + ' ===');
        console.log(JSON.stringify(rt, null, 2));
    }
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });