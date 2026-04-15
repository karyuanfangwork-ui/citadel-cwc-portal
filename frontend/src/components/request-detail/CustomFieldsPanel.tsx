import React from 'react';

interface CustomFieldsPanelProps {
  customFields: Record<string, any> | undefined;
  serviceDeskCode: string;
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
};

const IT_FIELD_LABELS: Record<string, string> = {
  hardwareName: 'Hardware Name',
  hardwareModel: 'Preferred Model',
  estimatedPrice: 'Estimated Price (USD)',
  preferredVendor: 'Preferred Vendor',
  productUrl: 'Product URL',
  businessJustification: 'Business Justification',
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
};

const FINANCE_FIELD_LABELS: Record<string, string> = {
  expenseType: 'Expense Type',
  amount: 'Amount',
  currency: 'Currency',
  receiptDate: 'Receipt Date',
  vendor: 'Vendor',
  costCenter: 'Cost Center',
  projectCode: 'Project Code',
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

function formatValue(key: string, value: any): React.ReactNode {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if (key === 'payment') return formatPayment(value);
    return JSON.stringify(value);
  }
  return String(value);
}

const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({ customFields, serviceDeskCode }) => {
  if (!customFields || Object.keys(customFields).length === 0) return null;

  const labels = getFieldLabels(serviceDeskCode);
  const entries = Object.entries(customFields).filter(([_, v]) => v !== null && v !== undefined && v !== '');

  if (entries.length === 0) return null;

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
                {labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </dt>
              <dd className="text-sm text-[#101418] flex-1">{formatValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default CustomFieldsPanel;
