import { Link } from 'react-router-dom';

interface RightSummaryPanelProps {
  applicantName: string;
  applicantTypeLabel: string;
  productLabel: string;
  amountLabel: string;
  tenorLabel: string;
  branchLabel: string;
  documentCompletion: number;
  applicantSelected: boolean;
  productSelected: boolean;
  purposeCaptured: boolean;
  requiredDocsComplete: boolean;
  riskNote: string;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-3 text-sm">
      <span style={{ color: 'var(--cr-on-surface-variant)' }}>{label}</span>
      <span className="text-right font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{value}</span>
    </div>
  );
}

function QuickCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]" style={{ color: ok ? 'var(--cr-secondary)' : 'var(--cr-on-surface-variant)' }}>{ok ? 'check_circle' : 'radio_button_unchecked'}</span>
      <span>{label}</span>
    </div>
  );
}

export default function RightSummaryPanel({
  applicantName,
  applicantTypeLabel,
  productLabel,
  amountLabel,
  tenorLabel,
  branchLabel,
  documentCompletion,
  applicantSelected,
  productSelected,
  purposeCaptured,
  requiredDocsComplete,
  riskNote,
}: RightSummaryPanelProps) {
  return (
    <aside className="xl:sticky xl:top-6">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Summary</p>

        <SummaryRow label="Applicant" value={applicantName} />
        <SummaryRow label="Type" value={applicantTypeLabel} />
        <SummaryRow label="Product" value={productLabel} />
        <SummaryRow label="Amount" value={amountLabel} />
        <SummaryRow label="Tenor" value={tenorLabel} />
        <SummaryRow label="Documents" value={`${documentCompletion}% complete`} />
        <SummaryRow label="Branch" value={branchLabel} />

        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-low)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Quick checks</p>
          <div className="mt-2 space-y-2 text-sm" style={{ color: 'var(--cr-on-surface)' }}>
            <QuickCheck ok={applicantSelected} label="Applicant selected" />
            <QuickCheck ok={productSelected} label="Product chosen" />
            <QuickCheck ok={Boolean(amountLabel && amountLabel !== '—')} label="Requested amount captured" />
            <QuickCheck ok={true} label="Draft can be created before later-stage requirements" />
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-secondary-fixed)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-secondary-fixed)' }}>Risk notes</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--cr-on-secondary-fixed)' }}>{riskNote}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <Link to="/credit/applications" className="flex-1 rounded border px-3 py-2 text-center text-sm font-semibold" style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface)', textDecoration: 'none' }}>
            Back to List
          </Link>
        </div>
      </div>
    </aside>
  );
}
