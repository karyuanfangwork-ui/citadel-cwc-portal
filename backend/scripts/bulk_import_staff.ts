import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import path from 'path';
import {
  resolveEntityCode,
  splitName,
  inferExecutiveRole,
  inferDepartment,
  inferAgentTeam,
  parseStaffRows,
} from '../src/utils/importStaff';

const prisma = new PrismaClient();

// Default Excel path (relative to backend dir)
const DEFAULT_EXCEL_PATH = path.resolve(__dirname, '../../docs/JobTitles.xlsx');

async function main() {
  const filePath = process.argv[2] || DEFAULT_EXCEL_PATH;
  
  console.log('=== BULK USER IMPORT (from Excel) ===\n');
  console.log(`📂 File: ${filePath}\n`);
  
  // Read staff data from Excel
  let staffData: StaffRow[];
  try {
    const wb = xlsx.readFile(filePath);
    const sheetName = wb.SheetNames.find(n =>
      n.toLowerCase().includes('staff listing') || n.toLowerCase().includes('staff'),
    );
    const targetSheet = sheetName || wb.SheetNames[0];
    if (!targetSheet) {
      console.error('❌ Excel file contains no sheets');
      process.exit(1);
    }
    console.log(`📋 Reading from sheet: "${targetSheet}"`);
    const ws = wb.Sheets[targetSheet];
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    staffData = parseStaffRows(rawData);
  } catch (err: any) {
    console.error(`❌ Failed to read Excel file: ${err.message}`);
    process.exit(1);
  }
  
  if (staffData.length === 0) {
    console.log('⚠️  No staff data found in Excel file.');
    process.exit(0);
  }
  
  console.log(`👥 Found ${staffData.length} staff members\n`);
  
  // Get entities from DB
  const entities = await prisma.entity.findMany();
  const entityCodeToId: Record<string, string> = {};
  for (const e of entities) {
    entityCodeToId[e.code] = e.id;
  }
  const dbEntityLookup = entities.map(e => ({ code: e.code, name: e.name }));
  
  // Get existing user emails
  const existingUsers = await prisma.user.findMany({ select: { email: true, id: true, firstName: true, lastName: true, jobTitle: true, entityId: true, executiveRole: true, department: true, isActive: true } });
  const existingByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));
  
  // Get NORMAL_STAFF role
  const normalStaffRole = await prisma.role.findFirst({ where: { name: 'NORMAL_STAFF' } });
  if (!normalStaffRole) throw new Error('NORMAL_STAFF role not found');
  
  const TEMP_PASSWORD = 'abc@123';
  const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let deactivated = 0;
  
  // Track which emails are in the Excel — users NOT in Excel might need deactivation
  const excelEmails = new Set(staffData.map(s => s.email.toLowerCase()));
  
  for (const staff of staffData) {
    const email = staff.email.toLowerCase();
    const { firstName, lastName } = splitName(staff.displayName);
    const executiveRole = inferExecutiveRole(staff.jobTitle);
    const entityCode = resolveEntityCode(staff.company, dbEntityLookup);
    const entityId = entityCode ? entityCodeToId[entityCode] : null;
    const department = staff.department || inferDepartment(staff.jobTitle);
    const agentTeam = inferAgentTeam(staff.jobTitle);
    
    const existing = existingByEmail.get(email);
    
    if (existing) {
      // UPDATE existing user — sync all fields from Excel (overwrite)
      const updateData: any = {};
      
      // Always update these fields from Excel (source of truth)
      if (existing.jobTitle !== staff.jobTitle) updateData.jobTitle = staff.jobTitle;
      if (existing.entityId !== entityId && entityId) updateData.entityId = entityId;
      if (existing.executiveRole !== executiveRole && executiveRole) updateData.executiveRole = executiveRole;
      if (existing.department !== department && department) updateData.department = department;
      
      // Update name if it changed
      if (existing.firstName !== firstName || existing.lastName !== lastName) {
        updateData.firstName = firstName;
        updateData.lastName = lastName;
      }
      
      // Update active status if specified
      if (staff.isActive !== undefined && existing.isActive !== staff.isActive) {
        updateData.isActive = staff.isActive;
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({ where: { id: existing.id }, data: updateData });
        console.log(`✅ UPDATED: ${email} | ${staff.displayName} | ${JSON.stringify(updateData)}`);
        updated++;
      } else {
        console.log(`⏭️  SKIPPED (up-to-date): ${email}`);
        skipped++;
      }
      continue;
    }
    
    // CREATE new user
    try {
      const newUser = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash: hashedPassword,
          jobTitle: staff.jobTitle,
          department,
          entityId,
          executiveRole,
          agentTeam,
          isActive: staff.isActive !== undefined ? staff.isActive : true,
          roles: {
            create: { roleId: normalStaffRole.id },
          },
        },
      });
      console.log(`✅ CREATED: ${email} | ${staff.displayName} | ${staff.jobTitle} | entity=${entityCode || '?'} | execRole=${executiveRole || 'none'}`);
      created++;
    } catch (err: any) {
      console.error(`❌ ERROR: ${email} | ${err.message}`);
      errors++;
    }
  }
  
  // Deactivate users that are in DB but NOT in Excel (optional, controlled by flag)
  const DEACTIVATE_MISSING = process.argv.includes('--deactivate-missing');
  if (DEACTIVATE_MISSING) {
    for (const user of existingUsers) {
      const email = user.email.toLowerCase();
      // Skip seed/system accounts
      if (email.endsWith('@test.local') || email.endsWith('@helpdesk.com') || email.endsWith('@company.com')) continue;
      // Skip company emails not in Excel
      if (!excelEmails.has(email) && email.includes('@citadelgroup.com.my')) {
        if (user.isActive) {
          await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
          console.log(`🔴 DEACTIVATED: ${email} (not in Excel)`);
          deactivated++;
        }
      }
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (up-to-date): ${skipped}`);
  console.log(`Errors: ${errors}`);
  if (DEACTIVATE_MISSING) console.log(`Deactivated: ${deactivated}`);
  console.log(`Total processed: ${staffData.length}`);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });