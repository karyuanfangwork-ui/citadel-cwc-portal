const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
    const prisma = new PrismaClient();

    const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: 'asc' } });
    const rolesOut = roles.map(r => ({ name: r.name, description: r.description || '', permissions: r.permissions.map(p => p.permission.name) }));

    const entities = await prisma.entity.findMany({ include: { approver: { select: { id: true, email: true } } }, orderBy: { code: 'asc' } });
    const entitiesOut = entities.map(e => ({ code: e.code, name: e.name, description: e.description || '', approverEmail: e.approver.email, displayOrder: e.displayOrder, isActive: e.isActive }));

    const desks = await prisma.serviceDesk.findMany({ orderBy: { createdAt: 'asc' } });
    const desksOut = desks.map(d => ({ code: d.code, name: d.name, description: d.description || '', isActive: d.isActive }));

    const cats = await prisma.serviceCategory.findMany({ include: { serviceDesk: { select: { code: true } }, requestTypes: { select: { code: true } } }, orderBy: { displayOrder: 'asc' } });
    const catsOut = cats.map(c => ({ code: c.code || '', name: c.name, description: c.description || '', deskCode: c.serviceDesk?.code || '', requestTypeCodes: c.requestTypes.map(r => r.code), icon: c.icon || '', colorClass: c.colorClass || '', displayOrder: c.displayOrder, isActive: c.isActive }));

    const rts = await prisma.requestType.findMany({ orderBy: { code: 'asc' } });
    const rtsOut = rts.map(r => ({ code: r.code, name: r.name, description: r.description || '', slaHours: r.slaHours, requiresApproval: r.requiresApproval, isActive: r.isActive }));

    const users = await prisma.user.findMany({ include: { roles: { include: { role: true } }, entity: { select: { code: true } } }, orderBy: { email: 'asc' } });
    const usersOut = users.map(u => ({ email: u.email, firstName: u.firstName, lastName: u.lastName, department: u.department || '', jobTitle: u.jobTitle || '', executiveRole: u.executiveRole || null, agentTeam: u.agentTeam || null, entityCode: u.entity ? u.entity.code : null, roles: u.roles.map(r => r.role.name), isActive: u.isActive }));

    const wts = await prisma.workflowType.findMany({ include: { steps: { orderBy: { displayOrder: 'asc' } } }, orderBy: { code: 'asc' } });
    const wtsOut = wts.map(w => ({ code: w.code, name: w.name, isActive: w.isActive, steps: w.steps.map(s => ({ status: s.status, label: s.label || '', icon: s.icon || '', displayOrder: s.displayOrder, isInitial: s.isInitial, isFinal: s.isFinal, slaPause: s.slaPause })) }));

    const trans = await prisma.workflowTransition.findMany({ orderBy: { fromStatus: 'asc' } });
    const transOut = trans.map(t => ({ fromStatus: t.fromStatus, toStatus: t.toStatus, transitionLabel: t.transitionLabel || '', autoAssignRole: t.autoAssignRole || null, isActive: t.isActive }));

    const esc = await prisma.escalationRule.findMany({});
    const escOut = esc.map(e => ({ requestTypeId: e.requestTypeId, triggerHoursAfterBreach: e.triggerHoursAfterBreach, notifyRoles: e.notifyRoles || [], label: e.label || '', isActive: e.isActive }));

    const statuses = await prisma.requestStatusDefinition.findMany({ orderBy: { displayOrder: 'asc' } });
    const statusesOut = statuses.map(s => ({ code: s.code, label: s.label, category: s.category, displayOrder: s.displayOrder }));

    const banners = await prisma.bannerConfig.findMany({ orderBy: [{ role: 'asc' }, { status: 'asc' }] });
    const bannersOut = banners.map(b => ({ role: b.role, status: b.status, icon: b.icon || '', title: b.title, description: b.description || '', colorScheme: b.colorScheme || '', isActive: b.isActive }));

    const templates = await prisma.notificationTemplate.findMany({ orderBy: { eventType: 'asc' } });
    const templatesOut = templates.map(t => ({ eventType: t.eventType, name: t.name, emailSubject: t.emailSubject || '', emailBody: t.emailBody || '', smsBody: t.smsBody || '', pushTitle: t.pushTitle || '', pushBody: t.pushBody || '', isActive: t.isActive }));

    const onb = await prisma.onboardingTaskTemplate.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] });
    const onbOut = onb.map(t => ({ taskName: t.taskName, taskDescription: t.taskDescription || '', taskCategory: t.taskCategory || '', priority: t.priority, dueDayOffset: t.dueDayOffset, displayOrder: t.displayOrder, isActive: t.isActive }));

    const off = await prisma.offboardingTaskTemplate.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] });
    const offOut = off.map(t => ({ taskName: t.taskName, taskDescription: t.taskDescription || '', taskCategory: t.taskCategory || '', priority: t.priority, dueDayOffset: t.dueDayOffset, displayOrder: t.displayOrder, isActive: t.isActive }));

    const output = {
        _meta: { exportedAt: new Date().toISOString(), description: 'CWC 2.0 Production Admin Configuration Backup' },
        roles: rolesOut,
        entities: entitiesOut,
        desks: desksOut,
        categories: catsOut,
        requestTypes: rtsOut,
        users: usersOut,
        workflowTypes: wtsOut,
        workflowTransitions: transOut,
        escalationRules: escOut,
        statusDefinitions: statusesOut,
        bannerConfigs: bannersOut,
        notificationTemplates: templatesOut,
        onboardingTemplates: onbOut,
        offboardingTemplates: offOut,
    };

    const json = JSON.stringify(output, null, 2);
    // Write to /tmp on server or stdout
    if (process.argv[2] === '--file') {
        fs.writeFileSync(process.argv[3] || '/tmp/admin_config_backup.json', json);
        console.log('Written to', process.argv[3] || '/tmp/admin_config_backup.json');
    } else {
        console.log(json);
    }
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });