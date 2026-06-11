import { PrismaClient, LeadSource } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { assertSpreadsheetOrCsvSignature } from '../utils/file-signature';

const prisma = new PrismaClient();

// ============================================================================
// FIELD DEFINITIONS PER ENTITY
// ============================================================================

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean';
  enumValues?: string[];
  default?: unknown;
}

const ENTITY_FIELDS: Record<string, FieldDef[]> = {
  LEAD: [
    { key: 'title', label: 'Title', required: true, type: 'string' },
    { key: 'contactName', label: 'Contact Name', required: true, type: 'string' },
    { key: 'contactEmail', label: 'Contact Email', required: false, type: 'string' },
    { key: 'contactPhone', label: 'Contact Phone', required: false, type: 'string' },
    { key: 'companyName', label: 'Company Name', required: false, type: 'string' },
    { key: 'source', label: 'Source', required: false, type: 'enum', enumValues: ['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'], default: 'OTHER' },
    { key: 'estimatedValue', label: 'Estimated Value', required: false, type: 'number' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
  ],
  CONTACT: [
    { key: 'firstName', label: 'First Name', required: true, type: 'string' },
    { key: 'lastName', label: 'Last Name', required: true, type: 'string' },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'mobile', label: 'Mobile', required: false, type: 'string' },
    { key: 'jobTitle', label: 'Job Title', required: false, type: 'string' },
    { key: 'department', label: 'Department', required: false, type: 'string' },
    { key: 'nricPassport', label: 'NRIC/Passport', required: false, type: 'string' },
  ],
  ACCOUNT: [
    { key: 'name', label: 'Account Name', required: true, type: 'string' },
    { key: 'industry', label: 'Industry', required: false, type: 'string' },
    { key: 'companySize', label: 'Company Size', required: false, type: 'string' },
    { key: 'website', label: 'Website', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'state', label: 'State', required: false, type: 'string' },
    { key: 'country', label: 'Country', required: false, type: 'string' },
    { key: 'annualRevenue', label: 'Annual Revenue', required: false, type: 'number' },
  ],
  OPPORTUNITY: [
    { key: 'name', label: 'Opportunity Name', required: true, type: 'string' },
    { key: 'value', label: 'Deal Value', required: false, type: 'number' },
    { key: 'currency', label: 'Currency', required: false, type: 'string', default: 'MYR' },
    { key: 'probability', label: 'Probability (%)', required: false, type: 'number' },
    { key: 'expectedCloseDate', label: 'Expected Close Date', required: false, type: 'date' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
  ],
};

const MAX_ROWS = 10000;

// ============================================================================
// IMPORT SERVICE
// ============================================================================

export function getFieldDefinitions(entity: string): FieldDef[] {
  return ENTITY_FIELDS[entity.toUpperCase()] || [];
}

export function suggestColumnMapping(headers: string[], entity: string): Record<string, string> {
  const fields = ENTITY_FIELDS[entity.toUpperCase()] || [];
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const field of fields) {
      const normalizedField = field.key.toLowerCase();
      const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedHeader === normalizedField || normalizedHeader === normalizedLabel) {
        mapping[header] = field.key;
        break;
      }
    }
    if (!mapping[header]) {
      const aliases: Record<string, string> = {
        'firstname': 'firstName', 'fname': 'firstName', 'givenname': 'firstName',
        'lastname': 'lastName', 'lname': 'lastName', 'surname': 'lastName', 'familyname': 'lastName',
        'emailaddress': 'email', 'mail': 'email',
        'phonenumber': 'phone', 'tel': 'phone', 'mobilephone': 'mobile', 'cellphone': 'mobile',
        'company': 'companyName', 'organization': 'companyName', 'organisation': 'companyName',
        'subject': 'title', 'dealname': 'name', 'opportunityname': 'name',
        'dealvalue': 'value', 'amount': 'value', 'revenue': 'annualRevenue',
        'estimatedvalue': 'estimatedValue', 'leadvalue': 'estimatedValue',
        'closingdate': 'expectedCloseDate', 'closedate': 'expectedCloseDate',
        'industrytype': 'industry', 'companysize': 'companySize', 'employees': 'companySize',
        'leadsource': 'source',
        'jobtitle': 'jobTitle', 'position': 'jobTitle', 'role': 'jobTitle',
        'nric': 'nricPassport', 'passport': 'nricPassport',
      };
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (aliases[lowerHeader]) {
        mapping[header] = aliases[lowerHeader];
      }
    }
  }

  return mapping;
}

export async function uploadAndParseFile(
  file: Express.Multer.File,
  entity: string,
  userId: string
): Promise<{ jobId: string; preview: Record<string, unknown>[]; headers: string[]; suggestedMapping: Record<string, string>; totalRows: number }> {
  if (!assertSpreadsheetOrCsvSignature(file.buffer, file.originalname, file.mimetype)) {
    throw new Error('Uploaded file content does not match the declared CSV/XLS/XLSX type.');
  }

  let rawRows: Record<string, unknown>[];

  if (file.mimetype.includes('csv') || file.originalname.endsWith('.csv')) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else if (
    file.mimetype.includes('spreadsheet') ||
    file.originalname.endsWith('.xlsx') ||
    file.originalname.endsWith('.xls')
  ) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    throw new Error('Unsupported file type. Please upload a CSV or XLSX file.');
  }

  if (rawRows.length === 0) {
    throw new Error('File is empty or has no parseable data.');
  }

  if (rawRows.length > MAX_ROWS) {
    throw new Error(`File contains ${rawRows.length} rows, which exceeds the maximum of ${MAX_ROWS}.`);
  }

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const suggestedMapping = suggestColumnMapping(headers, entity);

  const job = await prisma.crmImportJob.create({
    data: {
      fileName: file.originalname,
      fileType: file.originalname.endsWith('.csv') ? 'CSV' : 'XLSX',
      entity: entity.toUpperCase(),
      status: 'PREVIEW',
      totalRows: rawRows.length,
      rawData: rawRows.slice(0, 2000) as any,
      columnMapping: suggestedMapping as any,
      createdBy: userId,
    },
  });

  return {
    jobId: job.id,
    preview: rawRows.slice(0, 20),
    headers,
    suggestedMapping,
    totalRows: rawRows.length,
  };
}

export async function validateImportMapping(
  jobId: string,
  columnMapping: Record<string, string>,
  userId: string
): Promise<{ valid: boolean; errors: { row: number; field: string; error: string }[]; warnings: string[] }> {
  const job = await prisma.crmImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Import job not found');
  if (job.createdBy !== userId) throw new Error('Not authorized to access this import job');

  const rawData = (job.rawData as Record<string, unknown>[]) || [];
  const fields = ENTITY_FIELDS[job.entity as keyof typeof ENTITY_FIELDS] || [];
  const requiredFields = fields.filter(f => f.required);
  const errors: { row: number; field: string; error: string }[] = [];
  const warnings: string[] = [];

  const mappedFields = new Set(Object.values(columnMapping).filter(Boolean));
  for (const req of requiredFields) {
    if (!mappedFields.has(req.key)) {
      warnings.push(`Required field "${req.label}" is not mapped. Rows without this field will fail.`);
    }
  }

  for (let i = 0; i < Math.min(rawData.length, 100); i++) {
    const row = rawData[i];
    for (const [header, fieldKey] of Object.entries(columnMapping)) {
      if (!fieldKey) continue;
      const fieldDef = fields.find(f => f.key === fieldKey);
      if (!fieldDef) continue;
      const value = row[header];

      if (fieldDef.required && (!value || String(value).trim() === '')) {
        errors.push({ row: i + 1, field: fieldDef.label, error: 'Required field is empty' });
      }

      if (value && fieldDef.type === 'number' && isNaN(Number(value))) {
        errors.push({ row: i + 1, field: fieldDef.label, error: `Expected number, got "${value}"` });
      }

      if (value && fieldDef.type === 'enum' && fieldDef.enumValues && !fieldDef.enumValues.includes(String(value).toUpperCase())) {
        errors.push({ row: i + 1, field: fieldDef.label, error: `Invalid value "${value}". Allowed: ${fieldDef.enumValues.join(', ')}` });
      }
    }
  }

  await prisma.crmImportJob.update({
    where: { id: jobId },
    data: { columnMapping: columnMapping as any, status: 'PREVIEW' },
  });

  return { valid: errors.length < rawData.length * 0.5, errors: errors.slice(0, 50), warnings };
}

export async function executeImport(jobId: string, userId: string): Promise<{ importedRows: number; failedRows: number; errors: { row: number; error: string }[] }> {
  const job = await prisma.crmImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Import job not found');
  if (job.createdBy !== userId) throw new Error('Not authorized');
  if (job.status === 'IMPORTING') throw new Error('Import is already in progress');

  await prisma.crmImportJob.update({ where: { id: jobId }, data: { status: 'IMPORTING' } });

  const rawData = (job.rawData as Record<string, unknown>[]) || [];
  const columnMapping = (job.columnMapping as Record<string, string>) || {};
  const fields = ENTITY_FIELDS[job.entity as keyof typeof ENTITY_FIELDS] || [];
  let importedRows = 0;
  let failedRows = 0;
  const allErrors: { row: number; error: string }[] = [];

  // Get default pipeline for opportunities
  let defaultPipeline: { id: string; stages: { id: string; name: string; displayOrder: number }[] } | null = null;
  if (job.entity === 'OPPORTUNITY') {
    defaultPipeline = await prisma.crmPipeline.findFirst({
      where: { isDefault: true, isActive: true },
      include: { stages: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  for (let i = 0; i < rawData.length; i++) {
    try {
      const row = rawData[i];
      const data: Record<string, unknown> = {};

      for (const [header, fieldKey] of Object.entries(columnMapping)) {
        if (!fieldKey) continue;
        const fieldDef = fields.find(f => f.key === fieldKey);
        if (!fieldDef) continue;
        let value = row[header];

        if (fieldDef.type === 'number' && value !== undefined && value !== '') {
          value = Number(value);
          if (isNaN(value as number)) throw new Error(`Invalid number for ${fieldDef.label}`);
        }
        if (fieldDef.type === 'enum' && value) {
          value = String(value).toUpperCase();
        }
        if (fieldDef.type === 'date' && value) {
          const d = new Date(String(value));
          if (isNaN(d.getTime())) throw new Error(`Invalid date for ${fieldDef.label}`);
          value = d.toISOString();
        }
        if (fieldDef.type === 'boolean' && value !== undefined) {
          value = String(value).toLowerCase() === 'true' || value === '1' || value === 'yes';
        }
        if ((value === undefined || value === '') && fieldDef.default !== undefined) {
          value = fieldDef.default;
        }

        data[fieldKey] = value;
      }

      switch (job.entity) {
        case 'LEAD':
          await prisma.crmLead.create({
            data: {
              title: String(data.title || 'Imported Lead'),
              contactName: String(data.contactName || 'Unknown'),
              contactEmail: data.contactEmail ? String(data.contactEmail) : null,
              contactPhone: data.contactPhone ? String(data.contactPhone) : null,
              companyName: data.companyName ? String(data.companyName) : null,
              source: (data.source as LeadSource) || LeadSource.OTHER,
              estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined,
              description: data.description ? String(data.description) : null,
              ownerId: userId,
              status: 'NEW',
            },
          });
          break;
        case 'CONTACT': {
          let accountId = data.accountId ? String(data.accountId) : null;
          if (!accountId) {
            const defaultAccount = await prisma.crmAccount.findFirst({
              where: { name: 'Imported Contacts', ownerId: userId },
            });
            if (defaultAccount) {
              accountId = defaultAccount.id;
            } else {
              const newAccount = await prisma.crmAccount.create({
                data: { name: 'Imported Contacts', ownerId: userId },
              });
              accountId = newAccount.id;
            }
          }
          await prisma.crmContact.create({
            data: {
              firstName: String(data.firstName || ''),
              lastName: String(data.lastName || ''),
              accountId: accountId!,
              email: data.email ? String(data.email) : null,
              phone: data.phone ? String(data.phone) : null,
              mobile: data.mobile ? String(data.mobile) : null,
              jobTitle: data.jobTitle ? String(data.jobTitle) : null,
              department: data.department ? String(data.department) : null,
              nricPassport: data.nricPassport ? String(data.nricPassport) : null,
            },
          });
          break;
        }
        case 'ACCOUNT':
          await prisma.crmAccount.create({
            data: {
              name: String(data.name || 'Imported Account'),
              industry: data.industry ? String(data.industry) : null,
              companySize: data.companySize ? String(data.companySize) : null,
              website: data.website ? String(data.website) : null,
              phone: data.phone ? String(data.phone) : null,
              email: data.email ? String(data.email) : undefined,
              city: data.city ? String(data.city) : null,
              state: data.state ? String(data.state) : null,
              country: data.country ? String(data.country) : null,
              annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
              ownerId: userId,
            },
          });
          break;
        case 'OPPORTUNITY': {
          const pipeline = defaultPipeline || await prisma.crmPipeline.findFirst({
            where: { isActive: true },
            include: { stages: { orderBy: { displayOrder: 'asc' } } },
          });
          if (!pipeline || pipeline.stages.length === 0) {
            throw new Error('No pipeline found. Please create a pipeline first.');
          }
          const firstStage = pipeline.stages[0];
          // Find or create a default account for imported opportunities
          let opportunityAccountId = data.accountId ? String(data.accountId) : null;
          if (!opportunityAccountId) {
            const defaultAccount = await prisma.crmAccount.findFirst({
              where: { name: 'Imported Opportunities', ownerId: userId },
            });
            if (defaultAccount) {
              opportunityAccountId = defaultAccount.id;
            } else {
              const newAccount = await prisma.crmAccount.create({
                data: { name: 'Imported Opportunities', ownerId: userId },
              });
              opportunityAccountId = newAccount.id;
            }
          }
          await prisma.crmOpportunity.create({
            data: {
              name: String(data.name || 'Imported Opportunity'),
              value: data.value ? Number(data.value) : 0,
              currency: String(data.currency || 'MYR'),
              probability: data.probability ? Math.round(Number(data.probability)) : 0,
              expectedCloseDate: data.expectedCloseDate ? new Date(String(data.expectedCloseDate)) : undefined,
              description: data.description ? String(data.description) : null,
              ownerId: userId,
              pipelineId: pipeline.id,
              stageId: firstStage.id,
              accountId: opportunityAccountId!,
            },
          });
          break;
        }
      }
      importedRows++;
    } catch (err) {
      failedRows++;
      allErrors.push({ row: i + 1, error: (err as Error).message });
    }
  }

  await prisma.crmImportJob.update({
    where: { id: jobId },
    data: {
      status: importedRows > 0 ? 'COMPLETED' : 'FAILED',
      importedRows,
      failedRows,
      errorReport: allErrors.length > 0 ? (allErrors as any) : undefined,
      completedAt: new Date(),
    },
  });

  return { importedRows, failedRows, errors: allErrors.slice(0, 50) };
}

export async function getImportStatus(jobId: string, userId: string) {
  const job = await prisma.crmImportJob.findUnique({
    where: { id: jobId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!job) throw new Error('Import job not found');
  if (job.createdBy !== userId) throw new Error('Not authorized');
  return job;
}

export async function getImportHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.crmImportJob.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.crmImportJob.count({ where: { createdBy: userId } }),
  ]);
  return { jobs, total };
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export async function requestExport(
  entity: string,
  filters: Record<string, unknown> | null,
  format: string,
  userId: string
): Promise<{ jobId: string }> {
  const job = await prisma.crmExportJob.create({
    data: {
      entity: entity.toUpperCase(),
      filters: filters as any,
      format: format.toUpperCase() === 'XLSX' ? 'XLSX' : 'CSV',
      status: 'GENERATING',
      createdBy: userId,
    },
  });

  try {
    await generateExportFile(job.id);
  } catch (err) {
    await prisma.crmExportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: (err as Error).message },
    });
  }

  return { jobId: job.id };
}

async function generateExportFile(jobId: string): Promise<void> {
  const job = await prisma.crmExportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Export job not found');

  let data: Record<string, unknown>[];
  const ownerSelect = { select: { id: true, firstName: true, lastName: true, email: true } };

  const whereClause = { deletedAt: null as Date | null };

  switch (job.entity) {
    case 'LEAD':
      data = await prisma.crmLead.findMany({ where: whereClause, include: { owner: ownerSelect } }) as unknown as Record<string, unknown>[];
      break;
    case 'CONTACT':
      data = await prisma.crmContact.findMany({ where: whereClause, include: { account: ownerSelect } }) as unknown as Record<string, unknown>[];
      break;
    case 'ACCOUNT':
      data = await prisma.crmAccount.findMany({ where: whereClause, include: { owner: ownerSelect } }) as unknown as Record<string, unknown>[];
      break;
    case 'OPPORTUNITY':
      data = await prisma.crmOpportunity.findMany({ where: whereClause, include: { owner: ownerSelect, stage: true } }) as unknown as Record<string, unknown>[];
      break;
    default:
      throw new Error(`Unknown entity type: ${job.entity}`);
  }

  const rowCount = data.length;

  const exportDir = path.join(process.cwd(), 'uploads', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const fileName = `${job.entity.toLowerCase()}_export_${Date.now()}.${job.format.toLowerCase()}`;
  const filePath = path.join(exportDir, fileName);

  // Flatten nested objects for export
  const flatData = data.map(row => {
    const flat: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          flat[`${key}_${subKey}`] = subValue;
        }
      } else if (value instanceof Date) {
        flat[key] = value.toISOString();
      } else {
        flat[key] = value;
      }
    }
    return flat;
  });

  if (job.format === 'XLSX') {
    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, job.entity);
    XLSX.writeFile(wb, filePath);
  } else {
    const ws = XLSX.utils.json_to_sheet(flatData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    fs.writeFileSync(filePath, csv);
  }

  await prisma.crmExportJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      fileUrl: `/uploads/exports/${fileName}`,
      rowCount,
    },
  });
}

export async function getExportDownload(jobId: string, userId: string): Promise<{ filePath: string; fileName: string }> {
  const job = await prisma.crmExportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Export job not found');
  if (job.createdBy !== userId) throw new Error('Not authorized');
  if (job.status !== 'COMPLETED') throw new Error('Export is not ready');

  const fileName = job.fileUrl?.split('/').pop() || `export_${jobId}.csv`;
  const filePath = path.join(process.cwd(), job.fileUrl || '');

  return { filePath, fileName };
}

export async function getExportHistory(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.crmExportJob.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.crmExportJob.count({ where: { createdBy: userId } }),
  ]);
  return { jobs, total };
}

export default {
  getFieldDefinitions,
  suggestColumnMapping,
  uploadAndParseFile,
  validateImportMapping,
  executeImport,
  getImportStatus,
  getImportHistory,
  requestExport,
  getExportDownload,
  getExportHistory,
};