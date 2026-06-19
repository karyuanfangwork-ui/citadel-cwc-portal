import React from 'react';

export type ValidationWarning = {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
};

interface Props {
  applicationId: string;
  warnings: ValidationWarning[];
  borrowerType?: string | null;
  readOnly?: boolean;
}

const ValidationOverridePanel: React.FC<Props> = ({ applicationId, warnings, borrowerType, readOnly }) => {
  const blocking = warnings.filter(w => w.severity === 'error');
  const cautions = warnings.filter(w => w.severity === 'warning');
  const infos = warnings.filter(w => w.severity === 'info');

  const primaryMessage = blocking.length > 0
    ? 'Submission is blocked until the highlighted issues are resolved or formally overridden in the audit trail.'
    : cautions.length > 0
      ? 'Review the warnings before submitting. If you proceed with an exception, document the rationale in the audit trail.'
      : 'No financial validation exceptions are currently flagged.';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Blocking issues</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{blocking.length}</p>
          <p className="text-xs text-red-600 mt-1">Must be resolved before review</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Warnings</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{cautions.length}</p>
          <p className="text-xs text-amber-600 mt-1">Review / exception candidate</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Application</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{applicationId.slice(0, 8)}…</p>
          <p className="text-xs text-slate-500 mt-1">{borrowerType || 'Borrower type not set'}</p>
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${blocking.length > 0 ? 'border-red-200 bg-red-50' : cautions.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">gavel</span>
              Maker-checker / Exception Controls
            </h4>
            <p className="text-sm text-gray-600 mt-1">{primaryMessage}</p>
          </div>
          {!readOnly && (
            <a
              href="?tab=timeline-audit"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Open Audit Tab
            </a>
          )}
        </div>

        {(blocking.length > 0 || cautions.length > 0 || infos.length > 0) && (
          <div className="mt-4 space-y-2">
            {blocking.map((w) => (
              <div key={`${w.field}-${w.message}`} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
                <span className="font-semibold uppercase text-[10px] tracking-wider mr-2">Blocker</span>
                {w.message}
              </div>
            ))}
            {cautions.map((w) => (
              <div key={`${w.field}-${w.message}`} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700">
                <span className="font-semibold uppercase text-[10px] tracking-wider mr-2">Warning</span>
                {w.message}
              </div>
            ))}
            {infos.map((w) => (
              <div key={`${w.field}-${w.message}`} className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700">
                <span className="font-semibold uppercase text-[10px] tracking-wider mr-2">Info</span>
                {w.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
        Record the exception rationale as an internal comment in the Timeline &amp; Audit area so the maker-checker trail
        remains visible alongside the financial profile. This panel is summary-only and does not persist overrides by itself.
      </div>
    </div>
  );
};

export default ValidationOverridePanel;
