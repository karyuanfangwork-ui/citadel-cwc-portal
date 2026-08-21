import type { Branch, CreditUserRef } from '../../../services/credit.service';

interface AssignmentStepProps {
  lane: string | null;
  laneReason?: string | null;
  rm?: CreditUserRef | null;
  analyst?: CreditUserRef | null;
  branch?: Branch | null;
  canOverride: boolean;
  onOverride?: () => void;
}

function staffName(staff?: CreditUserRef | null) {
  if (!staff) return 'Automatically assigned';
  return `${staff.firstName} ${staff.lastName}`.trim() || 'Automatically assigned';
}

export default function AssignmentStep({ lane, laneReason, rm, analyst, branch, canOverride, onOverride }: AssignmentStepProps) {
  return (
    <div className="space-y-4" data-testid="assignment-step">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-low)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Processing lane</p>
        <p className="mt-1 text-lg font-semibold">{lane || 'Resolving automatically…'}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>{laneReason || 'Derived from borrower type and requested amount.'}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-3"><p className="text-xs text-slate-500">Relationship manager</p><p className="mt-1 font-semibold">{staffName(rm)}</p></div>
        <div className="rounded border p-3"><p className="text-xs text-slate-500">Analyst</p><p className="mt-1 font-semibold">{staffName(analyst)}</p></div>
        <div className="rounded border p-3"><p className="text-xs text-slate-500">Branch</p><p className="mt-1 font-semibold">{branch ? `${branch.code} — ${branch.name}` : 'Resolved from assignment'}</p></div>
      </div>
      {canOverride && onOverride && <button type="button" onClick={onOverride} className="rounded border px-3 py-2 text-sm font-semibold">Manage permitted assignment override</button>}
      <p className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>Staff assignment is resolved by the server. Raw user IDs are not application inputs.</p>
    </div>
  );
}
