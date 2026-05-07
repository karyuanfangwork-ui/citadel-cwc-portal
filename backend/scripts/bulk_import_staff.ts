import { PrismaClient, ExecutiveRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

// Default Excel path (relative to backend dir)
const DEFAULT_EXCEL_PATH = path.resolve(__dirname, '../../docs/JobTitles.xlsx');

// Entity name -> code mapping
const ENTITY_MAP: Record<string, string> = {
  'Citadel Group Sdn. Bhd.': 'CG',
  'Citadel Group Technologies Sdn. Bhd.': 'CGT',
  'Citadel Wealth Partner Sdn. Bhd.': 'CWP',
  'Citadel Tayyib 360 Sdn. Bhd.': 'CT360',
  'NIU Trading Sdn. Bhd.': 'NIU',
  'Cosmospan Sdn. Bhd.': 'COS',
};

// Map job titles to executive roles
function inferExecutiveRole(jobTitle: string): ExecutiveRole | null {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('group chief executive') || lower.includes('chairman')) return 'GROUP_CEO' as ExecutiveRole;
  if (lower === 'chief executive officer' || lower === 'ceo') return 'CEO' as ExecutiveRole;
  if (lower.includes('chief executive officer') && lower.includes('head of sales')) return 'CEO' as ExecutiveRole;
  if (lower.includes('chief technology officer') || lower === 'cto') return 'CTO' as ExecutiveRole;
  if (lower.includes('chief finance officer') || lower.includes('chief financial') || lower === 'cfo') return 'CFO' as ExecutiveRole;
  if (lower.includes('chief human resources') || lower === 'chro') return 'CHRO' as ExecutiveRole;
  if (lower.includes('chief operating officer') || lower === 'coo') return 'COO' as ExecutiveRole;
  return null;
}

// Infer department from job title
function inferDepartment(jobTitle: string): string | null {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('developer') || lower.includes('system admin') || lower.includes('application support') || lower.includes('lead application') || lower.includes('product head')) return 'IT';
  if (lower.includes('finance') || lower.includes('financial') || lower.includes('accounting')) return 'Finance';
  if (lower.includes('hr') || lower.includes('human resource')) return 'HR';
  if (lower.includes('marketing') || lower.includes('investor relation')) return 'Marketing';
  if (lower.includes('legal') || lower.includes('compliance')) return 'Legal';
  if (lower.includes('admin') || lower.includes('receptionist') || lower.includes('executive assistant')) return 'Admin';
  if (lower.includes('director') || lower.includes('chief') || lower.includes('chairman') || lower.includes('ceo') || lower.includes('cto') || lower.includes('cfo')) return 'Executive';
  if (lower.includes('sales')) return 'Sales';
  return null;
}

// Infer agent team from job title
function inferAgentTeam(jobTitle: string): string | null {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('developer') || lower.includes('system admin') || lower.includes('application support') || lower.includes('lead application')) return 'IT';
  if (lower.includes('finance') || lower.includes('financial')) return 'FINANCE';
  if (lower.includes('hr') || lower.includes('human resource')) return 'HR';
  return null;
}

// Split display name into first/last name
function splitName(displayName: string): { firstName: string; lastName: string } {
  // Handle special prefixes
  const prefixes = ["Dato'", 'Dr.', 'Ir.', 'Hj.', 'Hjh.'];
  let prefix = '';
  let remaining = displayName;
  for (const p of prefixes) {
    if (displayName.startsWith(p + ' ')) {
      prefix = p;
      remaining = displayName.slice(p.length).trim();
      break;
    }
  }
  
  const parts = remaining.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: (prefix ? prefix + ' ' : '') + parts[0], lastName: parts[0] };
  }
  return {
    firstName: (prefix ? prefix + ' ' : '') + parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

interface StaffRow {
  displayName: string;
  email: string;
  jobTitle: string;
  company: string;
  department?: string; // override if provided in Excel
  isActive?: boolean;  // override if provided in Excel
}

function readExcel(filePath: string): StaffRow[] {
  const wb = xlsx.readFile(filePath);
  
  // Read "staff listing" sheet
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('staff listing') || n.toLowerCase().includes('staff'));
  if (!sheetName) {
    // Fallback to first sheet
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    console.log(`⚠️  No "staff listing" sheet found, using first sheet: "${wb.SheetNames[0]}"`);
    return parseRows(data);
  }
  
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  console.log(`📋 Reading from sheet: "${sheetName}" (${data.length} rows)`);
  return parseRows(data);
}

function parseRows(data: Record<string, any>[]): StaffRow[] {
  const staff: StaffRow[] = [];
  
  for (const row of data) {
    // Auto-detect column names (case-insensitive, flexible matching)
    const keys = Object.keys(row);
    const emailCol = keys.find(k => k.toLowerCase().includes('email'));
    const nameCol = keys.find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('entity') && !k.toLowerCase().includes('company'));
    const jobCol = keys.find(k => k.toLowerCase().includes('job') || k.toLowerCase().includes('title') || k.toLowerCase().includes('position'));
    const companyCol = keys.find(k => k.toLowerCase().includes('entity') || k.toLowerCase().includes('company') || k.toLowerCase().includes('organisation'));
    const deptCol = keys.find(k => k.toLowerCase().includes('department') || k.toLowerCase().includes('dept'));
    const activeCol = keys.find(k => k.toLowerCase().includes('active') || k.toLowerCase().includes('status'));
    
    const email = emailCol ? String(row[emailCol] || '').trim().toLowerCase() : '';
    const displayName = nameCol ? String(row[nameCol] || '').trim() : '';
    const jobTitle = jobCol ? String(row[jobCol] || '').trim() : '';
    const company = companyCol ? String(row[companyCol] || '').trim() : '';
    const department = deptCol ? String(row[deptCol] || '').trim() || undefined : undefined;
    const isActive = activeCol ? String(row[activeCol] || '').toLowerCase() !== 'inactive' : undefined;
    
    // Skip rows without email or name
    if (!email || !displayName) continue;
    // Skip header-like rows
    if (email === 'email' || displayName.toLowerCase() === 'name') continue;
    
    staff.push({ displayName, email, jobTitle, company, department, isActive });
  }
  
  return staff;
}

async function main() {
  const filePath = process.argv[2] || DEFAULT_EXCEL_PATH;
  
  console.log('=== BULK USER IMPORT (from Excel) ===\n');
  console.log(`📂 File: ${filePath}\n`);
  
  // Read staff data from Excel
  let staffData: StaffRow[];
  try {
    staffData = readExcel(filePath);
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
    const entityCode = ENTITY_MAP[staff.company];
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