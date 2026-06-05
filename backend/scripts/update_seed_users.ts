import { PrismaClient, ExecutiveRole } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const entities = await prisma.entity.findMany();
  const codeToId: Record<string, string> = Object.fromEntries(entities.map(e => [e.code, e.id]));

  const updates = [
    { email: 'ceo@test.local',       entityId: codeToId['CGT'], executiveRole: 'CEO' as ExecutiveRole, jobTitle: 'Chief Executive Officer' },
    { email: 'cto@test.local',       entityId: codeToId['CGT'], executiveRole: 'CTO' as ExecutiveRole, jobTitle: 'Chief Technology Officer' },
    { email: 'cfo@test.local',       entityId: codeToId['CG'],  executiveRole: 'CFO' as ExecutiveRole, jobTitle: 'Chief Finance Officer' },
    { email: 'groupceo@test.local',  entityId: codeToId['CG'],  executiveRole: 'GROUP_DCEO' as ExecutiveRole, jobTitle: 'Chairman & Group Chief Executive Officer' },
    { email: 'hr@test.local',        entityId: codeToId['CG'],  jobTitle: 'Senior HR Executive' },
    { email: 'finance@test.local',   entityId: codeToId['CG'],  jobTitle: 'Finance Agent' },
    { email: 'it@test.local',        entityId: codeToId['CGT'], jobTitle: 'IT Agent' },
    { email: 'it2@test.local',       entityId: codeToId['CGT'], jobTitle: 'IT Agent' },
  ];

  for (const u of updates) {
    const data: any = {};
    if (u.entityId) data.entityId = u.entityId;
    if (u.executiveRole) data.executiveRole = u.executiveRole;
    if (u.jobTitle) data.jobTitle = u.jobTitle;
    await prisma.user.update({ where: { email: u.email }, data });
    console.log(`✅ Updated: ${u.email} | ${JSON.stringify(data)}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
