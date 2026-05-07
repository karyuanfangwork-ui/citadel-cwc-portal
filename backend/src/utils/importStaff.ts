/**
 * Bulk Staff Import Utility
 *
 * Reused from backend/scripts/bulk_import_staff.ts — entity mapping,
 * executive role inference, name splitting, department inference, and
 * upsert logic are all shared here for use in the API endpoint.
 */
import { ExecutiveRole } from '@prisma/client';

// ── Entity name → code mapping ──────────────────────────────────────────────
export const ENTITY_MAP: Record<string, string> = {
  'Citadel Group Sdn. Bhd.': 'CG',
  'Citadel Group Technologies Sdn. Bhd.': 'CGT',
  'Citadel Wealth Partner Sdn. Bhd.': 'CWP',
  'Citadel Tayyib 360 Sdn. Bhd.': 'CT360',
  'NIU Trading Sdn. Bhd.': 'NIU',
  'Cosmospan Sdn. Bhd.': 'COS',
};

// ── Map job titles to executive roles ────────────────────────────────────────
export function inferExecutiveRole(jobTitle: string): ExecutiveRole | null {
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

// ── Infer department from job title ──────────────────────────────────────────
export function inferDepartment(jobTitle: string): string | null {
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

// ── Infer agent team from job title ──────────────────────────────────────────
export function inferAgentTeam(jobTitle: string): string | null {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('developer') || lower.includes('system admin') || lower.includes('application support') || lower.includes('lead application')) return 'IT';
  if (lower.includes('finance') || lower.includes('financial')) return 'FINANCE';
  if (lower.includes('hr') || lower.includes('human resource')) return 'HR';
  return null;
}

// ── Split display name into first/last name ──────────────────────────────────
export function splitName(displayName: string): { firstName: string; lastName: string } {
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

// ── Staff row type (parsed from Excel) ────────────────────────────────────────
export interface StaffRow {
  displayName: string;
  email: string;
  jobTitle: string;
  company: string;
  department?: string;
  isActive?: boolean;
}

// ── Parse raw Excel rows into StaffRow[] ──────────────────────────────────────
export function parseStaffRows(data: Record<string, any>[]): StaffRow[] {
  const staff: StaffRow[] = [];

  for (const row of data) {
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