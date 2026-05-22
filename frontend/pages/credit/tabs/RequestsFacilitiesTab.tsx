import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditFacility,
  RequestItem,
  ExposureSummary,
  CaRequestType,
  FacilityType,
} from '../../../src/services/credit.service';
import apiClient from '../../../src/services/api';
import { getFacilityTypes } from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_FACILITY_TYPE_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan',
  REVOLVING: 'Revolving Credit',
  REVOLVING_CREDIT: 'Revolving Credit',
  OVERDRAFT: 'Overdraft',
  LC: 'Letter of Credit',
  LETTER_OF_CREDIT: 'Letter of Credit',
  BG: 'Bank Guarantee',
  BANK_GUARANTEE: 'Bank Guarantee',
  TRUST_RECEIPT: 'Trust Receipt',
  BRIDGING: 'Bridging Loan',
  BRIDGE_LOAN: 'Bridging Loan',
};

const ISLAMIC_FACILITY_TYPE_LABELS: Record<string, string> = {
  CASHLINE: 'Cashline (Islamic)',
  RWC_I: 'Revolving Credit (Islamic)',
  LC_I: 'Letter of Credit (Islamic)',
  BG_I: 'Bank Guarantee (Islamic)',
  ICMTD_I: 'Istisna Credit (Islamic)',
};

const CA_REQUEST_TYPE_LABELS: Record<CaRequestType, string> = {
  FACILITY_RENEWAL: 'Facility Renewal',
  VARIATION: 'Variation',
  POLICY_BREACH_RATIFICATION: 'Policy Breach Ratification',
  SICR_IMPAIRMENT: 'SICR / Impairment',
};

const CA_REQUEST_TYPE_OPTIONS: CaRequestType[] = [
  'FACILITY_RENEWAL', 'VARIATION', 'POLICY_BREACH_RATIFICATION', 'SICR_IMPAIRMENT',
];

const EXPOSURE_BUCKETS: { key: keyof ExposureSummary; label: string }[] = [
  { key: 'thisAppSecured',              label: 'This App — Secured' },
  { key: 'thisAppUnsecured',            label: 'This App — Unsecured' },
  { key: 'otherAppSecured',             label: 'Other App — Secured' },
  { key: 'otherAppUnsecured',           label: 'Other App — Unsecured' },
  { key: 'customerTotalSecured',        label: 'Customer Total — Secured' },
  { key: 'customerTotalUnsecured',      label: 'Customer Total — Unsecured' },
  { key: 'relatedCounterpartySecured',  label: 'Related Counterparty — Secured' },
  { key: 'relatedCounterpartyUnsecured',label: 'Related Counterparty — Unsecured' },
  { key: 'groupTotalSecured',           label: 'Group Total — Secured' },
  { key: 'groupTotalUnsecured',         label: 'Group Total — Unsecured' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | string | null | undefined) =>
  v != null && v !== '' ? Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  application: CreditApplication;
  onDirtyChange?: (dirty: boolean) => void;
};

// ─── Facility row editor ──────────────────────────────────────────────────────

type FacilityRowProps = {
  facility: CreditFacility;
  readOnly: boolean;
  facilityTypeOptions: { value: FacilityType; label: string }[];
  facilityTypeLabels: Record<string, string>;
  onSave: (id: string, patch: Partial<CreditFacility>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const FacilityRow: React.FC<FacilityRowProps> = ({ facility, readOnly, facilityTypeOptions, facilityTypeLabels, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CreditFacility>>(facility);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.facilityType) errs.facilityType = 'Facility type is required';
    if (form.amount != null && Number(form.amount) <= 0) errs.amount = 'Amount must be greater than 0';
    if (form.tenorMonths != null && String(form.tenorMonths) !== '' && Number(form.tenorMonths) <= 0) errs.tenorMonths = 'Tenor must be positive';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave(facility.id, form);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="p-2">
          <select
            className={`border rounded px-2 py-1 text-sm w-full ${errors.facilityType ? 'border-red-400' : ''}`}
            value={form.facilityType ?? ''}
            onChange={e => { setForm(f => ({ ...f, facilityType: e.target.value as FacilityType })); setErrors(errs => { const { facilityType, ...rest } = errs; return rest; }); }}
          >
            {facilityTypeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{facilityTypeLabels[opt.value] ?? opt.label}</option>
            ))}
          </select>
          {errors.facilityType && <p className="text-[10px] text-red-600 mt-0.5">{errors.facilityType}</p>}
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-24" value={form.pricingLabel ?? ''} onChange={e => setForm(f => ({ ...f, pricingLabel: e.target.value }))} placeholder="e.g. BFR+1%" />
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.existingLimit ?? ''} onChange={e => setForm(f => ({ ...f, existingLimit: e.target.value }))} placeholder="0.00" />
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.proposedChange ?? ''} onChange={e => setForm(f => ({ ...f, proposedChange: e.target.value }))} placeholder="0.00" />
        </td>
        <td className="p-2">
          <input className={`border rounded px-2 py-1 text-sm w-28 ${errors.amount ? 'border-red-400' : ''}`} type="number" value={form.newLimit ?? ''} onChange={e => { setForm(f => ({ ...f, newLimit: e.target.value })); setErrors(errs => { const { amount, ...rest } = errs; return rest; }); }} placeholder="0.00" />
          {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.outstandingBalance ?? ''} onChange={e => setForm(f => ({ ...f, outstandingBalance: e.target.value }))} placeholder="0.00" />
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.undisbursedLimit ?? ''} onChange={e => setForm(f => ({ ...f, undisbursedLimit: e.target.value }))} placeholder="0.00" />
        </td>
        <td className="p-2">
          <input className="border rounded px-2 py-1 text-sm w-28" value={form.approvingLevel ?? ''} onChange={e => setForm(f => ({ ...f, approvingLevel: e.target.value }))} placeholder="e.g. CC" />
        </td>
        <td className="p-2 space-x-1">
          <button onClick={handleSave} disabled={saving} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-2 py-1 border rounded">Cancel</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="p-2 text-sm">{facilityTypeLabels[facility.facilityType] ?? facility.facilityType}</td>
      <td className="p-2 text-sm text-gray-500">{facility.pricingLabel ?? '—'}</td>
      <td className="p-2 text-sm text-right">{fmt(facility.existingLimit)}</td>
      <td className="p-2 text-sm text-right">{fmt(facility.proposedChange)}</td>
      <td className="p-2 text-sm text-right font-medium">{fmt(facility.newLimit ?? facility.amount)}</td>
      <td className="p-2 text-sm text-right">{fmt(facility.outstandingBalance)}</td>
      <td className="p-2 text-sm text-right">{fmt(facility.undisbursedLimit)}</td>
      <td className="p-2 text-sm">{facility.approvingLevel ?? '—'}</td>
      <td className="p-2 space-x-1">
        {!readOnly && (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
            <button onClick={() => onDelete(facility.id)} className="text-xs text-red-500 hover:underline">Del</button>
          </>
        )}
      </td>
    </tr>
  );
};

// ─── Add facility form ────────────────────────────────────────────────────────

type AddFacilityFormProps = {
  applicationId: string;
  facilityTypeOptions: { value: FacilityType; label: string }[];
  facilityTypeLabels: Record<string, string>;
  onAdded: (f: CreditFacility) => void;
  onCancel: () => void;
};

const AddFacilityForm: React.FC<AddFacilityFormProps> = ({ applicationId, facilityTypeOptions, facilityTypeLabels, onAdded, onCancel }) => {
  const [form, setForm] = useState<Partial<CreditFacility>>({ facilityType: 'TERM_LOAN', amount: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAdd = async () => {
    const errs: Record<string, string> = {};
    if (!form.facilityType) errs.facilityType = 'Facility type is required';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Amount must be greater than 0';
    if (form.tenorMonths != null && String(form.tenorMonths) !== '' && Number(form.tenorMonths) <= 0) errs.tenorMonths = 'Tenor must be positive';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const created = await creditService.createFacility(applicationId, form);
      onAdded(created);
    } catch {
      setErrors({ general: 'Failed to add facility' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-green-50">
      <td className="p-2">
        <select
          className={`border rounded px-2 py-1 text-sm w-full ${errors.facilityType ? 'border-red-400' : ''}`}
          value={form.facilityType ?? 'TERM_LOAN'}
          onChange={e => { setForm(f => ({ ...f, facilityType: e.target.value as FacilityType })); setErrors(errs => { const { facilityType, ...rest } = errs; return rest; }); }}
        >
          {facilityTypeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{facilityTypeLabels[opt.value] ?? opt.label}</option>
          ))}
        </select>
        {errors.facilityType && <p className="text-[10px] text-red-600 mt-0.5">{errors.facilityType}</p>}
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-24" value={form.pricingLabel ?? ''} onChange={e => setForm(f => ({ ...f, pricingLabel: e.target.value }))} placeholder="Pricing" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.existingLimit ?? ''} onChange={e => setForm(f => ({ ...f, existingLimit: e.target.value }))} placeholder="Existing" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.proposedChange ?? ''} onChange={e => setForm(f => ({ ...f, proposedChange: e.target.value }))} placeholder="Proposed Δ" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.amount ?? ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value, newLimit: e.target.value }))} placeholder="New Limit *" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.outstandingBalance ?? ''} onChange={e => setForm(f => ({ ...f, outstandingBalance: e.target.value }))} placeholder="O/S Bal" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" type="number" value={form.undisbursedLimit ?? ''} onChange={e => setForm(f => ({ ...f, undisbursedLimit: e.target.value }))} placeholder="Undisbursed" />
      </td>
      <td className="p-2">
        <input className="border rounded px-2 py-1 text-sm w-28" value={form.approvingLevel ?? ''} onChange={e => setForm(f => ({ ...f, approvingLevel: e.target.value }))} placeholder="Approving Lvl" />
      </td>
      <td className="p-2">
        {errors.general && <p className="text-xs text-red-500 mb-1">{errors.general}</p>}
        <button onClick={handleAdd} disabled={saving} className="text-xs bg-green-600 text-white px-2 py-1 rounded">
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-500 px-2 py-1 border rounded ml-1">Cancel</button>
      </td>
    </tr>
  );
};

// ─── Main tab component ───────────────────────────────────────────────────────

const RequestsFacilitiesTab: React.FC<Props> = ({ application, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const appId = application.id;

  const [islamicEnabled, setIslamicEnabled] = useState(false);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [exposure, setExposure] = useState<Partial<ExposureSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showAddFacility, setShowAddFacility] = useState(false);
  const exposureDirty = useRef<Set<keyof ExposureSummary>>(new Set());
  // Also keep a ref to the latest exposure for the autosave saveFn closure
  const exposureRef = useRef<Partial<ExposureSummary>>({});
  // Per-request-item dirty key tracking (for RequestItemCard autosave integration)
  const requestItemDirtyMap = useRef<Map<string, Set<keyof RequestItem>>>(new Map());

  useEffect(() => {
    apiClient.get('/credit/feature-flags/credit:islamic_facilities').then(res => {
      setIslamicEnabled(res.data?.data?.flag?.enabled ?? false);
    }).catch(() => setIslamicEnabled(false));
  }, []);

  const facilityTypeOptions = useMemo(() => getFacilityTypes(islamicEnabled), [islamicEnabled]);
  const facilityTypeLabels = useMemo(() => {
    const base: Record<string, string> = { ...BASE_FACILITY_TYPE_LABELS };
    if (islamicEnabled) Object.assign(base, ISLAMIC_FACILITY_TYPE_LABELS);
    return base;
  }, [islamicEnabled]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [facs, items, exp] = await Promise.all([
        creditService.listFacilities(appId),
        creditService.listRequestItems(appId),
        creditService.getExposureSummary(appId),
      ]);
      setFacilities(facs);
      setRequestItems(items);
      setExposure(exp ?? {});
      exposureRef.current = exp ?? {};
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  // ── Autosave (for Exposure Summary inline edits + Request Item inline edits) ──
  const autosave = useAutosave<ExposureSummary>({
    saveFn: async () => {
      if (readOnly || exposureDirty.current.size === 0) return exposureRef.current as ExposureSummary;
      const saved = await creditService.upsertExposureSummary(appId, exposureRef.current);
      setExposure(saved);
      exposureRef.current = saved;
      exposureDirty.current.clear();
      return saved;
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  // Facility handlers
  const handleFacilitySave = async (id: string, patch: Partial<CreditFacility>) => {
    const updated = await creditService.updateFacility(id, patch);
    setFacilities(fs => fs.map(f => f.id === id ? { ...f, ...updated } : f));
  };

  const handleFacilityDelete = async (id: string) => {
    if (!confirm('Delete this facility?')) return;
    await creditService.deleteFacility(id);
    setFacilities(fs => fs.filter(f => f.id !== id));
  };

  const handleFacilityAdded = (f: CreditFacility) => {
    setFacilities(fs => [...fs, f]);
    setShowAddFacility(false);
  };

  // Exposure handlers
  const updateExposure = (key: keyof ExposureSummary, value: string) => {
    const next = { ...exposure, [key]: value };
    setExposure(next);
    exposureRef.current = next;
    exposureDirty.current.add(key);
    autosave.markDirty();
  };

  // Request item handlers
  const handleAddRequestItem = async () => {
    const created = await creditService.createRequestItem(appId, {
      requestType: 'FACILITY_RENEWAL',
      sortOrder: requestItems.length + 1,
    });
    setRequestItems(items => [...items, created]);
  };

  const handleRequestItemChange = async (id: string, patch: Partial<RequestItem>) => {
    const updated = await creditService.updateRequestItem(appId, id, patch);
    setRequestItems(items => items.map(i => i.id === id ? { ...i, ...updated } : i));
  };

  const handleDeleteRequestItem = async (id: string) => {
    if (!confirm('Delete this request item?')) return;
    await creditService.deleteRequestItem(appId, id);
    setRequestItems(items => items.filter(i => i.id !== id));
  };

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <CaMemoSection title="Facilities" phase="Phase 1" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
      <div className="space-y-8">
      {/* Section 3a — Facilities Table */}
      <section>
        {!readOnly && !showAddFacility && (
          <div className="mb-3">
            <button
              onClick={() => setShowAddFacility(true)}
              className="text-xs text-blue-600 border border-blue-300 px-3 py-1 rounded hover:bg-blue-50"
            >
              + Add Facility
            </button>
          </div>
        )}
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-2 text-left">Facility Type</th>
                <th className="p-2 text-left">Pricing</th>
                <th className="p-2 text-right">Existing (RM)</th>
                <th className="p-2 text-right">Proposed Δ</th>
                <th className="p-2 text-right">New Limit</th>
                <th className="p-2 text-right">O/S Balance</th>
                <th className="p-2 text-right">Undisbursed</th>
                <th className="p-2 text-left">Approving Level</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {facilities.map(f => (
                <FacilityRow
                  key={f.id}
                  facility={f}
                  readOnly={readOnly}
                  facilityTypeOptions={facilityTypeOptions}
                  facilityTypeLabels={facilityTypeLabels}
                  onSave={handleFacilitySave}
                  onDelete={handleFacilityDelete}
                />
              ))}
              {showAddFacility && (
                <AddFacilityForm
                  applicationId={appId}
                  facilityTypeOptions={facilityTypeOptions}
                  facilityTypeLabels={facilityTypeLabels}
                  onAdded={handleFacilityAdded}
                  onCancel={() => setShowAddFacility(false)}
                />
              )}
              {facilities.length === 0 && !showAddFacility && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-400 text-sm">No facilities added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3b — Exposure Summary */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Exposure Summary</h3>
          {autosave.saving && <span className="text-xs text-gray-400">Saving…</span>}
          {!autosave.saving && autosave.savedAt && (
            <span className="text-xs text-green-600">Saved {autosave.savedAt.toLocaleTimeString()}</span>
          )}
          {autosave.error && <span className="text-xs text-red-600">{autosave.error}</span>}
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-2 text-left w-64">Bucket</th>
                <th className="p-2 text-right">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              {EXPOSURE_BUCKETS.map(({ key, label }) => (
                <tr key={key} className="border-t hover:bg-gray-50">
                  <td className="p-2 text-gray-600">{label}</td>
                  <td className="p-2 text-right">
                    {readOnly ? (
                      <span>{fmt(exposure[key] as any)}</span>
                    ) : (
                      <input
                        type="number"
                        className="border rounded px-2 py-1 text-sm w-36 text-right"
                        value={(exposure[key] as any) ?? ''}
                        onChange={e => updateExposure(key, e.target.value)}
                        onBlur={() => autosave.save()}
                        placeholder="0.00"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3c — Request Items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Request Items ({requestItems.length}/4)
          </h3>
          {!readOnly && requestItems.length < 4 && (
            <button
              onClick={handleAddRequestItem}
              className="text-xs text-blue-600 border border-blue-300 px-3 py-1 rounded hover:bg-blue-50"
            >
              + Add Request
            </button>
          )}
        </div>
        {requestItems.length === 0 ? (
          <p className="text-sm text-gray-400">No request items added yet.</p>
        ) : (
          <div className="space-y-3">
            {requestItems.map((item, idx) => (
              <RequestItemCard
                key={item.id}
                item={item}
                index={idx}
                readOnly={readOnly}
                onChange={handleRequestItemChange}
                onDelete={handleDeleteRequestItem}
                autosave={autosave}
                dirtyKeys={(() => { if (!requestItemDirtyMap.current.has(item.id)) requestItemDirtyMap.current.set(item.id, new Set()); return requestItemDirtyMap.current.get(item.id)!; })()}
              />
            ))}
          </div>
        )}
      </section>
      </div>
    </CaMemoSection>
  );
};

// ─── Request item card ────────────────────────────────────────────────────────

type RequestItemCardProps = {
  item: RequestItem;
  index: number;
  readOnly: boolean;
  onChange: (id: string, patch: Partial<RequestItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const RequestItemCard: React.FC<RequestItemCardProps & { autosave: ReturnType<typeof useAutosave>; dirtyKeys: Set<keyof RequestItem> }> = ({ item, index, readOnly, onChange, onDelete, autosave, dirtyKeys }) => {
  const [local, setLocal] = useState(item);

  useEffect(() => { setLocal(item); }, [item.id, item.updatedAt]);

  const update = <K extends keyof RequestItem>(key: K, value: RequestItem[K]) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    dirtyKeys.add(key);
    autosave.markDirty();
  };

  const flush = async () => {
    if (dirtyKeys.size === 0) return;
    const patch: Partial<RequestItem> = {};
    dirtyKeys.forEach(k => { (patch as any)[k] = (local as any)[k]; });
    await onChange(item.id, patch);
    dirtyKeys.clear();
    // Clear autosave dirty since request item saves go through a different API
    autosave.clearDirty();
  };

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase">Request {index + 1}</span>
        <div className="flex items-center gap-2">
          {autosave.saving && <span className="text-xs text-gray-400">Saving…</span>}
          {!readOnly && (
            <button onClick={() => onDelete(item.id)} className="text-xs text-red-400 hover:underline">Remove</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Request Type</label>
          {readOnly ? (
            <span className="text-sm">{CA_REQUEST_TYPE_LABELS[local.requestType]}</span>
          ) : (
            <select
              className="border rounded px-2 py-1 text-sm w-full"
              value={local.requestType}
              onChange={e => update('requestType', e.target.value as CaRequestType)}
              onBlur={flush}
            >
              {CA_REQUEST_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{CA_REQUEST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Approving Level</label>
          {readOnly ? (
            <span className="text-sm">{local.approvingLevel ?? '—'}</span>
          ) : (
            <input
              className="border rounded px-2 py-1 text-sm w-full"
              value={local.approvingLevel ?? ''}
              onChange={e => update('approvingLevel', e.target.value)}
              onBlur={flush}
              placeholder="e.g. Credit Committee"
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Rationale</label>
        {readOnly ? (
          <p className="text-sm whitespace-pre-wrap">{local.rationale ?? '—'}</p>
        ) : (
          <textarea
            className="border rounded px-2 py-1 text-sm w-full h-20 resize-none"
            value={local.rationale ?? ''}
            onChange={e => update('rationale', e.target.value)}
            onBlur={flush}
            placeholder="Describe the rationale for this request…"
          />
        )}
      </div>
    </div>
  );
};

export default RequestsFacilitiesTab;