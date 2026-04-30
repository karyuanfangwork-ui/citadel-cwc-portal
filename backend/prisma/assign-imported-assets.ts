/**
 * Assign imported assets to their correct users based on the Excel "Primary user email address".
 *
 * 1. Creates CWC user accounts for employees found in the Excel (using @citadelgroup.com.my emails)
 * 2. Updates asset status from IN_STOCK → ASSIGNED
 * 3. Creates AssetAssignment records linking assets to users
 *
 * Usage:
 *   npx tsx prisma/assign-imported-assets.ts [--dry-run]
 */

import { PrismaClient, AssetStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const ADMIN_ID = '65718092-6fed-42fb-b478-96fbf77b58d6';
const DEFAULT_PASSWORD = 'abc@123';

// All unique employees from the Excel with their real emails
const employees: Array<{ email: string; firstName: string; lastName: string; department?: string; jobTitle?: string }> = [
  { email: 'rajna.anthony@citadelgroup.com.my', firstName: 'Rajna', lastName: 'Anthony', jobTitle: 'Doctor' },
  { email: 'j.medina@citadelgroup.com.my', firstName: 'Jeff', lastName: 'Medina', jobTitle: 'Dato' },
  { email: 'shah.musa@citadelgroup.com.my', firstName: 'Shah Rezza', lastName: 'Musa' },
  { email: 'zahidah.rashid@citadelgroup.com.my', firstName: 'Zahidah Zainal', lastName: 'Rashid' },
  { email: 'kamilah.hanif@citadelgroup.com.my', firstName: 'Nurul Kamilah Hanif', lastName: 'Kondon' },
  { email: 'fadhli.amran@citadelgroup.com.my', firstName: 'Muhammad Fadhli', lastName: 'Amran' },
  { email: 'sasha.nair@citadelgroup.com.my', firstName: 'Sasha', lastName: 'Nair' },
  { email: 'michelle.weng@citadelgroup.com.my', firstName: 'Lee Foong', lastName: 'Weng' },
  { email: 'saravanan.ramaiah@citadelgroup.com.my', firstName: 'Saravanan', lastName: 'Ramaiah' },
  { email: 'natasha.dealwis@citadelgroup.com.my', firstName: 'Natasha Kimberly', lastName: 'De Alwis' },
  { email: 'khaliesah.badruddin@citadelgroup.com.my', firstName: "Kha'liesah", lastName: 'Badruddin' },
  { email: 'nick.tan@citadelgroup.com.my', firstName: 'Nichollas Pi Huat', lastName: 'Tan' },
  { email: 'irina.kamarzan@citadelgroup.com.my', firstName: 'Nor Irina Safiyyah Md', lastName: 'Kamarzan' },
  { email: 'alain.boey@citadelgroup.com.my', firstName: 'Alain', lastName: 'Boey' },
  { email: 'natalya.erika@citadelgroup.com.my', firstName: 'Natalya Erika', lastName: 'Martison' },
  { email: 'emily.chow@citadelgroup.com.my', firstName: 'Emily', lastName: 'Chow' },
  { email: 'raymond.kueh@citadelgroup.com.my', firstName: 'Raymond Kueh Kian', lastName: 'Peng' },
  { email: 'naveen.ahmad@citadelgroup.com.my', firstName: 'Naveen', lastName: 'Ahmad' },
  { email: 'karyuan.fang@citadelgroup.com.my', firstName: 'Kar Yuan', lastName: 'Fang' },
  { email: 'fangkhai.foo@citadelgroup.com.my', firstName: 'Fang Khai', lastName: 'Foo' },
  { email: 'mingkai.tham@citadelgroup.com.my', firstName: 'Ming Kai', lastName: 'Tham' },
  { email: 'cheehao.wong@citadelgroup.com.my', firstName: 'Brandon Wong Chee', lastName: 'Hao' },
  { email: 'nurnafisah.sharudin@citadelgroup.com.my', firstName: 'Nurnafisah Najla', lastName: 'Sharudin' },
  { email: 'adly.mohamed@citadelgroup.com.my', firstName: 'Adly', lastName: 'Mohamed' },
  { email: 'ahmad.zuhayri@citadelgroup.com.my', firstName: 'Ahmad Zuhayri', lastName: 'Mohamed' },
  { email: 'zac.ashari@citadelgroup.com.my', firstName: 'Zac Mohd', lastName: 'Ashari' },
  { email: 'alan.ling@citadelgroup.com.my', firstName: 'Alan', lastName: 'Ling' },
  { email: 'joyce.loh@citadelgroup.com.my', firstName: 'Joyce', lastName: 'Loh' },
  { email: 'soraya.rozali@citadelgroup.com.my', firstName: 'Soraya Rose', lastName: 'Rozali' },
  { email: 'girling.liong@citadelgroup.com.my', firstName: 'Girling Liong Mee', lastName: 'Yee' },
  { email: 'rohani.munir@citadelgroup.com.my', firstName: 'Rohani Abdul', lastName: 'Munir' },
  { email: 'juliana.jalil@citadelgroup.com.my', firstName: 'Juliana Abd', lastName: 'Jalil' },
  { email: 'shamsuria.shamsuri@citadelgroup.com.my', firstName: 'Shamsuria', lastName: 'Shamsuri' },
];

// Asset tag → employee email mapping (from Excel "Primary user email address")
// Only assets with a real email (not "Available" or "Server Admin")
const assetAssignments: Record<string, string> = {
  'CG-MY-CEA-LAP001': 'rajna.anthony@citadelgroup.com.my',
  'CG-MY-CGB-LAP001': 'j.medina@citadelgroup.com.my',
  'CH-MY-CGB-LAP016': 'j.medina@citadelgroup.com.my',
  'CG-MY-CGB-LAP002': 'shah.musa@citadelgroup.com.my',
  'CG-MY-CGB-DSK001': 'zahidah.rashid@citadelgroup.com.my',
  'CG-MY-CGB-DSK002': 'shah.musa@citadelgroup.com.my',
  'CG-MY-CGB-LAP003': 'kamilah.hanif@citadelgroup.com.my',
  'CG-MY-CEA-LAP004': 'fadhli.amran@citadelgroup.com.my',
  'CG-MY-CGB-LAP005': 'sasha.nair@citadelgroup.com.my',
  'CG-MY-CGB-LAP006': 'michelle.weng@citadelgroup.com.my',
  'CG-MY-CGB-LAP007': 'zahidah.rashid@citadelgroup.com.my',
  'CG-MY-CGB-LAP008': 'saravanan.ramaiah@citadelgroup.com.my',
  'CG-MY-CGB-LAP009': 'natasha.dealwis@citadelgroup.com.my',
  'CG-MY-CGB-LAP010': 'khaliesah.badruddin@citadelgroup.com.my',
  'CH-MY-CGB-LAP011': 'nick.tan@citadelgroup.com.my',
  'CH-MY-CGB-LAP012': 'irina.kamarzan@citadelgroup.com.my',
  'CH-MY-CGB-LAP013': 'alain.boey@citadelgroup.com.my',
  'CG-MY-CTT-LAP002': 'natalya.erika@citadelgroup.com.my',
  'CH-MY-CGT-LAP001': 'emily.chow@citadelgroup.com.my',
  'CH-MY-CGT-LAP004': 'raymond.kueh@citadelgroup.com.my',
  'CH-MY-CGT-LAP003': 'naveen.ahmad@citadelgroup.com.my',
  'CH-MY-CGT-LAP005': 'karyuan.fang@citadelgroup.com.my',
  'CH-MY-CGT-LAP006': 'fangkhai.foo@citadelgroup.com.my',
  'CH-MY-CGT-LAP007': 'mingkai.tham@citadelgroup.com.my',
  'CH-MY-CGT-LAP010': 'cheehao.wong@citadelgroup.com.my',
  'CH-MY-CGT-LAP009': 'nurnafisah.sharudin@citadelgroup.com.my',
  'CH-MY-CTS-LAP001': 'adly.mohamed@citadelgroup.com.my',
  'CG-MY-CEA-LAP002': 'ahmad.zuhayri@citadelgroup.com.my',
  'CG-MY-CWP-LAP001': 'zac.ashari@citadelgroup.com.my',
  'CG-MY-CWP-LAP002': 'alan.ling@citadelgroup.com.my',
  'CG-MY-CWP-LAP004': 'joyce.loh@citadelgroup.com.my',
  'CG-MY-CWP-LAP005': 'soraya.rozali@citadelgroup.com.my',
  'CG-MY-CWP-LAP006': 'girling.liong@citadelgroup.com.my',
  'CG-MY-CWP-LAP007': 'joyce.loh@citadelgroup.com.my',
  'CG-MY-CWP-LAP008': 'rohani.munir@citadelgroup.com.my',
  'CG-MY-CWP-LAP011': 'juliana.jalil@citadelgroup.com.my',
  'CH-MY-NIU-DSK001': 'shamsuria.shamsuri@citadelgroup.com.my',
  'CH-MY-NIU-LAP002': 'shamsuria.shamsuri@citadelgroup.com.my',
};

async function main() {
  console.log('\n========================================');
  console.log('CWC Asset Assignment from Excel');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Employees to create: ${employees.length}`);
  console.log(`Asset assignments: ${Object.keys(assetAssignments).length}`);
  console.log();

  // Step 1: Create user accounts for all Excel employees
  console.log('--- Step 1: Create Employee User Accounts ---');
  const emailToUserId: Record<string, string> = {};
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Get existing default role (USER)
  const endUserRole = await prisma.role.findFirst({ where: { name: 'USER' } });
  if (!endUserRole) {
    console.error('ERROR: END_USER role not found. Run seed first.');
    process.exit(1);
  }

  for (const emp of employees) {
    const existing = await prisma.user.findUnique({ where: { email: emp.email } });
    if (existing) {
      emailToUserId[emp.email] = existing.id;
      console.log(`  [EXISTS] ${emp.email} → ${existing.firstName} ${existing.lastName} (${existing.id})`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would create: ${emp.email} | ${emp.firstName} ${emp.lastName}`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        jobTitle: emp.jobTitle || null,
        department: emp.department || null,
        isActive: true,
      },
    });

    // Assign END_USER role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: endUserRole.id,
      },
    });

    emailToUserId[emp.email] = user.id;
    console.log(`  [NEW] ${emp.email} → ${user.firstName} ${user.lastName} (${user.id})`);
  }

  // Step 2: Update assets and create assignments
  console.log('\n--- Step 2: Assign Assets to Users ---');
  let assigned = 0;
  let alreadyAssigned = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [assetTag, empEmail] of Object.entries(assetAssignments)) {
    const userId = emailToUserId[empEmail];
    if (!userId) {
      console.log(`  [SKIP] ${assetTag} → ${empEmail}: user not found/created`);
      notFound++;
      continue;
    }

    const asset = await prisma.asset.findUnique({ where: { assetTag } });
    if (!asset) {
      console.log(`  [SKIP] ${assetTag}: asset not found in DB`);
      notFound++;
      continue;
    }

    // Check for existing active assignment
    const existingAssignment = await prisma.assetAssignment.findFirst({
      where: { assetId: asset.id, returnedAt: null },
    });

    if (existingAssignment) {
      if (existingAssignment.userId === userId) {
        console.log(`  [OK] ${assetTag}: already assigned to ${empEmail}`);
        alreadyAssigned++;
        continue;
      }
      // Return existing assignment first
      if (!DRY_RUN) {
        await prisma.assetAssignment.update({
          where: { id: existingAssignment.id },
          data: { returnedAt: new Date(), notes: 'Reassigned during Excel import fix' },
        });
      }
      console.log(`  [REASSIGN] ${assetTag}: returned previous user, assigning to ${empEmail}`);
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would assign ${assetTag} → ${empEmail} and set status=ASSIGNED`);
      assigned++;
      continue;
    }

    // Update asset status to ASSIGNED
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: AssetStatus.ASSIGNED },
    });

    // Create assignment
    await prisma.assetAssignment.create({
      data: {
        assetId: asset.id,
        userId,
        assignedById: ADMIN_ID,
        reason: 'Imported from Device_Inventory.xlsx — Primary user assignment',
      },
    });

    console.log(`  [ASSIGNED] ${assetTag} → ${empEmail}`);
    assigned++;
  }

  console.log('\n========================================');
  console.log('Assignment Summary');
  console.log('========================================');
  console.log(`  Assigned        : ${assigned}`);
  console.log(`  Already assigned: ${alreadyAssigned}`);
  console.log(`  Skipped (error) : ${notFound}`);
  console.log(`  Total processed : ${Object.keys(assetAssignments).length}`);

  if (DRY_RUN) {
    console.log('\n(Dry run — no data was written to the database)');
  }
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());