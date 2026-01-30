const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createCEO() {
    try {
        console.log('Creating CEO role and user...');

        // Create CEO role
        const ceoRole = await prisma.role.upsert({
            where: { name: 'CEO' },
            update: {},
            create: {
                name: 'CEO',
                description: 'Chief Executive Officer with approval authority',
            },
        });
        console.log('✅ CEO role created');

        // Create CEO user
        const hashedPassword = await bcrypt.hash('ceo123', 10);

        const ceoUser = await prisma.user.upsert({
            where: { email: 'ceo@company.com' },
            update: {
                passwordHash: hashedPassword,
                firstName: 'Chief',
                lastName: 'Executive',
                department: 'Executive',
                jobTitle: 'Chief Executive Officer',
            },
            create: {
                email: 'ceo@company.com',
                passwordHash: hashedPassword,
                firstName: 'Chief',
                lastName: 'Executive',
                department: 'Executive',
                jobTitle: 'Chief Executive Officer',
                isActive: true,
            },
        });
        console.log('✅ CEO user created');

        // Assign CEO role
        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: ceoUser.id,
                    roleId: ceoRole.id,
                },
            },
            update: {},
            create: {
                userId: ceoUser.id,
                roleId: ceoRole.id,
            },
        });
        console.log('✅ CEO role assigned');

        console.log('\n🎉 CEO account created successfully!');
        console.log('Email: ceo@company.com');
        console.log('Password: ceo123');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createCEO();
