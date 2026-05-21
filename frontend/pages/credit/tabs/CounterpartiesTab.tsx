import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  KeyCounterparty,
  CounterpartyRole,
  keyCounterpartyApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

const ROLE_SECTIONS: { role: CounterpartyRole; label: string; max: number }[] = [
  { role: 'SUPPLIER',   label: 'Key Suppliers',   max: 3 },
  { role: 'BUYER',      label: 'Key Buyers',       max: 3 },
  { role: 'COMPETITOR', label: 'Main Competitors', max: 5 },
];

const empty = (role: CounterpartyRole): Partial<KeyCounterparty> => ({ role, name: '', sortOrder: 0 });

// ─── Counterparty Row ─────────────────────────────────────────────────────────

const CounterpartyRow: React.FC<{
  profileId: string;
  item: KeyCounterparty;
  readOnly: boolean;
  onSaved: (updated: KeyCounterparty) => void;
  onRemoved: () => void;
}> = ({ profileId, item, readOnly, onSaved, onRemoved }) => {
  const [form, setForm] = useState<KeyCounterparty>({ ...item });
  const [saving, setSaving] = useState(false);

  const update = (key: keyof KeyCounterparty, value: any) => setForm(f => ({ ...f, [key]: value }));

  const flush = async () => {
    setSaving(true);
    try {
      const saved = await keyCounterpartyApi.update(form.id, form);
      onSaved(saved);
    } finally { setSaving(false); }
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
      {saving && <span className="absolute top-2 right-8 text-xs text-gray-400">Saving…</span>}
      <button onClick={handleRemove} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs">✕</button>
      <input className="border rounded px-2 py-1 text-sm w-full" placeholder="Name *" value={form.name} onChange={e => update('name', e.target.value)} onBlur={flush} />
      <textarea className="border rounded px-2 py-1 text-sm w-full resize-none h-14" placeholder="Address" value={form.address ?? ''} onChange={e => update('address', e.target.value)} onBlur={flush} />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1 text-sm" placeholder="Telephone" value={form.telephone ?? ''} onChange={e => update('telephone', e.target.value)} onBlur={flush} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Years of relationship" value={form.yearsOfRelationship ?? ''} onChange={e => update('yearsOfRelationship', e.target.value ? Number(e.target.value) : null)} onBlur={flush} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Credit terms (days)" value={form.creditTermsDays ?? ''} onChange={e => update('creditTermsDays', e.target.value ? Number(e.target.value) : null)} onBlur={flush} />
        <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Sales/Purchase %" value={form.salesOrPurchasePct ?? ''} onChange={e => update('salesOrPurchasePct', e.target.value)} onBlur={flush} />
        <input className="border rounded px-2 py-1 text-sm col-span-2" placeholder="Mode of payment" value={form.modeOfPayment ?? ''} onChange={e => update('modeOfPayment', e.target.value)} onBlur={flush} />
      </div>
    </div>
  );
};

// ─── Add Form ─────────────────────────────────────────────────────────────────

const AddForm: React.FC<{
  profileId: string;
  role: CounterpartyRole;
  onAdded: (item: KeyCounterparty) => void;
}> = ({ profileId, role, onAdded }) => {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const created = await keyCounterpartyApi.create(profileId, { role, name: name.trim() });
      onAdded(created);
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

const CounterpartiesTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const profileId = application.borrowerProfileId;
  const [all, setAll] = useState<KeyCounterparty[]>([]);

  useEffect(() => {
    keyCounterpartyApi.list(profileId).then(setAll).catch(() => {});
  }, [profileId]);

  const byRole = (role: CounterpartyRole) => all.filter(c => c.role === role);

  const handleSaved = (updated: KeyCounterparty) =>
    setAll(a => a.map(c => c.id === updated.id ? updated : c));

  const handleRemoved = (id: string) => setAll(a => a.filter(c => c.id !== id));

  return (
    <CaMemoSection title="Key Counterparties" readOnly={readOnly}>
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
                  onSaved={handleSaved}
                  onRemoved={() => handleRemoved(item.id)}
                />
              ))}
            </div>
            {!readOnly && byRole(role).length < max && (
              <AddForm profileId={profileId} role={role} onAdded={item => setAll(a => [...a, item])} />
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
