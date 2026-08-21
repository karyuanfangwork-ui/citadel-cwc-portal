import type { FacilityType } from '../../../services/credit.service';

export interface FacilityDraft {
  facilityType: FacilityType;
  amount: string;
  tenorMonths: string;
  purpose: string;
}

interface FacilityStepProps {
  required: boolean;
  requestedAmount: string;
  requestedTenor: string;
  value: FacilityDraft;
  onChange: (value: FacilityDraft) => void;
}

export default function FacilityStep({ required, requestedAmount, requestedTenor, value, onChange }: FacilityStepProps) {
  return (
    <div className="space-y-4" data-testid="facility-step">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-low)' }}>
        <p className="text-sm font-semibold">{required ? 'Facility required for this lane' : 'No separate facility required'}</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>
          {required ? 'The initial facility total should match the requested amount before submission.' : 'Personal Fast uses the loan request directly. You may continue without adding a facility.'}
        </p>
      </div>
      {required && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Facility type
            <select value={value.facilityType} onChange={(e) => onChange({ ...value, facilityType: e.target.value as FacilityType })} className="mt-1 w-full rounded border px-3 py-2 font-normal">
              <option value="TERM_LOAN">Term loan</option>
              <option value="REVOLVING">Revolving</option>
              <option value="OVERDRAFT">Overdraft</option>
              <option value="BRIDGING">Bridging</option>
              <option value="LC">Letter of credit</option>
              <option value="BG">Bank guarantee</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Facility amount
            <input aria-label="Facility amount" type="number" min="0" value={value.amount || requestedAmount} onChange={(e) => onChange({ ...value, amount: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold">Facility tenor (months)
            <input aria-label="Facility tenor" type="number" min="1" value={value.tenorMonths || requestedTenor} onChange={(e) => onChange({ ...value, tenorMonths: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold">Facility purpose
            <input aria-label="Facility purpose" value={value.purpose} onChange={(e) => onChange({ ...value, purpose: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 font-normal" placeholder="Optional at draft creation" />
          </label>
        </div>
      )}
    </div>
  );
}
