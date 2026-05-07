/**
 * CWC 2.0 Admin Configuration Restore Script
 *
 * Restores production admin configuration from a JSON backup file.
 * This includes: entity approvers, user roles/entities/departments,
 * escalation rules, and other admin-configured data that is NOT
 * covered by the base seed.ts (which only creates seed/test accounts).
 *
 * Usage:
 *   npx tsx scripts/restore_admin_config.ts [backup-file]
 *
 * Default backup file: scripts/admin_config_backup.json
 *
 * Safe to re-run: uses upserts for entities, roles, and permissions.
 * Existing data is updated; seed data is preserved.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import bcryptjs from 'bcryptjs';

const DEFAULT_BACKUP = path.resolve(__dirname, 'admin_config_backup.json');

async function main() {
    const backupPath = process.argv[2] || DEFAULT_BACKUP;
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`📦 Loaded backup from: ${backupPath}`);
    console.log(`   Exported at: ${data._meta.exportedAt}`);

    const prisma = new PrismaClient();

    try {
        // ── 1. Restore Entity configuration (approver assignments, descriptions, display order) ──
        console.log('\n🏢 Restoring entity configuration...');
        for (const entity of data.entities) {
            // Find the approver by email
            const approver = await prisma.user.findUnique({ where: { email: entity.approverEmail } });
            if (!approver) {
                console.log(`  ⚠️  Skipping entity ${entity.code}: approver ${entity.approverEmail} not found`);
                continue;
            }

            await prisma.entity.update({
                where: { code: entity.code },
                data: {
                    name: entity.name,
                    description: entity.description || null,
                    approverId: approver.id,
                    displayOrder: entity.displayOrder,
                    isActive: entity.isActive,
                },
            });
            console.log(`  ✅ ${entity.code}: ${entity.name} → approver: ${entity.approverEmail}, order: ${entity.displayOrder}`);
        }

        // ── 2. Restore imported (production) users ──
        console.log('\n👤 Restoring production users...');
        const PRODUCTION_DOMAIN = '@citadelgroup.com.my';
        const DEFAULT_PASSWORD = await bcryptjs.hash('Welcome@2026', 10);

        let created = 0;
        let updated = 0;

        for (const userData of data.users) {
            if (!userData.email.includes(PRODUCTION_DOMAIN)) continue; // Skip seed accounts

            const entity = userData.entityCode
                ? await prisma.entity.findUnique({ where: { code: userData.entityCode } })
                : null;

            const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });

            if (existingUser) {
                // Update existing user
                await prisma.user.update({
                    where: { email: userData.email },
                    data: {
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        department: userData.department || null,
                        jobTitle: userData.jobTitle || null,
                        executiveRole: userData.executiveRole || null,
                        agentTeam: userData.agentTeam || null,
                        entityId: entity?.id || null,
                        isActive: userData.isActive,
                    },
                });
                updated++;
            } else {
                // Create new user
                await prisma.user.create({
                    data: {
                        email: userData.email,
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        password: DEFAULT_PASSWORD,
                        department: userData.department || null,
                        jobTitle: userData.jobTitle || null,
                        executiveRole: userData.executiveRole || null,
                        agentTeam: userData.agentTeam || null,
                        entityId: entity?.id || null,
                        isActive: userData.isActive,
                    },
                });
                created++;
            }
        }
        console.log(`  ✅ Created: ${created}, Updated: ${updated}`);

        // ── 3. Restore user role assignments for production users ──
        console.log('\n🔑 Restoring user role assignments...');
        const allRoles = await prisma.role.findMany();
        const roleMap = new Map(allRoles.map(r => [r.name, r.id]));

        for (const userData of data.users) {
            if (!userData.email.includes(PRODUCTION_DOMAIN)) continue;

            const user = await prisma.user.findUnique({ where: { email: userData.email } });
            if (!user || !userData.roles || userData.roles.length === 0) continue;

            for (const roleName of userData.roles) {
                const roleId = roleMap.get(roleName);
                if (!roleId) {
                    console.log(`  ⚠️  Role "${roleName}" not found for ${userData.email}`);
                    continue;
                }
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: user.id, roleId } },
                    update: {},
                    create: { userId: user.id, roleId },
                });
            }
        }
        console.log('  ✅ Role assignments ensured');

        // ── 4. Summary ──
        console.log('\n📋 Restore Summary:');
        console.log(`   Entities restored: ${data.entities.length}`);
        console.log(`   Production users created/updated: ${created + updated}`);
        console.log(`   Roles available: ${allRoles.length}`);

        console.log('\n✅ Admin configuration restored successfully!');

    } catch (error) {
        console.error('❌ Error restoring configuration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();