import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
    SEED_NOTIFICATION_TEMPLATES,
    SEED_STATUS_DEFINITIONS,
    SEED_WORKFLOW_TRANSITIONS,
    SEED_BANNER_CONFIGS,
    SEED_ONBOARDING_TEMPLATES,
    SEED_OFFBOARDING_TEMPLATES,
    SEED_ESCALATION_RULES,
    SEED_ENTITY_CONFIG,
    SEED_PRODUCTION_USERS,
} from './seed-admin-config';
import { seedWorkflows } from './seed-workflows';

const prisma = new PrismaClient();

// Safety flag: Set RETAIN_ADMIN_CONFIG=true to preserve all admin console settings
// Only re-seeds account management (users, roles, permissions)
const RETAIN_ADMIN_CONFIG = process.env.RETAIN_ADMIN_CONFIG === 'true';

async function main() {
    console.log('🌱 Starting database seed...');
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⚠️  RETAIN_ADMIN_CONFIG enabled - preserving admin console settings');
    }

    // Create Service Desks
    const itDesk = await prisma.serviceDesk.upsert({
        where: { code: 'IT' },
        update: RETAIN_ADMIN_CONFIG ? {} : { autoAssignTeam: 'IT' },
        create: {
            name: 'IT Support',
            code: 'IT',
            description: 'Technical support for hardware, software, and infrastructure',
            isActive: true,
            autoAssignTeam: 'IT',
            assignmentStrategy: 'ROUND_ROBIN',
        },
    });

    const hrDesk = await prisma.serviceDesk.upsert({
        where: { code: 'HR' },
        update: RETAIN_ADMIN_CONFIG ? {} : { autoAssignTeam: 'HR' },
        create: {
            name: 'HR Services',
            code: 'HR',
            description: 'Human resources support for employees',
            isActive: true,
            autoAssignTeam: 'HR',
            assignmentStrategy: 'ROUND_ROBIN',
        },
    });

    const financeDesk = await prisma.serviceDesk.upsert({
        where: { code: 'FINANCE' },
        update: RETAIN_ADMIN_CONFIG ? {} : { autoAssignTeam: 'FINANCE' },
        create: {
            name: 'Group Finance',
            code: 'FINANCE',
            description: 'Financial services and expense management',
            isActive: true,
            autoAssignTeam: 'FINANCE',
            assignmentStrategy: 'ROUND_ROBIN',
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

    const itAgentRole = await prisma.role.upsert({
        where: { name: 'IT_AGENT' },
        update: {},
        create: {
            name: 'IT_AGENT',
            description: 'IT Support Agent — includes IT Asset management',
        },
    });

    const normalStaffRole = await prisma.role.upsert({
        where: { name: 'NORMAL_STAFF' },
        update: {},
        create: {
            name: 'NORMAL_STAFF',
            description: 'Normal staff member who can create requests and access knowledge base',
        },
    });

    const ceoRole = await prisma.role.upsert({
        where: { name: 'CEO' },
        update: {},
        create: {
            name: 'CEO',
            description: 'Chief Executive Officer with approval authority',
        },
    });

    const ctoRole = await prisma.role.upsert({
        where: { name: 'CTO' },
        update: {},
        create: {
            name: 'CTO',
            description: 'Chief Technology Officer with IT approval authority',
        },
    });

    const cfoRole = await prisma.role.upsert({
        where: { name: 'CFO' },
        update: {},
        create: {
            name: 'CFO',
            description: 'Chief Financial Officer with finance approval authority',
        },
    });

    await prisma.role.upsert({
        where: { name: 'CMO' },
        update: {},
        create: {
            name: 'CMO',
            description: 'Chief Marketing Officer with marketing approval authority',
        },
    });

    await prisma.role.upsert({
        where: { name: 'GROUP_CEO' },
        update: {},
        create: {
            name: 'GROUP_CEO',
            description: 'Group Chief Executive Officer with highest approval authority',
        },
    });

    await prisma.role.upsert({
        where: { name: 'HIRING_MANAGER' },
        update: {},
        create: { name: 'HIRING_MANAGER', description: 'Can raise and manage HR hiring requests' }
    });

    await prisma.role.upsert({
        where: { name: 'FINANCE_HEAD' },
        update: {},
        create: { name: 'FINANCE_HEAD', description: 'Can approve expense reimbursement requests as Finance Head' }
    });

    await prisma.role.upsert({
        where: { name: 'SALES_MANAGER' },
        update: {},
        create: { name: 'SALES_MANAGER', description: 'CRM Sales Manager — full CRM access including pipeline management' }
    });

    await prisma.role.upsert({
        where: { name: 'SALES_REP' },
        update: {},
        create: { name: 'SALES_REP', description: 'CRM Sales Representative — can manage own accounts, leads, and deals' }
    });

    console.log('✅ Roles created');

    console.log('📋 Creating permission list...');
    const permissions = [
        { name: 'request:create', resource: 'request', action: 'create', description: 'Create new requests' },
        { name: 'request:read', resource: 'request', action: 'read', description: 'View requests' },
        { name: 'request:update', resource: 'request', action: 'update', description: 'Update requests' },
        { name: 'request:delete', resource: 'request', action: 'delete', description: 'Delete requests' },
        { name: 'request:approve', resource: 'request', action: 'approve', description: 'Approve requests' },
        { name: 'request:assign', resource: 'request', action: 'assign', description: 'Assign requests to agents' },
        { name: 'request:confidential', resource: 'request', action: 'confidential', description: 'View confidential requests' },
        { name: 'user:manage', resource: 'user', action: 'manage', description: 'Manage users' },
        { name: 'admin:access', resource: 'admin', action: 'access', description: 'Access admin panel' },
        { name: 'admin:settings', resource: 'admin', action: 'settings', description: 'Modify system settings' },
        { name: 'report:read', resource: 'report', action: 'read', description: 'View reports' },
        { name: 'kb:manage', resource: 'kb', action: 'manage', description: 'Manage knowledge base articles' },
        { name: 'notification:manage', resource: 'notification', action: 'manage', description: 'Manage notification templates' },
        { name: 'workflow:manage', resource: 'workflow', action: 'manage', description: 'Manage workflow transitions' },
        { name: 'banner:manage', resource: 'banner', action: 'manage', description: 'Manage banner configurations' },
        { name: 'asset:read', resource: 'asset', action: 'read', description: 'View IT asset registry and employee assets' },
        { name: 'asset:write', resource: 'asset', action: 'write', description: 'Register, edit, assign, and return IT assets' },
        { name: 'asset:import', resource: 'asset', action: 'import', description: 'Bulk CSV import of IT assets' },
        { name: 'asset:delete', resource: 'asset', action: 'delete', description: 'Dispose or soft-delete IT assets' },
        // CRM permissions
        { name: 'crm:read', resource: 'crm', action: 'read', description: 'View CRM accounts, contacts, leads, opportunities, and pipeline' },
        { name: 'crm:write', resource: 'crm', action: 'write', description: 'Create and edit CRM records' },
        { name: 'crm:delete', resource: 'crm', action: 'delete', description: 'Delete CRM records' },
        { name: 'crm:admin', resource: 'crm', action: 'admin', description: 'Manage CRM pipelines and system settings' },
        // Announcement permissions
        { name: 'announcement:read', resource: 'announcement', action: 'read', description: 'View announcements' },
        { name: 'announcement:write', resource: 'announcement', action: 'write', description: 'Create and edit announcements' },
        { name: 'announcement:admin', resource: 'announcement', action: 'admin', description: 'Delete and manage announcements' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }

    console.log('✅ Permissions created');

    // --- Seed RolePermission assignments ---
    // This maps each role to the permissions they should have at runtime.
    // The requirePermission() middleware reads from this join table to enforce RBAC.
    console.log('🔗 Assigning permissions to roles...');

    // Fetch all roles and create a lookup map
    const allRoles = await prisma.role.findMany();
    const roleMap = new Map<string, string>();
    for (const r of allRoles) {
        roleMap.set(r.name, r.id);
    }

    // Fetch all permissions
    const allPerms = await prisma.permission.findMany();
    const permMap = new Map<string, string>();
    for (const p of allPerms) {
        permMap.set(p.name, p.id);
    }

    // Permission assignment per role
    // ADMIN gets everything
    const adminPerms = [
        'request:create', 'request:read', 'request:update', 'request:delete',
        'request:assign', 'request:confidential',
        'user:manage',
        'admin:access', 'admin:settings',
        'report:read',
        'notification:manage',
        'workflow:manage',
        'banner:manage',
        'asset:read', 'asset:write', 'asset:import', 'asset:delete',
        'crm:read', 'crm:write', 'crm:delete', 'crm:admin',
        'announcement:read', 'announcement:write', 'announcement:admin',
    ];

    // AGENT gets full request CRUD + assign + confidential, no admin/user/report/banner/workflow
    // Note: asset permissions are NOT on AGENT — they are on IT_AGENT only
    const agentPerms = [
        'request:create', 'request:read', 'request:update', 'request:delete',
        'request:approve', 'request:assign', 'request:confidential',
        'announcement:read',
    ];

    // IT_AGENT gets asset management permissions (in addition to AGENT's request perms)
    const itAgentPerms = [
        'asset:read', 'asset:write', 'asset:import',
    ];

    // NORMAL_STAFF and USER can create and read their own requests
    const staffPerms = [
        'request:create', 'request:read',
        'announcement:read',
    ];

    // Executive approvers get request:read + request:approve
    // CTO also has admin:access (admin console viewer)
    const executivePerms = [
        'request:read', 'request:approve', 'announcement:read',
    ];
    const ctoPerms = [...executivePerms, 'admin:access'];

    // HIRING_MANAGER gets request:create, request:read + approve
    const hiringManagerPerms = [
        'request:create', 'request:read', 'request:approve',
    ];

    const rolePermissionMap: Record<string, string[]> = {
        ADMIN: adminPerms,
        AGENT: agentPerms,
        IT_AGENT: itAgentPerms,
        NORMAL_STAFF: staffPerms,
        CEO: executivePerms,
        CTO: ctoPerms,
        CFO: executivePerms,
        CMO: executivePerms,
        GROUP_CEO: executivePerms,
        HIRING_MANAGER: hiringManagerPerms,
        FINANCE_HEAD: executivePerms,
        SALES_MANAGER: ['crm:read', 'crm:write', 'crm:delete', 'crm:admin'],
        SALES_REP: ['crm:read', 'crm:write'],
    };

    // Upsert RolePermission records: only add seed-default assignments,
    // never remove admin-added permissions (RETAIN_ADMIN_CONFIG has no effect here —
    // we always preserve existing assignments)
    let totalSeeded = 0;
    for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
        const roleId = roleMap.get(roleName);
        if (!roleId) {
            console.log(`  ⚠️ Role not found: ${roleName} — skipping`);
            continue;
        }

        let roleSeeded = 0;
        for (const permName of permNames) {
            const permId = permMap.get(permName);
            if (!permId) {
                console.log(`  ⚠️ Permission not found: ${permName} — skipping`);
                continue;
            }
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId, permissionId: permId } },
                update: {},
                create: { roleId, permissionId: permId },
            });
            roleSeeded++;
        }
        totalSeeded += roleSeeded;
        console.log(`  ✅ ${roleName}: ${roleSeeded} seed-default permissions ensured`);
    }

    console.log('✅ Role permissions assigned');

    // Cleanup: Remove stale asset permissions from AGENT role
    // (Previously AGENT had asset:read/asset:write; now these belong to IT_AGENT only)
    const staleAgentAssetPerms = ['asset:read', 'asset:write'];
    let cleanedUp = 0;
    for (const permName of staleAgentAssetPerms) {
        const permId = permMap.get(permName);
        const agentRoleId = roleMap.get('AGENT');
        if (permId && agentRoleId) {
            const deleted = await prisma.rolePermission.deleteMany({
                where: { roleId: agentRoleId, permissionId: permId },
            });
            if (deleted.count > 0) {
                console.log(`  🧹 Removed stale ${permName} from AGENT role`);
                cleanedUp += deleted.count;
            }
        }
    }

    // Cleanup: Remove stale permissions from ADMIN role
    // (ADMIN no longer has request:approve or kb:manage per updated permission matrix)
    const staleAdminPerms: Record<string, string[]> = {
        ADMIN: ['request:approve', 'kb:manage'],
    };
    for (const [roleName, permNames] of Object.entries(staleAdminPerms)) {
        const roleId = roleMap.get(roleName);
        if (!roleId) continue;
        for (const permName of permNames) {
            const permId = permMap.get(permName);
            if (permId) {
                const deleted = await prisma.rolePermission.deleteMany({
                    where: { roleId, permissionId: permId },
                });
                if (deleted.count > 0) {
                    console.log(`  🧹 Removed stale ${permName} from ${roleName} role`);
                    cleanedUp += deleted.count;
                }
            }
        }
    }
    if (cleanedUp > 0) {
        console.log(`✅ Cleaned up ${cleanedUp} stale permission(s)`);
    }

    const hiringManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'HIRING_MANAGER' } });

    // Helper: assign roles to a user (create-only, never removes existing roles)
    const assignRoles = async (userId: string, roleIds: string[]) => {
        for (const roleId of roleIds) {
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId, roleId } },
                update: {},
                create: { userId, roleId },
            });
        }
    };

    // ── Entity assignments for seed users ──────────────────────────────────
    // Will be populated after entity seeding (entities need approver users to exist first)

    // --- System accounts ---
    const hashedPassword = await bcrypt.hash('abc@123', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@test.local' },
        update: { jobTitle: 'Administrator', department: 'IT' },
        create: {
            email: 'admin@test.local',
            passwordHash: hashedPassword,
            firstName: 'Fang',
            lastName: 'Kar Yuan',
            department: 'IT',
            jobTitle: 'Administrator',
            isActive: true,
        },
    });
    await assignRoles(adminUser.id, [adminRole.id, agentRole.id, hiringManagerRole.id]);
    console.log('✅ Admin user created (email: admin@test.local, password: abc@123)');

    const ceoUser = await prisma.user.upsert({
        where: { email: 'ceo@test.local' },
        update: { jobTitle: 'Chief Executive Officer', department: 'Executive', executiveRole: 'CEO' },
        create: {
            email: 'ceo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Emily',
            lastName: 'Chow',
            department: 'Executive',
            jobTitle: 'Chief Executive Officer',
            executiveRole: 'CEO',
            isActive: true,
        },
    });
    await assignRoles(ceoUser.id, [ceoRole.id, hiringManagerRole.id]);
    console.log('✅ CEO user created (email: ceo@test.local, password: abc@123)');

    const ctoUser = await prisma.user.upsert({
        where: { email: 'cto@test.local' },
        update: { jobTitle: 'Chief Technology Officer', department: 'IT', executiveRole: 'CTO' },
        create: {
            email: 'cto@test.local',
            passwordHash: hashedPassword,
            firstName: 'Raymond',
            lastName: 'Kueh',
            department: 'IT',
            jobTitle: 'Chief Technology Officer',
            executiveRole: 'CTO',
            isActive: true,
        },
    });
    await assignRoles(ctoUser.id, [ctoRole.id]);
    console.log('✅ CTO user created (email: cto@test.local, password: abc@123)');

    const cfoUser = await prisma.user.upsert({
        where: { email: 'cfo@test.local' },
        update: { jobTitle: 'Chief Finance Officer', department: 'Finance', executiveRole: 'CFO' },
        create: {
            email: 'cfo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Saravanan',
            lastName: 'Ramaiah',
            department: 'Finance',
            jobTitle: 'Chief Finance Officer',
            executiveRole: 'CFO',
            isActive: true,
        },
    });
    await assignRoles(cfoUser.id, [cfoRole.id]);
    console.log('✅ CFO user created (email: cfo@test.local, password: abc@123)');

    const groupCeoRole = await prisma.role.findUniqueOrThrow({ where: { name: 'GROUP_CEO' } });
    const groupCeoUser = await prisma.user.upsert({
        where: { email: 'groupceo@test.local' },
        update: { jobTitle: 'Chairman & Group Chief Executive Officer', department: 'Executive', executiveRole: 'GROUP_CEO' },
        create: {
            email: 'groupceo@test.local',
            passwordHash: hashedPassword,
            firstName: 'Alain',
            lastName: 'Boey',
            department: 'Executive',
            jobTitle: 'Chairman & Group Chief Executive Officer',
            executiveRole: 'GROUP_CEO',
            isActive: true,
        },
    });
    await assignRoles(groupCeoUser.id, [groupCeoRole.id]);
    console.log('✅ Group CEO user created (email: groupceo@test.local, password: abc@123)');

    // --- Agent accounts ---
    const agentPassword = await bcrypt.hash('abc@123', 10);

    const agentAccounts = [
        { email: 'finance@test.local',     firstName: 'Zahidah', lastName: 'Zahidah',     department: 'Finance', jobTitle: 'Finance Agent',             roles: [agentRole.id], agentTeam: 'FINANCE', entityCode: 'CG' },
        { email: 'it@test.local',          firstName: 'Tham',    lastName: 'Ming Kai',    department: 'IT',      jobTitle: 'IT Agent',                  roles: [agentRole.id, itAgentRole.id], agentTeam: 'IT', entityCode: 'CGT' },
        { email: 'it2@test.local',         firstName: 'Naila',   lastName: 'Naila',       department: 'IT',      jobTitle: 'IT Agent',                  roles: [agentRole.id, itAgentRole.id], agentTeam: 'IT', entityCode: 'CGT' },
        { email: 'hr@test.local',          firstName: 'Sasha',   lastName: 'Nair',        department: 'HR',      jobTitle: 'HR Agent',                  roles: [agentRole.id], agentTeam: 'HR', entityCode: 'CG' },
    ];

    for (const acc of agentAccounts) {
        const u = await prisma.user.upsert({
            where: { email: acc.email },
            update: RETAIN_ADMIN_CONFIG ? {} : { agentTeam: acc.agentTeam, jobTitle: acc.jobTitle, department: acc.department },
            create: {
                email: acc.email,
                passwordHash: agentPassword,
                firstName: acc.firstName,
                lastName: acc.lastName,
                department: acc.department || null,
                jobTitle: acc.jobTitle || null,
                isActive: true,
                agentTeam: acc.agentTeam,
            },
        });
        await assignRoles(u.id, acc.roles);
    }
    console.log('✅ Agent accounts created (password: abc@123)');

    // --- Regular test users ---
    const testPassword = await bcrypt.hash('abc@123', 10);
    const testUsers = [
        { email: 'john.doe@test.local',   firstName: 'John', lastName: 'Doe',   department: 'Engineering', jobTitle: 'Software Engineer' },
        { email: 'jane.smith@test.local', firstName: 'Jane', lastName: 'Smith', department: 'Marketing',   jobTitle: 'Marketing Manager' },
    ];

    for (const userData of testUsers) {
        const u = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: { ...userData, passwordHash: testPassword, isActive: true },
        });
        await assignRoles(u.id, [normalStaffRole.id]);
    }
    console.log('✅ Test users created with NORMAL_STAFF role (password: abc@123)');

    // --- Sales team test accounts ---
    const salesManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_MANAGER' } });
    const salesRepRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_REP' } });

    const salesManagerUser = await prisma.user.upsert({
        where: { email: 'salesmanager@test.local' },
        update: {},
        create: {
            email: 'salesmanager@test.local',
            passwordHash: testPassword,
            firstName: 'Ahmad',
            lastName: 'Razali',
            department: 'Sales',
            jobTitle: 'Sales Manager',
            isActive: true,
        },
    });
    await assignRoles(salesManagerUser.id, [salesManagerRole.id]);
    console.log('✅ Sales Manager user created (email: salesmanager@test.local, password: abc@123)');

    const salesRepUser = await prisma.user.upsert({
        where: { email: 'salesrep@test.local' },
        update: {},
        create: {
            email: 'salesrep@test.local',
            passwordHash: testPassword,
            firstName: 'Nurul',
            lastName: 'Ain',
            department: 'Sales',
            jobTitle: 'Relationship Manager',
            isActive: true,
        },
    });
    await assignRoles(salesRepUser.id, [salesRepRole.id]);
    console.log('✅ Sales Rep user created (email: salesrep@test.local, password: abc@123)');

    // --- Legacy USER role test account (now uses NORMAL_STAFF) ---
    const legacyUser = await prisma.user.upsert({
        where: { email: 'user@helpdesk.com' },
        update: {},
        create: {
            email: 'user@helpdesk.com',
            passwordHash: await bcrypt.hash('abc@123', 10),
            firstName: 'Regular',
            lastName: 'User',
            department: 'General',
            jobTitle: 'Staff',
            isActive: true,
        },
    });
    await assignRoles(legacyUser.id, [normalStaffRole.id]);
    console.log('✅ Legacy user account created (email: user@helpdesk.com, password: abc@123)');

    // ── Entities ─────────────────────────────────────────────────────────────
    console.log('Seeding entities...');

    // ── Entity seeds (create-only: do NOT overwrite admin-configured approver, description, or displayOrder) ──
    // When re-seeding on an existing DB, we only create entities that don't yet exist.
    // This preserves admin changes made via the UI (approver assignments, descriptions, ordering).
    // For fresh DB restores, the `seed-admin-config.ts` script applies the production configuration.
    const entitySeeds = [
        { code: 'CG',   name: 'Citadel Group Sdn. Bhd.',             description: '',  approverEmail: 'admin@test.local',      displayOrder: 10 },
        { code: 'CGT',  name: 'Citadel Group Technologies Sdn. Bhd.', description: '',  approverEmail: 'ceo@test.local',        displayOrder: 20 },
        { code: 'CWP',  name: 'Citadel Wealth Partners Sdn. Bhd.',   description: '',  approverEmail: 'admin@test.local',      displayOrder: 30 },
        { code: 'CT360', name: 'Citadel Tayyib 360 Sdn. Bhd.',       description: '',  approverEmail: 'admin@test.local',      displayOrder: 40 },
        { code: 'NIU',  name: 'NIU Trading Sdn. Bhd.',               description: '',  approverEmail: 'groupceo@test.local',   displayOrder: 50 },
        { code: 'COS',  name: 'Cosmospan Sdn. Bhd.',                  description: '',  approverEmail: 'admin@test.local',      displayOrder: 60 },
    ];

    for (const es of entitySeeds) {
        const approver = await prisma.user.findUnique({ where: { email: es.approverEmail } });
        if (!approver) {
            console.log(`⏭️  Skipping entity ${es.code}: approver ${es.approverEmail} not found`);
            continue;
        }
        await prisma.entity.upsert({
            where: { code: es.code },
            update: {}, // Do NOT overwrite admin-configured fields on re-seed
            create: {
                name: es.name,
                code: es.code,
                description: es.description,
                approverId: approver.id,
                isActive: true,
                displayOrder: es.displayOrder,
            },
        });
    }

    console.log('✅ Entities created (or already exist — admin config preserved)');

    // ── Update seed users with entity assignments ────────────────────────────
    // Entities must be created first (they reference approver users), so we
    // assign entityIds in a second pass rather than in the user upserts above.
    const entityCodeToId = new Map<string, string>((await prisma.entity.findMany({ select: { code: true, id: true } })).map(e => [e.code, e.id]));

    const userEntityMap: Record<string, string> = {
        'admin@test.local':   'CGT',
        'ceo@test.local':    'CGT',
        'cto@test.local':    'CGT',
        'cfo@test.local':    'CG',
        'groupceo@test.local': 'CG',
        'finance@test.local': 'CG',
        'it@test.local':     'CGT',
        'it2@test.local':    'CGT',
        'hr@test.local':     'CG',
    };

    for (const [email, code] of Object.entries(userEntityMap)) {
        const entityId = entityCodeToId.get(code);
        if (entityId) {
            await prisma.user.update({ where: { email }, data: { entityId } });
        } else {
            console.log(`⚠️  Could not assign entity ${code} to ${email}: entity not found`);
        }
    }
    console.log('✅ Seed user entity assignments updated');

    // ── Create production users (@citadelgroup.com.my) ────────────────────────
    // Real staff accounts from SEED_PRODUCTION_USERS. Password default: Welcome@2026.
    // Safe to re-run: upserts existing users, preserves admin role assignments.
    // IMPORTANT: This runs BEFORE entity config so approver users exist for assignment.
    if (SEED_PRODUCTION_USERS.length > 0) {
        console.log('👥 Creating production staff accounts...');
        const PROD_PASSWORD = await bcrypt.hash('Welcome@2026', 10);
        let prodCreated = 0;
        let prodUpdated = 0;

        for (const pu of SEED_PRODUCTION_USERS) {
            const entity = pu.entityCode
                ? await prisma.entity.findUnique({ where: { code: pu.entityCode } })
                : null;

            const existingUser = await prisma.user.findUnique({ where: { email: pu.email } });

            if (existingUser) {
                // Update existing user (preserve password, only update metadata)
                await prisma.user.update({
                    where: { email: pu.email },
                    data: {
                        firstName: pu.firstName,
                        lastName: pu.lastName,
                        department: pu.department || null,
                        jobTitle: pu.jobTitle || null,
                        executiveRole: (pu.executiveRole as any) || null,
                        agentTeam: pu.agentTeam || null,
                        entityId: entity?.id || null,
                        isActive: pu.isActive,
                    },
                });
                prodUpdated++;
            } else {
                // Create new user
                await prisma.user.create({
                    data: {
                        email: pu.email,
                        firstName: pu.firstName,
                        lastName: pu.lastName,
                        passwordHash: PROD_PASSWORD,
                        department: pu.department || null,
                        jobTitle: pu.jobTitle || null,
                        executiveRole: (pu.executiveRole as any) || null,
                        agentTeam: pu.agentTeam || null,
                        entityId: entity?.id || null,
                        isActive: pu.isActive,
                    },
                });
                prodCreated++;
            }

            // Assign roles
            if (pu.roles && pu.roles.length > 0) {
                const user = await prisma.user.findUniqueOrThrow({ where: { email: pu.email } });
                for (const roleName of pu.roles) {
                    const role = await prisma.role.findUnique({ where: { name: roleName } });
                    if (!role) {
                        console.log(`  ⚠️  Role "${roleName}" not found for ${pu.email}`);
                        continue;
                    }
                    await prisma.userRole.upsert({
                        where: { userId_roleId: { userId: user.id, roleId: role.id } },
                        update: {},
                        create: { userId: user.id, roleId: role.id },
                    });
                }
            }
        }
        console.log(`  ✅ Production users: ${prodCreated} created, ${prodUpdated} updated`);
    }

    // ── Apply production entity configuration (approvers, display order) ─────────
    // This overrides the default seed values with admin-configured production values.
    // Only runs when SEED_ENTITY_CONFIG has data (i.e., seed-admin-config.ts is populated).
    // IMPORTANT: This runs AFTER production users so approver user records exist.
    if (SEED_ENTITY_CONFIG.length > 0) {
        console.log('🏢 Applying production entity configuration...');
        for (const ec of SEED_ENTITY_CONFIG) {
            const approver = await prisma.user.findUnique({ where: { email: ec.approverEmail } });
            if (!approver) {
                console.log(`  ⚠️  Skipping entity config for ${ec.code}: approver ${ec.approverEmail} not found`);
                continue;
            }
            await prisma.entity.update({
                where: { code: ec.code },
                data: {
                    name: ec.name,
                    description: ec.description || null,
                    approverId: approver.id,
                    displayOrder: ec.displayOrder,
                    isActive: ec.isActive,
                },
            });
            console.log(`  ✅ ${ec.code} → approver: ${ec.approverEmail}, order: ${ec.displayOrder}`);
        }
        console.log('✅ Production entity configuration applied');
    }

    // Create Service Categories for IT
    const itCategories = [
        { name: 'Get IT help', description: 'Get general IT assistance and support', icon: 'help', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 1,
          requestTypeName: 'Get IT Help Request', requestTypeCode: 'GET_IT_HELP', workflowType: 'IT_SIMPLE', slaHours: 24 },
        { name: 'Email Management', description: 'Email account setup, configuration, and troubleshooting', icon: 'mail', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
          requestTypeName: 'Email Management Request', requestTypeCode: 'EMAIL_MANAGEMENT', workflowType: 'IT_SIMPLE', slaHours: 24 },
        { name: 'Report System problem', description: 'Report a system outage, bug, or performance issue', icon: 'report', colorClass: 'bg-purple-50 text-purple-600', displayOrder: 3,
          requestTypeName: 'Report System Problem Request', requestTypeCode: 'REPORT_SYSTEM_PROBLEM', workflowType: 'IT_SIMPLE', slaHours: 24 },
        { name: 'Request Software Installation', description: 'Request installation of software or applications', icon: 'apps', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 4,
          requestTypeName: 'Software Installation Request', requestTypeCode: 'SOFTWARE_INSTALLATION', workflowType: 'IT_PROCUREMENT', slaHours: 48 },
        { name: 'Request new hardware', description: 'Request new hardware such as laptops, monitors, or peripherals', icon: 'laptop', colorClass: 'bg-cyan-50 text-cyan-600', displayOrder: 5,
          requestTypeName: 'Request New Hardware Request', requestTypeCode: 'NEW_HARDWARE', workflowType: 'IT_HARDWARE_PROCUREMENT', slaHours: 72 },
    ];

    for (const category of itCategories) {
        const cat = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: itDesk.id,
                    name: category.name
                }
            },
            update: {},
            create: {
                name: category.name,
                description: category.description,
                icon: category.icon,
                colorClass: category.colorClass,
                displayOrder: category.displayOrder,
                serviceDeskId: itDesk.id,
                isActive: true,
            },
        });

        // Add a default request type with a sample form configuration
        let formConfig: any[] = [];
        if (category.requestTypeCode === 'NEW_HARDWARE') {
            formConfig = [
                { id: 'hardwareName', label: 'Hardware Name', type: 'text', required: true },
                { id: 'estimatedPrice', label: 'Estimated Price  ', type: 'currency', required: false },
                { id: 'productUrl', label: 'Product URL', type: 'text', required: false },
                { id: 'businessJustification', label: 'Business Justification', type: 'textarea', required: true },
            ];
        } else if (category.requestTypeCode === 'SOFTWARE_INSTALLATION') {
            formConfig = [
                { id: 'sw_name', label: 'Software Name', type: 'text', required: true },
                { id: 'sw_version', label: 'Version Number', type: 'text', required: false }
            ];
        }

        // Upsert by code so the name can be freely changed without duplicates
        const existingByCode = await prisma.requestType.findFirst({
            where: { code: category.requestTypeCode }
        });
        // Also find any old record without a code for this category (legacy)
        const existingLegacy = !existingByCode ? await prisma.requestType.findFirst({
            where: { serviceCategoryId: cat.id }
        }) : null;

        if (existingByCode) {
            // Only backfill structural fields — never overwrite admin-editable fields
            // (name, description, formConfig, slaHours, requiresApproval, isActive)
            // so Admin UI edits are preserved across re-seeds
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: {
                    serviceCategory: { connect: { id: cat.id } },
                    // Only backfill code if missing
                    ...(existingByCode.code ? {} : { code: category.requestTypeCode }),
                }
            });
        } else if (existingLegacy) {
            // Backfill code onto legacy record without touching admin-editable fields
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: {
                    code: category.requestTypeCode,
                }
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategory: { connect: { id: cat.id } },
                    code: category.requestTypeCode,
                    name: category.requestTypeName,
                    description: `Submit a request for ${category.name.toLowerCase()} assistance.`,
                    icon: category.icon,
                    formConfig,
                    isActive: true,
                    ...(category.slaHours ? { slaHours: category.slaHours } : {}),
                    ...(category.requestTypeCode === 'NEW_HARDWARE' || category.requestTypeCode === 'SOFTWARE_INSTALLATION' ? { requiresApproval: true } : {}),
                }
            });
        }
    }

    console.log('✅ Service categories created');

    // Create Service Categories for HR
    const hrCategoriesData = [
        {
            name: 'Question for HR', description: 'Ask HR a question or request general HR assistance',
            icon: 'contact_support', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1,
            requestTypeName: 'Question for HR', requestTypeCode: 'HR_QUESTION', workflowType: 'HR_GENERAL',
            formConfig: [
                { id: 'field_1776666757696', label: 'What is your question ?', type: 'text', required: true },
                { id: 'field_1776666848303', label: 'Provide as much detail as possible about your question', type: 'textarea', required: true },
                { id: 'field_1776666972796', label: 'Attachment', type: 'file', required: false },
            ],
            requiredRole: null, slaHours: 24,
        },
        {
            name: 'New Hiring Request', description: 'Request to open a new position and hire a candidate',
            icon: 'person_add', colorClass: 'bg-blue-50 text-blue-600', displayOrder: 2,
            requestTypeName: 'New Hiring Request', requestTypeCode: 'NEW_HIRING', workflowType: 'HR_RECRUITMENT',
            formConfig: [
                { id: 'position', label: 'Job Title', type: 'text', required: true },
                { id: 'department', label: 'Department', type: 'entity', required: true },
                { id: 'headcount', label: 'Role Category', type: 'select', required: true, options: ['Junior Executive', 'Senior Executive', 'Head of Department', 'C-Level', 'Manager'] },
                { id: 'employmentType', label: 'Employment Type', type: 'select', required: true, options: ['Permanent', 'Temporary', 'Contract'] },
                { id: 'field_1776667989723', label: 'Proposed Salary', type: 'currency', required: false },
                { id: 'field_1776668042538', label: 'Attach Org Chart', type: 'file', required: false },
                { id: 'field_1776668064979', label: 'Attach Job Description', type: 'file', required: false },
                { id: 'candidates', label: 'Candidate Documents', type: 'candidateDocuments', required: false, documentTypes: ['Resume', 'Certificates', 'Transcripts'], maxCandidates: 5 },
            ],
            requiredRole: 'HIRING_MANAGER', slaHours: 48,
        },
        {
            name: 'New Employee Onboarding', description: 'Initiate onboarding process for a new hire',
            icon: 'how_to_reg', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 3,
            requestTypeName: 'New Employee Onboarding', requestTypeCode: 'EMPLOYEE_ONBOARDING', workflowType: 'ONBOARDING',
            formConfig: [
                { id: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
                { id: 'employeeEmail', label: 'Employee Email', type: 'text', required: true },
                { id: 'startDate', label: 'Start Date', type: 'text', required: true },
                { id: 'department', label: 'Department', type: 'text', required: true },
                { id: 'jobTitle', label: 'Job Title', type: 'text', required: true },
            ],
            requiredRole: null, slaHours: 48,
        },
        {
            name: 'Offboard an Employee', description: 'Initiate offboarding process for a departing employee',
            icon: 'person_remove', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 4,
            requestTypeName: 'Offboard an Employee', requestTypeCode: 'EMPLOYEE_OFFBOARDING', workflowType: 'OFFBOARDING',
            formConfig: [
                { id: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
                { id: 'employeeEmail', label: 'Employee Email', type: 'text', required: true },
                { id: 'lastDay', label: 'Last Working Day', type: 'date', required: true },
            ],
            requiredRole: null, slaHours: 48,
        },
    ];

    for (const cat of hrCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: hrDesk.id,
                    name: cat.name
                }
            },
            update: {},
            create: {
                name: cat.name,
                description: cat.description,
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                serviceDeskId: hrDesk.id,
                isActive: true,
            },
        });

        // Upsert by code — only create if missing, never overwrite admin-editable fields
        const existingByCode = await prisma.requestType.findFirst({
            where: { code: cat.requestTypeCode }
        });
        const existingLegacy = !existingByCode
            ? await prisma.requestType.findFirst({ where: { serviceCategoryId: category.id } })
            : null;

        if (existingByCode) {
            // Backfill structural fields only — never overwrite admin-editable fields
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: { serviceCategory: { connect: { id: category.id } } },
            });
        } else if (existingLegacy) {
            // Assign code to legacy record without touching admin-editable fields
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: { code: cat.requestTypeCode },
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategory: { connect: { id: category.id } },
                    code: cat.requestTypeCode,
                    name: cat.requestTypeName,
                    description: cat.description,
                    slaHours: cat.slaHours,
                    isActive: true,
                    requiredRole: cat.requiredRole,
                    formConfig: cat.formConfig,
                },
            });
        }
    }

    console.log('✅ HR categories created');

    // Create Service Categories for Finance
    const finCategoriesData = [
        {
            name: 'Purchase Requisition', description: 'Submit a request to purchase goods or services',
            icon: 'shopping_cart', colorClass: 'bg-emerald-50 text-emerald-600', displayOrder: 1,
            requestTypeName: 'Purchase Requisition', requestTypeCode: 'PURCHASE_REQUISITION', workflowType: 'FINANCE',
            formConfig: [
                { id: 'itemName', label: 'Item / Service Name', type: 'text', required: true },
                { id: 'quantity', label: 'Quantity', type: 'number', required: true },
                { id: 'estimatedCost', label: 'Estimated Cost (RM)', type: 'currency', required: true },
                { id: 'vendor', label: 'Preferred Vendor', type: 'text', required: false },
                { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
            ],
        },
        {
            name: 'Inter-Company Chargeback', description: 'Request a chargeback between internal company entities',
            icon: 'swap_horiz', colorClass: 'bg-indigo-50 text-indigo-600', displayOrder: 2,
            requestTypeName: 'Inter-Company Chargeback', requestTypeCode: 'INTERCOMPANY_CHARGEBACK', workflowType: 'FINANCE',
            formConfig: [
                { id: 'chargeFromEntity', label: 'Charge From Entity', type: 'text', required: true },
                { id: 'chargeToEntity', label: 'Charge To Entity', type: 'text', required: true },
                { id: 'amount', label: 'Amount (RM)', type: 'currency', required: true },
                { id: 'costCenter', label: 'Cost Center', type: 'text', required: false },
                { id: 'description', label: 'Description / Reason', type: 'textarea', required: true },
            ],
        },
        {
            name: 'Submit Budget Proposal', description: 'Submit a budget proposal for approval',
            icon: 'account_balance', colorClass: 'bg-amber-50 text-amber-600', displayOrder: 3,
            requestTypeName: 'Submit Budget Proposal', requestTypeCode: 'BUDGET_PROPOSAL', workflowType: 'FINANCE',
            formConfig: [
                { id: 'department', label: 'Department', type: 'text', required: true },
                { id: 'budgetPeriod', label: 'Budget Period (e.g. Q1 2026)', type: 'text', required: true },
                { id: 'totalAmount', label: 'Total Amount Requested (RM)', type: 'currency', required: true },
                { id: 'breakdown', label: 'Budget Breakdown', type: 'textarea', required: true },
                { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
            ],
        },
        {
            name: 'Expense Claims',
            description: 'Submit a business expense claim for reimbursement',
            icon: 'receipt_long', colorClass: 'bg-rose-50 text-rose-600', displayOrder: 4,
            requestTypeName: 'Expense Claim', requestTypeCode: 'EXPENSE_CLAIM', workflowType: 'EXPENSE_REIMBURSEMENT',
            isActive: false,  // Disabled by admin — enable when ready to launch
            formConfig: [
                { id: 'expenseCategory', label: 'Expense Category', type: 'text', required: true },
                { id: 'expenseDate', label: 'Date of Expense', type: 'text', required: true },
                { id: 'amount', label: 'Amount (RM)', type: 'currency', required: true },
                { id: 'receiptNumber', label: 'Receipt / Reference Number', type: 'text', required: false },
                { id: 'justification', label: 'Business Justification', type: 'textarea', required: true },
            ],
        },
    ];

    for (const cat of finCategoriesData) {
        const category = await prisma.serviceCategory.upsert({
            where: {
                serviceDeskId_name: {
                    serviceDeskId: financeDesk.id,
                    name: cat.name
                }
            },
            update: {},
            create: {
                name: cat.name,
                description: cat.description,
                icon: cat.icon,
                colorClass: cat.colorClass,
                displayOrder: cat.displayOrder,
                serviceDeskId: financeDesk.id,
                isActive: cat.isActive ?? true,
            },
        });

        const existingByCode = await prisma.requestType.findFirst({
            where: { code: cat.requestTypeCode }
        });
        const existingLegacy = !existingByCode
            ? await prisma.requestType.findFirst({ where: { serviceCategoryId: category.id } })
            : null;

        if (existingByCode) {
            // Backfill structural fields only — never overwrite admin-editable fields
            await prisma.requestType.update({
                where: { id: existingByCode.id },
                data: { serviceCategory: { connect: { id: category.id } } },
            });
        } else if (existingLegacy) {
            // Assign code to legacy record without touching admin-editable fields
            await prisma.requestType.update({
                where: { id: existingLegacy.id },
                data: { code: cat.requestTypeCode },
            });
        } else {
            await prisma.requestType.create({
                data: {
                    serviceCategory: { connect: { id: category.id } },
                    code: cat.requestTypeCode,
                    name: cat.requestTypeName,
                    description: cat.description,
                    slaHours: 72,
                    isActive: true,
                    formConfig: cat.formConfig,
                },
            });
        }
    }

    console.log('✅ Finance categories created');

    // ── Workflow Types & Steps (from seed-workflows) ──
    // Must run AFTER request types are created so linking works
    await seedWorkflows(prisma, RETAIN_ADMIN_CONFIG);

    // Create Notification Templates (from seed-admin-config)
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping notification templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        const templates = SEED_NOTIFICATION_TEMPLATES;

        for (const template of templates) {
            // Never overwrite emailSubject/emailBody — admin may have customized them
            await prisma.notificationTemplate.upsert({
                where: { name: template.name },
                update: {},
                create: template,
            });
        }

        console.log('✅ Notification templates created');
    }

    // Seed onboarding task templates (from seed-admin-config, per-record upsert for idempotency)
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping onboarding task templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const tpl of SEED_ONBOARDING_TEMPLATES) {
            const existing = await prisma.onboardingTaskTemplate.findFirst({ where: { taskName: tpl.taskName } });
            if (!existing) {
                await prisma.onboardingTaskTemplate.create({
                    data: {
                        taskName: tpl.taskName,
                        taskDescription: tpl.taskDescription,
                        taskCategory: tpl.taskCategory,
                        priority: tpl.priority,
                        dueDayOffset: tpl.dueDayOffset,
                        displayOrder: tpl.displayOrder,
                        isActive: tpl.isActive ?? true,
                    },
                });
            }
        }
        console.log(`✅ Seeded ${SEED_ONBOARDING_TEMPLATES.length} onboarding task templates`);
    }

    // Seed offboarding task templates (from seed-admin-config, per-record upsert for idempotency)
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping offboarding task templates (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const tpl of SEED_OFFBOARDING_TEMPLATES) {
            const existing = await prisma.offboardingTaskTemplate.findFirst({ where: { taskName: tpl.taskName } });
            if (!existing) {
                await prisma.offboardingTaskTemplate.create({
                    data: {
                        taskName: tpl.taskName,
                        taskDescription: tpl.taskDescription,
                        taskCategory: tpl.taskCategory,
                        priority: tpl.priority,
                        dueDayOffset: tpl.dueDayOffset,
                        displayOrder: tpl.displayOrder,
                        isActive: tpl.isActive ?? true,
                    },
                });
            }
        }
        console.log(`✅ Seeded ${SEED_OFFBOARDING_TEMPLATES.length} offboarding task templates`);
    }

    // Banner Configs (from seed-admin-config)
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping banner configs (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const banner of SEED_BANNER_CONFIGS) {
            await prisma.bannerConfig.upsert({
                where: { role_status: { role: banner.role, status: banner.status } },
                update: {},
                create: {
                    role: banner.role,
                    status: banner.status,
                    icon: banner.icon,
                    title: banner.title,
                    description: banner.description,
                    colorScheme: banner.colorScheme,
                    isActive: banner.isActive ?? true,
                },
            });
        }
        console.log(`✅ Seeded ${SEED_BANNER_CONFIGS.length} default banner configs`);
    }

    // Request Status Definitions (from seed-admin-config)
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping request status definitions (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const def of SEED_STATUS_DEFINITIONS) {
            await prisma.requestStatusDefinition.upsert({
                where: { code: def.code },
                update: {},
                create: {
                    code: def.code,
                    label: def.label,
                    description: def.description ?? null,
                    category: def.category,
                    displayOrder: def.displayOrder,
                    isActive: def.isActive ?? true,
                },
            });
        }
        console.log(`✅ Seeded ${SEED_STATUS_DEFINITIONS.length} request status definitions`);
    }

    // ── Workflow Transitions (from seed-admin-config) ──
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping workflow transitions (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const t of SEED_WORKFLOW_TRANSITIONS) {
            await prisma.workflowTransition.upsert({
                where: { fromStatus_toStatus: { fromStatus: t.fromStatus, toStatus: t.toStatus } },
                update: {},
                create: {
                    fromStatus: t.fromStatus,
                    toStatus: t.toStatus,
                    transitionLabel: t.transitionLabel ?? null,
                    requiresComment: t.requiresComment ?? false,
                    autoAssignRole: t.autoAssignRole ?? null,
                    autoAssignUserId: t.autoAssignUserId ?? null,
                    isActive: t.isActive ?? true,
                },
            });
        }
        console.log(`✅ Seeded ${SEED_WORKFLOW_TRANSITIONS.length} workflow transitions`);
    }

    // ── Escalation Rules (from seed-admin-config) ──
    if (RETAIN_ADMIN_CONFIG) {
        console.log('⏭️  Skipping escalation rules (RETAIN_ADMIN_CONFIG enabled)');
    } else {
        for (const rule of SEED_ESCALATION_RULES) {
            const requestType = await prisma.requestType.findFirst({ where: { code: rule.requestTypeCode } });
            if (!requestType) {
                console.log(`⏭️  Skipping escalation rule for unknown request type: ${rule.requestTypeCode}`);
                continue;
            }
            // Upsert by requestTypeId + triggerHoursAfterBreach (semantic uniqueness)
            const existing = await prisma.escalationRule.findFirst({
                where: { requestTypeId: requestType.id, triggerHoursAfterBreach: rule.triggerHoursAfterBreach },
            });
            if (!existing) {
                await prisma.escalationRule.create({
                    data: {
                        requestTypeId: requestType.id,
                        triggerHoursAfterBreach: rule.triggerHoursAfterBreach,
                        notifyRoles: rule.notifyRoles,
                        label: rule.label ?? null,
                        isActive: rule.isActive ?? true,
                    },
                });
            }
        }
        console.log(`✅ Seeded escalation rules`);
    }

    // ── Seed Confidential Sample Requests ──
    // Create 2 HR requests with isConfidential=true for QA testing
    const confidentialRequestType = await prisma.requestType.findFirst({ where: { code: 'HR_QUESTION' } });
    if (confidentialRequestType) {
        const hrDesk = await prisma.serviceDesk.findFirst({ where: { code: 'HR' } });
        const hrCategory = await prisma.serviceCategory.findFirst({ where: { serviceDeskId: hrDesk?.id, name: 'HR Question' } });
        const endUserRole = await prisma.role.findFirst({ where: { name: 'END_USER' } });
        const endUsers = endUserRole ? await prisma.user.findMany({
            where: { roles: { some: { roleId: endUserRole.id } } },
            take: 1,
        }) : [];

        if (hrDesk && endUsers.length > 0) {
            await prisma.request.upsert({
                where: { referenceNumber: 'HR-CONF-001' },
                update: {},
                create: {
                    referenceNumber: 'HR-CONF-001',
                    summary: 'Confidential HR inquiry about workplace harassment report',
                    description: 'This is a confidential HR request regarding a sensitive workplace matter. Access should be restricted to the requester, designated approvers, and authorized personnel only.',
                    serviceDeskId: hrDesk.id,
                    requestTypeId: confidentialRequestType.id,
                    requesterId: endUsers[0].id,
                    priority: 'MEDIUM',
                    status: 'SUBMITTED',
                    isConfidential: true,
                },
            });
            await prisma.request.upsert({
                where: { referenceNumber: 'HR-CONF-002' },
                update: {},
                create: {
                    referenceNumber: 'HR-CONF-002',
                    summary: 'Confidential disciplinary action review',
                    description: 'This is a confidential request related to a disciplinary proceeding. Only the requester and authorized HR personnel should have access.',
                    serviceDeskId: hrDesk.id,
                    requestTypeId: confidentialRequestType.id,
                    requesterId: endUsers[0].id,
                    priority: 'HIGH',
                    status: 'SUBMITTED',
                    isConfidential: true,
                },
            });
            console.log('✅ Seeded 2 confidential HR requests for QA testing');
        } else {
            console.log('⏭️  Skipping confidential request seeding (missing HR desk or end users)');
        }
    } else {
        console.log('⏭️  Skipping confidential request seeding (HR_QUESTION request type not found)');
    }

    // ── Seed Knowledge Base Articles ──
    const kbArticles = [
        // IT Support articles
        {
            serviceDeskId: itDesk.id,
            title: 'How to Reset Your Password',
            slug: 'how-to-reset-your-password',
            content: `## Password Reset Guide\n\nIf you have forgotten your password or your account has been locked, follow these steps to regain access.\n\n### Self-Service Password Reset\n\n1. Go to the login page and click **"Forgot Password"**\n2. Enter your company email address\n3. Check your inbox for the reset link (valid for 30 minutes)\n4. Click the link and set a new password\n5. Password requirements: minimum 8 characters, at least one uppercase, one lowercase, and one number\n\n### Contact IT Support\n\nIf self-service reset is unavailable:\n- Submit an IT Support request under the **Account & Access** category\n- An agent will verify your identity and reset your password\n- New temporary credentials will be sent to your registered email\n\n### Common Issues\n\n- **Reset link expired**: Request a new one — links expire after 30 minutes\n- **Didn't receive email**: Check spam/junk folder, or contact IT\n- **Account locked**: Wait 15 minutes before retrying, or contact IT Support`,
            excerpt: 'Step-by-step guide to resetting your company password via self-service or IT Support.',
            category: 'Account & Access',
            tags: ['password', 'reset', 'account', 'login'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'VPN Setup and Troubleshooting',
            slug: 'vpn-setup-and-troubleshooting',
            content: `## VPN Configuration Guide\n\nAll remote workers must use the company VPN to access internal resources securely.\n\n### Installing the VPN Client\n\n1. Download the VPN client from the IT Downloads portal\n2. Run the installer with default settings\n3. When prompted, enter the server address: **vpn.citadelgroup.local**\n4. Use your standard company credentials to authenticate\n\n### Connecting to the VPN\n\n1. Launch the VPN client\n2. Select **"Corporate Network"** profile\n3. Enter your username and password\n4. Click **Connect**\n5. Wait for the status to show **"Connected"**\n\n### Troubleshooting\n\n- **Connection timeout**: Check your internet connection, then try an alternate server (vpn2.citadelgroup.local)\n- **Authentication failed**: Ensure you are using your current credentials — try resetting your password first\n- **Slow performance**: Switch to the nearest server region in client settings\n- **Client won't start**: Reinstall the client or run the repair tool from IT Downloads`,
            excerpt: 'Configure and troubleshoot the company VPN for secure remote access.',
            category: 'Network & Connectivity',
            tags: ['vpn', 'remote', 'network', 'security'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'Requesting New Software or Hardware',
            slug: 'requesting-new-software-or-hardware',
            content: `## Software & Hardware Procurement\n\nNeed new software or equipment? Follow the procurement process below.\n\n### Software Requests\n\n1. Check the **Approved Software Catalog** first — if the software is listed, submit an IT request under **Software & Applications**\n2. For software NOT in the catalog, submit an **IT Procurement** request with:\n   - Software name and version\n   - Business justification\n   - Number of licenses needed\n   - Approximate cost (if known)\n3. The request will go through manager approval, then IT review\n\n### Hardware Requests\n\n1. Submit an **IT Procurement** request under the **Hardware & Devices** category\n2. Include:\n   - Type of hardware (laptop, monitor, peripherals)\n   - Preferred specifications\n   - Business justification\n3. Standard hardware configurations are pre-approved — custom specs require additional review\n\n### Turnaround Time\n\n- **Standard software**: 1–2 business days after approval\n- **New software (not in catalog)**: 5–10 business days\n- **Standard hardware**: 3–5 business days after approval\n- **Custom hardware**: 2–4 weeks`,
            excerpt: 'How to request new software licenses or hardware through the procurement workflow.',
            category: 'Software & Applications',
            tags: ['procurement', 'software', 'hardware', 'request'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'Setting Up Multi-Factor Authentication (MFA)',
            slug: 'setting-up-multi-factor-authentication',
            content: `## MFA Setup Guide\n\nMFA is mandatory for all company accounts. Set it up using Microsoft Authenticator or your preferred TOTP app.\n\n### Step-by-Step Setup\n\n1. Log in to the **Security Settings** portal\n2. Click **"Enable MFA"**\n3. Scan the QR code with Microsoft Authenticator (or Google Authenticator)\n4. Enter the 6-digit verification code to confirm setup\n5. Save your **recovery codes** in a secure location — you will need these if you lose access to your authenticator app\n\n### Using MFA Daily\n\n- You will be prompted for a verification code each time you log in\n- Codes refresh every 30 seconds\n- Some applications support "Remember this device for 30 days"\n\n### Lost or Broken Device\n\n1. Use one of your **recovery codes** to log in\n2. Go to Security Settings → MFA → **"Reset MFA Device"**\n3. Set up MFA on your new device\n4. If you have no recovery codes, contact IT Support immediately`,
            excerpt: 'Configure MFA on your account for enhanced security compliance.',
            category: 'Account & Access',
            tags: ['mfa', 'security', 'authentication', '2fa'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // HR articles
        {
            serviceDeskId: hrDesk.id,
            title: 'Leave of Absence (LOA) Policy and Application',
            slug: 'leave-of-absence-policy-and-application',
            content: `## Leave of Absence Guide\n\nEmployees may apply for various types of leave through the HR Services portal.\n\n### Leave Types\n\n| Type | Entitlement | Approval |\n|------|-------------|----------|\n| Annual Leave | 14 days/year | Manager |\n| Medical Leave | 14 days/year | Manager + MC |\n| Emergency Leave | As needed | Manager |\n| Unpaid Leave | Case-by-case | Manager + HR |\n\n### How to Apply\n\n1. Navigate to **HR Services** → **Leave Management**\n2. Select the leave type\n3. Fill in the dates and reason\n4. Upload supporting documents (e.g., medical certificate)\n5. Submit for manager approval\n\n### Important Notes\n\n- Annual leave must be applied **at least 3 days in advance**\n- Medical leave requires a valid MC submitted within **24 hours**\n- Leave balance can be checked on your HR dashboard\n- Unconsumed annual leave may be carried forward (max 5 days) to the next year`,
            excerpt: 'Understand leave types, entitlements, and how to apply through the HR portal.',
            category: 'Leave Management',
            tags: ['leave', 'loa', 'vacation', 'hr', 'policy'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: hrDesk.id,
            title: 'Employee Benefits Overview',
            slug: 'employee-benefits-overview',
            content: `## Benefits Package\n\nCitadel Group offers a comprehensive benefits package for all permanent employees.\n\n### Medical & Insurance\n\n- **Group Hospitalization**: Full coverage under company panel hospitals\n- **Outpatient**: RM 500/year reimbursement for non-panel visits\n- **Dental**: RM 300/year for basic dental procedures\n\n### Allowances\n\n- **Transport**: RM 200/month for eligible roles\n- **Meal**: RM 15/day for overtime beyond 7:30 PM\n- **Communication**: RM 50/month mobile allowance\n\n### Professional Development\n\n- **Training Budget**: RM 3,000/year per employee\n- **Certification Fee**: One professional certification per year (full reimbursement)\n- **Conference Attendance**: Subject to manager approval\n\n### How to Claim\n\nSubmit a request through **HR Services** → **Benefits & Claims** with supporting receipts. Claims are processed within 5 business days.`,
            excerpt: 'Overview of medical, insurance, allowances, and professional development benefits.',
            category: 'Benefits & Compensation',
            tags: ['benefits', 'insurance', 'allowance', 'medical', 'hr'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // IT articles (continued)
        {
            serviceDeskId: itDesk.id,
            title: 'Connecting to a Shared Printer',
            slug: 'connecting-to-a-shared-printer',
            content: `## Shared Printer Setup\n\nFollow these steps to connect to the office network printers.\n\n### Finding Available Printers\n\n1. Go to **Start → Settings → Devices → Printers & Scanners**\n2. Click **"Add a printer or scanner"**\n3. Wait for the list to populate — office printers appear automatically on the company network\n4. Select your floor/department printer and click **"Add device"**\n\n### Printer Naming Convention\n\n| Printer Name | Location |\n|---|---|\n| CWC-PRINT-L1 | Level 1, near reception |\n| CWC-PRINT-L2A | Level 2, Finance wing |\n| CWC-PRINT-L2B | Level 2, HR wing |\n| CWC-PRINT-L3 | Level 3, IT & Admin |\n\n### Common Issues\n\n- **Printer not found**: Ensure you are on the corporate Wi-Fi or connected via LAN — VPN does not route printer traffic\n- **Print job stuck**: Open the printer queue, cancel all jobs, and retry\n- **Low toner / paper jam**: Submit an IT support request under **Hardware & Devices** — do not attempt to clear jams yourself on large printers\n\n### Printing Tips\n\n- Use **duplex (double-sided)** printing by default to conserve paper\n- For confidential documents, use the **PIN Release** option — the document only prints when you enter your PIN at the printer`,
            excerpt: 'How to connect to office network printers and resolve common printing issues.',
            category: 'Hardware & Devices',
            tags: ['printer', 'hardware', 'network', 'setup'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'Setting Up Company Email on Mobile',
            slug: 'setting-up-company-email-on-mobile',
            content: `## Company Email on Mobile Devices\n\nAccess your work email on your personal or company-issued mobile device using Microsoft Outlook.\n\n### Prerequisites\n\n- Install **Microsoft Outlook** from the App Store or Google Play\n- Your company email credentials (username@citadelgroup.com)\n- MFA must be set up on your account\n\n### Setup Steps (iOS & Android)\n\n1. Open **Outlook** and tap **Add Account**\n2. Enter your company email address and tap **Continue**\n3. On the Microsoft sign-in page, enter your password\n4. Complete the **MFA prompt** (approve in Authenticator app)\n5. Tap **"Allow"** when prompted to configure your device\n6. Outlook will sync your emails, calendar, and contacts automatically\n\n### Security Requirements\n\nConnecting your device to company email enrolls it in **Intune Mobile Device Management**. This allows IT to:\n- Enforce PIN/biometric lock on the device\n- Remotely wipe company data (not personal data) if the device is lost\n- Apply security policies (e.g., encryption)\n\n### Personal Device Policy\n\n- Only company data in the Outlook container is managed — personal apps and data are not affected\n- If you leave the company, only the Outlook/company data container will be wiped\n- If you do not want to enroll your personal device, request a company phone via IT Support`,
            excerpt: 'Configure Microsoft Outlook on your mobile device to access company email securely.',
            category: 'Email & Communication',
            tags: ['email', 'mobile', 'outlook', 'setup', 'mdm'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: itDesk.id,
            title: 'New Employee IT Onboarding Checklist',
            slug: 'new-employee-it-onboarding-checklist',
            content: `## IT Onboarding for New Employees\n\nWelcome to Citadel Group! Complete the following steps within your first week to get fully set up.\n\n### Day 1 Checklist\n\n- [ ] Collect your laptop from IT (Level 3 IT Helpdesk)\n- [ ] Log in with your temporary credentials provided by HR\n- [ ] **Change your password immediately** on first login\n- [ ] Set up **Multi-Factor Authentication (MFA)** — see the MFA Setup Guide in this Knowledge Base\n- [ ] Connect to **CWC-Corporate** Wi-Fi using your company credentials\n- [ ] Set up **Microsoft Outlook** with your company email\n\n### Week 1 Checklist\n\n- [ ] Join the company **Microsoft Teams** workspace\n- [ ] Set up company email on your mobile device (optional — see Mobile Email Guide)\n- [ ] Bookmark key internal tools: CWC Portal, HR Self-Service, Finance Portal\n- [ ] Review the **Acceptable Use Policy** (available in HR Knowledge Base)\n- [ ] Install any role-specific software via the **IT Self-Service Catalog**\n\n### Getting Help\n\nFor any IT issues during onboarding:\n- Walk-in: Level 3 IT Helpdesk (8:30 AM – 5:30 PM, Mon–Fri)\n- Submit a ticket: **IT Support → Account & Access** in this portal\n- Emergency: Call IT Helpdesk at ext. 1234`,
            excerpt: 'Complete IT setup checklist for new employees covering devices, accounts, and software.',
            category: 'Account & Access',
            tags: ['onboarding', 'new employee', 'setup', 'checklist', 'it'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // HR articles (continued)
        {
            serviceDeskId: hrDesk.id,
            title: 'Understanding Your Payslip',
            slug: 'understanding-your-payslip',
            content: `## Payslip Guide\n\nYour monthly payslip is available in the HR Self-Service portal by the 25th of each month.\n\n### Accessing Your Payslip\n\n1. Log in to the **HR Services** portal\n2. Navigate to **My Profile → Payslips**\n3. Select the month you want to view\n4. Download as PDF for your records\n\n### Payslip Breakdown\n\n| Section | Description |\n|---|---|\n| Basic Salary | Your fixed monthly salary |\n| Allowances | Transport, meal, communication, and role-specific allowances |\n| Overtime | Calculated at 1.5x hourly rate for approved OT |\n| EPF (Employee) | 11% of gross salary contributed by you |\n| EPF (Employer) | 13% of gross salary contributed by Citadel |\n| SOCSO | Social security contribution (varies by salary band) |\n| EIS | Employment Insurance System deduction |\n| PCB / Income Tax | Monthly tax deduction based on your tax bracket |\n| **Net Pay** | **Amount deposited into your bank account** |\n\n### Salary Payment Schedule\n\n- Salaries are credited on the **last working day** of each month\n- Overtime and claims approved before the 15th are included in the same month's payslip\n- Disputes must be raised within **3 months** of the pay date\n\n### Payslip Queries\n\nSubmit a request via **HR Services → Payroll & Compensation** with your query and the relevant payslip month attached.`,
            excerpt: 'How to read and understand your monthly payslip including deductions and contributions.',
            category: 'Payroll & Compensation',
            tags: ['payslip', 'salary', 'epf', 'pcb', 'payroll', 'hr'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: hrDesk.id,
            title: 'Performance Review Process',
            slug: 'performance-review-process',
            content: `## Annual Performance Review Guide\n\nCitadel Group conducts a formal performance review cycle twice a year. Here's what to expect and how to prepare.\n\n### Review Cycle\n\n| Review | Period | Completion Deadline |\n|---|---|---|\n| Mid-Year Review | Jan – Jun | 31 July |\n| Year-End Review | Jul – Dec | 31 January |\n\n### The Review Process\n\n1. **Self-Assessment** — You complete a self-evaluation in the HR portal (opens 2 weeks before deadline)\n2. **Manager Assessment** — Your direct manager rates your performance and adds comments\n3. **Calibration** — Department heads align ratings across the team\n4. **Feedback Discussion** — One-on-one session with your manager to review outcomes\n5. **Final Sign-Off** — Both you and your manager acknowledge the review\n\n### Rating Scale\n\n| Rating | Description |\n|---|---|\n| 5 – Exceptional | Consistently exceeded all targets |\n| 4 – Exceeds Expectations | Regularly exceeded most targets |\n| 3 – Meets Expectations | Met all targets as expected |\n| 2 – Needs Improvement | Partially met targets; development plan required |\n| 1 – Unsatisfactory | Did not meet key targets |\n\n### Tips for a Strong Self-Assessment\n\n- Reference specific achievements with measurable outcomes\n- Align your contributions to your department's goals\n- Highlight cross-functional collaboration\n- Be honest about development areas and propose an action plan\n\n### Outcome\n\nYear-end ratings influence annual increment percentages and bonus eligibility. Ratings are confidential between you, your manager, and HR.`,
            excerpt: 'Overview of the bi-annual performance review cycle, ratings, and how to prepare your self-assessment.',
            category: 'Performance & Development',
            tags: ['performance', 'review', 'appraisal', 'kpi', 'hr'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: hrDesk.id,
            title: 'Work From Home (WFH) Policy',
            slug: 'work-from-home-policy',
            content: `## Remote Work Policy\n\nCitadel Group supports flexible working arrangements for eligible roles.\n\n### Eligibility\n\n- Permanent employees who have completed their **probation period**\n- Roles that do not require a physical presence (confirmed by your department head)\n- Employees with a satisfactory or above performance rating\n\n### WFH Entitlement\n\n- Up to **2 days per week** for eligible employees\n- WFH days cannot be on **Mondays or Fridays** without prior manager approval\n- Department heads may restrict WFH during peak periods or project deadlines\n\n### How to Apply\n\n1. Discuss with your manager and agree on a recurring WFH schedule\n2. Submit a **WFH arrangement request** via **HR Services → Flexible Work**\n3. HR will issue a formal confirmation within 3 business days\n\n### WFH Requirements\n\n- Must be reachable during core hours **(9:00 AM – 5:00 PM)**\n- Must have a stable internet connection (minimum 10 Mbps)\n- Must be connected to the **company VPN** when accessing internal systems\n- Must attend all scheduled meetings (video on for calls with clients or leadership)\n\n### Equipment\n\n- Employees are responsible for their own WFH setup\n- IT can loan a portable monitor or peripherals — submit an IT request under **Hardware & Devices**\n- Company-issued laptops must be used for all work activities`,
            excerpt: 'Eligibility, entitlement, and requirements for the company Work From Home arrangement.',
            category: 'Workplace Policies',
            tags: ['wfh', 'remote work', 'flexible', 'policy', 'hr'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // Finance articles (continued)
        {
            serviceDeskId: financeDesk.id,
            title: 'Business Travel Policy and Booking Guide',
            slug: 'business-travel-policy-and-booking-guide',
            content: `## Business Travel Policy\n\nAll business travel must be pre-approved and booked through the company's designated channels.\n\n### Pre-Approval\n\n1. Submit a **Travel Request** via **Group Finance → Travel & Accommodation** at least **5 business days** before travel\n2. Include: destination, travel dates, purpose, and estimated costs\n3. Approval is required from your manager; trips above RM 5,000 also require Finance approval\n\n### Booking Channels\n\n- **Flights**: Book via the corporate travel portal (link in Finance intranet) — do NOT purchase independently without prior approval\n- **Hotels**: Use corporate rate hotels listed in the travel portal; max RM 350/night domestic, RM 600/night international\n- **Transport**: Company-arranged ground transport for airport transfers; Grab/taxi reimbursable with receipt\n\n### Allowances (Per Diem)\n\n| Location | Daily Meal Allowance |\n|---|---|\n| Domestic (within Malaysia) | RM 80/day |\n| ASEAN countries | RM 150/day |\n| Outside ASEAN | RM 250/day |\n\n### Claiming Travel Expenses\n\nAfter your trip:\n1. Collect all receipts (no receipt = no reimbursement for items above RM 50)\n2. Submit via **Group Finance → Expense Claims** within **14 days** of returning\n3. Attach flight itinerary and hotel invoice to the claim\n4. Per diem allowances do not require receipts`,
            excerpt: 'Pre-approval requirements, booking channels, allowances, and reimbursement process for business travel.',
            category: 'Expense Management',
            tags: ['travel', 'expense', 'per diem', 'reimbursement', 'finance'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: financeDesk.id,
            title: 'Budget Planning and Cost Center Guide',
            slug: 'budget-planning-and-cost-center-guide',
            content: `## Budget & Cost Center Guide\n\nUnderstanding how to use cost centers ensures accurate financial reporting and smooth approval of your procurement requests.\n\n### What is a Cost Center?\n\nA cost center is a unique code assigned to each department or project that tracks expenditure. Every purchase requisition and expense claim must include the correct cost center code.\n\n### Finding Your Cost Center\n\n1. Log in to the Finance portal\n2. Navigate to **My Department → Cost Center Info**\n3. Your primary cost center code is displayed on your profile\n4. For project-specific codes, contact your Finance Business Partner\n\n### Common Cost Center Codes\n\n| Department | Code |\n|---|---|\n| Human Resources | CC-HR-001 |\n| Information Technology | CC-IT-001 |\n| Group Finance | CC-FIN-001 |\n| Operations | CC-OPS-001 |\n| Executive Office | CC-EXEC-001 |\n\n### Annual Budget Cycle\n\n| Activity | Timeline |\n|---|---|\n| Department heads submit budget proposals | October |\n| Finance review and consolidation | November |\n| Management approval | December |\n| Budget takes effect | 1 January |\n\n### Budget Queries\n\nFor queries about budget availability, spending limits, or to request a budget reallocation, submit a request via **Group Finance → Budget Enquiry** and your assigned Finance Business Partner will respond within 2 business days.`,
            excerpt: 'How cost center codes work, where to find yours, and how the annual budget cycle operates.',
            category: 'Procurement',
            tags: ['budget', 'cost center', 'finance', 'procurement', 'planning'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        // Finance articles
        {
            serviceDeskId: financeDesk.id,
            title: 'How to Submit an Expense Claim',
            slug: 'how-to-submit-an-expense-claim',
            content: `## Expense Claim Process\n\nFollow these steps to submit and track your business expense claims.\n\n### Eligible Expenses\n\n- Business travel (flights, hotels, transport)\n- Client entertainment (meals, events)\n- Office supplies (when procured independently)\n- Training and certifications\n\n### Submitting a Claim\n\n1. Navigate to **Group Finance** → **Expense Claims**\n2. Click **"New Claim"**\n3. Fill in expense details:\n   - Category and sub-category\n   - Amount and currency\n   - Date of expense\n   - Business justification\n4. Upload supporting receipts (PDF or image)\n5. Submit for manager approval\n\n### Approval Workflow\n\n1. **Manager Review** — Verifies business justification\n2. **Finance Review** — Validates receipts and compliance\n3. **CFO Approval** — For claims above RM 5,000\n4. **Payment Processing** — 5–7 business days after final approval\n\n### Claim Limits\n\n- Maximum per claim: RM 50,000\n- Receipt required for any item above RM 50\n- Claims must be submitted within **30 days** of the expense date`,
            excerpt: 'Step-by-step guide for submitting and tracking business expense claims.',
            category: 'Expense Management',
            tags: ['expense', 'claim', 'reimbursement', 'finance'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
        {
            serviceDeskId: financeDesk.id,
            title: 'Purchase Requisition Guide',
            slug: 'purchase-requisition-guide',
            content: `## Purchase Requisition (PR) Process\n\nAll departmental purchases must go through the formal requisition workflow.\n\n### When to Submit a PR\n\n- Office equipment and furniture\n- Software subscriptions and licenses\n- Consulting and professional services\n- Any purchase exceeding RM 500\n\n### PR Workflow\n\n1. **Submit Request** via Group Finance → Purchase Requisition\n2. **Finance Acknowledgement** — Finance verifies budget allocation\n3. **Finance Processing** — PO created and sent to vendor\n4. **CFO Approval** — Required for purchases above RM 10,000\n5. **Group CEO Approval** — Required for purchases above RM 50,000\n6. **Payment** — Processed after goods/services received\n\n### Required Information\n\n- Item description and specifications\n- Quantity and estimated unit cost\n- Preferred vendor (if any)\n- Budget code / cost center\n- Expected delivery date\n- Business justification\n\n### Turnaround Time\n\n- Under RM 10,000: 5–7 business days\n- RM 10,000–50,000: 10–15 business days\n- Above RM 50,000: 15–20 business days`,
            excerpt: 'Complete guide for submitting and tracking purchase requisitions through approval workflow.',
            category: 'Procurement',
            tags: ['purchase', 'requisition', 'procurement', 'finance', 'approval'],
            isPublished: true,
            publishedAt: new Date(),
            authorId: adminUser.id,
        },
    ];

    for (const article of kbArticles) {
        await prisma.knowledgeBaseArticle.upsert({
            where: { slug: article.slug },
            update: {},
            create: article,
        });
    }
    console.log(`✅ Seeded ${kbArticles.length} knowledge base articles`);

    // ── CRM: Unified Sales Pipeline ────────────────────────────────────────
    console.log('📊 Seeding CRM default pipeline...');
    const defaultPipeline = await prisma.crmPipeline.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Sales Pipeline',
            description: 'Unified sales pipeline for tracking deals from prospecting to close',
            isDefault: true,
            isActive: true,
        },
    });

    const defaultStages = [
        { name: 'Prospecting',   displayOrder: 0, probability: 10, color: '#6366f1', isWonStage: false, isLostStage: false },
        { name: 'Qualification', displayOrder: 1, probability: 25, color: '#3b82f6', isWonStage: false, isLostStage: false },
        { name: 'Proposal',      displayOrder: 2, probability: 50, color: '#0ea5e9', isWonStage: false, isLostStage: false },
        { name: 'Negotiation',   displayOrder: 3, probability: 75, color: '#f59e0b', isWonStage: false, isLostStage: false },
        { name: 'Closed Won',    displayOrder: 4, probability: 100, color: '#10b981', isWonStage: true,  isLostStage: false },
        { name: 'Closed Lost',   displayOrder: 5, probability: 0,  color: '#ef4444', isWonStage: false, isLostStage: true },
    ];

    for (const stage of defaultStages) {
        const existing = await prisma.crmPipelineStage.findFirst({
            where: { pipelineId: defaultPipeline.id, displayOrder: stage.displayOrder },
        });
        if (!existing) {
            await prisma.crmPipelineStage.create({
                data: { ...stage, pipelineId: defaultPipeline.id },
            });
        }
    }
    console.log('✅ CRM default pipeline seeded');

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
