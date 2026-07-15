import React, { useState, useEffect, useCallback } from 'react';
import { entityService } from '../../services/entity.service';
import { requestService } from '../../services/request.service';
import { useToast } from '../../context/ToastContext';
import { parseFormConfig } from '../../utils/formConfig';

const API_BASE = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

interface CustomFieldsPanelProps {
  customFields: Record<string, any> | undefined;
  serviceDeskCode: string;
  formConfig?: any;
  requestId?: string;
  canEdit?: boolean;
  onFieldSaved?: (updatedCustomFields: Record<string, any>) => void;
}

// Fields that finance agents can edit inline
const FINANCE_EDITABLE_FIELDS = new Set([
  'estimatedCost',
  'itemName',
  'quantity',
  'vendor',
  'justification',
  'finalizedAmount',
  'paymentReference',
  'costCenter',
  'projectCode',
]);

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
  itemName: 'Item / Service Name',
  quantity: 'Quantity',
  estimatedCost: 'Estimated Cost (RM)',
  justification: 'Business Justification',
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

function formatFileLink(value: { s3Key: string; fileName: string; mimeType?: string; fileSize?: number }, showPreview = false): React.ReactNode {
  const href = `${API_BASE}/files/download/${encodeURIComponent(value.s3Key)}`;
  const inlineHref = `${API_BASE}/files/download/${encodeURIComponent(value.s3Key)}?inline=true`;
  const sizeStr = value.fileSize
    ? value.fileSize > 1024 * 1024
      ? ` (${(value.fileSize / (1024 * 1024)).toFixed(1)} MB)`
      : ` (${(value.fileSize / 1024).toFixed(0)} KB)`
    : '';
  const isImage = value.mimeType?.startsWith('image/');
  const isPdf = value.mimeType === 'application/pdf';

  return (
    <div className="space-y-1">
      {showPreview && isImage && (
        <a href={href} target="_blank" rel="noopener noreferrer">
          <img
            src={inlineHref}
            alt={value.fileName}
            className="max-h-32 rounded border border-gray-200 object-contain hover:border-brand-300 transition-colors"
          />
        </a>
      )}
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base text-[#0052cc]">
          {isPdf ? 'picture_as_pdf' : isImage ? 'image' : 'download'}
        </span>
        {isPdf ? (
          <button
            type="button"
            onClick={() => window.open(inlineHref, '_blank')}
            className="inline-flex items-center gap-1 text-[#0052cc] hover:underline font-medium"
            title="Click to preview PDF"
          >
            {value.fileName}{sizeStr}
          </button>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0052cc] hover:underline font-medium"
          >
            {value.fileName}{sizeStr}
          </a>
        )}
      </div>
    </div>
  );
}

function formatFileList(values: { s3Key: string; fileName: string; mimeType?: string; fileSize?: number }[]): React.ReactNode {
  if (values.length === 0) return '\u2014';
  if (values.length === 1) return formatFileLink(values[0], true);
  return (
    <div className="space-y-2">
      {values.map((f, i) => (
        <div key={f.s3Key || i}>
          {formatFileLink(f, true)}
        </div>
      ))}
    </div>
  );
}

function formatCandidateDocuments(value: Record<string, Record<string, any>>): React.ReactNode {
  const entries = Object.entries(value);
  if (entries.length === 0) return '\u2014';
  return (
    <div className="space-y-2">
      {entries.map(([candidateKey, docs]) => {
        const docEntries = Object.entries(docs);
        if (docEntries.length === 0) return null;
        const candidateLabel = candidateKey.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase());
        return (
          <div key={candidateKey}>
            <span className="text-xs font-semibold text-[#44546f] uppercase tracking-wide">{candidateLabel}</span>
            <div className="ml-3 mt-0.5 space-y-1">
              {docEntries.map(([docType, docValue]) => {
                if (docValue && typeof docValue === 'object' && docValue.s3Key && docValue.fileName) {
                  return (
                    <div key={docType} className="flex items-center gap-1.5 text-sm">
                      <span className="text-[#44546f]">{docType}:</span>
                      {formatFileLink(docValue as { s3Key: string; fileName: string; mimeType?: string; fileSize?: number })}
                    </div>
                  );
                }
                return (
                  <div key={docType} className="text-sm">
                    <span className="text-[#44546f]">{docType}:</span> {String(docValue)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(key: string, value: any, fieldType?: string, entityMap?: Record<string, string>): React.ReactNode {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // File array: multiple files in a single field
  if (Array.isArray(value)) {
    // Check if it's an array of file objects
    if (value.length > 0 && value[0]?.s3Key && value[0]?.fileName) {
      return formatFileList(value as { s3Key: string; fileName: string; mimeType?: string; fileSize?: number }[]);
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    if (key === 'payment') return formatPayment(value);
    // Nested candidate documents structure
    if (typeof value === 'object' && !value.s3Key && !value.fileName && !value.mimeType) {
      // Heuristic: if all values are objects (candidate documents pattern), render as structured docs
      const vals = Object.values(value);
      if (vals.length > 0 && vals.every(v => typeof v === 'object' && v !== null)) {
        return formatCandidateDocuments(value as Record<string, Record<string, any>>);
      }
    }
    if (value.s3Key && value.fileName) {
      return formatFileLink(value as { s3Key: string; fileName: string; mimeType?: string; fileSize?: number }, true);
    }
    return JSON.stringify(value);
  }
  // If fieldType is 'file' but the value is a plain string (legacy data), display it as-is
  if (fieldType === 'file') return String(value);
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
  // Format RM currency for known RM fields
  if (key === 'estimatedCost') {
    const num = Number(value);
    if (!isNaN(num)) return `RM${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Entity code display — resolve code to human-readable name
  if (fieldType === 'entity' && entityMap && entityMap[String(value)]) {
    return `${entityMap[String(value)]} (${value})`;
  }
  return String(value);
}

const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({
  customFields,
  serviceDeskCode,
  formConfig,
  requestId,
  canEdit = false,
  onFieldSaved,
}) => {
  if (!customFields || Object.keys(customFields).length === 0) return null;

  const [entityNameMap, setEntityNameMap] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
    const parsedConfig = parseFormConfig(formConfig);
    if (parsedConfig.length > 0) {
      const field = parsedConfig.find(f => f.id === key);
      if (field?.label) return field.label;
    }

    // 3. Fallback to formatted key
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  };

  const getFieldType = (key: string): string | undefined => {
    const parsedConfig = parseFormConfig(formConfig);
    if (parsedConfig.length > 0) {
      const field = parsedConfig.find(f => f.id === key);
      if (field?.type) return field.type;
    }
    return undefined;
  };

  const isFieldEditable = (key: string): boolean => {
    if (!canEdit || !requestId) return false;
    if (serviceDeskCode === 'FINANCE') return FINANCE_EDITABLE_FIELDS.has(key);
    return false;
  };

  const startEdit = (key: string) => {
    const val = customFields[key];
    // For objects (files etc) don't allow inline edit
    if (typeof val === 'object' && val !== null) return;
    // For file-type fields, don't allow inline edit (even if value is a plain string)
    if (getFieldType(key) === 'file') return;
    setEditingKey(key);
    setEditValue(String(val ?? ''));
  };

  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValue('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!requestId || !editingKey) return;
    setSaving(true);
    try {
      const updated = await requestService.updateRequest(requestId, {
        customFields: { [editingKey]: editValue },
      });
      toast.success('Field Updated', `${getLabel(editingKey)} has been updated.`);
      if (onFieldSaved && updated.customFields) {
        onFieldSaved(updated.customFields as Record<string, any>);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update field';
      toast.error('Update Failed', msg);
    } finally {
      setSaving(false);
      setEditingKey(null);
      setEditValue('');
    }
  }, [requestId, editingKey, editValue, onFieldSaved, toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  }, [saveEdit, cancelEdit]);

  return (
    <section>
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
        <span className="material-symbols-outlined text-[#0052cc]">description</span>
        <h3 className="font-bold text-xl">Request Details</h3>
        {canEdit && serviceDeskCode === 'FINANCE' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-full">
            <span className="material-symbols-outlined text-xs">edit</span>
            Editable
          </span>
        )}
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <dl className="divide-y divide-gray-100">
          {entries.map(([key, value]) => {
            const editable = isFieldEditable(key);
            const isEditing = editingKey === key;

            return (
              <div key={key} className="flex px-6 py-3.5 group">
                <dt className="w-44 shrink-0 text-sm font-semibold text-[#44546f]">
                  {getLabel(key)}
                </dt>
                <dd className="text-sm text-[#101418] flex-1 flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={saving}
                        autoFocus
                        className="flex-1 px-3 py-1.5 border border-brand-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-700 outline-none transition-all"
                      />
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-2.5 py-1.5 text-xs font-bold bg-brand-700 text-white rounded-md hover:bg-brand-800 disabled:opacity-50 transition-colors"
                      >
                        {saving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{formatValue(key, value, getFieldType(key), entityNameMap)}</span>
                      {editable && (
                        <button
                          onClick={() => startEdit(key)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-[#44546f] hover:text-[#0052cc]"
                          title={`Edit ${getLabel(key)}`}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                      )}
                    </>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
};

export default CustomFieldsPanel;