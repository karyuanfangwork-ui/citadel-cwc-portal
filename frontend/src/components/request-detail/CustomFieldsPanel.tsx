import React, { useState, useEffect } from 'react';
import { entityService } from '../../services/entity.service';

const API_BASE = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

interface CustomFieldsPanelProps {
  customFields: Record<string, any> | undefined;
  serviceDeskCode: string;
  formConfig?: any[];
}

const HR_FIELD_LABELS: Record<string, string> = {
  jobTitle: 'Job Title',
  department: 'Department',
  salary: 'Salary Range',
  salaryRange: 'Salary Range',
  justification: 'Justification',
  employmentType: 'Employment Type',
  reportingTo: 'Reporting To',
  startDate: 'Desired Start Date',
  headcount: 'Headcount',
  location: 'Location',
  jobDescription: 'Job Description',
  requirements: 'Requirements',
  budget: 'Budget',
  position_title: 'Position Title',
  selectedCandidateName: 'Candidate Name',
  jobPostedAt: 'Job Posted At',
  jobPostingUrl: 'Job Posting URL',
  jobPostingNotes: 'Job Posting Notes',
  employeeName: 'Employee Name',
  employeeEmail: 'Employee Email',
  lastDay: 'Last Working Day',
  reason: 'Reason for Departure',
};

const IT_FIELD_LABELS: Record<string, string> = {
  hardwareName: 'Hardware Name',
  hardwareModel: 'Model / Specifications',
  estimatedPrice: 'Estimated Price (USD)',
  preferredVendor: 'Preferred Vendor',
  productUrl: 'Product URL',
  businessJustification: 'Business Justification',
  businessUnit: 'Business Unit',
  serialNumber: 'Serial Number',
  assetTag: 'Asset Tag',
  payment: 'Payment',
  // legacy keys — keep for backward compat until backfill runs
  hardwareType: 'Hardware Type',
  model: 'Model',
  specifications: 'Specifications',
  reason: 'Reason',
  urgency: 'Urgency',
  currentDevice: 'Current Device',
  hw_name: 'Hardware Name',
  hw_model: 'Preferred Model',
  hw_reason: 'Business Justification',
  // old opaque field IDs (pre-migration) — resolve so legacy tickets aren't confusing
  field_1777345359663: 'Request for (Name)',
  field_1777345313368: 'Business Unit',
  field_1777345397494: 'Device Type',
  field_1777345423736: 'Attachment',
};

const FINANCE_FIELD_LABELS: Record<string, string> = {
  expenseType: 'Expense Type',
  amount: 'Amount',
  currency: 'Currency',
  receiptDate: 'Receipt Date',
  vendor: 'Vendor',
  costCenter: 'Cost Center',
  projectCode: 'Project Code',
  finalizedAmount: 'Finalized Amount (MYR)',
  paymentReference: 'Payment Reference',
};

function getFieldLabels(code: string): Record<string, string> {
  if (code === 'HR') return HR_FIELD_LABELS;
  if (code === 'IT') return IT_FIELD_LABELS;
  if (code === 'FINANCE') return FINANCE_FIELD_LABELS;
  return {};
}

function formatPayment(value: Record<string, any>): React.ReactNode {
  const rows: { label: string; val: string }[] = [];
  if (value.amount !== undefined) rows.push({ label: 'Amount', val: `MYR ${value.amount}` });
  if (value.paymentReference) rows.push({ label: 'Reference', val: value.paymentReference });
  if (value.paymentDate) rows.push({ label: 'Payment Date', val: value.paymentDate });
  if (value.completedAt) rows.push({ label: 'Completed At', val: new Date(value.completedAt).toLocaleString() });
  if (rows.length === 0) return JSON.stringify(value);
  return (
    <span className="flex flex-col gap-0.5">
      {rows.map(r => (
        <span key={r.label}><span className="text-[#44546f] font-medium">{r.label}:</span> {r.val}</span>
      ))}
    </span>
  );
}

// Keys whose values are ISO date strings that should be formatted
const DATE_KEYS = new Set([
  'jobPostedAt', 'startedAt', 'completedAt', 'createdAt', 'updatedAt',
  'receiptDate', 'approvalDate', 'acceptedDate', 'lastDay',
]);

function formatValue(key: string, value: any, fieldType?: string, entityMap?: Record<string, string>): React.ReactNode {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if (key === 'payment') return formatPayment(value);
    if (value.s3Key && value.fileName) {
      const href = `${API_BASE}/files/download/${encodeURIComponent(value.s3Key)}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[#0052cc] hover:underline font-medium"
        >
          <span className="material-symbols-outlined text-base">download</span>
          {value.fileName}
        </a>
      );
    }
    return JSON.stringify(value);
  }
  // Detect and format ISO date strings or plain date strings (YYYY-MM-DD)
  if (typeof value === 'string' && DATE_KEYS.has(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = value.includes('T') ? new Date(value) : new Date(value + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  // Format currency fields with MYR prefix
  if (fieldType === 'currency') {
    const num = Number(value);
    if (!isNaN(num)) return `MYR ${num.toLocaleString()}`;
  }
  // Entity code display — resolve code to human-readable name
  if (fieldType === 'entity' && entityMap && entityMap[String(value)]) {
    return `${entityMap[String(value)]} (${value})`;
  }
  return String(value);
}

const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({ customFields, serviceDeskCode, formConfig }) => {
  if (!customFields || Object.keys(customFields).length === 0) return null;

  const [entityNameMap, setEntityNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    entityService.listActiveEntities()
      .then(entities => {
        const map: Record<string, string> = {};
        for (const e of entities) map[e.code] = e.name;
        setEntityNameMap(map);
      })
      .catch(() => {});
  }, []);

  const labels = getFieldLabels(serviceDeskCode);
  const HIDDEN_KEYS = new Set(['selectedCandidateId', 'selectedCandidateIds', 'selectedCandidateNames']);
  const entries = Object.entries(customFields).filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== '');

  if (entries.length === 0) return null;

  const getLabel = (key: string) => {
    // 1. Check hardcoded map (standard fields)
    if (labels[key]) return labels[key];

    // 2. Check dynamic form config
    if (formConfig) {
      const field = formConfig.find(f => f.id === key);
      if (field?.label) return field.label;
    }

    // 3. Fallback to formatted key
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  };

  const getFieldType = (key: string): string | undefined => {
    if (formConfig) {
      const field = formConfig.find(f => f.id === key);
      if (field?.type) return field.type;
    }
    return undefined;
  };

  return (
    <section>
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
        <span className="material-symbols-outlined text-[#0052cc]">description</span>
        <h3 className="font-bold text-xl">Request Details</h3>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <dl className="divide-y divide-gray-100">
          {entries.map(([key, value]) => (
            <div key={key} className="flex px-6 py-3.5">
              <dt className="w-44 shrink-0 text-sm font-semibold text-[#44546f]">
                {getLabel(key)}
              </dt>
              <dd className="text-sm text-[#101418] flex-1">{formatValue(key, value, getFieldType(key), entityNameMap)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default CustomFieldsPanel;

