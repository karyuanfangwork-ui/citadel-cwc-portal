import React from 'react';
import { KpiCell, OutlinedCard } from './primitives';

const LABELS: Record<string, string> = {
  NRIC_PASSPORT: 'NRIC or passport',
  PAYSLIP: 'Payslip',
  BANK_STATEMENT: 'Bank statement',
  SSM_CERT: 'SSM certificate',
  TAX_RETURN: 'Tax return',
  AUDITED_FINANCIALS: 'Audited financial statements',
  MOA_AOA: 'Memorandum / articles of association',
  MEMORANDUM_ARTICLES: 'Memorandum / articles of association',
  BOARD_RESOLUTION: 'Board resolution',
  AUTHORIZED_SIGNATORY: 'Authorized signatory',
  JV_AGREEMENT: 'Joint venture agreement',
};

type Checklist = {
  requiredCount: number;
  collectedCount: number;
  outstandingCount: number;
  completionPct: number;
  outstandingGroups: Array<string | string[]>;
};

function label(group: string | string[]): string {
  if (Array.isArray(group)) return group.map((item) => LABELS[item] ?? item.replace(/_/g, ' ')).join(' or ');
  return LABELS[group] ?? group.replace(/_/g, ' ');
}

const DocumentChecklistSummary: React.FC<{ checklist?: Checklist }> = ({ checklist }) => {
  if (!checklist) return null;
  const minimumRequired = Math.min(checklist.requiredCount, Math.ceil(checklist.requiredCount * 0.8));
  return (
    <OutlinedCard title="Required document checklist">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCell label="Required" value={checklist.requiredCount} sub="groups" />
        <KpiCell label="Ready" value={checklist.collectedCount} sub="groups" tone={checklist.collectedCount >= minimumRequired ? 'pos' : 'warn'} />
        <KpiCell label="Remaining" value={checklist.outstandingCount} sub="groups" tone={checklist.outstandingCount === 0 ? 'pos' : 'warn'} />
        <KpiCell label="Completion" value={`${checklist.completionPct}%`} />
      </div>
      <p className="mt-3 text-xs text-fc-on-variant">
        Minimum to continue: <strong className="text-fc-primary">{minimumRequired} of {checklist.requiredCount}</strong> required document groups.
      </p>
      {checklist.outstandingGroups.length > 0 ? (
        <div className="mt-3 rounded-fc border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-900">Still needed</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
            {checklist.outstandingGroups.map((group) => <li key={Array.isArray(group) ? group.join('|') : group}>{label(group)}</li>)}
          </ul>
        </div>
      ) : <p className="mt-3 text-xs font-semibold text-fc-pos">All required document groups are ready.</p>}
    </OutlinedCard>
  );
};

export default DocumentChecklistSummary;
