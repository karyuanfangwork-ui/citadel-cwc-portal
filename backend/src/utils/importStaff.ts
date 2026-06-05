/**
 * Bulk Staff Import Utility
 *
 * Reused from backend/scripts/bulk_import_staff.ts — entity mapping,
 * executive role inference, name splitting, department inference, and
 * upsert logic are all shared here for use in the API endpoint.
 */
import { ExecutiveRole } from '@prisma/client';

// ── Entity name → code mapping (kept for reference / script usage) ──────────
export const ENTITY_MAP: Record<string, string> = {
  'Citadel Group Sdn. Bhd.': 'CG',
  'Citadel Group Technologies Sdn. Bhd.': 'CGT',
  'Citadel Wealth Partners Sdn. Bhd.': 'CWP',
  'Citadel Tayyib 360 Sdn. Bhd.': 'CT360',
  'NIU Trading Sdn. Bhd.': 'NIU',
  'Cosmospan Sdn. Bhd.': 'COS',
};

/**
 * Normalise a string for fuzzy comparison:
 *  - lowercase
 *  - collapse whitespace
 *  - remove trailing periods
 *  - normalise "sdn bhd" / "sdn. bhd." / "sdnbhd" variants
 *  - strip periods altogether for comparison
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\./g, '')       // strip all periods
    .replace(/\s+/g, ' ')     // collapse whitespace
    .replace(/sdn\s*bhd/g, 'sdnbhd')  // normalise "Sdn. Bhd." / "Sdn Bhd" / "SdnBhd"
    .trim();
}

/**
 * Resolve a raw Excel cell value to an entity code.
 *
 * Tries in order:
 * 1. Exact match against ENTITY_MAP keys (original names with periods)
 * 2. Normalised match against ENTITY_MAP keys
 * 3. Direct entity code match (CG, CGT, CWP, CT360, NIU, COS) — case-insensitive
 * 4. Normalised match against provided DB entity names & codes
 * 5. Partial / substring match (e.g. "citadel group" → CG)
 */
export function resolveEntityCode(
  raw: string,
  dbEntities?: { code: string; name: string }[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Exact match on ENTITY_MAP
  if (ENTITY_MAP[trimmed]) return ENTITY_MAP[trimmed];

  // 2. Normalised match on ENTITY_MAP keys
  const normInput = normalize(trimmed);
  for (const [name, code] of Object.entries(ENTITY_MAP)) {
    if (normalize(name) === normInput) return code;
  }

  // 3. Direct entity-code match (case-insensitive)
  const upper = trimmed.toUpperCase();
  const knownCodes = Object.values(ENTITY_MAP);
  if (knownCodes.includes(upper)) return upper;
  // Also check dbEntities codes if provided
  if (dbEntities) {
    for (const e of dbEntities) {
      if (e.code.toUpperCase() === upper) return e.code;
    }
  }

  // 4. Normalised match against DB entities (covers names that differ from ENTITY_MAP)
  if (dbEntities) {
    for (const e of dbEntities) {
      if (normalize(e.name) === normInput) return e.code;
    }
  }

  // 5. Partial / substring match — input contains or is contained in known name
  for (const [name, code] of Object.entries(ENTITY_MAP)) {
    if (normInput.includes(normalize(name)) || normalize(name).includes(normInput)) return code;
  }
  if (dbEntities) {
    for (const e of dbEntities) {
      const normName = normalize(e.name);
      if (normInput.includes(normName) || normName.includes(normInput)) return e.code;
    }
  }

  return null;
}

// ── Map job titles to executive roles ────────────────────────────────────────
export function inferExecutiveRole(jobTitle: string): ExecutiveRole | null {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('group deputy chief executive officer') || lower.includes('group deputy ceo')) return 'GROUP_DCEO' as ExecutiveRole;
  if (lower === 'chief executive officer' || lower === 'ceo') return 'CEO' as ExecutiveRole;
  if (lower.includes('chief executive officer') && lower.includes('head of sales')) return 'CEO' as ExecutiveRole;
  if (lower.includes('chief technology officer') || lower === 'cto') return 'CTO' as ExecutiveRole;
  if (lower.includes('chief finance officer') || lower.includes('chief financial') || lower === 'cfo') return 'CFO' as ExecutiveRole;
  if (lower.includes('chief operating officer') || lower === 'coo') return 'COO' as ExecutiveRole;
  if (lower.includes('chief human resources') || lower === 'chro') return 'CHRO' as ExecutiveRole;
  if (lower.includes('chief marketing') || lower === 'cmo') return 'CMO' as ExecutiveRole;
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
  if (lower.includes('director') || lower.includes('chief') || lower.includes('group deputy') || lower.includes('ceo') || lower.includes('cto') || lower.includes('cfo')) return 'Executive';
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
    const nameCol = keys.find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('entit') && !k.toLowerCase().includes('company'));
    const jobCol = keys.find(k => k.toLowerCase().includes('job') || k.toLowerCase().includes('title') || k.toLowerCase().includes('position'));
    const companyCol = keys.find(k => k.toLowerCase().includes('entit') || k.toLowerCase().includes('company') || k.toLowerCase().includes('organisation'));
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