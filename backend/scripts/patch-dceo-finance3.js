// One-off script: create DCEO user + patch FINANCE-3 status
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();

  // Create DCEO user
  const hash = await bcrypt.hash('abc@123', 10);
  const dceo = await prisma.user.upsert({
    where: { email: 'dceo@test.local' },
    update: { executiveRole: 'DCEO', isActive: true, passwordHash: hash },
    create: {
      email: 'dceo@test.local',
      firstName: 'Deputy',
      lastName: 'CEO',
      passwordHash: hash,
      executiveRole: 'DCEO',
      isActive: true,
    },
  });
  console.log('DCEO user:', JSON.stringify({ id: dceo.id, email: dceo.email, executiveRole: dceo.executiveRole }));

  // Patch FINANCE-3 back to PENDING_CFO_APPROVAL_FIN
  const updated = await prisma.request.update({
    where: { id: '10208af3-c815-4a46-9cf3-936fddf43f23' },
    data: { status: 'PENDING_CFO_APPROVAL_FIN', assignedToId: null },
  });
  console.log('FINANCE-3 patched to:', updated.status);

  // Clean up old approvals
  const deleted = await prisma.requestApproval.deleteMany({
    where: { requestId: '10208af3-c815-4a46-9cf3-936fddf43f23' },
  });
  console.log('Deleted old approvals:', deleted.count);

  await prisma.$disconnect();
}

main().catch(console.error);