import { CrmActivityType, LeadSource } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { assertSpreadsheetOrCsvSignature } from '../utils/file-signature';
import { AppError } from '../middleware/error.middleware';

import prisma from '../utils/prisma';

// ============================================================================
// FIELD DEFINITIONS PER ENTITY
// ============================================================================

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean';
  maxLength?: number;
  enumValues?: string[];
  default?: unknown;
}

const ENTITY_FIELDS: Record<string, FieldDef[]> = {
  LEAD: [
    { key: 'title', label: 'Title', required: true, type: 'string', maxLength: 255 },
    { key: 'contactName', label: 'Contact Name', required: true, type: 'string', maxLength: 200 },
    { key: 'contactEmail', label: 'Contact Email', required: false, type: 'string', maxLength: 255 },
    { key: 'contactPhone', label: 'Contact Phone', required: false, type: 'string', maxLength: 50 },
    { key: 'companyName', label: 'Company Name', required: false, type: 'string', maxLength: 255 },
    { key: 'industry', label: 'Industry', required: false, type: 'string', maxLength: 255 },
    { key: 'address', label: 'Address', required: false, type: 'string' },
    { key: 'remark', label: 'Remark', required: false, type: 'string' },
    { key: 'source', label: 'Source', required: false, type: 'enum', enumValues: ['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','WHATSAPP','OTHER'], default: 'OTHER' },
    { key: 'estimatedValue', label: 'Estimated Value', required: false, type: 'number' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
    { key: 'activityType', label: 'Activity Type', required: false, type: 'enum', enumValues: ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] },
    { key: 'activitySubject', label: 'Activity Subject', required: false, type: 'string', maxLength: 255 },
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
    { key: 'name', label: 'Customer Name', required: true, type: 'string' },
    { key: 'accountType', label: 'Account Type', required: false, type: 'enum', enumValues: ['INDIVIDUAL', 'CORPORATE'], default: 'CORPORATE' },
    { key: 'industry', label: 'Industry', required: false, type: 'string' },
    { key: 'companySize', label: 'Company Size', required: false, type: 'string' },
    { key: 'website', label: 'Website', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'string' },
    { key: 'email', label: 'Email', required: false, type: 'string' },
    { key: 'address', label: 'Address', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'state', label: 'State', required: false, type: 'string' },
    { key: 'country', label: 'Country', required: false, type: 'string' },
    { key: 'postalCode', label: 'Postal Code', required: false, type: 'string' },
    { key: 'annualRevenue', label: 'Annual Revenue', required: false, type: 'number' },
    { key: 'registrationNumber', label: 'Registration Number', required: false, type: 'string' },
    { key: 'taxNumber', label: 'Tax Number', required: false, type: 'string' },
    { key: 'bankAccount', label: 'Bank Account', required: false, type: 'string' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
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

// Column display-name mapping per entity for cleaner exports
const EXPORT_COLUMN_ALIASES: Record<string, Record<string, string>> = {
  LEAD: {
    id: 'Lead ID', title: 'Title', status: 'Status', source: 'Source',
    contactName: 'Contact Name', contactEmail: 'Contact Email', contactPhone: 'Contact Phone',
    companyName: 'Company Name', industry: 'Industry', address: 'Address', remark: 'Remark',
    estimatedValue: 'Estimated Value', description: 'Description',
    ownerId: 'Owner ID', createdAt: 'Created At', updatedAt: 'Updated At',
    owner_id: 'Owner ID', owner_firstName: 'Owner First Name', owner_lastName: 'Owner Last Name', owner_email: 'Owner Email',
  },
  CONTACT: {
    id: 'Contact ID', firstName: 'First Name', lastName: 'Last Name',
    email: 'Email', phone: 'Phone', mobile: 'Mobile',
    jobTitle: 'Job Title', department: 'Department', accountId: 'Account ID',
    isPrimary: 'Is Primary', isActive: 'Is Active',
    createdAt: 'Created At', updatedAt: 'Updated At',
    account_id: 'Account ID', account_firstName: 'Account Owner First Name', account_lastName: 'Account Owner Last Name',
  },
  ACCOUNT: {
    id: 'Customer ID', name: 'Customer Name', accountType: 'Account Type',
    industry: 'Industry', companySize: 'Company Size', website: 'Website',
    phone: 'Phone', email: 'Email', address: 'Address',
    city: 'City', state: 'State', country: 'Country', postalCode: 'Postal Code',
    annualRevenue: 'Annual Revenue', registrationNumber: 'Registration Number',
    taxNumber: 'Tax Number', bankAccount: 'Bank Account',
    purchaseCashTrust: 'Purchase Cash Trust', description: 'Description',
    isActive: 'Is Active', ownerId: 'Owner ID',
    createdAt: 'Created At', updatedAt: 'Updated At',
    owner_id: 'Owner ID', owner_firstName: 'Owner First Name', owner_lastName: 'Owner Last Name', owner_email: 'Owner Email',
  },
  OPPORTUNITY: {
    id: 'Opportunity ID', name: 'Opportunity Name', value: 'Deal Value',
    currency: 'Currency', probability: 'Probability (%)',
    expectedCloseDate: 'Expected Close Date', description: 'Description',
    accountId: 'Account ID', ownerId: 'Owner ID',
    pipelineId: 'Pipeline ID', stageId: 'Stage ID',
    createdAt: 'Created At', updatedAt: 'Updated At',
    owner_id: 'Owner ID', owner_firstName: 'Owner First Name', owner_lastName: 'Owner Last Name', owner_email: 'Owner Email',
    stage_name: 'Stage', stage_probability: 'Stage Probability',
  },
};

// Fields to exclude from exports (internal/admin fields)
const EXPORT_EXCLUDE_FIELDS: Record<string, string[]> = {
  LEAD: ['deletedAt', 'lostReason', 'convertedAt', 'convertedToOppId', 'aiScore', 'aiScoreReason', 'aiScoredAt', 'ruleScore'],
  CONTACT: ['deletedAt', 'nricPassport', 'dateOfBirth'],
  ACCOUNT: ['deletedAt', 'parentAccountId'],
  OPPORTUNITY: ['deletedAt', 'lostReason', 'wonAt', 'lostAt', 'aiWinProbability', 'aiWinReason', 'aiScoredAt', 'forecastCategory'],
};

const MAX_ROWS = 10000;

function normalizeIdentityValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function leadDuplicateKey(data: Record<string, unknown>): string | null {
  const email = normalizeIdentityValue(data.contactEmail);
  if (email) return `email:${email}`;

  const phone = normalizePhone(data.contactPhone);
  const company = normalizeIdentityValue(data.companyName);
  if (phone && company) return `phone-company:${phone}:${company}`;

  const title = normalizeIdentityValue(data.title);
  const contactName = normalizeIdentityValue(data.contactName);
  if (title && company && contactName) return `title-company-contact:${title}:${company}:${contactName}`;

  return null;
}

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
        'remarks': 'remark', 'note': 'remark', 'notes': 'remark',
        'closingdate': 'expectedCloseDate', 'closedate': 'expectedCloseDate',
        'industrytype': 'industry', 'companysize': 'companySize', 'employees': 'companySize',
        'accounttype': 'accountType', 'type': 'accountType', 'customertype': 'accountType',
        'postalcode': 'postalCode', 'zipcode': 'postalCode', 'postcode': 'postalCode',
        'regno': 'registrationNumber', 'registrationno': 'registrationNumber', 'regnumber': 'registrationNumber',
        'taxno': 'taxNumber', 'taxid': 'taxNumber',
        'bankacc': 'bankAccount', 'bankaccountno': 'bankAccount',
        'addressline': 'address', 'registeredaddress': 'address', 'street': 'address',
        'leadsource': 'source',
        'activitytype': 'activityType', 'activitysubject': 'activitySubject',
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

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    for (const [header, fieldKey] of Object.entries(columnMapping)) {
      if (!fieldKey) continue;
      const fieldDef = fields.find(f => f.key === fieldKey);
      if (!fieldDef) continue;
      const value = row[header];

      if (fieldDef.required && (!value || String(value).trim() === '')) {
        // rawData excludes the spreadsheet header row.
        errors.push({ row: i + 2, field: fieldDef.label, error: 'Required field is empty' });
      }

      if (value && fieldDef.maxLength && String(value).length > fieldDef.maxLength) {
        errors.push({
          // rawData excludes the spreadsheet header row.
          row: i + 2,
          field: fieldDef.label,
          error: `Value is ${String(value).length} characters; maximum is ${fieldDef.maxLength}`,
        });
      }

      if (value && fieldDef.type === 'number' && isNaN(Number(value))) {
        errors.push({ row: i + 2, field: fieldDef.label, error: `Expected number, got "${value}"` });
      }

      if (value && fieldDef.type === 'enum' && fieldDef.enumValues && !fieldDef.enumValues.includes(String(value).toUpperCase())) {
        errors.push({ row: i + 2, field: fieldDef.label, error: `Invalid value "${value}". Allowed: ${fieldDef.enumValues.join(', ')}` });
      }
    }

    const activityTypeHeader = Object.entries(columnMapping).find(([, fieldKey]) => fieldKey === 'activityType')?.[0];
    const activitySubjectHeader = Object.entries(columnMapping).find(([, fieldKey]) => fieldKey === 'activitySubject')?.[0];
    const mappedActivityType = activityTypeHeader ? row[activityTypeHeader] : undefined;
    const mappedActivitySubject = activitySubjectHeader ? row[activitySubjectHeader] : undefined;
    if ((mappedActivityType || mappedActivitySubject) && (!mappedActivityType || !mappedActivitySubject)) {
      errors.push({ row: i + 2, field: 'Activity Type / Activity Subject', error: 'Both activity fields are required to create an activity log' });
    }
  }

  await prisma.crmImportJob.update({
    where: { id: jobId },
    data: { columnMapping: columnMapping as any, status: 'PREVIEW' },
  });

  // Any validation error must block import.
  return { valid: errors.length === 0, errors: errors.slice(0, 50), warnings };
}

export async function executeImport(jobId: string, userId: string): Promise<{
  importedRows: number;
  duplicateRows: number;
  duplicateDetails: {
    row: number;
    matchedBy: string;
    matchedRow?: number;
    matchSource: 'existing lead' | 'earlier spreadsheet row';
  }[];
  failedRows: number;
  errors: { row: number; error: string }[];
}> {
  const job = await prisma.crmImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Import job not found');
  if (job.createdBy !== userId) throw new Error('Not authorized');
  if (job.status === 'IMPORTING') throw new Error('Import is already in progress');
  if (job.status === 'COMPLETED' || job.status === 'FAILED') throw new Error('Import job has already been processed');

  await prisma.crmImportJob.update({ where: { id: jobId }, data: { status: 'IMPORTING' } });

  const rawData = (job.rawData as Record<string, unknown>[]) || [];
  const columnMapping = (job.columnMapping as Record<string, string>) || {};
  const fields = ENTITY_FIELDS[job.entity as keyof typeof ENTITY_FIELDS] || [];
  let importedRows = 0;
  let duplicateRows = 0;
  const duplicateDetails: {
    row: number;
    matchedBy: string;
    matchedRow?: number;
    matchSource: 'existing lead' | 'earlier spreadsheet row';
  }[] = [];
  let failedRows = 0;
  const allErrors: { row: number; error: string }[] = [];

  const existingLeadKeys = new Map<string, { source: 'existing lead' | 'earlier spreadsheet row'; row?: number }>();
  if (job.entity === 'LEAD') {
    const existingLeads = await prisma.crmLead.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { title: true, contactName: true, contactEmail: true, contactPhone: true, companyName: true },
    });
    for (const lead of existingLeads) {
      const key = leadDuplicateKey(lead);
      if (key) existingLeadKeys.set(key, { source: 'existing lead' });
    }
  }

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

      // Mapping validation is optional in the UI, so enforce database-backed
      // string limits again immediately before persistence. This turns a
      // vague Prisma P2000 error into a row/field-specific import error.
      for (const fieldDef of fields) {
        const value = data[fieldDef.key];
        if (value && fieldDef.maxLength && String(value).length > fieldDef.maxLength) {
          throw new Error(`${fieldDef.label} exceeds the maximum length of ${fieldDef.maxLength} characters`);
        }
      }

      switch (job.entity) {
        case 'LEAD': {
          const duplicateKey = leadDuplicateKey(data);
          if (duplicateKey && existingLeadKeys.has(duplicateKey)) {
            const match = existingLeadKeys.get(duplicateKey)!;
            duplicateRows++;
            const duplicateDetail: {
              row: number;
              matchedBy: string;
              matchedRow?: number;
              matchSource: 'existing lead' | 'earlier spreadsheet row';
            } = {
              // rawData starts after the spreadsheet header row.
              row: i + 2,
              matchedBy: duplicateKey.startsWith('email:')
                ? 'Contact Email'
                : duplicateKey.startsWith('phone-company:')
                  ? 'Contact Phone + Company Name'
                  : 'Title + Company Name + Contact Name',
              matchSource: match.source,
            };
            if (match.source === 'earlier spreadsheet row') {
              duplicateDetail.matchedRow = match.row;
            }
            duplicateDetails.push(duplicateDetail);
            continue;
          }
          const createdLead = await prisma.crmLead.create({
            data: {
              title: String(data.title || 'Imported Lead'),
              contactName: String(data.contactName || 'Unknown'),
              contactEmail: data.contactEmail ? String(data.contactEmail) : null,
              contactPhone: data.contactPhone ? String(data.contactPhone) : null,
              companyName: data.companyName ? String(data.companyName) : null,
              industry: data.industry ? String(data.industry).trim() : null,
              address: data.address ? String(data.address) : null,
              source: (data.source as LeadSource) || LeadSource.OTHER,
              estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined,
              description: data.description ? String(data.description) : null,
              remark: data.remark ? String(data.remark) : null,
              ownerId: userId,
              status: 'NEW',
            },
          });
          if (data.activityType && data.activitySubject) {
            await prisma.crmActivity.create({
              data: {
                activityType: data.activityType as CrmActivityType,
                subject: String(data.activitySubject),
                leadId: createdLead.id,
                userId,
              },
            });
          }
          if (duplicateKey) existingLeadKeys.set(duplicateKey, { source: 'earlier spreadsheet row', row: i + 2 });
          break;
        }
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
              name: String(data.name || 'Imported Customer'),
              accountType: (data.accountType as string) || 'CORPORATE',
              industry: data.industry ? String(data.industry) : null,
              companySize: data.companySize ? String(data.companySize) : null,
              website: data.website ? String(data.website) : null,
              phone: data.phone ? String(data.phone) : null,
              email: data.email ? String(data.email) : undefined,
              address: data.address ? String(data.address) : null,
              city: data.city ? String(data.city) : null,
              state: data.state ? String(data.state) : null,
              country: data.country ? String(data.country) : null,
              postalCode: data.postalCode ? String(data.postalCode) : null,
              annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
              registrationNumber: data.registrationNumber ? String(data.registrationNumber) : null,
              taxNumber: data.taxNumber ? String(data.taxNumber) : null,
              bankAccount: data.bankAccount ? String(data.bankAccount) : null,
              description: data.description ? String(data.description) : null,
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
      status: rawData.length > 0 && failedRows < rawData.length ? 'COMPLETED' : 'FAILED',
      importedRows,
      failedRows,
      errorReport: allErrors.length > 0 ? (allErrors as any) : undefined,
      duplicateReport: duplicateDetails as any,
      completedAt: new Date(),
    },
  });

  return { importedRows, duplicateRows, duplicateDetails, failedRows, errors: allErrors.slice(0, 50) };
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
  userId: string,
  visibleOwnerIds: string[] | null
): Promise<{ jobId: string }> {
  const job = await prisma.crmExportJob.create({
    data: {
      entity: entity.toUpperCase(),
      filters: { ...(filters ?? {}), __visibleOwnerIds: visibleOwnerIds } as any,
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

  const filters = (job.filters as Record<string, unknown> | null) ?? {};
  const visibleOwnerIds = filters.__visibleOwnerIds as string[] | null | undefined;
  const selectedIds = Array.isArray(filters.selectedIds)
    ? filters.selectedIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const ownerScope = visibleOwnerIds === null || visibleOwnerIds === undefined
    ? {}
    : { ownerId: { in: visibleOwnerIds } };
  const selectedScope = selectedIds.length > 0 ? { id: { in: selectedIds } } : {};
  const whereClause = { deletedAt: null as Date | null, ...ownerScope, ...selectedScope };
  const leadWhereClause: Record<string, unknown> = { ...whereClause };
  const requestedOwnerId = typeof filters.ownerId === 'string' ? filters.ownerId : undefined;
  const requestedStatus = typeof filters.status === 'string' ? filters.status : undefined;
  const requestedSource = typeof filters.source === 'string' ? filters.source : undefined;
  const requestedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';
  const requestedFilter = typeof filters.filter === 'string' ? filters.filter : undefined;

  // Match the lead list's filters. The visibility scope remains authoritative;
  // a requested owner can only narrow it, never expand it.
  if (requestedOwnerId) leadWhereClause.ownerId = requestedOwnerId;
  if (requestedStatus) leadWhereClause.status = requestedStatus;
  if (requestedSource) leadWhereClause.source = requestedSource;
  if (requestedSearch) {
    leadWhereClause.OR = [
      { title: { contains: requestedSearch, mode: 'insensitive' } },
      { contactName: { contains: requestedSearch, mode: 'insensitive' } },
      { contactEmail: { contains: requestedSearch, mode: 'insensitive' } },
      { companyName: { contains: requestedSearch, mode: 'insensitive' } },
    ];
  }
  if (requestedFilter === 'stale') {
    leadWhereClause.status = { notIn: ['CONVERTED', 'LOST'] };
    leadWhereClause.activities = { none: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } };
  }
  if (requestedFilter === 'followup') {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    leadWhereClause.followUpDate = { lte: todayEnd };
    leadWhereClause.status = { notIn: ['CONVERTED', 'LOST'] };
  }
  const contactWhereClause = visibleOwnerIds === null || visibleOwnerIds === undefined
    ? { deletedAt: null as Date | null }
    : { deletedAt: null as Date | null, account: { ownerId: { in: visibleOwnerIds } } };

  switch (job.entity) {
    case 'LEAD':
      data = await prisma.crmLead.findMany({ where: leadWhereClause as any, include: { owner: ownerSelect }, take: MAX_ROWS }) as unknown as Record<string, unknown>[];
      break;
    case 'CONTACT':
      data = await prisma.crmContact.findMany({ where: contactWhereClause, include: { account: ownerSelect }, take: MAX_ROWS }) as unknown as Record<string, unknown>[];
      break;
    case 'ACCOUNT':
      data = await prisma.crmAccount.findMany({ where: whereClause, include: { owner: ownerSelect }, take: MAX_ROWS }) as unknown as Record<string, unknown>[];
      break;
    case 'OPPORTUNITY':
      data = await prisma.crmOpportunity.findMany({ where: whereClause, include: { owner: ownerSelect, stage: true }, take: MAX_ROWS }) as unknown as Record<string, unknown>[];
      break;
    default:
      throw new Error(`Unknown entity type: ${job.entity}`);
  }

  const rowCount = data.length;

  const exportDir = path.join(process.cwd(), 'uploads', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const entityLabel = job.entity === 'ACCOUNT' ? 'customers' : job.entity.toLowerCase();
  const fileName = `${entityLabel}_export_${Date.now()}.${job.format.toLowerCase()}`;
  const filePath = path.join(exportDir, fileName);

  const escapeSpreadsheetFormula = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  };

  // Flatten nested objects for export, apply column aliases, and exclude internal fields
  const entityType = job.entity.toUpperCase();
  const aliases = EXPORT_COLUMN_ALIASES[entityType] || {};
  const excludeFields = new Set(EXPORT_EXCLUDE_FIELDS[entityType] || []);

  const flatData = data.map(row => {
    const flat: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      // Skip internal/excluded fields
      if (excludeFields.has(key)) continue;
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          const flatKey = `${key}_${subKey}`;
          if (excludeFields.has(flatKey)) continue;
          const alias = aliases[flatKey] || flatKey;
          flat[alias] = escapeSpreadsheetFormula(subValue);
        }
      } else if (value instanceof Date) {
        const alias = aliases[key] || key;
        flat[alias] = value.toISOString();
      } else {
        const alias = aliases[key] || key;
        flat[alias] = escapeSpreadsheetFormula(value);
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

  await prisma.auditLog.create({
    data: {
      userId: job.createdBy,
      action: 'EXPORT',
      resourceType: `CRM_${job.entity}`,
      resourceId: job.id,
      newValues: { rowCount, format: job.format, scoped: visibleOwnerIds !== null },
    },
  });

  await prisma.crmExportJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      fileUrl: `/uploads/exports/${fileName}`,
      rowCount,
    },
  });
}

export async function getExportDownload(jobId: string, userId: string, isAdmin = false): Promise<{ filePath: string; fileName: string }> {
  const job = await prisma.crmExportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Export job not found', 404);
  if (job.createdBy !== userId && !isAdmin) throw new AppError('Export job not found', 404);
  if (job.status !== 'COMPLETED') throw new AppError('Export is not ready', 409);

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
