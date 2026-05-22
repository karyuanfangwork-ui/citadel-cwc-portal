import React, { useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  KeyCounterparty,
  CounterpartyRole,
  keyCounterpartyApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const ROLE_SECTIONS: { role: CounterpartyRole; label: string; max: number }[] = [
  { role: 'SUPPLIER',   label: 'Key Suppliers',   max: 3 },
  { role: 'BUYER',      label: 'Key Buyers',       max: 3 },
  { role: 'COMPETITOR', label: 'Main Competitors', max: 5 },
];

const empty = (role: CounterpartyRole): Partial<KeyCounterparty> => ({ role, name: '', sortOrder: 0 });

// ─── Counterparty Row ─────────────────────────────────────────────────────────

type AutosaveLike = {
  save: () => Promise<unknown>;
  saving: boolean;
  savedAt: Date | null;
  dirty: boolean;
  error: string | null;
  markDirty: () => void;
  clearDirty: () => void;
  clearError: () => void;
};

type CounterpartyRefs = {
  pendingUpdatesRef: React.MutableRefObject<Map<string, KeyCounterparty>>;
};

const CounterpartyRow: React.FC<{
  profileId: string;
  item: KeyCounterparty;
  readOnly: boolean;
  autosave: AutosaveLike;
  refs: CounterpartyRefs;
  onSaved: (updated: KeyCounterparty) => void;
  onRemoved: () => void;
}> = ({ profileId, item, readOnly, autosave, refs, onSaved, onRemoved }) => {
  const { pendingUpdatesRef } = refs;
  const [form, setForm] = useState<KeyCounterparty>({ ...item });

  const update = (key: keyof KeyCounterparty, value: any) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      // Track pending update for autosave
      pendingUpdatesRef.current.set(next.id, next);
      return next;
    });
    autosave.markDirty();
  };

  const handleRemove = async () => {
    await keyCounterpartyApi.remove(form.id);
    onRemoved();
  };

  if (readOnly) {
    return (
      <div className="border rounded p-3 text-sm space-y-1">
        <p className="font-medium">{form.name}</p>
        {form.address && <p className="text-gray-500 text-xs">{form.address}</p>}
        <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
          {form.telephone && <span>Tel: {form.telephone}</span>}
          {form.yearsOfRelationship != null && <span>{form.yearsOfRelationship}y relationship</span>}
          {form.creditTermsDays != null && <span>{form.creditTermsDays}d credit terms</span>}
          {form.salesOrPurchasePct != null && <span>{form.salesOrPurchasePct}% sales/purch</span>}
          {form.modeOfPayment && <span>Payment: {form.modeOfPayment}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded p-3 space-y-2 relative">
      {autosave.saving && <span className="absolute top-2 right-8 text-xs text-gray-400">Saving…</span>}
      <button onClick={handleRemove} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs">✕</button>
      <input className="border rounded px-2 py-1 text-sm w-full" placeholder="Name *" value={form.name} onChange={e => update('name', e.target.value)} onBlur={() => autosave.save()} />
      <textarea className="border rounded px-2 py-1 text-sm w-full resize-none h-14" placeholder="Address" value={form.address ?? ''} onChange={e => update('address', e.target.value)} onBlur={() => autosave.save()} />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1 text-sm" placeholder="Telephone" value={form.telephone ?? ''} onChange={e => update('telephone', e.target.value)} onBlur={() => autosave.save()} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Years of relationship" value={form.yearsOfRelationship ?? ''} onChange={e => update('yearsOfRelationship', e.target.value ? Number(e.target.value) : null)} onBlur={() => autosave.save()} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Credit terms (days)" value={form.creditTermsDays ?? ''} onChange={e => update('creditTermsDays', e.target.value ? Number(e.target.value) : null)} onBlur={() => autosave.save()} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Sales/Purchase %" value={form.salesOrPurchasePct ?? ''} onChange={e => update('salesOrPurchasePct', e.target.value)} onBlur={() => autosave.save()} />
        <input className="border rounded px-2 py-1 text-sm col-span-2" placeholder="Mode of payment" value={form.modeOfPayment ?? ''} onChange={e => update('modeOfPayment', e.target.value)} onBlur={() => autosave.save()} />
      </div>
    </div>
  );
};

// ─── Add Form ─────────────────────────────────────────────────────────────────

const AddForm: React.FC<{
  profileId: string;
  role: CounterpartyRole;
  onAdded: (item: KeyCounterparty) => void;
  onMarkDirty: () => void;
}> = ({ profileId, role, onAdded, onMarkDirty }) => {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const created = await keyCounterpartyApi.create(profileId, { role, name: name.trim() });
      onAdded(created);
      onMarkDirty();
      setName('');
    } finally { setAdding(false); }
  };

  return (
    <div className="flex gap-2 mt-2">
      <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
      <button onClick={handleAdd} disabled={adding} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {adding ? '…' : 'Add'}
      </button>
    </div>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const CounterpartiesTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const profileId = application.borrowerProfileId;
  const [all, setAll] = useState<KeyCounterparty[]>([]);

  // Pending updates ref — tracks which counterparties have unsaved inline edits
  const pendingUpdatesRef = useRef<Map<string, KeyCounterparty>>(new Map());

  // ── Autosave (for inline counterparty edits) ─────────────────────────────
  const autosave = useAutosave<void>({
    saveFn: async () => {
      if (readOnly || pendingUpdatesRef.current.size === 0) return;
      for (const [id, form] of pendingUpdatesRef.current) {
        const saved = await keyCounterpartyApi.update(id, form);
        // Update local state with saved data
        setAll(a => a.map(c => c.id === id ? saved : c));
      }
      pendingUpdatesRef.current.clear();
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  useEffect(() => {
    keyCounterpartyApi.list(profileId).then(setAll).catch(() => {});
  }, [profileId]);

  const byRole = (role: CounterpartyRole) => all.filter(c => c.role === role);

  const handleSaved = (updated: KeyCounterparty) =>
    setAll(a => a.map(c => c.id === updated.id ? updated : c));

  const handleRemoved = (id: string) => {
    setAll(a => a.filter(c => c.id !== id));
    // Also remove from pending if it was there
    pendingUpdatesRef.current.delete(id);
    autosave.markDirty();
  };

  return (
    <CaMemoSection title="Key Counterparties" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
      <div className="space-y-8">
        {ROLE_SECTIONS.map(({ role, label, max }) => (
          <section key={role}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{label}</h3>
            <div className="space-y-3">
              {byRole(role).map(item => (
                <CounterpartyRow
                  key={item.id}
                  profileId={profileId}
                  item={item}
                  readOnly={readOnly}
                  autosave={autosave}
                  refs={{ pendingUpdatesRef }}
                  onSaved={handleSaved}
                  onRemoved={() => handleRemoved(item.id)}
                />
              ))}
            </div>
            {!readOnly && byRole(role).length < max && (
              <AddForm profileId={profileId} role={role} onAdded={item => setAll(a => [...a, item])} onMarkDirty={() => autosave.markDirty()} />
            )}
            {byRole(role).length === 0 && readOnly && (
              <p className="text-sm text-gray-400 italic">None recorded.</p>
            )}
          </section>
        ))}
      </div>
    </CaMemoSection>
  );
};

export default CounterpartiesTab;