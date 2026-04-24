import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Creating GROUP_CEO user...\n');

  // Find GROUP_CEO role
  const groupCeoRole = await prisma.role.findUnique({
    where: { name: 'GROUP_CEO' }
  });

  if (!groupCeoRole) {
    console.error('❌ GROUP_CEO role not found');
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'groupceo@company.com' }
  });

  if (existingUser) {
    console.log('⚠️  User groupceo@company.com already exists');
    
    // Check if already has GROUP_CEO role
    const existingRole = await prisma.userRole.findFirst({
      where: { userId: existingUser.id, roleId: groupCeoRole.id }
    });
    
    if (existingRole) {
      console.log('✅ User already has GROUP_CEO role');
    } else {
      // Assign GROUP_CEO role
      await prisma.userRole.create({
        data: {
          userId: existingUser.id,
          roleId: groupCeoRole.id
        }
      });
      console.log('✅ GROUP_CEO role assigned to existing user');
    }
    
    console.log('\n📋 Login credentials:');
    console.log('   Email: groupceo@company.com');
    console.log('   Password: groupceo123');
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash('groupceo123', 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'groupceo@company.com',
      passwordHash,
      firstName: 'Group',
      lastName: 'CEO',
      isActive: true,
    }
  });

  // Assign GROUP_CEO role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: groupCeoRole.id
    }
  });

  console.log('✅ GROUP_CEO user created successfully!\n');
  console.log('📋 Login credentials:');
  console.log('   Email: groupceo@company.com');
  console.log('   Password: groupceo123');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });